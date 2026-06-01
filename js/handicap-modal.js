let handicapChart   = null;
let activeHcpState  = null;

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

function switchHcpTab(btn, tabId) {
    const modal = document.getElementById('handicap-modal');
    modal.querySelectorAll('.hcp-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    modal.querySelectorAll('.hcp-tab-panel').forEach(p => { p.style.display = 'none'; });
    document.getElementById('hcp-panel-' + tabId).style.display = '';

    if (!activeHcpState) return;
    const { playerName, hcp } = activeHcpState;

    if (hcp.progression.length > 1) {
        const courseParams = tabId === 'champion' ? CHAMP_COURSE_HCP
                           : tabId === 'park'     ? PARK_COURSE_HCP
                           : null;
        renderHandicapChart(playerName, hcp.progression, courseParams);
    }

    const diffWrap = document.getElementById('handicap-diff-wrap');
    if (!diffWrap) return;
    if (tabId === 'whs') {
        diffWrap.innerHTML = buildHandicapDiffHtml(hcp.diffs, playerName, true, hcp);
    } else {
        const isPark = tabId === 'park';
        const filteredDiffs = hcp.diffs.filter(d => {
            const c = (d.rounds[0].course || '').toLowerCase();
            return isPark ? c.includes('park') : !c.includes('park');
        });
        diffWrap.innerHTML = buildHandicapDiffHtml(filteredDiffs, playerName, false, hcp);
    }
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
        subtitle     = `${n} diff${n !== 1 ? 's' : ''} · best ${row[2]}${adj} · ×0.96`;
        whsBestLabel = `(best ${row[2]} of ${Math.min(n, 20)})`;
    } else {
        const needed = 3 - n;
        subtitle = `${n} diff${n !== 1 ? 's' : ''} · need ${needed} more for estimate`;
    }

    activeHcpState = { playerName, hcp };

    const champCH = hcp.whi !== null
        ? Math.round(hcp.whi * (CHAMP_COURSE_HCP.slope / 113) + (CHAMP_COURSE_HCP.cr - CHAMP_COURSE_HCP.par))
        : null;
    const parkCH = hcp.whi !== null
        ? Math.round(hcp.whi * (PARK_COURSE_HCP.slope / 113) + (PARK_COURSE_HCP.cr - PARK_COURSE_HCP.par))
        : null;

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
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label">Champion Course handicap</span>
                    <span class="hcp-comparison-value">${champCH !== null ? champCH : '—'}</span>
                </div>
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label">Park Course handicap (9h)</span>
                    <span class="hcp-comparison-value">${parkCH !== null ? parkCH : '—'}</span>
                </div>
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
