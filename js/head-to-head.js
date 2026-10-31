// Head-to-head between the two players: rounds played the same day on the same course, matched
// nine for nine. Requires courses.js (COURSE_VIEWS, PLAYERS, courseRounds) and
// data.js (seasonOf). Gross scores only, and courseRounds keeps it to complete, competitive rounds,
// so a casual round on either side doesn't count.

const H2H_MARGIN_MIN_PAIRS = 20;   // below this a first-vs-last margin is mostly noise
const H2H_MARGIN_WINDOW    = 30;   // rounds at each end of the season, or half of them if fewer

// What follows the date in a round id: "a", "b" or "1" on a day with more than one round.
function roundNine(round) {
    const m = /\d{8}_?([a-z0-9]+)$/.exec(round.roundId);
    return m ? m[1] : '';
}

function headToHead(courseKey, season) {
    const byDay = player => {
        const days = {};
        courseRounds(player.key, courseKey)
            .filter(r => !season || seasonOf(r.date) === season)
            .sort((a, b) => a.roundId.localeCompare(b.roundId))
            .forEach(r => { (days[r.date] = days[r.date] || []).push(r); });
        return days;
    };
    const [first, second] = PLAYERS.map(byDay);

    const pairs = [];
    Object.keys(first).sort().forEach(date => {
        (second[date] || []).forEach((round, i) => {
            // Same nine by id ("...a" with "...a") when a round has that label, or else by play order.
            const nine = roundNine(round);
            const opponent = (nine && first[date].find(r => roundNine(r) === nine)) || first[date][i];
            if (opponent) pairs.push({ date, first: opponent, second: round, margin: round.score - opponent.score });
        });
    });

    const mean = list => list.reduce((s, p) => s + p.margin, 0) / list.length;
    const w = Math.min(H2H_MARGIN_WINDOW, Math.floor(pairs.length / 2));
    return {
        pairs,
        played: pairs.length,
        firstWins:  pairs.filter(p => p.margin > 0).length,
        secondWins: pairs.filter(p => p.margin < 0).length,
        ties:       pairs.filter(p => p.margin === 0).length,
        window: w,
        // Positive means the first player in PLAYERS was ahead
        earlyMargin: w ? mean(pairs.slice(0, w)) : 0,
        lateMargin:  w ? mean(pairs.slice(-w)) : 0,
    };
}

function headToHeadMarginText(h) {
    if (h.played < H2H_MARGIN_MIN_PAIRS) return '';
    const describe = m => `${PLAYERS[m >= 0 ? 0 : 1].name} by ${Math.abs(m).toFixed(1)} strokes`;
    return `Average margin: ${describe(h.earlyMargin)} over the first ${h.window}, ${describe(h.lateMargin)} over the last ${h.window}.`;
}

// One row per same-day round, newest first. Needs scorecard-modal.js for the score links.
function headToHeadRows(h) {
    const [p1, p2] = PLAYERS;
    const score = (round, player, won) => `
        <td><button class="recap-round-link${won ? ' h2h-winner' : ''}"${won ? ` style="color:${player.color.solid}"` : ''}
                onclick="openScorecard('${round.roundId}')">${round.score}</button></td>`;
    const result = p => {
        if (p.margin === 0) return 'Tied';
        return `${(p.margin > 0 ? p1 : p2).name} by ${Math.abs(p.margin)}`;
    };

    return `
        <table class="recap-table h2h-rows">
            <thead><tr><th>Date</th><th>${p1.name}</th><th>${p2.name}</th><th>Result</th></tr></thead>
            <tbody>${[...h.pairs].reverse().map(p => `
                <tr>
                    <td>${formatDate(p.date)}</td>
                    ${score(p.first, p1, p.margin > 0)}
                    ${score(p.second, p2, p.margin < 0)}
                    <td class="h2h-result">${result(p)}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function toggleHeadToHeadRows(btn) {
    const rows = btn.nextElementSibling;
    rows.hidden = !rows.hidden;
    btn.textContent = rows.hidden ? `Show all ${btn.dataset.total} rounds ▾` : 'Hide rounds ▴';
}

function headToHeadCard(courseKey, season) {
    const h = headToHead(courseKey, season);
    if (h.played === 0) return '';

    const [p1, p2] = PLAYERS;
    const seg = (n, color, text) => n === 0 ? '' :
        `<div class="h2h-seg" style="flex:${n};background:${color};color:${text};">${n}</div>`;
    const margin = headToHeadMarginText(h);

    return `
        <div class="stats-card h2h-card">
            <h3>${COURSE_VIEWS[courseKey].label}</h3>
            <div class="h2h-names">
                <span style="color:${p1.color.solid}">${p1.name} ${h.firstWins}</span>
                <span>${h.ties} tied</span>
                <span style="color:${p2.color.solid}">${h.secondWins} ${p2.name}</span>
            </div>
            <div class="h2h-bar">
                ${seg(h.firstWins, p1.color.solid, '#fff')}
                ${seg(h.ties, 'var(--green-100)', 'var(--green-700)')}
                ${seg(h.secondWins, p2.color.solid, '#fff')}
            </div>
            <p class="h2h-note">${h.played} same-day ${h.played === 1 ? 'round' : 'rounds'}${margin ? ` · ${margin}` : ''}</p>
            <button class="h2h-toggle" data-total="${h.played}" onclick="toggleHeadToHeadRows(this)">Show all ${h.played} rounds ▾</button>
            <div hidden>${headToHeadRows(h)}</div>
        </div>`;
}
