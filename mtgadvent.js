// MTG Draft Advent Calendar: date logic and page behavior.
// The date logic at the top is pure so it can be tested in Node (see tools/ for the data refresher).
(function () {
    'use strict';

    const DRAFTS = 5; // four Advent Sundays plus Christmas Day
    const DECEMBER = 11;
    const MS_PER_DAY = 86400000;

    function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    // The day each draft unlocks: the four Advent Sundays (the fourth is the last Sunday before
    // Christmas, so the first can fall in late November), then Christmas Day itself.
    function unlockDates(year) {
        const christmas = new Date(year, DECEMBER, 25);
        const fourth = 25 - (christmas.getDay() || 7);
        const dates = [21, 14, 7, 0].map(back => new Date(year, DECEMBER, fourth - back));
        dates.push(christmas);
        return dates;
    }

    // Where "now" falls in the Advent of `year`.
    //   before: before the first Advent Sunday; nothing is unlocked
    //   active: `current` is the newest unlocked draft (1-5); `daysUntil` counts to the next one
    //   after:  Dec 26 onward; the calendar is done for the year
    function seasonOf(now, year) {
        const dates = unlockDates(year);
        const closes = new Date(year, DECEMBER, 26);
        const daysTo = d => Math.round((d - startOfDay(now)) / MS_PER_DAY);
        if (now < dates[0]) return { phase: 'before', current: 0, dates, daysUntil: daysTo(dates[0]) };
        if (now >= closes) return { phase: 'after', current: DRAFTS + 1, dates, daysUntil: 0 };
        const current = dates.filter(d => now >= d).length;
        return { phase: 'active', current, dates, daysUntil: current < DRAFTS ? daysTo(dates[current]) : 0 };
    }

    // current: the draft that can be opened now. past: earlier drafts.
    // next: the single locked door that gets a teaser. locked: everything after that.
    function doorState(n, season) {
        if (season.phase === 'before') return n === 1 ? 'next' : 'locked';
        if (season.phase === 'after') return 'past';
        if (n < season.current) return 'past';
        if (n === season.current) return 'current';
        if (n === season.current + 1) return 'next';
        return 'locked';
    }

    function msUntilNextMidnight(now) {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    }

    const logic = { unlockDates, seasonOf, doorState, msUntilNextMidnight, DRAFTS };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = logic;
        return;
    }

    // ---- Page behavior (browser only) ----

    // The five Magic colors in WUBRG order. Each one is a wreath candle and a door leaf color.
    // Candles, one per draft, placed around the ring like the color pie seen from above:
    // white at the back, then clockwise blue, black, red, green. x/y is where the candle stands on the ring.
    const CANDLES = [
        { color: '#f4efd6', edge: '#b9b294', x: 120, y: 80, top: '#f1e9c9', bot: '#bfb185', rim: 'rgba(255,248,220,0.8)', light: true }, // W
        { color: '#1f6fb5', edge: '#5aa3e0', x: 196, y: 94, top: '#2c7cc4', bot: '#0d3a6b', rim: 'rgba(120,180,240,0.6)' },  // U
        { color: '#24201c', edge: '#7a6e64', x: 167, y: 116, top: '#3d3630', bot: '#14110e', rim: 'rgba(160,148,136,0.5)' }, // B
        { color: '#d3202a', edge: '#f06a5f', x: 73, y: 116, top: '#cc3440', bot: '#721018', rim: 'rgba(250,140,130,0.55)' }, // R
        { color: '#00733e', edge: '#3fae72', x: 44, y: 94, top: '#178a52', bot: '#063f26', rim: 'rgba(110,210,150,0.55)' }   // G
    ];
    // Door n has the allied pair that starts with candle n: WU, UB, BR, RG, and GW for Christmas.
    function paintLeaf(leaf, c) {
        leaf.style.setProperty('--top', c.top);
        leaf.style.setProperty('--bot', c.bot);
        leaf.style.setProperty('--rim', c.rim);
        if (c.light) leaf.classList.add('light');
    }
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const MYSTERY_ICON = 'https://svgs.scryfall.io/sets/mb2.svg'; // Mystery Booster symbol stands in for the hidden set
    const BELL_URL = 'christmas-bells-02-439604.mp3';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const grid = document.getElementById('calendar');
    const statusEl = document.getElementById('status');
    const yearEl = document.getElementById('year');
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');

    let data = null;
    let currentSeason = null;
    let midnightTimer = null;

    // Test mode: mtgadvent.html?date=2026-12-07 (or 2026-12-07T09:30) pretends it is that moment.
    // Time keeps moving from there. Opened doors are stored separately so tests never touch real state.
    const dateParam = new URLSearchParams(location.search).get('date');
    let testTarget = null;
    if (dateParam) {
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(dateParam + 'T12:00:00') : new Date(dateParam);
        if (!isNaN(parsed)) testTarget = parsed;
    }
    let testOffset = testTarget ? testTarget - Date.now() : 0;
    const testMode = testTarget !== null || dateParam !== null;
    function currentNow() { return new Date(Date.now() + testOffset); }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function svg(markup, className) {
        const s = document.createElementNS(SVG_NS, 'svg');
        s.setAttribute('viewBox', '0 0 24 24');
        s.setAttribute('aria-hidden', 'true');
        if (className) s.setAttribute('class', className);
        s.innerHTML = markup;
        return s;
    }

    const lockSvg = cls => svg('<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/>' +
        '<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/>', cls);
    const checkSvg = cls => svg('<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', cls);
    const closeSvg = cls => svg('<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>', cls);
    const starSvg = cls => svg('<path d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z" fill="currentColor"/>', cls);

    const isChristmas = n => n === DRAFTS;
    const shortDate = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const longDate = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    // "Week 2" or "Christmas Day", for headings and labels.
    const draftName = n => isChristmas(n) ? 'Christmas Day' : 'Week ' + n;

    // The Advent wreath in the header: five candles in WUBRG order around the ring, the green one for Christmas.
    // A candle is lit once its draft has unlocked. Drawn once per render, no animation.
    function drawWreath(season) {
        const lit = n => season.phase === 'after' || (season.phase === 'active' && season.current >= n);
        const candle = n => {
            const c = CANDLES[n - 1];
            const x = c.x, base = c.y, h = 44;
            let s = '<rect x="' + (x - 7) + '" y="' + (base - h) + '" width="14" height="' + h + '" rx="2" fill="' + c.color +
                '" stroke="' + c.edge + '" stroke-width="1"/>' +
                '<rect x="' + (x - 7) + '" y="' + (base - h) + '" width="4" height="' + h + '" rx="2" fill="#fff" opacity="0.18"/>' +
                '<path d="M' + x + ' ' + (base - h) + 'v-5" stroke="#2a1d10" stroke-width="1.5"/>';
            if (lit(n)) {
                const t = base - h - 5;
                s += '<circle cx="' + x + '" cy="' + (t - 6) + '" r="13" fill="#ffd700" opacity="0.16"/>' +
                    '<path d="M' + x + ' ' + (t - 17) + 'c6 7 6 13 0 17c-6-4-6-10 0-17z" fill="#ffc93c"/>' +
                    '<path d="M' + x + ' ' + (t - 9) + 'c3 4 3 7 0 9c-3-2-3-5 0-9z" fill="#fff3b0"/>';
            }
            return s;
        };
        const berries = [[52, 104], [96, 113], [148, 113], [190, 104], [72, 86], [170, 86], [120, 82]]
            .map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="#c8323c"/>').join('');
        // Back candles (W, U, G) are drawn before the ring, front ones (B, R) after it.
        const back = candle(1) + candle(2) + candle(5);
        const ring = '<ellipse cx="120" cy="98" rx="92" ry="20" fill="none" stroke="#1f4d2b" stroke-width="16"/>' +
            '<ellipse cx="120" cy="98" rx="92" ry="20" fill="none" stroke="#3f8a4c" stroke-width="7" stroke-dasharray="9 7"/>' + berries;
        const front = candle(3) + candle(4);
        const count = [1, 2, 3, 4, 5].filter(lit).length;
        const wreath = document.getElementById('wreath');
        wreath.innerHTML = back + ring + front;
        wreath.setAttribute('aria-label', 'Advent wreath with ' + count + ' of 5 candles lit');
    }

    // Opened state is only a per-device convenience; the page works without it.
    // Its own key, so the old daily calendar's opened days don't carry over.
    function storageKey() { return 'mtgadvent-' + data.year + '-weekly' + (testMode ? '-test' : '') + '-opened'; }
    function getOpened() {
        try { return JSON.parse(localStorage.getItem(storageKey())) || []; } catch (e) { return []; }
    }
    function markOpened(day) {
        try {
            const opened = getOpened();
            if (!opened.includes(day)) {
                opened.push(day);
                localStorage.setItem(storageKey(), JSON.stringify(opened));
            }
        } catch (e) { /* ignore */ }
    }

    function setsOf(entry) { return entry.sets.map(code => data.sets[code]); }

    // Load card art only when its door scrolls near the viewport
    const artObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            e.target.style.backgroundImage = 'url("' + e.target.dataset.art + '")';
            artObserver.unobserve(e.target);
        });
    }, { rootMargin: '200px' }) : null;
    function lazyArt(piece) {
        if (artObserver) artObserver.observe(piece);
        else piece.style.backgroundImage = 'url("' + piece.dataset.art + '")';
    }

    function buildInside(entry) {
        const sets = setsOf(entry);
        const inside = el('span', 'inside');
        const art = el('span', 'art');
        sets.forEach((set, i) => {
            const piece = el('span', 'art-piece ' + (sets.length === 1 ? 'solo' : i === 0 ? 'a' : 'b'));
            if (set.art) { piece.dataset.art = set.art; lazyArt(piece); }
            art.appendChild(piece);
        });
        inside.appendChild(art);
        const icons = el('span', 'icons');
        sets.forEach(set => {
            const img = el('img');
            img.src = set.icon;
            img.alt = '';
            img.loading = 'lazy';
            icons.appendChild(img);
        });
        inside.appendChild(icons);
        const text = el('span', 'door-text');
        text.appendChild(el('span', 'door-title', entry.title));
        text.appendChild(el('span', 'door-date', draftName(entry.day)));
        inside.appendChild(text);
        return inside;
    }

    function buildDoor(entry, state, season, wasOpened) {
        const n = entry.day;
        const door = el('button', 'door state-' + state + (isChristmas(n) ? ' xmas' : ''));
        door.type = 'button';
        door.dataset.day = n;
        const date = season.dates[n - 1];

        const frame = el('span', 'frame');
        const unlocked = state === 'current' || state === 'past';
        if (unlocked) frame.appendChild(buildInside(entry));
        const leafL = el('span', 'leaf leaf-l');
        const leafR = el('span', 'leaf leaf-r');
        paintLeaf(leafL, CANDLES[n - 1]);
        paintLeaf(leafR, CANDLES[n % CANDLES.length]);
        if (unlocked || state === 'next') {
            // Set symbols sit on the closed doors: one per leaf (a single set repeats).
            // The next door shows only the first set; the second leaf keeps its secret.
            const sets = setsOf(entry);
            const second = state === 'next' ? { icon: MYSTERY_ICON } : (sets[1] || sets[0]);
            [[leafL, sets[0]], [leafR, second]].forEach(([leaf, set]) => {
                const img = el('img', 'leaf-icon');
                img.src = set.icon;
                img.alt = '';
                leaf.appendChild(img);
            });
        }
        frame.appendChild(leafL);
        frame.appendChild(leafR);
        // Closed door: the week number (a star for Christmas) and the date it unlocks.
        const num = el('span', 'num');
        if (isChristmas(n)) num.appendChild(starSvg('star'));
        else num.textContent = String(n);
        frame.appendChild(num);
        frame.appendChild(el('span', 'when', shortDate(date)));
        if (state === 'locked' || state === 'next') frame.appendChild(lockSvg('lock'));

        const done = state === 'current' && wasOpened;
        if (unlocked) {
            if (done) {
                door.classList.add('open');
                frame.appendChild(checkSvg('check'));
            }
            door.setAttribute('aria-label', draftName(n) + ': ' + entry.title +
                (state === 'current' && !wasOpened ? ', open this draft' : ', view details'));
        } else {
            door.disabled = true;
            door.setAttribute('aria-label', draftName(n) + ', locked, unlocks ' + longDate(date));
        }

        door.appendChild(frame);
        if (unlocked) door.addEventListener('click', e => onDoorClick(entry, door, state, e));
        return door;
    }

    function sparkle(x, y) {
        return; // sparkles removed for performance
        for (let i = 0; i < 10; i++) {
            const dot = el('span', 'spark');
            dot.style.left = x + 'px';
            dot.style.top = y + 'px';
            document.body.appendChild(dot);
            const angle = (i / 10) * Math.PI * 2;
            const dist = 40 + Math.random() * 40;
            const anim = dot.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: 'translate(calc(-50% + ' + Math.cos(angle) * dist + 'px), calc(-50% + ' + Math.sin(angle) * dist + 'px)) scale(0)', opacity: 0 }
            ], { duration: 750, easing: 'ease-out' });
            anim.onfinish = () => dot.remove();
        }
    }

    function ring() {
        try {
            const bell = new Audio(BELL_URL);
            bell.volume = 0.3;
            bell.play().catch(() => {});
        } catch (e) { /* ignore */ }
    }

    function onDoorClick(entry, door, state, e) {
        if (state === 'current' && !door.classList.contains('open')) {
            door.classList.add('open');
            door.querySelector('.frame').appendChild(checkSvg('check'));
            door.setAttribute('aria-label', draftName(entry.day) + ': ' + entry.title + ', view details');
            markOpened(entry.day);
            statusEl.textContent = statusText(currentSeason, true);
            const rect = door.getBoundingClientRect();
            sparkle(rect.left + rect.width / 2, rect.top + rect.height / 2);
            ring();
            setTimeout(() => showDetails(entry, door), reduceMotion ? 0 : 700);
        } else if (!door.classList.contains('open')) {
            // Earlier days stay shut; swing open to peek, then close again with the dialog.
            door.classList.add('open');
            door.dataset.reclose = '1';
            setTimeout(() => showDetails(entry, door), reduceMotion ? 0 : 500);
        } else {
            showDetails(entry, door);
        }
    }

    let lastDoor = null;
    function showDetails(entry, door) {
        lastDoor = door;
        modalBody.textContent = '';
        modalBody.appendChild(el('p', 'modal-day', draftName(entry.day) + ' · ' + longDate(currentSeason.dates[entry.day - 1])));
        const title = el('h2', 'modal-title', entry.title);
        title.id = 'modalTitle';
        modalBody.appendChild(title);
        modalBody.appendChild(el('p', 'modal-desc', entry.description));

        const list = el('div', 'modal-sets');
        entry.sets.forEach(code => {
            const set = data.sets[code];
            const card = el('div', 'set-card');
            const banner = el('div', 'set-art');
            if (set.art) banner.style.backgroundImage = 'url("' + set.art + '")';
            card.appendChild(banner);
            const head = el('div', 'set-head');
            const icon = el('img');
            icon.src = set.icon;
            icon.alt = '';
            head.appendChild(icon);
            head.appendChild(el('span', 'set-name', set.name));
            card.appendChild(head);
            card.appendChild(el('p', 'set-blurb', set.blurb));
            if (set.artCard) card.appendChild(el('p', 'set-credit', 'Art: ' + set.artCard + (set.artist ? ' by ' + set.artist : '')));
            list.appendChild(card);
        });
        modalBody.appendChild(list);
        if (!modal.open) modal.showModal();
    }

    function closeModal() {
        if (modal.open) modal.close();
    }
    modal.addEventListener('close', () => {
        if (!lastDoor) return;
        if (lastDoor.dataset.reclose) {
            lastDoor.classList.remove('open');
            delete lastDoor.dataset.reclose;
        }
        lastDoor.focus();
    });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.getElementById('modalClose').appendChild(closeSvg());
    document.getElementById('modalClose').addEventListener('click', closeModal);

    // "in 3 days", "tomorrow" or "today", for the countdown to the next unlock.
    function inDays(n) { return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }

    function statusText(season, currentOpened) {
        if (season.phase === 'before') {
            return 'The first draft opens ' + longDate(season.dates[0]) + ', ' + inDays(season.daysUntil) + '.';
        }
        if (season.phase === 'after') return 'The ' + data.year + ' calendar has finished. See you next Advent.';
        if (isChristmas(season.current)) {
            return currentOpened ? 'Merry Christmas! That was the last door.' : 'Merry Christmas! The Christmas draft is ready to open.';
        }
        const next = isChristmas(season.current + 1) ? 'The Christmas draft' : 'Next draft';
        return 'Week ' + season.current + ' of 4: ' + (currentOpened ? 'this week’s draft is open. ' : 'this week’s draft is ready to open. ') +
            next + ' ' + longDate(season.dates[season.current]) + ', ' + inDays(season.daysUntil) + '.';
    }

    const testbar = document.getElementById('testbar');
    const testLabel = document.getElementById('testLabel');

    function shiftTestDay(days) {
        const base = currentNow();
        const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, 12, 0, 0);
        testOffset = next - Date.now();
        const iso = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
        history.replaceState(null, '', '?date=' + iso);
        render();
    }

    function setupTestBar() {
        testbar.hidden = false;
        document.getElementById('testPrevWeek').addEventListener('click', () => shiftTestDay(-7));
        document.getElementById('testPrev').addEventListener('click', () => shiftTestDay(-1));
        document.getElementById('testNext').addEventListener('click', () => shiftTestDay(1));
        document.getElementById('testNextWeek').addEventListener('click', () => shiftTestDay(7));
        document.getElementById('testReset').addEventListener('click', () => {
            try { localStorage.removeItem(storageKey()); } catch (e) { /* ignore */ }
            render();
        });
        document.getElementById('testExit').href = location.pathname;
    }

    function render() {
        const now = currentNow();
        if (testMode) {
            testLabel.textContent = testTarget
                ? 'TEST MODE: pretending it is ' + now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : '';
        }
        const season = seasonOf(now, data.year);
        currentSeason = season;
        const opened = getOpened();
        grid.textContent = '';
        drawWreath(season);

        if (season.phase === 'after') {
            statusEl.textContent = statusText(season, false);
            grid.hidden = true;
        } else {
            grid.hidden = false;
            data.days.forEach(entry => {
                const state = doorState(entry.day, season);
                grid.appendChild(buildDoor(entry, state, season, opened.includes(entry.day)));
            });
            statusEl.textContent = statusText(season, opened.includes(season.current));
        }

        // Unlock the next door if the tab is left open past midnight.
        clearTimeout(midnightTimer);
        midnightTimer = setTimeout(render, msUntilNextMidnight(now) + 1000);
    }

    function makeSnow() {
        return; // snow removed for performance
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 36; i++) {
            const flake = el('span', 'snowflake');
            const size = 3 + Math.random() * 5;
            flake.style.left = Math.random() * 100 + '%';
            flake.style.width = flake.style.height = size + 'px';
            flake.style.opacity = 0.35 + Math.random() * 0.5;
            flake.style.animationDuration = 9 + Math.random() * 9 + 's';
            flake.style.animationDelay = -Math.random() * 18 + 's';
            flake.style.setProperty('--sway', (Math.random() * 60 - 30) + 'px');
            frag.appendChild(flake);
        }
        document.getElementById('snow').appendChild(frag);
    }

    async function init() {
        makeSnow();
        try {
            if (window.MTGADVENT_DATA) {
                data = window.MTGADVENT_DATA;
            } else {
                const res = await fetch('draftsets.json');
                if (!res.ok) throw new Error(res.status);
                data = await res.json();
            }
        } catch (e) {
            statusEl.textContent = 'Could not load the calendar data (draftsets.json). If you opened this file directly, serve the folder over http instead.';
            return;
        }
        yearEl.textContent = data.year;
        document.title = 'MTG Draft Advent Calendar ' + data.year;
        if (testMode) {
            if (!testTarget) testOffset = 0; // unreadable ?date= value: fall back to the real date
            setupTestBar();
        }
        render();
        if (testMode && !testTarget) testLabel.textContent = 'TEST MODE: could not read "' + dateParam + '". Use ?date=YYYY-MM-DD. Showing the real date.';
    }

    init();
})();
