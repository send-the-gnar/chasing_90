// Latest Round section at the top of the dashboard: each player's most recent day of golf and
// what it changed. We often play two nines in a day, so "before" and "after" compare the end of
// the previous day with the end of this one instead of treating each nine separately.
// Requires render.js (renderRoundCard, formatDateLong), courses.js (COURSE_VIEWS, PLAYERS,
// courseRounds), scoring-average.js (AVG_WINDOW), scorecard-modal.js (renderScoringSummary) and
// config.js (handicapData, birdieData), which renderHeroStats fills before this runs.

function lastOf(list) {
    return list[list.length - 1];
}

function averageScore(rounds) {
    return rounds.reduce((s, r) => s + r.score, 0) / rounds.length;
}

// Matches what the handicap and the scoring averages count, so a casual, scramble or partial
// round is never shown as having moved them.
function countsTowardStats(round) {
    return round.roundType !== 'scramble' && !round.excludeFromHandicap
        && (round.holes === 9 || round.holes === 18);
}

function latestChangeRow(label, from, to, note) {
    const change = from === null ? 0 : Math.round((to - from) * 10) / 10;
    let delta = note || '';
    if (!delta && from !== null) {
        delta = change === 0 ? 'no change' : `${change > 0 ? '+' : ''}${change.toFixed(1)}`;
    }
    // Index and scoring average both improve downward
    const cls = change < 0 ? ' vs-better' : change > 0 ? ' vs-worse' : '';
    return `
        <div class="latest-change">
            <span class="latest-change-label">${label}</span>
            <span class="latest-change-values">${from === null ? '' : `${from.toFixed(1)} → `}<strong>${to.toFixed(1)}</strong></span>
            <span class="latest-change-delta${cls}">${delta}</span>
        </div>`;
}

function latestIndexChange(player, day) {
    const hcp   = handicapData[player.name];
    const after = lastOf(hcp.progression.filter(pt => pt.date <= day));
    if (!after) return { row: '', record: null };

    const before = hcp.progression.filter(pt => pt.date < day);
    const from   = before.length ? lastOf(before).whi : null;
    // An odd nine has no differential of its own until the next nine pairs with it
    const waiting = hcp.unpaired.some(r => r.date === day) && from === after.whi;
    const isLow   = before.length > 0 && after.whi < Math.min(...before.map(pt => pt.whi));
    return {
        row: latestChangeRow('Handicap index', from, after.whi, waiting ? 'waiting on a pair' : ''),
        record: isLow ? `Lowest index yet: ${after.whi.toFixed(1)}` : null,
    };
}

// Rolling average row and score records for one course, compared with everything before this day.
function latestCourseChange(player, courseKey, day) {
    const label  = COURSE_VIEWS[courseKey].label;
    const career = courseRounds(player.key, courseKey);
    const today  = career.filter(r => r.date === day);
    if (today.length === 0) return { row: '', records: [] };

    const before = career.filter(r => r.date < day);
    const after  = career.filter(r => r.date <= day);
    const w      = Math.min(AVG_WINDOW[courseKey], after.length);
    const row    = latestChangeRow(
        `${label.replace(' Course', '')} ${w}-round avg`,
        before.length ? averageScore(before.slice(-w)) : null,
        averageScore(after.slice(-w)));

    const records = [];
    if (before.length) {
        const best      = Math.min(...today.map(r => r.score));
        const pb        = Math.min(...before.map(r => r.score));
        const inSeason  = before.filter(r => seasonOf(r.date) === seasonOf(day));
        if (best < pb) records.push(`New ${label} best: ${best} (was ${pb})`);
        else if (best === pb) records.push(`Tied ${label} best: ${best}`);
        else if (inSeason.length && best < Math.min(...inSeason.map(r => r.score))) {
            records.push(`Best ${label} round of ${seasonOf(day)}: ${best}`);
        }
    }
    return { row, records };
}

// Holes crossed off the birdie-every-hole chase today.
function latestBirdieRecords(player, day) {
    const { log, courses } = birdieData[player.name];
    const records = [];
    courses.forEach(c => {
        const earlier = new Set(log.filter(e => e.course === c.label && e.date < day).map(e => e.hole));
        const fresh   = new Set(log.filter(e => e.course === c.label && e.date === day && !earlier.has(e.hole)).map(e => e.hole));
        [...fresh].sort((a, b) => a - b).forEach(hole => {
            records.push(`First birdie on ${c.label} #${hole}`);
        });
        if (fresh.size && c.birdied === c.byHole.length) records.push(`Every hole on ${c.label} birdied`);
    });
    return records;
}

function renderLatestPlayer(player) {
    const mine = allRoundsData.filter(r => r.player.toLowerCase() === player.key);
    if (mine.length === 0) return '';

    const day    = mine[0].date;   // allRoundsData is sorted newest first
    const rounds = mine.filter(r => r.date === day).sort((a, b) => a.roundId.localeCompare(b.roundId));
    const counted = rounds.some(countsTowardStats);

    const holes = rounds.filter(r => r.roundType !== 'scramble')
        .flatMap(r => scorecardData[r.roundId] || [])
        .filter(h => h.score > 0);

    let changes = '';
    let records = [];
    if (counted) {
        const index  = latestIndexChange(player, day);
        const byCourse = Object.keys(COURSE_VIEWS).map(k => latestCourseChange(player, k, day));
        changes = index.row + byCourse.map(c => c.row).join('');
        records = [
            ...byCourse.flatMap(c => c.records),
            ...(index.record ? [index.record] : []),
            ...latestBirdieRecords(player, day),
        ];
    }

    return `
        <div class="stats-card latest-card">
            <div class="latest-head">
                <h3>${player.name}</h3>
                <span class="latest-date">${formatDateLong(day)}</span>
            </div>
            <div class="rounds-list">${rounds.map(renderRoundCard).join('')}</div>
            ${holes.length ? `<div class="latest-summary">${renderScoringSummary(holes)}</div>` : ''}
            ${records.length ? `<ul class="latest-records">${records.map(r => `<li>★ ${r}</li>`).join('')}</ul>` : ''}
            ${changes ? `<div class="latest-changes">${changes}</div>` : ''}
            ${counted ? '' : '<p class="latest-note">Didn\'t count toward the handicap or scoring averages.</p>'}
        </div>`;
}

function renderLatestRound() {
    const section = document.getElementById('latest');
    if (!section || allRoundsData.length === 0) return;
    document.getElementById('latest-round').innerHTML = PLAYERS.map(renderLatestPlayer).join('');
    section.style.display = '';
}
