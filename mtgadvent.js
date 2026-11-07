// MTG Draft Advent Calendar: date logic and page behavior.
// The date logic at the top is pure so it can be tested in Node (see tools/ for the data refresher).
(function () {
    'use strict';

    const LAST_DAY = 25;
    const DECEMBER = 11;
    const MS_PER_DAY = 86400000;

    function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    // Where "now" falls relative to the December of `year`.
    //   before: not December yet; nothing is unlocked
    //   active: Dec 1-25; `today` is the day number that is unlocked
    //   after:  Dec 26 onward; the calendar is done for the year
    function seasonOf(now, year) {
        const opens = new Date(year, DECEMBER, 1);
        const closes = new Date(year, DECEMBER, LAST_DAY + 1);
        if (now < opens) {
            return { phase: 'before', today: 0, daysUntil: Math.round((opens - startOfDay(now)) / MS_PER_DAY) };
        }
        if (now >= closes) return { phase: 'after', today: LAST_DAY + 1, daysUntil: 0 };
        return { phase: 'active', today: now.getDate(), daysUntil: 0 };
    }

    // today: the door that can be opened now. past: earlier days (already done).
    // next: the single locked door that gets a teaser. locked: everything after that.
    function doorState(day, season) {
        if (season.phase === 'before') return day === 1 ? 'next' : 'locked';
        if (season.phase === 'after') return 'past';
        if (day < season.today) return 'past';
        if (day === season.today) return 'today';
        if (day === season.today + 1) return 'next';
        return 'locked';
    }

    function msUntilNextMidnight(now) {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    }

    const logic = { seasonOf, doorState, msUntilNextMidnight, LAST_DAY };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = logic;
        return;
    }

    // ---- Page behavior (browser only) ----

    const HUES = [352, 150, 42, 205, 285]; // red, green, gold, blue, purple doors
    const SVG_NS = 'http://www.w3.org/2000/svg';
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

    // Opened state is only a per-device convenience; the page works without it.
    function storageKey() { return 'mtgadvent-' + data.year + (testMode ? '-test' : '') + '-opened'; }
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

    function buildInside(entry) {
        const sets = setsOf(entry);
        const inside = el('span', 'inside');
        const art = el('span', 'art');
        sets.forEach((set, i) => {
            const piece = el('span', 'art-piece ' + (sets.length === 1 ? 'solo' : i === 0 ? 'a' : 'b'));
            if (set.art) piece.style.backgroundImage = 'url("' + set.art + '")';
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
        inside.appendChild(el('span', 'door-title', entry.title));
        return inside;
    }

    function buildDoor(entry, state, season, wasOpened) {
        const door = el('button', 'door state-' + state);
        door.type = 'button';
        door.style.setProperty('--hue', HUES[(entry.day - 1) % HUES.length]);
        door.dataset.day = entry.day;

        const frame = el('span', 'frame');
        const unlocked = state === 'today' || state === 'past';
        if (unlocked) frame.appendChild(buildInside(entry));
        frame.appendChild(el('span', 'leaf leaf-l'));
        frame.appendChild(el('span', 'leaf leaf-r'));
        frame.appendChild(el('span', 'num', String(entry.day)));

        if (state === 'next') {
            const icons = el('span', 'teaser');
            setsOf(entry).forEach(set => {
                const img = el('img');
                img.src = set.icon;
                img.alt = '';
                icons.appendChild(img);
            });
            frame.appendChild(icons);
            frame.appendChild(el('span', 'when', season.phase === 'before' ? 'Dec 1' : 'Tomorrow'));
        }
        if (state === 'locked' || state === 'next') frame.appendChild(lockSvg('lock'));

        const done = state === 'past' || (state === 'today' && wasOpened);
        if (unlocked) {
            if (done) {
                door.classList.add('open');
                frame.appendChild(checkSvg('check'));
            }
            door.setAttribute('aria-label', 'Day ' + entry.day + ': ' + entry.title +
                (state === 'today' && !wasOpened ? ', open today’s door' : ', view details'));
        } else {
            door.disabled = true;
            door.setAttribute('aria-label', 'Day ' + entry.day + ', locked' +
                (state === 'next' ? ', unlocks ' + (season.phase === 'before' ? 'December 1' : 'tomorrow') : ''));
        }

        door.appendChild(frame);
        if (unlocked) door.addEventListener('click', e => onDoorClick(entry, door, state, e));
        return door;
    }

    function sparkle(x, y) {
        if (reduceMotion) return;
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
        if (state === 'today' && !door.classList.contains('open')) {
            door.classList.add('open');
            door.querySelector('.frame').appendChild(checkSvg('check'));
            door.setAttribute('aria-label', 'Day ' + entry.day + ': ' + entry.title + ', view details');
            markOpened(entry.day);
            statusEl.textContent = statusText(currentSeason, true);
            const rect = door.getBoundingClientRect();
            sparkle(rect.left + rect.width / 2, rect.top + rect.height / 2);
            ring();
            setTimeout(() => showDetails(entry, door), reduceMotion ? 0 : 700);
        } else {
            showDetails(entry, door);
        }
    }

    let lastDoor = null;
    function showDetails(entry, door) {
        lastDoor = door;
        modalBody.textContent = '';
        modalBody.appendChild(el('p', 'modal-day', 'Day ' + entry.day));
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
    modal.addEventListener('close', () => { if (lastDoor) lastDoor.focus(); });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.getElementById('modalClose').appendChild(closeSvg());
    document.getElementById('modalClose').addEventListener('click', closeModal);

    function statusText(season, todayOpened) {
        if (season.phase === 'before') {
            return season.daysUntil === 1
                ? 'The calendar opens tomorrow, December 1.'
                : 'The calendar opens December 1. ' + season.daysUntil + ' days to go.';
        }
        if (season.phase === 'after') return 'The ' + data.year + ' calendar has finished. See you next December.';
        if (season.today === LAST_DAY) return todayOpened ? 'Merry Christmas! That was the last door.' : 'Merry Christmas! Open the last door.';
        return todayOpened
            ? 'Day ' + season.today + ' of ' + LAST_DAY + '. Today’s door is open. Come back tomorrow.'
            : 'Day ' + season.today + ' of ' + LAST_DAY + '. Today’s door is ready to open.';
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
        document.getElementById('testPrev').addEventListener('click', () => shiftTestDay(-1));
        document.getElementById('testNext').addEventListener('click', () => shiftTestDay(1));
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

        if (season.phase === 'after') {
            statusEl.textContent = statusText(season, false);
            grid.hidden = true;
        } else {
            grid.hidden = false;
            data.days.forEach(entry => {
                const state = doorState(entry.day, season);
                grid.appendChild(buildDoor(entry, state, season, opened.includes(entry.day)));
            });
            statusEl.textContent = statusText(season, opened.includes(season.today));
        }

        // Unlock the next door if the tab is left open past midnight.
        clearTimeout(midnightTimer);
        midnightTimer = setTimeout(render, msUntilNextMidnight(now) + 1000);
    }

    function makeSnow() {
        if (reduceMotion) return;
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
            const res = await fetch('draftsets.json');
            if (!res.ok) throw new Error(res.status);
            data = await res.json();
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
