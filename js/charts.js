let trajectoryChart    = null;
let parkHistogramChart = null;
let scoringDistChartDaniel = null;
let scoringDistChartAmelie = null;

const DANIEL_COLOR = { solid: '#4a6fa5', fill: 'rgba(74,111,165,0.08)', bar: 'rgba(74,111,165,0.75)' };
const AMELIE_COLOR = { solid: '#4a7c4a', fill: 'rgba(74,124,74,0.08)',  bar: 'rgba(74,124,74,0.75)'  };

function renderRoadTo90(roundsData) {
    const danielRounds = roundsData.daniel
        .filter(isChampionCourse)
        .filter(r => r.roundType !== 'scramble')
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    const amelieRounds = roundsData.amelie
        .filter(isChampionCourse)
        .filter(r => r.roundType !== 'scramble')
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const wrap = document.getElementById('trajectory-wrap');
    if (danielRounds.length === 0 && amelieRounds.length === 0) {
        wrap.innerHTML = '<p class="loading" style="padding:0">No Champion Course 18-hole rounds yet.</p>';
        return;
    }

    const allDates = [...new Set([
        ...danielRounds.map(r => r.date),
        ...amelieRounds.map(r => r.date),
    ])].sort();

    const danielByDate = Object.fromEntries(danielRounds.map(r => [r.date, r.score]));
    const amelieByDate = Object.fromEntries(amelieRounds.map(r => [r.date, r.score]));

    const labels     = allDates.map(d => formatDate(d));
    const danielData = allDates.map(d => danielByDate[d] ?? null);
    const amelieData = allDates.map(d => amelieByDate[d] ?? null);
    const targetData = allDates.map(() => 90);

    const allScores = [...danielRounds, ...amelieRounds].map(r => r.score);
    const yMin = Math.floor(Math.min(...allScores, 90) - 2);
    const yMax = Math.ceil(Math.max(...allScores) + 3);

    const ctx = document.getElementById('trajectory-chart');
    if (!ctx) return;
    if (trajectoryChart) { trajectoryChart.destroy(); trajectoryChart = null; }

    trajectoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Daniel',
                    data: danielData,
                    borderColor: DANIEL_COLOR.solid,
                    backgroundColor: DANIEL_COLOR.fill,
                    fill: false,
                    spanGaps: true,
                    tension: 0.25,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: DANIEL_COLOR.solid,
                    borderWidth: 2.5,
                },
                {
                    label: 'Amelie',
                    data: amelieData,
                    borderColor: AMELIE_COLOR.solid,
                    backgroundColor: AMELIE_COLOR.fill,
                    fill: false,
                    spanGaps: true,
                    tension: 0.25,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: AMELIE_COLOR.solid,
                    borderWidth: 2.5,
                },
                {
                    label: 'Target: 90',
                    data: targetData,
                    borderColor: 'rgba(180,50,35,0.55)',
                    borderDash: [8, 5],
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    spanGaps: true,
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
                    ticks: { font: { size: 11 }, stepSize: 5 },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                },
                x: {
                    ticks: { font: { size: 10 } },
                    grid: { display: false },
                },
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 11 }, usePointStyle: true, padding: 16 },
                },
                tooltip: {
                    callbacks: {
                        label: (item) => {
                            if (item.dataset.label === 'Target: 90') return null;
                            return `${item.dataset.label}: ${item.parsed.y}`;
                        },
                    },
                },
            },
        },
    });
}

function renderParkHistogram() {
    const eligible = r =>
        isParkCourse(r) && r.holes === 9 && r.roundType !== 'scramble' && !r.excludeFromHandicap;

    const danielRounds = allRoundsData.filter(r => r.player.toLowerCase() === 'daniel' && eligible(r));
    const amelieRounds = allRoundsData.filter(r => r.player.toLowerCase() === 'amelie' && eligible(r));

    const canvas = document.getElementById('park-histogram');
    if (danielRounds.length === 0 && amelieRounds.length === 0) {
        canvas.style.display = 'none';
        return;
    }

    const allOverPar = [...danielRounds, ...amelieRounds].map(r => r.score - r.par);
    const minOP = Math.min(...allOverPar);
    const maxOP = Math.max(...allOverPar);

    const labels    = [];
    const binValues = [];
    for (let v = minOP; v <= maxOP; v++) {
        labels.push(v >= 0 ? `+${v}` : `${v}`);
        binValues.push(v);
    }

    const countFor = rounds => binValues.map(v => rounds.filter(r => (r.score - r.par) === v).length);

    if (parkHistogramChart) { parkHistogramChart.destroy(); parkHistogramChart = null; }

    parkHistogramChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Daniel',
                    data: countFor(danielRounds),
                    backgroundColor: DANIEL_COLOR.bar,
                    borderColor: DANIEL_COLOR.solid,
                    borderWidth: 1,
                    borderRadius: 3,
                },
                {
                    label: 'Amelie',
                    data: countFor(amelieRounds),
                    backgroundColor: AMELIE_COLOR.bar,
                    borderColor: AMELIE_COLOR.solid,
                    borderWidth: 1,
                    borderRadius: 3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: 'Rounds', font: { size: 11 }, color: '#6b9b6b' },
                },
                x: {
                    ticks: { font: { size: 11 } },
                    grid: { display: false },
                    title: { display: true, text: 'Score to par', font: { size: 11 }, color: '#6b9b6b' },
                },
            },
            plugins: {
                legend: { labels: { font: { size: 11 }, boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        title: items => `${items[0].label} over par`,
                        label: item => ` ${item.dataset.label}: ${item.raw} round${item.raw !== 1 ? 's' : ''}`,
                    },
                },
            },
        },
    });
}

function getScoringDistribution(playerName) {
    const counts = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0 };
    let total = 0;
    allRoundsData.forEach(r => {
        if (r.player.toLowerCase() !== playerName.toLowerCase()) return;
        if (r.roundType === 'scramble') return;
        const holes = scorecardData[r.roundId];
        if (!holes || holes.length === 0) return;
        holes.forEach(h => {
            const diff = h.score - h.par;
            total++;
            if      (diff <= -2) counts.eagle++;
            else if (diff === -1) counts.birdie++;
            else if (diff ===  0) counts.par++;
            else if (diff ===  1) counts.bogey++;
            else                  counts.double++;
        });
    });
    return { counts, total };
}

function makeScoringChart(canvasId, dist, color, yMax) {
    const categories = ['Eagle+', 'Birdie', 'Par', 'Bogey', 'Double+'];
    const catKeys    = ['eagle', 'birdie', 'par', 'bogey', 'double'];
    const pctOf = key => dist.total > 0 ? parseFloat((dist.counts[key] / dist.total * 100).toFixed(1)) : 0;

    return new Chart(document.getElementById(canvasId), {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                data: catKeys.map(pctOf),
                backgroundColor: color.bg,
                borderColor: color.border,
                borderWidth: 1,
                borderRadius: 3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: yMax,
                    ticks: { font: { size: 11 }, callback: v => v + '%' },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                },
                x: { ticks: { font: { size: 11 } }, grid: { display: false } },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: item => {
                            const count = dist.counts[catKeys[item.dataIndex]];
                            return ` ${item.raw}% (${count} hole${count !== 1 ? 's' : ''})`;
                        },
                    },
                },
            },
        },
    });
}

function renderScoringStats() {
    const tableEl = document.getElementById('scoring-dist-table');
    if (!tableEl) return;

    const daniel = getScoringDistribution('daniel');
    const amelie = getScoringDistribution('amelie');

    if (daniel.total === 0 && amelie.total === 0) {
        document.querySelector('.scoring-charts-wrap').style.display = 'none';
        tableEl.innerHTML = '<p class="loading">No hole-by-hole scorecard data yet.</p>';
        return;
    }

    const categories = ['Eagle+', 'Birdie', 'Par', 'Bogey', 'Double+'];
    const catKeys    = ['eagle', 'birdie', 'par', 'bogey', 'double'];
    const allPcts = catKeys.flatMap(k => [
        daniel.total > 0 ? daniel.counts[k] / daniel.total * 100 : 0,
        amelie.total > 0 ? amelie.counts[k] / amelie.total * 100 : 0,
    ]);
    const yMax = Math.min(100, Math.ceil(Math.max(...allPcts) / 10) * 10 + 10);

    if (scoringDistChartDaniel) { scoringDistChartDaniel.destroy(); scoringDistChartDaniel = null; }
    if (scoringDistChartAmelie) { scoringDistChartAmelie.destroy(); scoringDistChartAmelie = null; }

    scoringDistChartDaniel = makeScoringChart('scoring-dist-chart-daniel', daniel,
        { bg: DANIEL_COLOR.bar, border: DANIEL_COLOR.solid }, yMax);
    scoringDistChartAmelie = makeScoringChart('scoring-dist-chart-amelie', amelie,
        { bg: AMELIE_COLOR.bar, border: AMELIE_COLOR.solid }, yMax);

    const pct = (n, t) => t > 0 ? (n / t * 100).toFixed(1) + '%' : '—';
    const dT = daniel.total, aT = amelie.total;

    let rows = catKeys.map((k, i) => `
        <tr>
            <td>${categories[i]}</td>
            <td>${daniel.counts[k]}</td><td class="pct-col">${pct(daniel.counts[k], dT)}</td>
            <td>${amelie.counts[k]}</td><td class="pct-col">${pct(amelie.counts[k], aT)}</td>
        </tr>`).join('');

    document.getElementById('scoring-dist-table').innerHTML = `
        <table class="scoring-dist-table">
            <thead>
                <tr>
                    <th></th>
                    <th colspan="2">Daniel <span class="scoring-table-sub">${dT} holes</span></th>
                    <th colspan="2">Amelie <span class="scoring-table-sub">${aT} holes</span></th>
                </tr>
                <tr class="scoring-table-subhead">
                    <th>Score</th>
                    <th>#</th><th>%</th>
                    <th>#</th><th>%</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}
