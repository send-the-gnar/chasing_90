// Dashboard handicap chart: both players' estimated WHS index over time on one shared pair of axes.
// Requires courses.js (PLAYERS), config.js (handicapData, filled by renderHeroStats) and render.js
// (parseLocalDate, formatDateLong).

let handicapCompareChart = null;

// The index only changes when a differential lands, and two diffs can land on the same day (an 18
// plus a pair of nines). On a date axis those would stack into a vertical zigzag, so keep the last
// value of each day — what the index stood at when the day was done.
function dailyIndexPoints(progression) {
    const byDay = new Map();
    progression.forEach(p => byDay.set(p.date, p));
    return [...byDay.values()].map(p => ({
        x: parseLocalDate(p.date).getTime(),
        y: p.whi,
        date: p.date,
    }));
}

function renderHandicapCompare() {
    const wrap = document.getElementById('handicap-compare-wrap');
    if (!wrap) return;
    if (handicapCompareChart) { handicapCompareChart.destroy(); handicapCompareChart = null; }

    // Each line starts at that player's first calculated index (their third differential), so a
    // player who hasn't got one yet is simply left out.
    const series = PLAYERS
        .map(p => ({ ...p, points: dailyIndexPoints(handicapData[p.name]?.progression ?? []) }))
        .filter(s => s.points.length >= 2);

    if (series.length === 0) {
        wrap.innerHTML = '<p class="loading" style="padding:0">Not enough rounds for a handicap index yet.</p>';
        return;
    }
    wrap.innerHTML = '<canvas></canvas>';

    const allX = series.flatMap(s => s.points.map(p => p.x));
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const spansYears = new Date(minX).getFullYear() !== new Date(maxX).getFullYear();

    handicapCompareChart = new Chart(wrap.querySelector('canvas'), {
        type: 'line',
        data: {
            datasets: series.map(s => ({
                label: s.name,
                data: s.points,
                borderColor: s.color.solid,
                backgroundColor: s.color.solid,
                borderWidth: 2.5,
                pointStyle: s.dot,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { left: 4, right: 8 } },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            scales: {
                x: {
                    type: 'linear',
                    min: minX,
                    max: maxX,
                    grid: { display: false },
                    // One tick per month start; a linear axis would otherwise pick arbitrary timestamps.
                    afterBuildTicks: axis => {
                        const ticks = [];
                        const d = new Date(axis.min);
                        d.setDate(1);
                        d.setHours(0, 0, 0, 0);
                        if (d.getTime() < axis.min) d.setMonth(d.getMonth() + 1);
                        for (; d.getTime() <= axis.max; d.setMonth(d.getMonth() + 1)) ticks.push({ value: d.getTime() });
                        axis.ticks = ticks;
                    },
                    ticks: {
                        font: { size: 10 },
                        callback: v => new Date(v).toLocaleDateString('en-US',
                            spansYears ? { month: 'short', year: '2-digit' } : { month: 'short' }),
                    },
                },
                y: {
                    ticks: { font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: 'Handicap Index', font: { size: 10 }, color: '#6b9b6b' },
                },
            },
            plugins: {
                legend: { labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8, padding: 12 } },
                tooltip: {
                    callbacks: {
                        title: items => formatDateLong(items[0].raw.date),
                        label: item => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}`,
                    },
                },
            },
        },
    });
}
