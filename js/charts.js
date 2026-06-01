let trajectoryChart   = null;
let parkHistogramChart = null;

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
                    borderColor: '#4a7c4a',
                    backgroundColor: 'rgba(74,124,74,0.08)',
                    fill: false,
                    spanGaps: true,
                    tension: 0.25,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#4a7c4a',
                    borderWidth: 2.5,
                },
                {
                    label: 'Amelie',
                    data: amelieData,
                    borderColor: '#c9a227',
                    backgroundColor: 'rgba(201,162,39,0.08)',
                    fill: false,
                    spanGaps: true,
                    tension: 0.25,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#c9a227',
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
                    backgroundColor: 'rgba(74,124,74,0.75)',
                    borderColor: '#4a7c4a',
                    borderWidth: 1,
                    borderRadius: 3,
                },
                {
                    label: 'Amelie',
                    data: countFor(amelieRounds),
                    backgroundColor: 'rgba(201,162,39,0.75)',
                    borderColor: '#c9a227',
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
