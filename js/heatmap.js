// Keyed by "player|holeNum|containerId" → round detail objects for hole detail modal
const holeDetailCache = {};

let holeDetailChart = null;

function isChampionCourse(round) {
    const c = round.course.toLowerCase();
    return (c.includes('mieming') || c.includes('champion')) && !c.includes('park');
}

function isParkCourse(round) {
    return round.course.toLowerCase().includes('park');
}

// ---- Heatmap colour scale ----

function lerp(a, b, t) { return a + (b - a) * t; }

const HEATMAP_STOPS = [
    { d: 0,   rgb: [40,  130, 40]  },
    { d: 1.0, rgb: [130, 200, 130] },
    { d: 2.0, rgb: [250, 220, 80]  },
    { d: 3.0, rgb: [240, 120, 50]  },
    { d: 4.0, rgb: [190, 45,  30]  },
];

function heatmapColor(delta) {
    const c = Math.max(0, Math.min(4, delta));
    let lo = HEATMAP_STOPS[0], hi = HEATMAP_STOPS[HEATMAP_STOPS.length - 1];
    for (let i = 0; i < HEATMAP_STOPS.length - 1; i++) {
        if (c >= HEATMAP_STOPS[i].d && c <= HEATMAP_STOPS[i + 1].d) {
            lo = HEATMAP_STOPS[i]; hi = HEATMAP_STOPS[i + 1]; break;
        }
    }
    const t = lo.d === hi.d ? 0 : (c - lo.d) / (hi.d - lo.d);
    const r = Math.round(lerp(lo.rgb[0], hi.rgb[0], t));
    const g = Math.round(lerp(lo.rgb[1], hi.rgb[1], t));
    const b = Math.round(lerp(lo.rgb[2], hi.rgb[2], t));
    return `rgb(${r},${g},${b})`;
}

function heatmapTextColor(delta) {
    return (delta <= 0.3 || delta >= 3.2) ? '#fff' : '#1a2e1a';
}

// ---- Main heatmap renderer ----

function renderHeatmap(containerId, roundFilter, options = {}) {
    const rollingN = options.rollingN || null;
    const container = document.getElementById(containerId);

    function getMatchingRounds(player) {
        return allRoundsData.filter(r =>
            r.player.toLowerCase() === player.toLowerCase()
            && roundFilter(r)
            && scorecardData[r.roundId]
        );
    }

    const danielRounds = getMatchingRounds('Daniel');
    const amelieRounds = getMatchingRounds('Amelie');

    if (danielRounds.length === 0 && amelieRounds.length === 0) {
        container.innerHTML = '<p class="loading" style="padding:0">No scorecard data for this course yet.</p>';
        return;
    }

    function buildHoleRounds(rounds) {
        const byHole = {};
        rounds.forEach(r => {
            (scorecardData[r.roundId] || []).forEach(h => {
                if (!byHole[h.hole]) byHole[h.hole] = [];
                byHole[h.hole].push({ date: r.date, score: h.score, par: h.par, putts: h.putts });
            });
        });
        Object.values(byHole).forEach(arr => arr.sort((a, b) => new Date(a.date) - new Date(b.date)));
        return byHole;
    }

    const danielHoleRounds = buildHoleRounds(danielRounds);
    const amelieHoleRounds = buildHoleRounds(amelieRounds);

    const courseName = (danielRounds[0] || amelieRounds[0]).course.replace(/GC Mieming\s*/i, '');

    function computeAvgs(holeRounds) {
        if (Object.keys(holeRounds).length === 0) return null;
        const avgs = {};
        for (const [hole, list] of Object.entries(holeRounds)) {
            const recent = rollingN ? list.slice(-rollingN) : list;
            const scoreSum = recent.reduce((s, r) => s + r.score, 0);
            const parSum   = recent.reduce((s, r) => s + r.par, 0);
            avgs[+hole] = {
                avg:   scoreSum / recent.length,
                par:   Math.round(parSum / recent.length),
                delta: (scoreSum - parSum) / recent.length,
                count: recent.length,
            };
        }
        return avgs;
    }

    const dAvgs = computeAvgs(danielHoleRounds);
    const aAvgs = computeAvgs(amelieHoleRounds);
    const refAvgs = dAvgs || aAvgs;

    const allHoleNums = Object.keys(refAvgs || {}).map(Number);
    const hasBack9 = allHoleNums.some(h => h > 9);

    function findExtremes(avgs) {
        if (!avgs) return { nemesis: null, fave: null };
        const eligible = Object.entries(avgs)
            .filter(([, a]) => a.count >= 2)
            .map(([h, a]) => ({ hole: +h, delta: a.delta }));
        if (eligible.length === 0) return { nemesis: null, fave: null };
        return {
            nemesis: eligible.reduce((w, e) => e.delta > w.delta ? e : w, eligible[0]).hole,
            fave:    eligible.reduce((b, e) => e.delta < b.delta ? e : b, eligible[0]).hole,
        };
    }

    const dEx = findExtremes(dAvgs);
    const aEx = findExtremes(aAvgs);

    function cacheHoleDetails(player, holeRounds, avgs) {
        if (!avgs) return;
        Object.entries(holeRounds).forEach(([holeStr, rounds]) => {
            const holeNum = +holeStr;
            const key = `${player}|${holeNum}|${containerId}`;
            holeDetailCache[key] = { player, holeNum, par: avgs[holeNum] ? avgs[holeNum].par : rounds[0].par, courseName, rounds, rollingN };
        });
    }

    cacheHoleDetails('Daniel', danielHoleRounds, dAvgs);
    cacheHoleDetails('Amelie', amelieHoleRounds, aAvgs);

    function playerRow(player, avgs, holeRounds, holes, ex) {
        let cells = `<div class="heatmap-label-cell">${player}</div>`;
        let totalScore = 0, totalPar = 0, dataCount = 0;
        holes.forEach(h => {
            if (avgs && avgs[h]) {
                const a = avgs[h];
                const bg = heatmapColor(a.delta);
                const fg = heatmapTextColor(a.delta);
                const sign = a.delta >= 0 ? '+' : '';
                const isNemesis = ex.nemesis === h;
                const isFave    = ex.fave    === h;
                const extraClass = isNemesis ? ' heatmap-nemesis' : isFave ? ' heatmap-fave' : '';
                const badgeChar = isNemesis ? '!' : '★';
                const badge = `<span class="hole-badge"${(!isNemesis && !isFave) ? ' style="visibility:hidden"' : ''}>${badgeChar}</span>`;
                const key = `${player}|${h}|${containerId}`;
                totalScore += a.avg;
                totalPar   += a.par;
                dataCount++;
                cells += `<div class="heatmap-cell${extraClass}" data-hole-key="${key}" style="background:${bg};color:${fg};" onclick="openHoleDetail('${key}')">${sign}${a.delta.toFixed(1)}${badge}</div>`;
            } else {
                cells += '<div class="heatmap-cell heatmap-no-data">—</div>';
            }
        });
        if (dataCount > 0) {
            const totalDelta = totalScore - totalPar;
            const avgDeltaPerHole = totalDelta / dataCount;
            const bg = heatmapColor(avgDeltaPerHole);
            const fg = heatmapTextColor(avgDeltaPerHole);
            const totalSign = totalDelta >= 0 ? '+' : '';
            cells += `<div class="heatmap-cell heatmap-total-cell" style="background:${bg};color:${fg};">${totalSign}${totalDelta.toFixed(1)}</div>`;
        } else {
            cells += '<div class="heatmap-cell heatmap-total-cell heatmap-no-data">—</div>';
        }
        return cells;
    }

    function renderHalf(holes, totalLabel) {
        let html = '<div class="heatmap-grid">';
        html += '<div class="heatmap-label-cell"></div>';
        holes.forEach(h => { html += `<div class="heatmap-hole-num">${h}</div>`; });
        html += `<div class="heatmap-hole-num heatmap-total-num">${totalLabel}</div>`;
        if (refAvgs) {
            let parTotal = 0;
            html += '<div class="heatmap-label-cell" style="color:var(--green-500);">Par</div>';
            holes.forEach(h => {
                const par = refAvgs[h] ? refAvgs[h].par : '—';
                if (refAvgs[h]) parTotal += refAvgs[h].par;
                html += `<div class="heatmap-cell heatmap-par-cell">${par}</div>`;
            });
            html += `<div class="heatmap-cell heatmap-par-cell heatmap-total-cell">${parTotal || '—'}</div>`;
        }
        html += playerRow('Daniel', dAvgs, danielHoleRounds, holes, dEx);
        html += playerRow('Amelie', aAvgs, amelieHoleRounds, holes, aEx);
        html += '</div>';
        return html;
    }

    const front = Array.from({length: 9}, (_, i) => i + 1);
    const back  = Array.from({length: 9}, (_, i) => i + 10);

    let html = '<div class="heatmap-wrap">';
    html += renderHalf(front, hasBack9 ? 'Out' : 'Total');
    if (hasBack9) {
        html += '<div style="height:0.75rem;"></div>';
        html += renderHalf(back, 'In');
    }
    html += '</div>';

    const parts = [];
    if (danielRounds.length > 0) parts.push(`Daniel: ${danielRounds.length} round${danielRounds.length !== 1 ? 's' : ''}`);
    if (amelieRounds.length > 0) parts.push(`Amelie: ${amelieRounds.length} round${amelieRounds.length !== 1 ? 's' : ''}`);
    const rollingNote = rollingN ? ` · rolling avg (last ${rollingN})` : '';
    html += `<p class="heatmap-note">${parts.join(' · ')}${rollingNote}</p>`;

    container.innerHTML = html;
}

// ---- Hole detail modal ----

function openHoleDetail(key) {
    const entry = holeDetailCache[key];
    if (!entry) return;
    const { player, holeNum, par, courseName, rounds, rollingN } = entry;

    const overlay = document.getElementById('hole-detail-overlay');
    const content = document.getElementById('hole-detail-content');

    const hasPutts = rounds.some(r => r.putts !== null);
    const newestFirst = [...rounds].reverse();
    const windowSize = rollingN ? Math.min(rollingN, newestFirst.length) : newestFirst.length;
    const isRolling = rollingN && rounds.length > 0;
    const rollingLabel = isRolling
        ? `<span class="hole-detail-rolling-badge">last ${windowSize}</span>`
        : '';

    let chartHtml = '';
    if (rounds.length < 3) {
        chartHtml = `
            <div class="hole-chart-section">
                <p class="hole-chart-title">H${holeNum} Score History</p>
                <p style="font-size:0.8rem;color:var(--green-400);font-style:italic;margin-top:0.25rem;">Not enough data yet (need 3+ rounds).</p>
            </div>
        `;
    } else {
        chartHtml = `
            <div class="hole-chart-section">
                <p class="hole-chart-title">H${holeNum} Score History</p>
                <div class="hole-chart-wrap">
                    <canvas id="hole-detail-chart"></canvas>
                </div>
            </div>
        `;
    }

    let html = `
        <div class="hole-detail-header">
            <div>
                <h3>${player} — Hole ${holeNum}</h3>
                <p>${courseName} · Par ${par} · ${rounds.length} round${rounds.length !== 1 ? 's' : ''}${rollingLabel}</p>
            </div>
        </div>
        <div class="hole-detail-body">
            ${chartHtml}
            <table class="hole-detail-table">
                <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>To Par</th>
                    ${hasPutts ? '<th>Putts</th>' : ''}
                </tr>
    `;

    newestFirst.forEach((r, i) => {
        const isOlder = isRolling && i >= windowSize;
        if (isRolling && i === windowSize && rounds.length > windowSize) {
            const colspan = hasPutts ? 4 : 3;
            html += `<tr class="hole-detail-divider"><td colspan="${colspan}">Earlier rounds</td></tr>`;
        }
        const diff = r.score - r.par;
        const sign = diff >= 0 ? '+' : '';
        const shapeClass = scoreShapeClass(diff);
        html += `
            <tr${isOlder ? ' class="hole-detail-older"' : ''}>
                <td>${formatDate(r.date)}</td>
                <td><span class="score-shape ${shapeClass}">${r.score}</span></td>
                <td>${sign}${diff}</td>
                ${hasPutts ? `<td>${r.putts !== null ? r.putts : '—'}</td>` : ''}
            </tr>
        `;
    });

    const rollingRounds = newestFirst.slice(0, windowSize);
    const rollingDelta  = rollingRounds.reduce((s, r) => s + (r.score - r.par), 0) / rollingRounds.length;
    const rollingSign   = rollingDelta >= 0 ? '+' : '';

    let avgHtml = '';
    if (isRolling && rounds.length > windowSize) {
        const allDelta = rounds.reduce((s, r) => s + (r.score - r.par), 0) / rounds.length;
        const allSign  = allDelta >= 0 ? '+' : '';
        avgHtml = `
            <div class="hole-detail-avg">
                <span>Last ${windowSize} avg</span>
                <strong>${rollingSign}${rollingDelta.toFixed(2)}</strong>
            </div>
            <div class="hole-detail-avg" style="margin-top:0.3rem;opacity:0.6;font-size:0.8rem;">
                <span>All-time avg (${rounds.length})</span>
                <strong style="font-size:0.9rem;">${allSign}${allDelta.toFixed(2)}</strong>
            </div>
        `;
    } else {
        const label = isRolling ? `Last ${windowSize} avg` : 'Average to par';
        avgHtml = `
            <div class="hole-detail-avg">
                <span>${label}</span>
                <strong>${rollingSign}${rollingDelta.toFixed(2)}</strong>
            </div>
        `;
    }

    html += `</table>${avgHtml}</div>`;

    content.innerHTML = html;
    if (rounds.length >= 3) renderHoleDetailChart(rounds, par, holeNum);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeHoleDetail() {
    document.getElementById('hole-detail-overlay').classList.remove('active');
    document.body.style.overflow = '';
    if (holeDetailChart) { holeDetailChart.destroy(); holeDetailChart = null; }
}

function closeHoleDetailIfBackground(event) {
    if (event.target === document.getElementById('hole-detail-overlay')) closeHoleDetail();
}

function renderHoleDetailChart(rounds, par, holeNum) {
    const ctx = document.getElementById('hole-detail-chart');
    if (!ctx) return;
    if (holeDetailChart) { holeDetailChart.destroy(); holeDetailChart = null; }

    const ROLLING_WINDOW = 5;

    const labels = rounds.map(r => {
        const d = new Date(r.date);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    });

    const barColors = rounds.map(r => {
        if (r.score <= par - 1) return '#3B82F6';
        if (r.score === par)    return '#22C55E';
        if (r.score === par + 1) return '#EAB308';
        return '#EF4444';
    });

    const rollingAvg = rounds.map((_, i) => {
        if (i < ROLLING_WINDOW - 1) return null;
        const window = rounds.slice(i - ROLLING_WINDOW + 1, i + 1);
        return window.reduce((s, r) => s + r.score, 0) / ROLLING_WINDOW;
    });

    const maxScore = Math.max(...rounds.map(r => r.score));
    const yMin = Math.max(1, par - 2);
    const yMax = maxScore + 1;
    const rotateLabels = rounds.length > 10;

    holeDetailChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Score',
                    data: rounds.map(r => r.score),
                    backgroundColor: barColors,
                    borderColor: barColors,
                    borderWidth: 1,
                    order: 3,
                },
                {
                    label: '5-round avg',
                    data: rollingAvg,
                    type: 'line',
                    borderColor: '#475569',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBackgroundColor: '#475569',
                    fill: false,
                    spanGaps: false,
                    tension: 0.3,
                    order: 1,
                },
                {
                    label: 'Par',
                    data: Array(rounds.length).fill(par),
                    type: 'line',
                    borderColor: '#6B7280',
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    fill: false,
                    order: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: { font: { size: 10 }, stepSize: 1, precision: 0 },
                    grid: { color: 'rgba(0,0,0,0.06)' },
                },
                x: {
                    ticks: { font: { size: 9 }, maxRotation: rotateLabels ? 45 : 0, minRotation: rotateLabels ? 45 : 0 },
                    grid: { display: false },
                },
            },
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { size: 10 }, padding: 10, usePointStyle: false } },
                tooltip: {
                    callbacks: {
                        label: (item) => {
                            if (item.dataset.label === 'Par') return `Par: ${par}`;
                            if (item.dataset.label === '5-round avg') {
                                return item.parsed.y !== null ? `5-round avg: ${item.parsed.y.toFixed(1)}` : null;
                            }
                            const diff = item.parsed.y - par;
                            const sign = diff >= 0 ? '+' : '';
                            return `Score: ${item.parsed.y} (${sign}${diff})`;
                        },
                    },
                },
            },
        },
    });
}
