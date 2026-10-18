// Birdie tallies behind the hero counter and the birdie modal.
// Requires config.js (scorecardData) and handicap.js (courseGroupLabel).
//
// A birdie is any hole under par, so an eagle counts too — the rule the hero tile has always
// used. Scrambles are team scores and stay out of every number; their birdies are only
// tallied so the modal can say what it left out.

// The two Mieming courses get a "birdie every hole" tracker. Birdies anywhere else are
// lumped together as away.
const BIRDIE_COURSES = [
    { label: 'Park Course',     holes: 9  },
    { label: 'Champion Course', holes: 18 },
];

function calculateBirdies(allRounds) {
    const courses = BIRDIE_COURSES.map(c => ({
        label: c.label,
        birdies: 0,
        played: 0,
        byHole: Array.from({ length: c.holes }, (_, i) => ({ hole: i + 1, par: null, played: 0, birdies: 0 })),
    }));
    const away = {};   // course label → birdies
    const log  = [];   // one entry per birdie, newest first
    let total = 0, eagles = 0, scrambleBirdies = 0;
    let roundsScored = 0, roundsWithBirdie = 0, mostInRound = null;

    // Newest first, so the log reads that way and a tie for "most in a round" goes to the latest.
    // Rounds on the same day have no recorded order beyond their ids (calculateHandicap leans on
    // the same thing), so the id breaks ties.
    const rounds = [...allRounds].sort((a, b) =>
        new Date(b.date) - new Date(a.date) || b.roundId.localeCompare(a.roundId));

    rounds.forEach(r => {
        const holes = scorecardData[r.roundId];
        if (!holes) return;
        const scramble = r.roundType === 'scramble';
        const label    = courseGroupLabel(r.course);
        const course   = courses.find(c => c.label === label);
        let played = 0, inRound = 0;
        const roundLog = [];

        holes.forEach(h => {
            if (h.score <= 0) return;   // hole not played on a partial round
            const birdie = h.score < h.par;
            if (scramble) { if (birdie) scrambleBirdies++; return; }

            played++;
            const slot = course && course.byHole[h.hole - 1];
            if (course) course.played++;
            if (slot) {
                slot.played++;
                if (slot.par === null) slot.par = h.par;
            }
            if (!birdie) return;

            inRound++;
            total++;
            if (h.score <= h.par - 2) eagles++;
            if (course) course.birdies++;
            else away[label] = (away[label] || 0) + 1;
            if (slot) slot.birdies++;
            roundLog.push({ roundId: r.roundId, date: r.date, course: label, hole: h.hole, par: h.par, score: h.score });
        });
        log.push(...roundLog.reverse());   // holes run 1→18, so flip them to keep the log newest first

        if (played === 0) return;
        roundsScored++;
        if (inRound === 0) return;
        roundsWithBirdie++;
        if (!mostInRound || inRound > mostInRound.count) {
            mostInRound = { count: inRound, roundId: r.roundId, date: r.date };
        }
    });

    courses.forEach(c => { c.birdied = c.byHole.filter(h => h.birdies > 0).length; });

    return { total, eagles, scrambleBirdies, roundsScored, roundsWithBirdie, mostInRound, courses, away, log };
}
