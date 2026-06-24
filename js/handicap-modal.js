let handicapChart   = null;
let activeHcpState  = null;

// Tiny inline trend line. Lower index is better, so the lowest value is drawn
// at the bottom — a line sloping down-right means improving, matching the big
// WHI chart's orientation.
function miniSparkline(values, w = 84, h = 22) {
    if (!values || values.length < 2) return '';
    const pad = 3;
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const n = values.length;
    const x = i => pad + (i / (n - 1)) * (w - 2 * pad);
    const y = v => pad + ((max - v) / span) * (h - 2 * pad);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<svg class="hcp-sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
        <polyline points="${pts}" fill="none" stroke="var(--green-500)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x(n - 1).toFixed(1)}" cy="${y(values[n - 1]).toFixed(1)}" r="1.8" fill="var(--green-700)"/>
    </svg>`;
}

function hcpScoreCell(r) {
    const capped = r.adjustedScore && r.adjustedScore !== r.score;
    if (capped) return `${r.adjustedScore} <span class="diff-pair" title="Raw: ${r.score}">(adj)</span>`;
    return `${r.score} (${formatToPar(r.score, r.par)})`;
}

function hcpRenderDiffRow(d, idx) {
    const usedCls  = d.used ? ' class="diff-used"' : '';
    const usedMark = d.used ? ' ✓' : '';
    if (d.type === 'paired') {
        const r1 = d.rounds[0], r2 = d.rounds[1];
        const sc = (r) => r.course.replace(/GC Mieming\s*/i, '');
        return `
            <tr>
                <td${usedCls}>${idx + 1}${usedMark}</td>
                <td>${formatDate(r1.date)}<br><span class="diff-pair">${formatDate(r2.date)}</span></td>
                <td>${sc(r1)} (9h)<br><span class="diff-pair">${sc(r2)} (9h)</span></td>
                <td>${hcpScoreCell(r1)}<br><span class="diff-pair">${hcpScoreCell(r2)}</span></td>
                <td${usedCls}>${d.diff.toFixed(1)}<br><span class="diff-pair">${r1.diff.toFixed(1)} + ${r2.diff.toFixed(1)}</span></td>
            </tr>`;
    }
    const r  = d.rounds[0];
    const sc = r.course.replace(/GC Mieming\s*/i, '');
    return `
        <tr>
            <td${usedCls}>${idx + 1}${usedMark}</td>
            <td>${formatDate(r.date)}</td>
            <td>${sc} (18h)</td>
            <td>${hcpScoreCell(r)}</td>
            <td${usedCls}>${d.diff.toFixed(1)}</td>
        </tr>`;
}

function buildHandicapDiffHtml(diffs, playerName, showUnpaired, hcp) {
    if (diffs.length === 0) {
        return '<p style="font-size:0.85rem;color:var(--green-400);font-style:italic;margin-top:var(--space-sm);">No rounds for this course yet.</p>';
    }
    const n       = diffs.length;
    const reversed = [...diffs].reverse();
    const visible  = reversed.slice(0, 20);
    const older    = reversed.slice(20);

    let h = `
        <button class="handicap-detail-toggle" onclick="this.nextElementSibling.classList.toggle('open'); this.textContent = this.nextElementSibling.classList.contains('open') ? '▾ Hide differential breakdown' : '▸ Show differential breakdown'">▸ Show differential breakdown</button>
        <div class="handicap-detail">
            <table class="handicap-table">
                <tr><th>#</th><th>Date</th><th>Round(s)</th><th>Score</th><th>Diff</th></tr>
    `;
    visible.forEach((d, i) => { h += hcpRenderDiffRow(d, n - 1 - i); });
    h += '</table>';

    if (older.length > 0) {
        const olderId = `older-diffs-${playerName.replace(/\s+/g, '-')}`;
        h += `
            <div id="${olderId}" style="display:none;">
                <table class="handicap-table">
                    ${older.map((d, i) => hcpRenderDiffRow(d, n - 1 - (visible.length + i))).join('')}
                </table>
            </div>
            <button class="handicap-detail-toggle" style="margin-top:var(--space-sm);"
                onclick="const el=document.getElementById('${olderId}'); const shown=el.style.display!=='none'; el.style.display=shown?'none':'block'; this.textContent=shown?'▸ Load ${older.length} older round(s)':'▾ Hide older rounds';">
                ▸ Load ${older.length} older round(s)
            </button>`;
    }
    if (showUnpaired && hcp.unpaired.length > 0) {
        const u  = hcp.unpaired[0];
        const sc = u.course.replace(/GC Mieming\s*/i, '');
        h += `<p style="margin-top:var(--space-sm);font-size:0.8rem;color:var(--green-400);font-style:italic;">Unpaired 9-hole: ${sc} ${formatDate(u.date)} — ${u.score} (${formatToPar(u.score, u.par)}) · diff ${u.diff.toFixed(1)} — waiting for next 9h round</p>`;
    }
    h += '</div>';
    return h;
}

function openHandicap(playerName) {
    const hcp = handicapData[playerName];
    if (!hcp) return;

    const overlay = document.getElementById('handicap-overlay');
    const content = document.getElementById('handicap-content');

    const whiStr = hcp.whi !== null ? hcp.whi.toFixed(1) : '—';
    const n      = hcp.numDiffs;

    let subtitle    = '';
    let whsBestLabel = '';
    if (n >= 3) {
        const row = WHS_TABLE.find(r => n >= r[0] && n <= r[1]);
        const adj = row[3] !== 0 ? ` · ${row[3] > 0 ? '+' : ''}${row[3]} adj` : '';
        subtitle     = `${n} diff${n !== 1 ? 's' : ''} · best ${row[2]}${adj}`;
        whsBestLabel = `(best ${row[2]} of ${Math.min(n, 20)})`;
    } else {
        const needed = 3 - n;
        subtitle = `${n} diff${n !== 1 ? 's' : ''} · need ${needed} more for estimate`;
    }

    activeHcpState = { playerName, hcp };

    // Per-course WHS index: the same best-N-of-last-20 calculation as the
    // headline index, restricted to one course. This keeps every course on the
    // same scale as the overall index (and each other), so the gap is a clean
    // "demonstrated ability" comparison net of slope/CR. The sparkline plots the
    // rolling course index so recent direction is visible. Park (paired 9h) and
    // champ diffs are both full 18-hole, slope/CR-normalized, so they compare
    // directly.
    const courseStats = (isPark) => {
        const diffs = hcp.diffs.filter(d => {
            const c = (d.rounds[0].course || '').toLowerCase();
            return isPark ? c.includes('park') : !c.includes('park');
        }).map(d => d.diff);
        const n = diffs.length;
        if (n === 0) return { n: 0 };
        const prog = [];
        for (let i = 0; i < n; i++) {
            const whi = whsFromDiffs(diffs.slice(Math.max(0, i - 19), i + 1));
            if (whi !== null) prog.push(whi);
        }
        if (prog.length === 0) {  // fewer than 3 diffs — can't form an index
            return { n, index: null, avg: diffs.reduce((s, v) => s + v, 0) / n };
        }
        const m   = Math.min(n, 20);
        const row = WHS_TABLE.find(r => m >= r[0] && m <= r[1]);
        const index = prog[prog.length - 1];
        const back  = prog[Math.max(0, prog.length - 6)];  // ~5 index-points ago
        return { n, index, prog, best: row ? row[2] : null, window: m, trendDelta: index - back };
    };
    const champStats = courseStats(false);
    const parkStats  = courseStats(true);

    const courseRow = (label, s) => {
        const row = (inner, sub) => `
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label">${label}${sub ? ` <span class="hcp-comparison-sub">${sub}</span>` : ''}</span>
                    <span class="hcp-course-stat">${inner}</span>
                </div>`;
        if (s.n === 0) return row('<span class="hcp-comparison-value">—</span>', '');
        if (s.index === null) {
            return row(`<span class="hcp-comparison-value">${s.avg.toFixed(1)}</span>
                        <span class="hcp-course-trend hcp-trend-flat">avg · need 3 for index</span>`,
                       `${s.n} diff${s.n !== 1 ? 's' : ''}`);
        }
        const d = s.trendDelta;
        const better = d < -0.05, worse = d > 0.05;
        const arrow = better ? '▼' : worse ? '▲' : '◆';
        const word  = better ? 'better' : worse ? 'worse' : 'steady';
        const cls   = better ? 'hcp-trend-better' : worse ? 'hcp-trend-worse' : 'hcp-trend-flat';
        const spark = miniSparkline(s.prog);
        const trend = s.prog.length > 1
            ? `<span class="hcp-course-trend ${cls}">${arrow} ${Math.abs(d).toFixed(1)} recent</span>`
            : '';
        const sub = s.best ? `best ${s.best} of ${s.window}` : '';
        return row(`<span class="hcp-comparison-value">${s.index.toFixed(1)}</span>${spark}${trend}`, sub);
    };

    const last20    = hcp.diffs.slice(-20);
    const avgDiffCount = last20.length;
    const avgDiff   = avgDiffCount > 0
        ? last20.reduce((s, d) => s + d.diff, 0) / avgDiffCount
        : null;

    let html = `
        <div class="handicap-header">
            <div>
                <h3>${playerName}</h3>
                <span class="handicap-whi-label">${subtitle}</span>
            </div>
        </div>
        <div class="handicap-body">
            <div class="hcp-main-value">${whiStr}</div>
            <div class="hcp-main-label">WHS Handicap Index</div>
            <div class="hcp-comparison-box">
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label">Avg of last ${avgDiffCount} differential${avgDiffCount !== 1 ? 's' : ''}</span>
                    <span class="hcp-comparison-value">${avgDiff !== null ? avgDiff.toFixed(1) : '—'}</span>
                </div>
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label">WHS Index <span class="hcp-comparison-sub">${whsBestLabel}</span></span>
                    <span class="hcp-comparison-value">${whiStr}</span>
                </div>
                ${courseRow('Champion Course', champStats)}
                ${courseRow('Park Course', parkStats)}
            </div>
    `;

    if (hcp.progression.length > 1) {
        html += `
            <div class="handicap-chart-wrap">
                <canvas id="handicap-chart"></canvas>
            </div>
        `;
    }

    if (hcp.diffs.length > 0) {
        html += `<div id="handicap-diff-wrap">${buildHandicapDiffHtml(hcp.diffs, playerName, true, hcp)}</div>`;
    }

    html += '</div>';
    content.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (hcp.progression.length > 1) renderHandicapChart(playerName, hcp.progression);
}

function renderHandicapChart(playerName, progression, courseParams) {
    const ctx = document.getElementById('handicap-chart');
    if (!ctx) return;
    if (handicapChart) { handicapChart.destroy(); handicapChart = null; }

    const toValue  = courseParams
        ? (whi) => Math.round(whi * (courseParams.slope / 113) + (courseParams.cr - courseParams.par))
        : (whi) => whi;
    const yLabel    = courseParams ? 'Course Handicap' : 'Handicap Index';
    const dataLabel = courseParams ? 'Course HCP' : 'Est. WHI';

    const startingWhi = { 'Daniel': 33, 'Amelie': 36 };
    const startVal    = startingWhi[playerName];
    const startDisplay = startVal != null ? toValue(startVal) : null;

    const labels = startDisplay != null
        ? ['Start', ...progression.map(p => formatDate(p.date))]
        : progression.map(p => formatDate(p.date));
    const data = startDisplay != null
        ? [startDisplay, ...progression.map(p => toValue(p.whi))]
        : progression.map(p => toValue(p.whi));

    handicapChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: dataLabel,
                data,
                borderColor: '#4a7c4a',
                backgroundColor: 'rgba(74, 124, 74, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#4a7c4a',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: { display: true, text: yLabel, font: { size: 11 } },
                    ticks: { font: { size: 11 } },
                },
                x: { ticks: { font: { size: 10 } } },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => courseParams
                            ? `${yLabel}: ${ctx.parsed.y}`
                            : `WHI: ${ctx.parsed.y.toFixed(1)}`,
                    },
                },
            },
        },
    });
}

function closeHandicap() {
    document.getElementById('handicap-overlay').classList.remove('active');
    document.body.style.overflow = '';
    if (handicapChart) { handicapChart.destroy(); handicapChart = null; }
}

function closeHandicapIfBackground(event) {
    if (event.target === document.getElementById('handicap-overlay')) closeHandicap();
}
