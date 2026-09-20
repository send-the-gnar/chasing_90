// Course/tee ratings. `cr18` is always the 18-hole course rating: 9-hole courses
// store double their published 9-hole rating and calcScoreDifferential halves it
// back, so one field covers both.
//
// Away-course ratings come from published scorecards (GolfLink / TeeOff, Sept 2026).
// Where a course publishes no women's rating for the white tees, Amelie's white
// entry reuses the men's numbers — the differential is then slightly generous to
// her, so check the card on site and correct here if it lists a women's white.
const COURSE_DATA = {
    'daniel_park':        { cr18: 57.0,  slope: 94,  par18: 58 },
    'amelie_park':        { cr18: 58.8,  slope: 97,  par18: 58 },
    'daniel_champ_gams':  { cr18: 74.4,  slope: 133, par18: 73 },
    'daniel_champ_fuchs': { cr18: 72.48, slope: 132, par18: 73 },
    'daniel_champ_igel':  { cr18: 70.1,  slope: 129, par18: 73 },
    'amelie_champ_igel':  { cr18: 75.3,  slope: 134, par18: 73 },

    // ---- Massachusetts / Maine ----

    // Beverly Golf & Tennis, Beverly MA — 18 holes, par 70 (Donald Ross, 1910)
    'daniel_beverly_white':   { cr18: 68.8, slope: 122, par18: 70 },
    'daniel_beverly_blue':    { cr18: 70.3, slope: 124, par18: 70 },
    'amelie_beverly_white':   { cr18: 68.8, slope: 122, par18: 70 },  // men's white — no women's white published
    'amelie_beverly_red':     { cr18: 71.6, slope: 124, par18: 73 },  // women's rating, women's par

    // Wenham Country Club, Wenham MA — 18 holes, par 65 (31 out / 34 in)
    'daniel_wenham_white':    { cr18: 63.3, slope: 112, par18: 65 },
    'amelie_wenham_white':    { cr18: 63.3, slope: 112, par18: 65 },  // men's white — no women's white published
    'amelie_wenham_red':      { cr18: 65.3, slope: 111, par18: 65 },

    // Cape Ann Golf Club, Essex MA — 9 holes, par 34. cr18 = published 9-hole rating x2.
    'daniel_capeann_white':   { cr18: 67.0, slope: 123, par18: 68 },  // 33.5 / 123 over nine
    'daniel_capeann_blue':    { cr18: 69.8, slope: 124, par18: 68 },  // 34.9 / 124 over nine
    'amelie_capeann_white':   { cr18: 73.4, slope: 126, par18: 68 },  // 36.7 / 126 over nine — women's white is rated here
    'amelie_capeann_red':     { cr18: 65.4, slope: 111, par18: 68 },  // 32.7 / 111 over nine

    // Dunegrass Golf Club, Old Orchard Beach ME — 18 holes, par 71 (Dan Maples, 1998)
    'daniel_dunegrass_white': { cr18: 70.2, slope: 130, par18: 71 },
    'daniel_dunegrass_gold':  { cr18: 72.1, slope: 137, par18: 71 },
    'amelie_dunegrass_white': { cr18: 70.2, slope: 130, par18: 71 },  // men's white — no women's white published
    'amelie_dunegrass_green': { cr18: 68.1, slope: 126, par18: 71 },
    'amelie_dunegrass_black': { cr18: 68.0, slope: 113, par18: 71 },  // forward tees
};

// Courses away from Mieming, matched on the sheet's course name. `tees` maps a
// COURSE_DATA tee suffix to the tee-colour keywords that select it; anything the
// sheet writes that isn't listed (or isn't rated for that player) falls back to
// `defaultTee`, since white is what we normally play.
const AWAY_COURSES = [
    {
        id: 'beverly', label: 'Beverly G&T', defaultTee: 'white',
        match: c => c.includes('beverly'),
        tees: { blue: ['blue'], red: ['red', 'forward'], white: ['white'] },
    },
    {
        id: 'wenham', label: 'Wenham CC', defaultTee: 'white',
        match: c => c.includes('wenham'),
        tees: { red: ['red', 'forward'], white: ['white'] },
    },
    {
        id: 'capeann', label: 'Cape Ann', defaultTee: 'white',
        // "Cape Anne" is the common misspelling and shows up in the sheet
        match: c => c.includes('cape ann'),
        tees: { blue: ['blue'], red: ['red', 'forward'], white: ['white'] },
    },
    {
        id: 'dunegrass', label: 'Dunegrass', defaultTee: 'white',
        match: c => c.includes('dunegrass') || c.includes('dune grass'),
        tees: { gold: ['gold', 'back'], green: ['green'], black: ['black', 'forward'], white: ['white'] },
    },
];

function getCourseKey(player, course, teeColor) {
    const p = player.toLowerCase();
    const c = course.toLowerCase();
    const t = teeColor.toLowerCase();

    const isMieming = c.includes('mieming') || c.includes('park course') || c.includes('champion');
    if (isMieming) {
        const isPark = c.includes('park');
        if (isPark) return p === 'daniel' ? 'daniel_park' : 'amelie_park';

        if (p === 'amelie') return 'amelie_champ_igel';
        if (t.includes('blue') || t.includes('fuchs')) return 'daniel_champ_fuchs';
        if (t.includes('yellow') || t.includes('back') || t.includes('gams')) return 'daniel_champ_gams';
        if (t.includes('red') || t.includes('igel')) return 'daniel_champ_igel';
        return 'daniel_champ_gams';
    }

    const away = AWAY_COURSES.find(a => a.match(c));
    if (!away) return null;

    const suffix = Object.keys(away.tees).find(s => away.tees[s].some(k => t.includes(k))) || away.defaultTee;
    for (const key of [`${p}_${away.id}_${suffix}`, `${p}_${away.id}_${away.defaultTee}`]) {
        if (COURSE_DATA[key]) return key;
    }
    return null;
}

// Label for the per-course breakdown in the handicap modal.
function courseGroupLabel(course) {
    const c = (course || '').toLowerCase();
    if (c.includes('park')) return 'Park Course';
    if (c.includes('mieming') || c.includes('champion')) return 'Champion Course';
    const away = AWAY_COURSES.find(a => a.match(c));
    return away ? away.label : (course || 'Other');
}

function calcScoreDifferential(score, courseData, holes) {
    if (holes === 9) return (113 / courseData.slope) * (score - courseData.cr18 / 2);
    return (113 / courseData.slope) * (score - courseData.cr18);
}

const WHS_TABLE = [
    [3,  3,  1, -2.0],
    [4,  4,  1, -1.0],
    [5,  5,  1,  0],
    [6,  6,  2, -1.0],
    [7,  8,  2,  0],
    [9,  11, 3,  0],
    [12, 14, 4,  0],
    [15, 16, 5,  0],
    [17, 18, 6,  0],
    [19, 19, 7,  0],
    [20, Infinity, 8, 0],
];

function whsFromDiffs(diffs) {
    const n = diffs.length;
    if (n < 3) return null;
    const row = WHS_TABLE.find(r => n >= r[0] && n <= r[1]);
    if (!row) return null;
    const sorted = [...diffs].sort((a, b) => a - b);
    const used = sorted.slice(0, row[2]);
    const avg = used.reduce((s, v) => s + v, 0) / used.length;
    return Math.round((avg + row[3]) * 10) / 10;
}

function calculateHandicap(allRounds) {
    const seen = new Set();
    const unique = allRounds.filter(r => {
        if (!r.roundId || seen.has(r.roundId)) return false;
        seen.add(r.roundId);
        return true;
    });

    const eligible = unique.filter(r => {
        const key = getCourseKey(r.player, r.course, r.teeColor);
        return key && (r.holes === 9 || r.holes === 18) && !r.excludeFromHandicap && r.roundType !== 'scramble';
    }).sort((a, b) => {
        const d = new Date(a.date) - new Date(b.date);
        return d !== 0 ? d : a.roundId.localeCompare(b.roundId);
    });

    const diffs = [];
    const nineRounds = [];
    const roundDetails = [];

    for (const r of eligible) {
        const key = getCourseKey(r.player, r.course, r.teeColor);
        const cd = COURSE_DATA[key];
        const holeData = scorecardData[r.roundId];
        const adjustedScore = holeData
            ? holeData.reduce((sum, h) => sum + Math.min(h.score, h.par + 3), 0)
            : r.score;
        const d = calcScoreDifferential(adjustedScore, cd, r.holes);
        const detail = {
            roundId: r.roundId, date: r.date, course: r.course,
            teeColor: r.teeColor, score: r.score, adjustedScore, par: r.par,
            holes: r.holes, diff: d, cr: cd.cr18, slope: cd.slope,
        };
        roundDetails.push(detail);

        if (r.holes === 18) {
            diffs.push({ diff: d, date: r.date, type: '18h', rounds: [detail] });
        } else {
            nineRounds.push(detail);
        }
    }

    const unpaired = [];
    for (let i = 0; i < nineRounds.length; i += 2) {
        if (i + 1 < nineRounds.length) {
            const r1 = nineRounds[i], r2 = nineRounds[i + 1];
            diffs.push({ diff: r1.diff + r2.diff, date: r2.date, type: 'paired', rounds: [r1, r2] });
        } else {
            unpaired.push(nineRounds[i]);
        }
    }

    diffs.sort((a, b) => new Date(a.date) - new Date(b.date));

    // WHS: only the most recent 20 differentials are eligible
    const recentDiffs = diffs.slice(-20);
    const diffValues = recentDiffs.map(d => d.diff);
    const n = diffValues.length;
    const usedIndices = new Set();
    if (n >= 3) {
        const row = WHS_TABLE.find(r => n >= r[0] && n <= r[1]);
        if (row) {
            const sorted = diffValues.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
            sorted.slice(0, row[2]).forEach(s => usedIndices.add(s.i));
        }
    }
    const offset = diffs.length - recentDiffs.length;
    diffs.forEach((d, i) => { d.used = usedIndices.has(i - offset); });

    const progression = [];
    for (let i = 0; i < diffs.length; i++) {
        const slice = diffs.slice(Math.max(0, i - 19), i + 1).map(d => d.diff);
        const whi = whsFromDiffs(slice);
        if (whi !== null) progression.push({ date: diffs[i].date, whi });
    }

    const whi = whsFromDiffs(diffValues);
    return { whi, numDiffs: diffs.length, diffs, unpaired, progression };
}
