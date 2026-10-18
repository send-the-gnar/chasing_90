// Birdie modal, opened from the Birdies tile in the hero banner. Every number comes from
// calculateBirdies (birdies.js) — the same call that feeds the tile — so the two always agree.

const BIRDIE_LOG_INITIAL = 8;   // log rows shown before "Show all"

// "#4", "#4 and #7", "#4, #7 and #9"
function holeList(holes) {
    const tags = holes.map(h => '#' + h.hole);
    return tags.length > 1 ? `${tags.slice(0, -1).join(', ')} and ${tags[tags.length - 1]}` : tags[0];
}

// One hole in a course tracker. A birdie is a tint of the scorecard's birdie green, from pale
// (one) up to full strength for the hole with the most; holes still waiting are dashed outlines.
function birdieHoleChip(h, max, isTop) {
    const par = h.par ? ` · par ${h.par}` : '';
    if (h.birdies === 0) {
        return `<div class="birdie-hole" title="Hole ${h.hole}${par} · no birdie yet">
            <span class="birdie-hole-num">${h.hole}</span><span class="birdie-hole-n">–</span>
        </div>`;
    }
    const alpha = 0.25 + 0.75 * (h.birdies / max);
    const style = `background:rgba(45,122,45,${alpha.toFixed(2)});color:${alpha >= 0.6 ? '#fff' : 'var(--green-900)'};`;
    return `<div class="birdie-hole birdie-hole-hit${isTop ? ' birdie-hole-top' : ''}" style="${style}"
                 title="Hole ${h.hole}${par} · ${pluralize(h.birdies, 'birdie')} in ${h.played} rounds">
        <span class="birdie-hole-num">${h.hole}</span><span class="birdie-hole-n">${h.birdies}</span>
    </div>`;
}

// "Birdie every hole" tracker for one course. The chips double as the per-hole distribution.
function birdieCourseCard(c) {
    const max      = Math.max(...c.byHole.map(h => h.birdies));
    const missing  = c.byHole.filter(h => h.birdies === 0);
    const complete = missing.length === 0;
    // Only star a hole once it has pulled ahead of a plain single birdie
    const top      = max >= 2 ? c.byHole.filter(h => h.birdies === max) : [];

    const sub = c.birdies > 0
        ? `${pluralize(c.birdies, 'birdie')} · 1 every ${Math.round(c.played / c.birdies)} holes`
        : 'No birdies yet';

    const notes = [];
    if (complete) notes.push('⛳ Every hole birdied');
    else if (missing.length <= 4) notes.push(`${missing.length} to go: ${holeList(missing)}`);
    if (top.length) notes.push(`★ Most on ${holeList(top)} (${max}${top.length > 1 ? ' each' : ''})`);

    return `
        <div class="birdie-course${complete ? ' birdie-course-complete' : ''}">
            <div class="birdie-course-head">
                <div>
                    <div class="birdie-course-name">${c.label}</div>
                    <div class="birdie-course-sub">${sub}</div>
                </div>
                <div class="birdie-course-count">
                    <div class="birdie-course-fraction"><strong>${c.birdied}</strong>/${c.byHole.length}</div>
                    <div class="birdie-course-fraction-label">holes birdied</div>
                </div>
            </div>
            <div class="birdie-holes">${c.byHole.map(h => birdieHoleChip(h, max, top.includes(h))).join('')}</div>
            ${notes.length ? `<p class="birdie-course-note">${notes.join(' · ')}</p>` : ''}
        </div>`;
}

function openBirdies(playerName) {
    const b = birdieData[playerName];
    if (!b) return;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 30);
    const last30 = b.log.filter(e => parseLocalDate(e.date) >= cutoff).length;

    const most     = b.mostInRound;
    const mostLink = most
        ? `<span class="hcp-comparison-sub goal-detail" onclick="openBirdieRound('${most.roundId}')">${formatDate(most.date)} → scorecard</span>`
        : '';
    const awayList = Object.entries(b.away).map(([label, n]) => `${n} at ${label}`);

    const logRows = b.log.map((e, i) => `
        <tr class="birdie-log-row${i >= BIRDIE_LOG_INITIAL ? ' birdie-log-extra' : ''}" onclick="openBirdieRound('${e.roundId}')" title="View scorecard">
            <td>${formatDate(e.date)}</td>
            <td>${e.course}</td>
            <td>#${e.hole} <span class="diff-pair">par ${e.par}</span></td>
            <td><span class="score-shape ${scoreShapeClass(e.score - e.par)}">${e.score}</span></td>
        </tr>`).join('');

    const html = `
        <div class="birdie-header">
            <h3>${playerName}</h3>
            <span class="birdie-header-sub">${b.log.length ? `Latest birdie ${formatDate(b.log[0].date)}` : 'No birdies yet'}</span>
        </div>
        <div class="birdie-body">
            <div class="hcp-main-value">${b.total}</div>
            <div class="hcp-main-label">${b.total === 1 ? 'Birdie' : 'Birdies'}${b.eagles ? ` (incl. ${pluralize(b.eagles, 'eagle')})` : ''}</div>
            <div class="hcp-comparison-box">
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label">Last 30 days</span>
                    <span class="hcp-comparison-value">${last30}</span>
                </div>
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label">Most in one round${mostLink}</span>
                    <span class="hcp-comparison-value">${most ? most.count : '—'}</span>
                </div>
                <div class="hcp-comparison-row">
                    <span class="hcp-comparison-label" title="Logged rounds with a hole-by-hole scorecard — 9-hole and partial rounds included, scrambles excluded">Rounds with a birdie</span>
                    <span class="hcp-comparison-value">${b.roundsWithBirdie} of ${b.roundsScored}</span>
                </div>
            </div>

            <h4 class="birdie-section-title">Birdie every hole</h4>
            ${b.courses.map(birdieCourseCard).join('')}
            ${awayList.length ? `<p class="birdie-away">Away: ${awayList.join(', ')}</p>` : ''}

            ${b.log.length ? `
                <h4 class="birdie-section-title">Birdie log</h4>
                <table class="handicap-table birdie-log">
                    <tr><th>Date</th><th>Course</th><th>Hole</th><th>Score</th></tr>
                    ${logRows}
                </table>
                ${b.log.length > BIRDIE_LOG_INITIAL
                    ? `<button class="handicap-detail-toggle birdie-log-toggle" data-total="${b.log.length}" onclick="toggleBirdieLog(this)">▸ Show all ${b.log.length}</button>`
                    : ''}` : ''}

            <p class="birdie-note">Holes under par · scrambles aren't counted${b.scrambleBirdies ? ` (${pluralize(b.scrambleBirdies, 'team birdie')} left out)` : ''}</p>
        </div>
    `;

    document.getElementById('birdie-content').innerHTML = html;
    document.getElementById('birdie-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function toggleBirdieLog(btn) {
    const open = btn.previousElementSibling.classList.toggle('expanded');
    btn.textContent = open ? '▾ Show fewer' : `▸ Show all ${btn.dataset.total}`;
}

// The scorecard modal sits at the same z-index as this one, so hand over rather than stack.
function openBirdieRound(roundId) {
    closeBirdies();
    openScorecard(roundId);
}

function closeBirdies() {
    document.getElementById('birdie-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

function closeBirdiesIfBackground(event) {
    if (event.target === document.getElementById('birdie-overlay')) closeBirdies();
}
