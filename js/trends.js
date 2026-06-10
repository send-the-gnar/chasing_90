// Trends page: rolling averages, monthly table, pace-to-goal projection, personal records.
// Relies on globals from config.js (scorecardData, allRoundsData) and helpers from data.js
// (parseCSV, processRoundsData, processScorecardData), render.js (formatDate, formatToPar)
// and heatmap.js (isChampionCourse, isParkCourse).
//
// The two Mieming courses (par 73 vs par 29) don't compare stroke for stroke, so the whole
// page renders one course at a time and works in raw scores. Requiring the course's standard
// round length also drops incomplete rounds (12-, 14-, 6-hole partials in the sheet).

const PACE_FIT_POINTS = 20;  // most recent rolling-average points the projection is fitted to
const MS_PER_DAY      = 86400000;

const TREND_COURSES = {
    park: {
        label: 'Park Course',
        match: isParkCourse,
        holes: 9,
        par: 29,
        target: 29 + GOAL_9_OVER_PAR,            // 36 — the journal's 9-hole goal
        targetLabel: `Goal: ${29 + GOAL_9_OVER_PAR} (+${GOAL_9_OVER_PAR})`,
        goalPhrase: `reach the 9-hole goal of ${29 + GOAL_9_OVER_PAR}`,
        paceTitle: `Projected Path to ${29 + GOAL_9_OVER_PAR} — the 9-Hole Goal`,
    },
    champion: {
        label: 'Champion Course',
        match: isChampionCourse,
        holes: 18,
        par: 73,
        target: 90,
        targetLabel: 'Break 90',
        goalPhrase: 'break 90',
        paceTitle: 'Projected Path to Breaking 90',
    },
};

let currentCourse = localStorage.getItem('chasing90-trends-course') || 'park';
if (!TREND_COURSES[currentCourse]) currentCourse = 'park';

let rollingChartDaniel = null;
let rollingChartAmelie = null;
let paceChart          = null;

const TREND_PLAYERS = [
    // Distinct dot shapes on top of color so the players stay tellable apart when dots overlap
    { key: 'daniel', name: 'Daniel', dot: 'circle',   color: { solid: '#4a6fa5', fill: 'rgba(74,111,165,0.08)', faint: 'rgba(74,111,165,0.6)' } },
    { key: 'amelie', name: 'Amelie', dot: 'triangle', color: { solid: '#4a7c4a', fill: 'rgba(74,124,74,0.08)',  faint: 'rgba(74,124,74,0.6)'  } },
];

// ---- Shared helpers ----

// Complete, competitive rounds on the selected course, oldest first.
// The holes check excludes incomplete rounds and keeps scores comparable.
function eligibleTrendRounds(playerKey) {
    const course = TREND_COURSES[currentCourse];
    return allRoundsData
        .filter(r => r.player.toLowerCase() === playerKey
            && course.match(r)
            && r.holes === course.holes
            && r.roundType !== 'scramble'
            && !r.excludeFromHandicap)
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function scoreWithPar(score, par) {
    return `${score} <span class="month-best-sub">${formatToPar(score, par)}</span>`;
}

function movingAverage(values, window) {
    return values.map((_, i) => {
        if (i < window - 1) return null;
        const slice = values.slice(i - window + 1, i + 1);
        return +(slice.reduce((a, b) => a + b, 0) / window).toFixed(1);
    });
}

function monthKey(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ---- 1. Rolling average charts ----

function renderRollingChart(canvasWrapId, player) {
    const { key: playerKey, color } = player;
    const wrap = document.getElementById(canvasWrapId);
    if (!wrap) return null;
    wrap.innerHTML = '<canvas></canvas>'; // recreate canvas in case a previous course had no data
    const canvas = wrap.querySelector('canvas');

    const rounds = eligibleTrendRounds(playerKey);
    if (rounds.length < 3) {
        wrap.innerHTML = '<p class="loading" style="padding:0">Not enough rounds on this course yet.</p>';
        return null;
    }

    const labels = rounds.map(r => formatDate(r.date));
    const values = rounds.map(r => r.score);
    const ma3    = movingAverage(values, 3);
    const ma10   = movingAverage(values, 10);
    const pars   = rounds.map(r => r.par);

    return new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Round',
                    data: values,
                    borderColor: 'transparent',
                    pointBackgroundColor: color.faint,
                    pointBorderColor: 'transparent',
                    pointStyle: player.dot,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    showLine: false,
                },
                {
                    label: '3-round avg',
                    data: ma3,
                    borderColor: color.solid,
                    backgroundColor: color.fill,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.3,
                    spanGaps: true,
                },
                {
                    label: '10-round avg',
                    data: ma10,
                    borderColor: color.solid,
                    borderDash: [7, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.3,
                    spanGaps: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: { font: { size: 10 } },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: 'Score', font: { size: 10 }, color: '#6b9b6b' },
                },
                x: {
                    ticks: { font: { size: 9 }, maxTicksLimit: 8, maxRotation: 0 },
                    grid: { display: false },
                },
            },
            plugins: {
                legend: { labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8, padding: 10 } },
                tooltip: {
                    callbacks: {
                        label: item => item.dataset.label === 'Round'
                            ? ` Round: ${item.parsed.y} (${formatToPar(item.parsed.y, pars[item.dataIndex])})`
                            : ` ${item.dataset.label}: ${item.parsed.y}`,
                    },
                },
            },
        },
    });
}

function renderRollingCharts() {
    if (rollingChartDaniel) { rollingChartDaniel.destroy(); rollingChartDaniel = null; }
    if (rollingChartAmelie) { rollingChartAmelie.destroy(); rollingChartAmelie = null; }
    rollingChartDaniel = renderRollingChart('rolling-wrap-daniel', TREND_PLAYERS[0]);
    rollingChartAmelie = renderRollingChart('rolling-wrap-amelie', TREND_PLAYERS[1]);
}

// ---- 2. Month-by-month table ----

function monthlyStats(playerKey) {
    const byMonth = {};
    eligibleTrendRounds(playerKey).forEach(r => {
        const key = monthKey(r.date);
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(r);
    });

    const stats = {};
    Object.entries(byMonth).forEach(([key, rounds]) => {
        const avg  = rounds.reduce((s, r) => s + r.score, 0) / rounds.length;
        const best = rounds.reduce((b, r) => r.score < b.score ? r : b, rounds[0]);
        stats[key] = { rounds: rounds.length, avg, best };
    });
    return stats;
}

function renderMonthlyTable() {
    const el = document.getElementById('monthly-table');
    const daniel = monthlyStats('daniel');
    const amelie = monthlyStats('amelie');

    const months = [...new Set([...Object.keys(daniel), ...Object.keys(amelie)])].sort();
    if (months.length === 0) {
        el.innerHTML = '<p class="loading">No rounds on this course yet.</p>';
        return;
    }

    const cell = stat => {
        if (!stat) return '<td class="month-empty">—</td><td class="month-empty">—</td><td class="month-empty">—</td>';
        return `<td>${stat.rounds}</td><td>${stat.avg.toFixed(1)}</td><td>${scoreWithPar(stat.best.score, stat.best.par)}</td>`;
    };

    const rows = months.map(key => `
        <tr>
            <td>${monthLabel(key)}</td>
            ${cell(daniel[key])}
            ${cell(amelie[key])}
        </tr>`).join('');

    el.innerHTML = `
        <table class="scoring-dist-table monthly-table">
            <thead>
                <tr>
                    <th></th>
                    <th colspan="3">Daniel</th>
                    <th colspan="3">Amelie</th>
                </tr>
                <tr class="scoring-table-subhead">
                    <th>Month</th>
                    <th>Rounds</th><th>Avg</th><th>Best</th>
                    <th>Rounds</th><th>Avg</th><th>Best</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// ---- 3. Pace-to-goal projection ----

function linearRegression(points) {
    const n = points.length;
    const meanX = points.reduce((s, p) => s + p.x, 0) / n;
    const meanY = points.reduce((s, p) => s + p.y, 0) / n;
    let num = 0, den = 0;
    points.forEach(p => {
        num += (p.x - meanX) * (p.y - meanY);
        den += (p.x - meanX) ** 2;
    });
    const slope = den === 0 ? 0 : num / den;
    return { slope, intercept: meanY - slope * meanX };
}

function renderPaceChart() {
    const course  = TREND_COURSES[currentCourse];
    const wrap    = document.getElementById('pace-chart-wrap');
    const summary = document.getElementById('pace-summary');

    if (paceChart) { paceChart.destroy(); paceChart = null; }
    wrap.innerHTML = '<canvas id="pace-chart"></canvas>';
    const canvas = document.getElementById('pace-chart');

    // Fit the trend to the rolling average, not raw scores: one hot or cold round
    // shouldn't own the projection. The average window matches the data volume.
    const playerData = TREND_PLAYERS.map(p => {
        const rounds = eligibleTrendRounds(p.key);
        if (rounds.length < 5) return null;
        const w = rounds.length >= 16 ? 10 : rounds.length >= 8 ? 5 : 3;
        const days = rounds.map(r => new Date(r.date).getTime() / MS_PER_DAY);
        const rawPoints = rounds.map((r, i) => ({ x: days[i], y: r.score }));
        const ma = movingAverage(rounds.map(r => r.score), w);
        // One average point per day: several same-day rounds share an x-position and
        // would otherwise draw vertical zigzags. Keep the value after the day's last round.
        const byDay = new Map();
        ma.forEach((v, i) => { if (v !== null) byDay.set(days[i], v); });
        const maPoints = [...byDay.entries()].map(([x, y]) => ({ x, y }));
        const fitPoints = maPoints.slice(-PACE_FIT_POINTS);
        return { ...p, w, rawPoints, maPoints, fitPoints };
    }).filter(Boolean);

    if (playerData.length === 0) {
        wrap.innerHTML = '<p class="loading" style="padding:0">Not enough rounds on this course for a projection yet.</p>';
        summary.innerHTML = '';
        return;
    }

    const allDays  = playerData.flatMap(p => p.rawPoints.map(pt => pt.x));
    const firstDay = Math.min(...allDays);
    const lastDay  = Math.max(...allDays);
    const maxHorizon = lastDay + 540; // cap drawn projection at ~18 months out

    const summaries = [];
    let chartEnd = lastDay + 30;

    playerData.forEach(p => {
        const reg = linearRegression(p.fitPoints);
        p.reg = reg;
        const playerLastDay = p.rawPoints[p.rawPoints.length - 1].x;
        const currentTrend = reg.slope * playerLastDay + reg.intercept;

        if (currentTrend <= course.target) {
            p.crossDay = null;
            p.trendEndCap = playerLastDay + 30; // already there — a long projection below target would promise tour golf
            summaries.push(`<strong style="color:${p.color.solid}">${p.name}</strong>: the ${p.w}-round average is already at ${currentTrend.toFixed(1)} — at or under ${course.target}. Keep it up!`);
        } else if (reg.slope >= -0.0005) {
            p.crossDay = null;
            summaries.push(`<strong style="color:${p.color.solid}">${p.name}</strong>: the ${p.w}-round average isn't coming down right now, so there's no projected date yet. One good stretch changes this.`);
        } else {
            const crossDay = (course.target - reg.intercept) / reg.slope;
            p.crossDay = crossDay;
            const date = new Date(crossDay * MS_PER_DAY);
            const dateLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const beyond = crossDay > maxHorizon ? ' (beyond the chart window)' : '';
            summaries.push(`<strong style="color:${p.color.solid}">${p.name}</strong>: on pace to ${course.goalPhrase} around <strong>${dateLabel}</strong>${beyond} — a straight-line estimate of where the ${p.w}-round average is heading.`);
            chartEnd = Math.max(chartEnd, Math.min(crossDay + 20, maxHorizon));
        }
    });

    const datasets = [];
    playerData.forEach(p => {
        datasets.push({
            label: `${p.name} rounds`,
            data: p.rawPoints,
            borderColor: 'transparent',
            pointBackgroundColor: p.color.faint,
            pointStyle: p.dot,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            showLine: false,
        });
        datasets.push({
            label: `${p.name} ${p.w}-round avg`,
            data: p.maPoints,
            borderColor: p.color.solid,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.3,
        });
        const trendStart = p.fitPoints[0].x;
        const trendEnd   = p.crossDay ? Math.min(p.crossDay, chartEnd) : (p.trendEndCap ?? chartEnd);
        datasets.push({
            label: `${p.name} trend`,
            data: [
                { x: trendStart, y: p.reg.slope * trendStart + p.reg.intercept },
                { x: trendEnd,   y: p.reg.slope * trendEnd   + p.reg.intercept },
            ],
            borderColor: p.color.solid,
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 0,
        });
    });
    datasets.push({
        label: course.targetLabel,
        data: [
            { x: firstDay, y: course.target },
            { x: chartEnd, y: course.target },
        ],
        borderColor: 'rgba(180,50,35,0.55)',
        borderDash: [8, 5],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
    });

    paceChart = new Chart(canvas, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    min: firstDay - 7,
                    max: chartEnd,
                    ticks: {
                        font: { size: 10 },
                        maxTicksLimit: 8,
                        // Short ranges need day-level labels; long projections read better as month + year
                        callback: v => new Date(v * MS_PER_DAY).toLocaleDateString('en-US',
                            chartEnd - firstDay < 240
                                ? { month: 'short', day: 'numeric' }
                                : { month: 'short', year: '2-digit' }),
                    },
                    grid: { display: false },
                },
                y: {
                    ticks: { font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: 'Score', font: { size: 11 }, color: '#6b9b6b' },
                },
            },
            plugins: {
                legend: {
                    labels: {
                        font: { size: 10 },
                        usePointStyle: true,
                        padding: 12,
                        filter: item => item.text.includes('avg') || item.text === course.targetLabel,
                    },
                },
                tooltip: {
                    callbacks: {
                        title: items => new Date(items[0].parsed.x * MS_PER_DAY)
                            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        label: item => {
                            const l = item.dataset.label;
                            if (l.endsWith('rounds')) return ` ${l}: ${item.parsed.y} (${formatToPar(item.parsed.y, course.par)})`;
                            if (l.includes('avg'))    return ` ${l}: ${item.parsed.y.toFixed(1)}`;
                            return null;
                        },
                    },
                },
            },
        },
    });

    summary.innerHTML = summaries.map(s => `<p class="pace-summary-line">${s}</p>`).join('')
        + `<p class="pace-disclaimer">Projections assume the recent trend continues linearly — golf rarely cooperates. A single round under ${course.target} will likely come sooner than the average gets there. Treat these as motivation, not deadlines.</p>`;
}

// ---- 4. Personal records sidebar ----

function parOrBetterStreak(playerKey) {
    let streak = 0, best = 0, bestDate = null;
    eligibleTrendRounds(playerKey).forEach(r => {
        const holes = scorecardData[r.roundId];
        if (!holes || holes.length === 0) return; // unknown holes neither extend nor break the streak
        holes.forEach(h => {
            if (h.score <= h.par) {
                streak++;
                if (streak > best) { best = streak; bestDate = r.date; }
            } else {
                streak = 0;
            }
        });
    });
    return { best, bestDate };
}

function mostBirdiesInRound(playerKey) {
    let best = null, bestCount = 0;
    eligibleTrendRounds(playerKey).forEach(r => {
        const holes = scorecardData[r.roundId];
        if (!holes || holes.length === 0) return;
        const birdies = holes.filter(h => h.score < h.par).length;
        if (birdies > bestCount) { bestCount = birdies; best = r; }
    });
    return { count: bestCount, round: best };
}

function bestAndWorstMonths(playerKey) {
    const stats = monthlyStats(playerKey);
    // Prefer months with 2+ rounds so one outlier round can't own the record
    let entries = Object.entries(stats).filter(([, s]) => s.rounds >= 2);
    if (entries.length === 0) entries = Object.entries(stats);
    if (entries.length === 0) return { best: null, worst: null };

    const best  = entries.reduce((a, b) => b[1].avg < a[1].avg ? b : a);
    const worst = entries.reduce((a, b) => b[1].avg > a[1].avg ? b : a);
    return {
        best:  { key: best[0],  ...best[1]  },
        worst: { key: worst[0], ...worst[1] },
    };
}

function recordItem(label, value, sub) {
    return `
        <div class="record-item">
            <p class="record-label">${label}</p>
            <p class="record-value">${value}</p>
            ${sub ? `<p class="record-sub">${sub}</p>` : ''}
        </div>`;
}

function renderRecords() {
    const el = document.getElementById('records-content');

    const blocks = TREND_PLAYERS.map(p => {
        const streak  = parOrBetterStreak(p.key);
        const birdies = mostBirdiesInRound(p.key);
        const months  = bestAndWorstMonths(p.key);

        let items = '';
        items += recordItem(
            'Longest par-or-better streak',
            streak.best > 0 ? `${streak.best} hole${streak.best !== 1 ? 's' : ''}` : '—',
            streak.bestDate ? `set ${formatDate(streak.bestDate)}` : 'needs scorecard data');
        items += recordItem(
            'Most birdies in a round',
            birdies.count > 0 ? `${birdies.count}` : '—',
            birdies.round ? formatDate(birdies.round.date) : 'no birdies yet — they\'re coming');
        items += recordItem(
            'Best scoring month',
            months.best ? monthLabel(months.best.key) : '—',
            months.best ? `avg ${months.best.avg.toFixed(1)} over ${months.best.rounds} round${months.best.rounds !== 1 ? 's' : ''}` : '');
        items += recordItem(
            'Toughest scoring month',
            months.worst ? monthLabel(months.worst.key) : '—',
            months.worst ? `avg ${months.worst.avg.toFixed(1)} over ${months.worst.rounds} round${months.worst.rounds !== 1 ? 's' : ''}` : '');

        return `
            <div class="records-card">
                <h3 class="records-player" style="color:${p.color.solid}">${p.name}</h3>
                ${items}
            </div>`;
    });

    el.innerHTML = blocks.join('')
        + '<p class="records-note">Streaks and birdie counts use hole-by-hole scorecard data, so rounds without a scorecard don\'t count toward them.</p>';
}

// ---- Course switching + page load ----

function renderTrends() {
    const course = TREND_COURSES[currentCourse];

    document.querySelectorAll('.course-tab').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.course === currentCourse));

    document.getElementById('rolling-note').textContent =
        `${course.label} · ${course.holes}-hole rounds, excluding scrambles and incomplete rounds · lower is better`;
    document.getElementById('monthly-note').textContent =
        `${course.label} only · Avg = average score · Best = lowest round that month`;
    document.getElementById('pace-title').textContent = course.paceTitle;
    document.getElementById('pace-note').textContent =
        `Trend fitted to each player's rolling scoring average over their recent ${course.label} rounds (up to the last ${PACE_FIT_POINTS} average points), extended forward to the target of ${course.target} (par ${course.par}) · an estimate, not a promise`;
    document.getElementById('records-course').textContent = course.label;

    renderRollingCharts();
    renderMonthlyTable();
    renderPaceChart();
    renderRecords();
}

function setTrendsCourse(key) {
    if (!TREND_COURSES[key] || key === currentCourse) return;
    currentCourse = key;
    localStorage.setItem('chasing90-trends-course', key);
    renderTrends();
}

async function loadTrendsData() {
    try {
        const [roundsResponse, scorecardsResponse] = await Promise.all([
            fetch(getSheetUrl(ROUNDS_SHEET)),
            fetch(getSheetUrl(SCORECARDS_SHEET)).catch(() => null),
        ]);

        const roundsCsv = await roundsResponse.text();
        processRoundsData(parseCSV(roundsCsv)); // populates allRoundsData

        if (scorecardsResponse && scorecardsResponse.ok) {
            const scorecardsCsv = await scorecardsResponse.text();
            scorecardData = processScorecardData(parseCSV(scorecardsCsv));
        }

        renderTrends();

    } catch (error) {
        console.error('Error loading trends data:', error);
        ['monthly-table', 'records-content', 'pace-summary'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<p class="loading">Error loading data. Check console for details.</p>';
        });
    }
}

document.addEventListener('DOMContentLoaded', loadTrendsData);
