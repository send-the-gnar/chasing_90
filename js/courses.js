// Shared course and player definitions for the per-course pages (Trends, Stroke Audit).
// Requires config.js (GOAL_9_OVER_PAR) and heatmap.js (isParkCourse / isChampionCourse).
//
// The two Mieming courses (par 73 vs par 29) don't compare stroke for stroke, so these
// pages render one course at a time and work in raw scores. Requiring the course's
// standard round length also drops incomplete rounds (12-, 14-, 6-hole partials).

const COURSE_VIEWS = {
    park: {
        label: 'Park Course',
        match: isParkCourse,
        holes: 9,
        par: 29,
        target: 29 + GOAL_9_OVER_PAR,            // 36 — the journal's 9-hole goal
        targetLabel: `Goal: ${29 + GOAL_9_OVER_PAR} (+${GOAL_9_OVER_PAR})`,
        goalPhrase: `reach the 9-hole goal of ${29 + GOAL_9_OVER_PAR}`,
        paceTitle: `Projected Path to ${29 + GOAL_9_OVER_PAR} — the 9-Hole Goal`,
    },
    champion: {
        label: 'Champion Course',
        match: isChampionCourse,
        holes: 18,
        par: 73,
        target: 90,
        targetLabel: 'Break 90',
        goalPhrase: 'break 90',
        paceTitle: 'Projected Path to Breaking 90',
    },
};

const PLAYERS = [
    // Distinct dot shapes on top of color so the players stay tellable apart when dots overlap
    { key: 'daniel', name: 'Daniel', dot: 'circle',   color: { solid: '#4a6fa5', fill: 'rgba(74,111,165,0.08)', faint: 'rgba(74,111,165,0.6)' } },
    { key: 'amelie', name: 'Amelie', dot: 'triangle', color: { solid: '#4a7c4a', fill: 'rgba(74,124,74,0.08)',  faint: 'rgba(74,124,74,0.6)'  } },
];

// Complete, competitive rounds for a player on a course, oldest first.
// The holes check excludes incomplete rounds and keeps scores comparable.
function courseRounds(playerKey, courseKey) {
    const course = COURSE_VIEWS[courseKey];
    return allRoundsData
        .filter(r => r.player.toLowerCase() === playerKey
            && course.match(r)
            && r.holes === course.holes
            && r.roundType !== 'scramble'
            && !r.excludeFromHandicap)
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}
