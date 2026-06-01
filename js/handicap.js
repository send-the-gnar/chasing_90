const COURSE_DATA = {
    'daniel_park':        { cr18: 57.0,  slope: 94,  par18: 58 },
    'amelie_park':        { cr18: 58.8,  slope: 97,  par18: 58 },
    'daniel_champ_gams':  { cr18: 74.4,  slope: 133, par18: 73 },
    'daniel_champ_fuchs': { cr18: 72.48, slope: 132, par18: 73 },
    'daniel_champ_igel':  { cr18: 70.1,  slope: 129, par18: 73 },
    'amelie_champ_igel':  { cr18: 75.3,  slope: 134, par18: 73 },
};

// Course handicap parameters used in the handicap modal
const CHAMP_COURSE_HCP = { cr: 72.48, slope: 132, par: 73 };
const PARK_COURSE_HCP  = { cr: 28.5,  slope: 94,  par: 29 };

function getCourseKey(player, course, teeColor) {
    const p = player.toLowerCase();
    const c = course.toLowerCase();
    const t = teeColor.toLowerCase();
    const isMieming = c.includes('mieming') || c.includes('park course') || c.includes('champion');
    if (!isMieming) return null;

    const isPark = c.includes('park');
    if (isPark) return p === 'daniel' ? 'daniel_park' : 'amelie_park';

    if (p === 'amelie') return 'amelie_champ_igel';
    if (t.includes('blue') || t.includes('fuchs')) return 'daniel_champ_fuchs';
    if (t.includes('yellow') || t.includes('back') || t.includes('gams')) return 'daniel_champ_gams';
    if (t.includes('red') || t.includes('igel')) return 'daniel_champ_igel';
    return 'daniel_champ_gams';
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
    return Math.round(((avg + row[3]) * 0.96) * 10) / 10;
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
