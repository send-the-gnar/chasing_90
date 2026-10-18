// Dashboard stats: scoring-average charts (one per course, both players) and a monthly GIR chart.
// Requires courses.js (COURSE_VIEWS, PLAYERS, courseRounds), data.js (parseRate), render.js
// (formatDate, formatToPar) and trends.js-style helpers re-declared locally (trends.js isn't loaded here).

const AVG_WINDOW = { park: 10, champion: 5 };   // rolling window per course; matches the heatmap windows

let scoringAvgCharts = {};
let girChart         = null;
let girCourse        = 'park';

function rollingAverage(values, window) {
    return values.map((_, i) => {
        if (i < window - 1) return null;
        const slice = values.slice(i - window + 1, i + 1);
        return +(slice.reduce((a, b) => a + b, 0) / window).toFixed(1);
    });
}

function renderScoringAverage(courseKey) {
    const course = COURSE_VIEWS[courseKey];
    const wrap   = document.getElementById(`scoring-avg-${courseKey}`);
    if (!wrap) return;
    if (scoringAvgCharts[courseKey]) { scoringAvgCharts[courseKey].destroy(); scoringAvgCharts[courseKey] = null; }

    const w = AVG_WINDOW[courseKey];
    const series = PLAYERS.map(p => {
        const rounds = courseRounds(p.key, courseKey);
        const avg    = rollingAverage(rounds.map(r => r.score), w);
        // x = round number, not date: 18 or 27 holes in a day would otherwise stack up on one x
        // position and make the average zigzag. Each player is plotted against their own count.
        return {
            ...p,
            rounds,
            raw: rounds.map((r, i) => ({ x: i + 1, y: r.score, date: r.date })),
            avgPoints: avg.map((v, i) => v === null ? null : { x: i + 1, y: v, date: rounds[i].date }).filter(Boolean),
        };
    }).filter(s => s.rounds.length >= 3);

    if (series.length === 0) {
        wrap.innerHTML = '<p class="loading" style="padding:0">Not enough rounds on this course yet.</p>';
        return;
    }
    wrap.innerHTML = '<canvas></canvas>';

    const datasets = [];
    series.forEach(s => {
        datasets.push({
            label: `${s.name} rounds`,
            data: s.raw,
            borderColor: 'transparent',
            pointBackgroundColor: s.color.faint,
            pointBorderColor: 'transparent',
            pointStyle: s.dot,
            pointRadius: 3,
            pointHoverRadius: 5,
            showLine: false,
        });
        datasets.push({
            label: `${s.name} ${w}-round avg`,
            data: s.avgPoints,
            borderColor: s.color.solid,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            cubicInterpolationMode: 'monotone',
        });
    });
    const maxRound = Math.max(...series.map(s => s.rounds.length));
    datasets.push({
        label: course.targetLabel,
        data: [{ x: 1, y: course.target }, { x: maxRound, y: course.target }],
        borderColor: 'rgba(180,50,35,0.55)',
        borderDash: [8, 5],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
    });

    scoringAvgCharts[courseKey] = new Chart(wrap.querySelector('canvas'), {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: {
                    type: 'linear',
                    min: 1,
                    max: maxRound,
                    ticks: { font: { size: 10 }, precision: 0, maxTicksLimit: 12 },
                    grid: { display: false },
                    title: { display: true, text: 'Rounds played', font: { size: 10 }, color: '#6b9b6b' },
                },
                y: {
                    ticks: { font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: 'Score', font: { size: 10 }, color: '#6b9b6b' },
                },
            },
            plugins: {
                legend: {
                    labels: {
                        font: { size: 10 }, usePointStyle: true, boxWidth: 8, padding: 12,
                        filter: item => item.text.includes('avg') || item.text === course.targetLabel,
                    },
                },
                tooltip: {
                    callbacks: {
                        title: items => `Round ${items[0].parsed.x}` + (items[0].raw.date ? ` · ${formatDate(items[0].raw.date)}` : ''),
                        label: item => {
                            const l = item.dataset.label;
                            if (l.endsWith('rounds')) return ` ${l.replace(' rounds', '')}: ${item.parsed.y} (${formatToPar(item.parsed.y, course.par)})`;
                            if (l.includes('avg'))    return ` ${l}: ${item.parsed.y.toFixed(1)}`;
                            return null;
                        },
                    },
                },
            },
        },
    });
}

function renderScoringAverages() {
    Object.keys(COURSE_VIEWS).forEach(renderScoringAverage);
}

// ---- Monthly GIR ----
// Per-round GIR is noisy (and 9-hole rounds are tiny samples), so pool by month and weight each
// round by holes played. Only rounds with a logged GIR count; months under GIR_MIN_HOLES are dropped.

const GIR_MIN_HOLES = 18;

function monthlyGir(playerKey, courseKey) {
    const byMonth = {};
    // Any length counts for GIR as long as it was logged — a hole-weighted pool doesn't need standard-length rounds
    allRoundsData
        .filter(r => r.player.toLowerCase() === playerKey && COURSE_VIEWS[courseKey].match(r)
            && r.roundType !== 'scramble' && !r.excludeFromHandicap)
        .forEach(r => {
            const rate = parseRate(r.gir);
            if (rate === null) return;
            const d   = new Date(r.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const m   = byMonth[key] || (byMonth[key] = { greens: 0, holes: 0 });
            m.greens += rate * r.holes;
            m.holes  += r.holes;
        });
    return byMonth;
}

function renderGirChart() {
    const wrap = document.getElementById('gir-chart-wrap');
    if (!wrap) return;
    if (girChart) { girChart.destroy(); girChart = null; }

    const perPlayer = PLAYERS.map(p => ({ ...p, months: monthlyGir(p.key, girCourse) }));
    const keys = [...new Set(perPlayer.flatMap(p =>
        Object.entries(p.months).filter(([, m]) => m.holes >= GIR_MIN_HOLES).map(([k]) => k)))].sort();

    if (keys.length === 0) {
        wrap.innerHTML = '<p class="loading" style="padding:0">No GIR data on this course yet.</p>';
        return;
    }
    wrap.innerHTML = '<canvas></canvas>';

    const labels = keys.map(k => {
        const [y, m] = k.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });
    const pct = (p, k) => {
        const m = p.months[k];
        return m && m.holes >= GIR_MIN_HOLES ? +(100 * m.greens / m.holes).toFixed(1) : null;
    };

    girChart = new Chart(wrap.querySelector('canvas'), {
        type: 'bar',
        data: {
            labels,
            datasets: perPlayer.map(p => ({
                label: p.name,
                data: keys.map(k => pct(p, k)),
                backgroundColor: p.color.solid + 'bf',
                borderRadius: 3,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 10 }, callback: v => v + '%' },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                },
                x: { ticks: { font: { size: 10 } }, grid: { display: false } },
            },
            plugins: {
                legend: { labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8, padding: 12 } },
                tooltip: {
                    callbacks: {
                        label: item => {
                            const p = perPlayer[item.datasetIndex];
                            const m = p.months[keys[item.dataIndex]];
                            return ` ${p.name}: ${item.parsed.y}% (${Math.round(m.greens)} of ${m.holes} holes)`;
                        },
                    },
                },
            },
        },
    });
}

function setGirCourse(key) {
    if (!COURSE_VIEWS[key] || key === girCourse) return;
    girCourse = key;
    document.querySelectorAll('[data-gir-course]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.girCourse === key));
    renderGirChart();
}
