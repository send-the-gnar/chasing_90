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
        const front   = holes.filter(h => h.hole <= 9);
        const back    = holes.filter(h => h.hole > 9);
        const hasPutts = holes.some(h => h.putts !== null);

        function renderNineTable(label, nineHoles) {
            if (nineHoles.length === 0) return '';

            const ninePar   = nineHoles.reduce((s, h) => s + h.par, 0);
            const nineScore = nineHoles.reduce((s, h) => s + h.score, 0);

            let t = '<table class="scorecard-table">';

            t += '<tr><th>' + label + '</th>';
            nineHoles.forEach(h => { t += '<th>' + h.hole + '</th>'; });
            t += '<th class="total-col">Out</th></tr>';

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
        html += renderNineTable('Hole', front);
        if (back.length > 0) {
            html += '<div style="height: 0.75rem;"></div>';
            html += renderNineTable('Hole', back);
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
