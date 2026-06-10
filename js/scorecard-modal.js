// ---- Round report card helpers ----

function scorecardCourseKey(round) {
    if (isChampionCourse(round)) return 'champion';
    if (isParkCourse(round)) return 'park';
    return round.course.toLowerCase();
}

// Per-hole career averages for this player on this course (scrambles excluded).
// Holes with fewer than 2 recorded scores don't get an average — no basis to compare.
function holeAveragesFor(round) {
    const key = scorecardCourseKey(round);
    const byHole = {};
    allRoundsData.forEach(r => {
        if (r.player.toLowerCase() !== round.player.toLowerCase()) return;
        if (scorecardCourseKey(r) !== key) return;
        if (r.roundType === 'scramble') return;
        const holes = scorecardData[r.roundId];
        if (!holes) return;
        holes.forEach(h => {
            if (!byHole[h.hole]) byHole[h.hole] = { sum: 0, n: 0 };
            byHole[h.hole].sum += h.score;
            byHole[h.hole].n++;
        });
    });
    const avgs = {};
    Object.entries(byHole).forEach(([hole, { sum, n }]) => {
        if (n >= 2) avgs[hole] = sum / n;
    });
    return avgs;
}

function roundScoringCounts(holes) {
    const counts = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0 };
    holes.forEach(h => {
        const d = h.score - h.par;
        if      (d <= -2) counts.eagle++;
        else if (d === -1) counts.birdie++;
        else if (d ===  0) counts.par++;
        else if (d ===  1) counts.bogey++;
        else               counts.double++;
    });
    return counts;
}

const SUMMARY_CATS = [
    { key: 'eagle',  label: 'Eagle+',  color: '#c9a227', text: '#fff' },
    { key: 'birdie', label: 'Birdie',  color: '#2d7a2d', text: '#fff' },
    { key: 'par',    label: 'Par',     color: '#8fb88f', text: '#1a2e1a' },
    { key: 'bogey',  label: 'Bogey',   color: '#e3c44d', text: '#1a2e1a' },
    { key: 'double', label: 'Double+', color: '#cf6b3a', text: '#fff' },
];

function renderScoringSummary(holes) {
    const counts = roundScoringCounts(holes);
    const present = SUMMARY_CATS.filter(c => counts[c.key] > 0);
    const segs = present.map(c =>
        `<div class="summary-seg" style="width:${(counts[c.key] / holes.length * 100).toFixed(1)}%; background:${c.color}; color:${c.text};" title="${c.label}: ${counts[c.key]}">${counts[c.key]}</div>`
    ).join('');
    const chips = present.map(c =>
        `<span class="summary-chip"><span class="summary-dot" style="background:${c.color}"></span>${counts[c.key]} ${c.label}</span>`
    ).join('');
    return `<div class="round-summary"><div class="summary-bar">${segs}</div><div class="summary-chips">${chips}</div></div>`;
}

function formatVsDelta(d) {
    if (Math.abs(d) < 0.05) return 'E';
    return (d > 0 ? '+' : '-') + Math.abs(d).toFixed(1);
}

function vsDeltaClass(d) {
    if (d <= -1)    return 'vs-much-better';
    if (d < -0.05)  return 'vs-better';
    if (d <= 0.05)  return 'vs-even';
    if (d < 1)      return 'vs-worse';
    return 'vs-much-worse';
}

function trimNum(v) {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function pluralize(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Auto-generated headline, e.g. "3 birdies · best front 9 yet · 2 putts saved vs. average"
function buildRoundHeadline(round, holes) {
    if (round.roundType === 'scramble') return 'Scramble round — team score';

    const facts = [];
    const counts = roundScoringCounts(holes);
    if (counts.eagle)  facts.push(pluralize(counts.eagle, 'eagle'));
    if (counts.birdie) facts.push(pluralize(counts.birdie, 'birdie'));
    if (!counts.eagle && !counts.birdie && counts.par >= 1) facts.push(pluralize(counts.par, 'par'));

    const key = scorecardCourseKey(round);
    const comparable = allRoundsData.filter(r =>
        r.player.toLowerCase() === round.player.toLowerCase()
        && scorecardCourseKey(r) === key
        && r.holes === round.holes
        && r.roundType !== 'scramble');

    if (comparable.length < 2) {
        facts.push('first recorded round on this course');
        return facts.slice(0, 3).join(' · ');
    }

    const betterRounds = comparable.filter(r => r.score < round.score).length;
    if      (betterRounds === 0) facts.push('best round yet on this course');
    else if (betterRounds === 1) facts.push('2nd best round on this course');

    if (round.holes === 18) {
        const nineSum = (roundId, from, to) => {
            const hs = scorecardData[roundId];
            if (!hs) return null;
            const nine = hs.filter(h => h.hole >= from && h.hole <= to);
            return nine.length === 9 ? nine.reduce((s, h) => s + h.score, 0) : null;
        };
        [['front 9', 1, 9], ['back 9', 10, 18]].forEach(([label, from, to]) => {
            const mine = nineSum(round.roundId, from, to);
            if (mine === null) return;
            const others = comparable
                .filter(r => r.roundId !== round.roundId)
                .map(r => nineSum(r.roundId, from, to))
                .filter(v => v !== null);
            if (others.length >= 1 && mine < Math.min(...others)) facts.push(`best ${label} yet`);
        });
    }

    const puttsTotal = roundId => {
        const hs = scorecardData[roundId];
        if (!hs || hs.length === 0 || hs.some(h => h.putts === null)) return null;
        return hs.reduce((s, h) => s + h.putts, 0);
    };
    const myPutts = puttsTotal(round.roundId);
    if (myPutts !== null) {
        const otherPutts = comparable
            .filter(r => r.roundId !== round.roundId)
            .map(r => puttsTotal(r.roundId))
            .filter(v => v !== null);
        if (otherPutts.length >= 2) {
            const saved = otherPutts.reduce((a, b) => a + b, 0) / otherPutts.length - myPutts;
            if      (saved >= 1)  facts.push(`${trimNum(saved)} putts saved vs. average`);
            else if (saved <= -1) facts.push(`${trimNum(-saved)} extra putts vs. average`);
        }
    }

    const avgScore = comparable.reduce((s, r) => s + r.score, 0) / comparable.length;
    const scoreDiff = avgScore - round.score;
    if (scoreDiff >= 1.5)       facts.push(`${trimNum(scoreDiff)} strokes better than your average`);
    else if (scoreDiff <= -1.5) facts.push(`${trimNum(-scoreDiff)} strokes over your average`);
    else if (facts.length < 2)  facts.push('right around your course average');

    return facts.slice(0, 3).join(' · ');
}

// ---- Modal ----

function openScorecard(roundId) {
    if (!roundId) return;

    const round = allRoundsData.find(r => r.roundId === roundId);
    if (!round) return;

    const holes   = scorecardData[roundId];
    const overlay = document.getElementById('scorecard-overlay');
    const content = document.getElementById('scorecard-content');
    const toPar   = formatToPar(round.score, round.par);

    let html = `
        <div class="scorecard-header">
            <div class="scorecard-header-info">
                <h3>${round.course}</h3>
                <p>${formatDateLong(round.date)} · ${round.player} · ${round.teeColor}</p>
            </div>
            <div class="scorecard-total">
                <span class="big-score">${round.score}</span>
                <span class="to-par">(${toPar})</span>
            </div>
        </div>
    `;

    if (holes && holes.length > 0) {
        const front    = holes.filter(h => h.hole <= 9);
        const back     = holes.filter(h => h.hole > 9);
        const hasPutts = holes.some(h => h.putts !== null);
        // vs-average comparisons make no sense for team scrambles
        const holeAvgs = round.roundType === 'scramble' ? null : holeAveragesFor(round);

        const headline = buildRoundHeadline(round, holes);
        html += '<div class="scorecard-report">';
        if (headline) html += `<div class="scorecard-headline">${headline}</div>`;
        html += renderScoringSummary(holes);
        html += '</div>';

        function renderNineTable(nineHoles, totalLabel) {
            if (nineHoles.length === 0) return '';

            const ninePar   = nineHoles.reduce((s, h) => s + h.par, 0);
            const nineScore = nineHoles.reduce((s, h) => s + h.score, 0);

            let t = '<table class="scorecard-table">';

            t += '<tr><th>Hole</th>';
            nineHoles.forEach(h => { t += '<th>' + h.hole + '</th>'; });
            t += '<th class="total-col">' + totalLabel + '</th></tr>';

            t += '<tr><td class="stat-label">Par</td>';
            nineHoles.forEach(h => { t += '<td>' + h.par + '</td>'; });
            t += '<td class="total-col">' + ninePar + '</td></tr>';

            t += '<tr><td class="stat-label">Score</td>';
            nineHoles.forEach(h => {
                const diff = h.score - h.par;
                const cls  = scoreShapeClass(diff);
                t += '<td><span class="score-shape ' + cls + '">' + h.score + '</span></td>';
            });
            t += '<td class="total-col">' + nineScore + '</td></tr>';

            if (holeAvgs) {
                let deltaSum = 0, anyDelta = false;
                let row = '<tr><td class="stat-label">vs avg</td>';
                nineHoles.forEach(h => {
                    const avg = holeAvgs[h.hole];
                    if (avg === undefined) {
                        row += '<td class="vs-cell vs-na">—</td>';
                        return;
                    }
                    const d = h.score - avg;
                    deltaSum += d;
                    anyDelta = true;
                    row += `<td class="vs-cell ${vsDeltaClass(d)}" title="Your average on this hole: ${avg.toFixed(1)}">${formatVsDelta(d)}</td>`;
                });
                row += `<td class="total-col vs-cell ${anyDelta ? vsDeltaClass(deltaSum / 3) : 'vs-na'}">${anyDelta ? formatVsDelta(deltaSum) : '—'}</td></tr>`;
                t += row;
            }

            if (hasPutts) {
                const ninePutts = nineHoles.reduce((s, h) => s + (h.putts || 0), 0);
                t += '<tr><td class="stat-label">Putts</td>';
                nineHoles.forEach(h => {
                    t += '<td>' + (h.putts !== null ? h.putts : '—') + '</td>';
                });
                t += '<td class="total-col">' + ninePutts + '</td></tr>';
            }

            t += '</table>';
            return t;
        }

        html += '<div class="scorecard-table-wrapper">';
        html += renderNineTable(front, 'Out');
        if (back.length > 0) {
            html += '<div style="height: 0.75rem;"></div>';
            html += renderNineTable(back, 'In');
        }
        if (holeAvgs) {
            html += '<p class="vs-avg-note">vs avg = this round against your per-hole career average on this course · green = better, red = worse</p>';
        }
        html += '</div>';
    } else {
        html += '<div class="scorecard-empty">No hole-by-hole data for this round yet.<br>Add it to the Scorecards sheet to see it here.</div>';
    }

    content.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeScorecard() {
    document.getElementById('scorecard-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

function closeScorecardIfBackground(event) {
    if (event.target === document.getElementById('scorecard-overlay')) closeScorecard();
}
