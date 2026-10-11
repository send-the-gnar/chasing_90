// "New Irons — Before & After" section on the Trends page: before/after
// comparison around an equipment change. Nothing new to log — every round
// dated on/after the switch counts as the new gear, so the "after" column
// fills itself as rounds land in the sheet.
// Driven by trends.js: renderTrends() calls renderGear(), which reads the
// page's shared course selection (currentCourse). Also relies on globals from
// config.js (scorecardData, allRoundsData), helpers from data.js (parseRate),
// render.js (formatDate) and courses.js (COURSE_VIEWS, courseRounds).

// Master switch for the section. While false, renderGear() leaves the section
// hidden (trends.html ships it with the `hidden` attribute) and does no work.
const GEAR_SECTION_ENABLED = false;

const GEAR_CHANGES = [
    {
        key: 'irons2026',
        player: 'daniel',
        date: '2026-08-08',
        label: 'Custom-fit irons',
        story: 'First custom-fit set. Irons do the approach work, so greens in regulation and '
             + 'par-3 scoring are where a real change should show up first. Fairways (mostly '
             + 'driver and woods) and putting are the control group — if those move too, '
             + 'it\'s form, not the clubs.',
    },
];

// Baseline = the most recent rounds before the switch, not all history: tees and
// form have drifted, and "what the old irons were doing lately" is the fair bar.
const GEAR_BASELINE_WINDOW = 15;
const GEAR_VERDICT_MIN     = 3;   // after-rounds needed before a score verdict
const GEAR_SETTLED_N       = 5;   // below this the verdict wears an "early days" tag
const GEAR_MS_PER_DAY      = 86400000;

let gearCharts = [];

// ---- Round splitting -------------------------------------------------------

function gearSplit(change, courseKey) {
    const rounds = courseRounds(change.player, courseKey);  // eligible, oldest first
    const cut = new Date(change.date).getTime();
    const before = rounds.filter(r => new Date(r.date).getTime() < cut);
    const after  = rounds.filter(r => new Date(r.date).getTime() >= cut);
    return { baseline: before.slice(-GEAR_BASELINE_WINDOW), after };
}

// ---- Metric extraction -----------------------------------------------------
// Each extractor returns { value, n } or null when the stat wasn't tracked.

function gearAvg(values) {
    if (values.length === 0) return null;
    return { value: values.reduce((s, v) => s + v, 0) / values.length, n: values.length };
}

function gearScoreStat(rounds)  { return gearAvg(rounds.map(r => r.score)); }
function gearPuttsStat(rounds)  { return gearAvg(rounds.filter(r => r.putts !== null).map(r => r.putts)); }
function gearRateStat(field) {
    return rounds => gearAvg(rounds.map(r => parseRate(r[field])).filter(v => v !== null));
}

// Par-3 scoring needs scorecards; n counts par-3 holes, not rounds.
function gearPar3Stat(rounds) {
    const scores = rounds.flatMap(r =>
        (scorecardData[r.roundId] || []).filter(h => h.par === 3).map(h => h.score));
    return gearAvg(scores);
}

const GEAR_METRICS = [
    {
        key: 'score', label: 'Scoring average', tag: 'the bottom line', lowerBetter: true,
        stat: gearScoreStat, fmt: (v, course) => `${v.toFixed(1)} <span class="gear-topar">+${(v - course.par).toFixed(1)}</span>`,
        deltaFmt: d => `${Math.abs(d).toFixed(1)} strokes`, flat: 0.5, unit: 'rounds',
    },
    {
        key: 'gir', label: 'Greens in regulation', tag: 'irons', lowerBetter: false,
        stat: gearRateStat('gir'), fmt: v => Math.round(v * 100) + '%',
        deltaFmt: d => `${Math.round(Math.abs(d) * 100)} pts`, flat: 0.03, unit: 'rounds',
    },
    {
        key: 'par3', label: 'Par-3 average', tag: 'irons', lowerBetter: true,
        stat: gearPar3Stat, fmt: v => v.toFixed(2),
        deltaFmt: d => `${Math.abs(d).toFixed(2)} strokes`, flat: 0.1, unit: 'holes',
    },
    {
        key: 'fir', label: 'Fairways hit', tag: 'control', lowerBetter: false,
        stat: gearRateStat('fir'), fmt: v => Math.round(v * 100) + '%',
        deltaFmt: d => `${Math.round(Math.abs(d) * 100)} pts`, flat: 0.03, unit: 'rounds',
    },
    {
        key: 'putts', label: 'Putts per round', tag: 'control', lowerBetter: true,
        stat: gearPuttsStat, fmt: v => v.toFixed(1),
        deltaFmt: d => `${Math.abs(d).toFixed(1)}`, flat: 0.5, unit: 'rounds',
    },
];

// ---- Verdict card ----------------------------------------------------------

function renderGearVerdict(change, split, course) {
    const el = document.getElementById('gear-verdict');
    const base = gearScoreStat(split.baseline);
    const aft  = gearScoreStat(split.after);

    if (!base) {
        el.innerHTML = `<p class="loading" style="padding:0">Not enough rounds on this course for a baseline yet.</p>`;
        return;
    }

    const baseLine = `<div class="gear-verdict-col">
            <p class="gear-verdict-label">Baseline — old irons</p>
            <p class="gear-verdict-value">${base.value.toFixed(1)}</p>
            <p class="gear-verdict-sub">last ${base.n} round${base.n !== 1 ? 's' : ''} before ${formatDate(change.date)}</p>
        </div>`;

    if (!aft) {
        el.innerHTML = `
            <div class="gear-verdict-grid">
                ${baseLine}
                <div class="gear-verdict-arrow">→</div>
                <div class="gear-verdict-col gear-pending">
                    <p class="gear-verdict-label">New irons</p>
                    <p class="gear-verdict-value">—</p>
                    <p class="gear-verdict-sub">no rounds logged yet</p>
                </div>
            </div>
            <p class="gear-verdict-line">Baseline locked in. Log rounds as usual — everything dated
               ${formatDate(change.date)} or later lands on the new-irons side automatically.</p>`;
        return;
    }

    const diff = aft.value - base.value;   // negative = improvement
    let line;
    if (aft.n < GEAR_VERDICT_MIN) {
        line = `${aft.n} round${aft.n !== 1 ? 's' : ''} in — too early to call. The verdict appears at ${GEAR_VERDICT_MIN}.`;
    } else {
        const dir = diff <= -0.5 ? `<strong class="gear-better">${Math.abs(diff).toFixed(1)} strokes better</strong>`
                  : diff >= 0.5  ? `<strong class="gear-worse">${diff.toFixed(1)} strokes worse</strong>`
                  : '<strong>holding steady</strong>';
        const early = aft.n < GEAR_SETTLED_N ? ` Early days — treat it as a lean until ~${GEAR_SETTLED_N} rounds.` : '';
        line = `The new irons are ${dir} per round so far.${early}`;
    }

    el.innerHTML = `
        <div class="gear-verdict-grid">
            ${baseLine}
            <div class="gear-verdict-arrow">→</div>
            <div class="gear-verdict-col">
                <p class="gear-verdict-label">New irons</p>
                <p class="gear-verdict-value">${aft.value.toFixed(1)}</p>
                <p class="gear-verdict-sub">${aft.n} round${aft.n !== 1 ? 's' : ''} since ${formatDate(change.date)}</p>
            </div>
        </div>
        <p class="gear-verdict-line">${line}</p>`;
}

// ---- Metric table ----------------------------------------------------------

function renderGearMetrics(change, split, course) {
    const el = document.getElementById('gear-metrics');

    const rows = GEAR_METRICS.map(m => {
        const b = m.stat(split.baseline);
        const a = m.stat(split.after);

        const cell = (s, side) => s
            ? `<p class="gear-metric-value">${m.fmt(s.value, course)}</p>
               <p class="gear-metric-sub">${s.n} ${m.unit}</p>`
            : `<p class="gear-metric-value gear-empty">—</p>
               <p class="gear-metric-sub">${side === 'after' && split.after.length === 0 ? 'no rounds yet' : 'not tracked'}</p>`;

        let delta = '<span class="gear-delta gear-delta-none">·</span>';
        if (b && a) {
            const d = a.value - b.value;
            const improved = m.lowerBetter ? d < 0 : d > 0;
            if (Math.abs(d) < m.flat) delta = '<span class="gear-delta gear-delta-none">≈ flat</span>';
            else delta = `<span class="gear-delta ${improved ? 'gear-delta-good' : 'gear-delta-bad'}">
                ${d > 0 ? '▲' : '▼'} ${m.deltaFmt(d)}</span>`;
        }

        return `
            <div class="gear-metric-row">
                <div class="gear-metric-name">
                    ${m.label}
                    <span class="gear-tag gear-tag-${m.tag === 'control' ? 'control' : 'iron'}">${m.tag}</span>
                </div>
                <div class="gear-metric-cell">${cell(b, 'before')}</div>
                <div class="gear-metric-cell">${cell(a, 'after')}</div>
                <div class="gear-metric-cell gear-metric-delta">${delta}</div>
            </div>`;
    }).join('');

    el.innerHTML = `
        <div class="gear-metric-row gear-metric-head">
            <div class="gear-metric-name"></div>
            <div class="gear-metric-cell">Old irons</div>
            <div class="gear-metric-cell">New irons</div>
            <div class="gear-metric-cell">Change</div>
        </div>
        ${rows}`;
}

// ---- Timeline charts -------------------------------------------------------
// Rounds as dots (before faint, after warm), a rolling average through them,
// and a dashed vertical marker on switch day.

function gearTimelineChart(canvas, rounds, change, opts) {
    const cutDay = new Date(change.date).getTime() / GEAR_MS_PER_DAY;
    const pts = rounds
        .map(r => ({ x: new Date(r.date).getTime() / GEAR_MS_PER_DAY, y: opts.value(r), r }))
        .filter(p => p.y !== null);
    if (pts.length < 3) return null;

    const beforePts = pts.filter(p => p.x < cutDay);
    const afterPts  = pts.filter(p => p.x >= cutDay);

    // Rolling average over the plotted values, one point per day (same-day rounds
    // would otherwise zigzag vertically)
    const w = pts.length >= 16 ? 5 : 3;
    const byDay = new Map();
    pts.forEach((p, i) => {
        if (i < w - 1) return;
        const avg = pts.slice(i - w + 1, i + 1).reduce((s, q) => s + q.y, 0) / w;
        byDay.set(p.x, +avg.toFixed(2));
    });
    const maPts = [...byDay.entries()].map(([x, y]) => ({ x, y }));

    const ys = pts.map(p => p.y);
    const pad = (Math.max(...ys) - Math.min(...ys)) * 0.08 || 1;
    const yMin = Math.floor(Math.min(...ys) - pad), yMax = Math.ceil(Math.max(...ys) + pad);
    const lastDay = Math.max(...pts.map(p => p.x), cutDay);

    return new Chart(canvas, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Old irons',
                    data: beforePts,
                    borderColor: 'transparent',
                    pointBackgroundColor: 'rgba(74,111,165,0.45)',
                    pointRadius: 3, pointHoverRadius: 5, showLine: false,
                },
                {
                    label: 'New irons',
                    data: afterPts,
                    borderColor: 'transparent',
                    pointBackgroundColor: '#cf6b3a',
                    pointRadius: 4, pointHoverRadius: 6, showLine: false,
                },
                {
                    label: `${w}-round avg`,
                    data: maPts,
                    borderColor: '#4a6fa5',
                    borderWidth: 2, pointRadius: 0, pointHoverRadius: 3, tension: 0.3,
                },
                {
                    label: 'switch',
                    data: [{ x: cutDay, y: yMin }, { x: cutDay, y: yMax }],
                    borderColor: 'rgba(180,50,35,0.55)',
                    borderDash: [6, 5], borderWidth: 2,
                    pointRadius: 0, pointHoverRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    min: Math.min(...pts.map(p => p.x)) - 5,
                    max: lastDay + 5,
                    ticks: {
                        font: { size: 9 }, maxTicksLimit: 6,
                        callback: v => new Date(v * GEAR_MS_PER_DAY)
                            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    },
                    grid: { display: false },
                },
                y: {
                    min: yMin, max: yMax,
                    ticks: { font: { size: 10 }, callback: opts.tick },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: { display: true, text: opts.axis, font: { size: 10 }, color: '#6b9b6b' },
                },
            },
            plugins: {
                legend: {
                    labels: {
                        font: { size: 10 }, usePointStyle: true, boxWidth: 8, padding: 10,
                        filter: item => item.text !== 'switch' && !item.text.includes('avg'),
                    },
                },
                tooltip: {
                    filter: item => item.dataset.label !== 'switch',
                    callbacks: {
                        title: items => items.length ? new Date(items[0].parsed.x * GEAR_MS_PER_DAY)
                            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
                        label: item => ` ${item.dataset.label}: ${opts.tip(item.parsed.y)}`,
                    },
                },
            },
        },
    });
}

function renderGearCharts(change, courseKey) {
    gearCharts.forEach(c => c && c.destroy());
    gearCharts = [];

    // Charts get the full eligible history for context, not just the baseline window
    const rounds = courseRounds(change.player, courseKey);

    const defs = [
        {
            wrap: 'gear-chart-score',
            value: r => r.score, axis: 'Score', tick: v => v, tip: v => v,
        },
        {
            wrap: 'gear-chart-gir',
            value: r => { const g = parseRate(r.gir); return g === null ? null : +(g * 100).toFixed(0); },
            axis: 'GIR %', tick: v => v + '%', tip: v => v + '%',
        },
    ];

    defs.forEach(d => {
        const wrap = document.getElementById(d.wrap);
        wrap.innerHTML = '<canvas></canvas>';
        const chart = gearTimelineChart(wrap.querySelector('canvas'), rounds, change, d);
        if (!chart) wrap.innerHTML = '<p class="loading" style="padding:0">Not enough data on this course yet.</p>';
        else gearCharts.push(chart);
    });
}

// ---- Section assembly ------------------------------------------------------
// Called from renderTrends(); currentCourse is trends.js's course selection.

function renderGear() {
    const section = document.getElementById('gear');
    section.hidden = !GEAR_SECTION_ENABLED;
    if (!GEAR_SECTION_ENABLED) return;

    const change = GEAR_CHANGES[0];
    const course = COURSE_VIEWS[currentCourse];
    const split  = gearSplit(change, currentCourse);

    document.getElementById('gear-story').textContent = change.story;
    document.getElementById('gear-method').textContent =
        `${course.label} · baseline = the last ${GEAR_BASELINE_WINDOW} eligible rounds before `
        + `${formatDate(change.date)}, "new irons" = every round since · scrambles and partial rounds excluded`;

    renderGearVerdict(change, split, course);
    renderGearMetrics(change, split, course);
    renderGearCharts(change, currentCourse);
}
