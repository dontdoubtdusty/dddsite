#!/usr/bin/env node
// Refreshes draftsets.json for the MTG advent calendar from Scryfall.
//
//   node tools/mtgadvent-build.js [year] [--reshuffle]
//   node tools/mtgadvent-build.js --shuffle [--seed=N]   (offline: new day assignments only, no Scryfall)
//
// - Finds every core/expansion set that has Standard-legal cards right now
//   (minus the "exclude" list stored in the JSON, e.g. non-draftable supplements).
// - Fetches set icon + a piece of card art for each set.
// - Builds 25 days, ~85% pairs and the rest single sets, using a shuffle seeded by the year
//   so the same year always gives the same calendar.
// - Keeps anything you've hand-written (set blurbs, day titles/descriptions) on later runs.
//   Pass --reshuffle to throw the day assignments away and redo them.
//
// Run it in the fall, after the year's last set has been released or has previews out.
// Check Standard legality yourself if a rotation is announced: Scryfall only knows what is legal today.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'draftsets.json');
const OUT_JS = path.join(__dirname, '..', 'draftsets.js');
const API = 'https://api.scryfall.com';
const HEADERS = { 'User-Agent': 'dddsite-mtgadvent/2.0', Accept: 'application/json' };
const DAYS = 25;
// A set only counts as Standard if at least this many of its cards are legal. Sets that rotated
// out still show a handful of legal cards because of reprints in newer sets.
const MIN_LEGAL = 100;

const args = process.argv.slice(2);
const reshuffle = args.includes('--reshuffle');
const shuffleOnly = args.includes('--shuffle');
const seedArg = (args.find(a => a.startsWith('--seed=')) || '').slice(7);
const year = Number(args.find(a => /^\d{4}$/.test(a))) || new Date().getFullYear();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
    for (let attempt = 1; attempt <= 6; attempt++) {
        await sleep(attempt === 1 ? 400 : 4000 * attempt); // Scryfall asks for 50-100ms between requests; back off hard on 429
        const res = await fetch(url, { headers: HEADERS });
        if (res.status === 404) return null;
        if (res.status === 429) continue;
        if (!res.ok) throw new Error(`${res.status} for ${url}`);
        return res.json();
    }
    throw new Error(`Rate limited too many times for ${url}`);
}

function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Looks for a striking piece of art that belongs to the set itself: a new rare/mythic creature
// first, then any new rare/mythic, then anything legal. Lands and reprints make dull set art.
async function fetchArt(code) {
    const plain = '-is:showcase -is:extendedart -is:borderless -is:fullart';
    const queries = [
        `set:${code} -is:reprint t:creature (r:mythic OR r:rare) ${plain}`,
        `set:${code} -is:reprint -t:land (r:mythic OR r:rare) ${plain}`,
        `set:${code} -t:land ${plain}`,
        `set:${code}`
    ];
    for (const q of queries) {
        const r = await get(`${API}/cards/search?q=${encodeURIComponent(q)}&order=edhrec&unique=cards`);
        if (r && r.data && r.data.length) {
            const art = pickArt(r.data);
            if (art.art) return art;
        }
    }
    return { art: '', artCard: '', artist: '' };
}

// Picks the most popular (EDHREC order) rare/mythic with ordinary frame art from a search result.
function pickArt(cards) {
    const artOf = c => (c.image_uris || (c.card_faces && c.card_faces[0].image_uris) || {}).art_crop;
    const plain = c => !(c.frame_effects || []).includes('showcase') && !(c.frame_effects || []).includes('extendedart')
        && c.border_color !== 'borderless' && !c.full_art;
    const good = c => artOf(c) && plain(c);
    const card = cards.find(c => good(c) && ['rare', 'mythic'].includes(c.rarity))
        || cards.find(good) || cards.find(artOf);
    if (!card) return { art: '', artCard: '', artist: '' };
    const artist = card.artist || (card.card_faces && card.card_faces[0].artist) || '';
    return { art: artOf(card), artCard: card.name, artist };
}

function buildDays(codes, rand) {
    // 3 or 4 single-set days out of 25 gives 84-88% pairs.
    const singles = 3 + Math.floor(rand() * 2);
    const slots = shuffle([...Array(DAYS).keys()], rand);
    const singleDays = new Set(slots.slice(0, singles));
    const use = Object.fromEntries(codes.map(c => [c, 0]));
    const seenPairs = new Set();
    const days = [];

    const pickLeast = (exclude = []) => {
        const pool = codes.filter(c => !exclude.includes(c));
        const min = Math.min(...pool.map(c => use[c]));
        const tied = shuffle(pool.filter(c => use[c] === min), rand);
        return tied[0];
    };

    for (let d = 0; d < DAYS; d++) {
        let picked;
        if (singleDays.has(d)) {
            picked = [pickLeast()];
        } else {
            for (let attempt = 0; attempt < 50; attempt++) {
                const a = pickLeast();
                const b = pickLeast([a]);
                const key = [a, b].sort().join('+');
                if (!seenPairs.has(key)) { seenPairs.add(key); picked = [a, b]; break; }
                use[a] += 0.01; // nudge so the retry can land somewhere else
            }
            if (!picked) throw new Error('Could not find an unused pair; too few sets?');
        }
        picked.forEach(c => { use[c] = Math.floor(use[c]) + 1; });
        days.push({ day: d + 1, sets: picked });
    }
    return days;
}

function writeOut(out) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
    fs.writeFileSync(OUT_JS, 'window.MTGADVENT_DATA = ' + JSON.stringify(out) + ';\n');
}

function assignDays(sets, rand) {
    const days = buildDays(Object.keys(sets), rand);
    days.forEach(d => {
        d.title = d.sets.map(c => sets[c].name).join(' × ');
        d.description = d.sets.map(c => sets[c].blurb).filter(Boolean).join(' ');
    });
    return days;
}

// Offline reshuffle: keeps the sets already in draftsets.json and applies the same rules
// (25 days, ~85% pairs, even set usage, no repeated pair) with a fresh random seed.
if (shuffleOnly) {
    if (!fs.existsSync(OUT)) { console.error('No draftsets.json yet; run the full build first.'); process.exit(1); }
    const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const seed = seedArg ? Number(seedArg) : Math.floor(Math.random() * 1e9);
    data.days = assignDays(data.sets, mulberry32(seed));
    writeOut(data);
    console.log(`Reshuffled ${data.days.length} days with seed ${seed} (rerun with --seed=${seed} to reproduce).`);
    data.days.forEach(d => console.log(`  ${String(d.day).padStart(2)}  ${d.sets.join(' + ')}`));
    process.exit(0);
}

(async () => {
    const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
    const exclude = Array.isArray(existing.exclude) ? existing.exclude : [];
    const oldSets = existing.sets || {};
    const sameYear = existing.year === year;

    console.log(`Building advent calendar for ${year}...`);
    const setList = (await get(`${API}/sets`)).data
        .filter(s => ['core', 'expansion'].includes(s.set_type))
        .filter(s => s.released_at >= `${year - 3}-01-01` && s.released_at <= `${year}-12-25`)
        .filter(s => !exclude.includes(s.code))
        .sort((a, b) => a.released_at.localeCompare(b.released_at));

    const sets = {};
    for (const s of setList) {
        const legal = await get(`${API}/cards/search?q=${encodeURIComponent(`set:${s.code} f:standard`)}&unique=cards`);
        const count = legal ? legal.total_cards : 0;
        // A set that releases before Dec 25 but isn't out yet only has its previewed cards legal so far.
        const upcoming = s.released_at > new Date().toISOString().slice(0, 10);
        if (count < MIN_LEGAL && !(upcoming && count > 0)) continue;
        sets[s.code] = {
            name: s.name,
            released: s.released_at,
            icon: s.icon_svg_uri,
            ...(await fetchArt(s.code)),
            blurb: (oldSets[s.code] && oldSets[s.code].blurb) || ''
        };
        console.log(`  ${s.released_at}  ${s.code.padEnd(4)} ${s.name} (${count} Standard-legal cards)`);
    }

    const codes = Object.keys(sets);
    if (codes.length < 4) throw new Error('Found suspiciously few Standard sets; aborting.');

    let days;
    const keepDays = sameYear && !reshuffle && Array.isArray(existing.days) && existing.days.length === DAYS
        && existing.days.every(d => d.sets.every(c => sets[c]));
    if (keepDays) {
        days = existing.days;
        console.log('Kept existing day assignments (use --reshuffle to redo them).');
    } else {
        days = assignDays(sets, mulberry32(year));
        console.log('Generated new day assignments.');
    }

    const missing = codes.filter(c => !sets[c].blurb);
    if (missing.length) console.log(`Needs a blurb: ${missing.join(', ')}`);

    const out = { year, exclude, sets, days };
    writeOut(out);
    console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${codes.length} sets, ${days.length} days.`);
})().catch(e => { console.error(e); process.exit(1); });
