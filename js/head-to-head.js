// Head-to-head between the two players: rounds played the same day on the same course, matched
// nine for nine, as stroke play or match play. We play straight up, so no strokes are ever given.
// Requires courses.js (COURSE_VIEWS, PLAYERS, courseRounds), data.js (seasonOf), render.js
// (formatDate) and scorecard-modal.js. courseRounds keeps it to complete, competitive rounds, so a
// casual round on either side doesn't count.

const H2H_MARGIN_MIN_PAIRS = 20;   // below this a first-vs-last margin is mostly noise
const H2H_MARGIN_WINDOW    = 30;   // rounds at each end of the season, or half of them if fewer

const h2hView = { containerId: null, season: null, format: 'stroke', open: {} };

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

// ---- Match play ----

// One round as a match, or null without a full scorecard on both sides. Every hole counts toward
// holes won, even after the match is decided. A lead can't be lost once it's bigger than the holes
// left, so the holes-won count always agrees with the match result.
function matchResult(pair) {
    const mine = scorecardData[pair.first.roundId];
    const theirs = scorecardData[pair.second.roundId];
    if (!mine || !theirs) return null;

    const opponent = Object.fromEntries(theirs.map(h => [h.hole, h.score]));
    const holes = mine.filter(h => h.score > 0 && opponent[h.hole] > 0);
    if (holes.length !== pair.first.holes) return null;

    let firstWon = 0, secondWon = 0, closedOut = null;
    holes.forEach((h, i) => {
        if (h.score < opponent[h.hole]) firstWon++;
        else if (opponent[h.hole] < h.score) secondWon++;
        const lead = Math.abs(firstWon - secondWon);
        const left = holes.length - i - 1;
        if (!closedOut && left > 0 && lead > left) closedOut = `${lead}&${left}`;
    });

    const lead = Math.abs(firstWon - secondWon);
    return {
        firstWon,
        secondWon,
        halved: holes.length - firstWon - secondWon,
        margin: firstWon - secondWon,
        score: closedOut || `${lead} up`,
    };
}

function matchPlay(h) {
    const matches = h.pairs.map(pair => ({ pair, result: matchResult(pair) })).filter(m => m.result);
    const results = matches.map(m => m.result);
    const total = key => results.reduce((s, r) => s + r[key], 0);
    return {
        matches,
        played: matches.length,
        firstWins:  results.filter(r => r.margin > 0).length,
        secondWins: results.filter(r => r.margin < 0).length,
        ties:       results.filter(r => r.margin === 0).length,
        firstHoles: total('firstWon'),
        secondHoles: total('secondWon'),
        halvedHoles: total('halved'),
        // Rounds where one player won on strokes and the other won the match
        flips: matches.filter(m => m.pair.margin * m.result.margin < 0).length,
    };
}

// ---- Text and rows ----

function headToHeadMarginText(h) {
    if (h.played < H2H_MARGIN_MIN_PAIRS) return '';
    const describe = m => `${PLAYERS[m >= 0 ? 0 : 1].name} by ${Math.abs(m).toFixed(1)} strokes`;
    return `Average margin: ${describe(h.earlyMargin)} over the first ${h.window}, ${describe(h.lateMargin)} over the last ${h.window}.`;
}

function matchNoteText(m) {
    const [p1, p2] = PLAYERS;
    const holes = `Holes won: ${p1.name} ${m.firstHoles}, ${p2.name} ${m.secondHoles}, ${m.halvedHoles} halved.`;
    if (m.flips === 0) return holes;
    return `${holes} The stroke play winner lost the match ${m.flips === 1 ? 'once' : `${m.flips} times`}.`;
}

function headToHeadCell(round, value, player, won) {
    return `
        <td><button class="recap-round-link${won ? ' h2h-winner' : ''}"${won ? ` style="color:${player.color.solid}"` : ''}
                onclick="openScorecard('${round.roundId}')">${value}</button></td>`;
}

function headToHeadTable(rows) {
    const [p1, p2] = PLAYERS;
    return `
        <table class="recap-table h2h-rows">
            <thead><tr><th>Date</th><th>${p1.name}</th><th>${p2.name}</th><th>Result</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
        </table>`;
}

function strokeRow(p) {
    const [p1, p2] = PLAYERS;
    const result = p.margin === 0 ? 'Tied' : `${(p.margin > 0 ? p1 : p2).name} by ${Math.abs(p.margin)}`;
    return `
        <tr>
            <td>${formatDate(p.date)}</td>
            ${headToHeadCell(p.first, p.first.score, p1, p.margin > 0)}
            ${headToHeadCell(p.second, p.second.score, p2, p.margin < 0)}
            <td class="h2h-result">${result}</td>
        </tr>`;
}

function matchRow({ pair, result }) {
    const [p1, p2] = PLAYERS;
    const outcome = result.margin === 0 ? 'Halved' : `${(result.margin > 0 ? p1 : p2).name} ${result.score}`;
    return `
        <tr>
            <td>${formatDate(pair.date)}</td>
            ${headToHeadCell(pair.first, result.firstWon, p1, result.margin > 0)}
            ${headToHeadCell(pair.second, result.secondWon, p2, result.margin < 0)}
            <td class="h2h-result">${outcome}</td>
        </tr>`;
}

// ---- Cards ----

function headToHeadCard(courseKey) {
    const h = headToHead(courseKey, h2hView.season);
    if (h.played === 0) return '';

    const isMatch = h2hView.format === 'match';
    const m = isMatch ? matchPlay(h) : null;
    const record = m || h;
    if (record.played === 0) return '';

    const [p1, p2] = PLAYERS;
    const seg = (n, color, text) => n === 0 ? '' :
        `<div class="h2h-seg" style="flex:${n};background:${color};color:${text};">${n}</div>`;
    const detail = isMatch ? matchNoteText(m) : headToHeadMarginText(h);
    const unit = isMatch ? 'match' : 'round';
    const units = isMatch ? 'matches' : 'rounds';
    const open = Boolean(h2hView.open[courseKey]);

    // Newest first
    const rows = isMatch ? [...m.matches].reverse().map(matchRow) : [...h.pairs].reverse().map(strokeRow);

    return `
        <div class="stats-card h2h-card">
            <h3>${COURSE_VIEWS[courseKey].label}</h3>
            <div class="h2h-names">
                <span style="color:${p1.color.solid}">${p1.name} ${record.firstWins}</span>
                <span>${record.ties} ${isMatch ? 'halved' : 'tied'}</span>
                <span style="color:${p2.color.solid}">${record.secondWins} ${p2.name}</span>
            </div>
            <div class="h2h-bar">
                ${seg(record.firstWins, p1.color.solid, '#fff')}
                ${seg(record.ties, 'var(--green-100)', 'var(--green-700)')}
                ${seg(record.secondWins, p2.color.solid, '#fff')}
            </div>
            <p class="h2h-note">${record.played} same-day ${record.played === 1 ? unit : units}${detail ? ` · ${detail}` : ''}</p>
            <button class="h2h-toggle" onclick="toggleHeadToHeadRows('${courseKey}')">${open ? `Hide ${units} ▴` : `Show all ${record.played} ${units} ▾`}</button>
            ${open ? `
                ${isMatch ? '<p class="h2h-rows-note">Holes won in each match</p>' : ''}
                ${headToHeadTable(rows)}` : ''}
        </div>`;
}

function drawHeadToHead() {
    const html = Object.keys(COURSE_VIEWS).map(headToHeadCard).join('');
    document.getElementById(h2hView.containerId).innerHTML = html;
    return Boolean(html);
}

// Draws one card per course into the container. Returns false when there's nothing to compare.
function renderHeadToHead(containerId, season) {
    h2hView.containerId = containerId;
    h2hView.season = season;
    return drawHeadToHead();
}

function setHeadToHeadFormat(format) {
    h2hView.format = format;
    document.querySelectorAll('[data-h2h-format]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.h2hFormat === format));
    drawHeadToHead();
}

function toggleHeadToHeadRows(courseKey) {
    h2hView.open[courseKey] = !h2hView.open[courseKey];
    drawHeadToHead();
}
