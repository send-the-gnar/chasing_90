// ---- Formatting helpers ----

// Rewrite Cloudinary URLs to auto-convert format (fixes HEIC phone photos that
// browsers can't render) and optimize delivery size. Safe to call on any string.
function cloudinaryAuto(input) {
    return (input || '').replace(
        /(https?:\/\/res\.cloudinary\.com\/[^\s"')]+?\/upload\/)(?!f_auto)/g,
        '$1f_auto,q_auto,w_1400,c_limit/'
    );
}

function scoreShapeClass(diff) {
    if (diff <= -1) return 'score-under-par';
    if (diff === 1) return 'score-over-par';
    if (diff === 2) return 'score-double-bogey';
    if (diff >= 3)  return 'score-triple-bogey';
    return '';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatToPar(score, par) {
    const diff = score - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
}

function getBestOverPar(rounds) {
    if (!rounds || rounds.length === 0) return null;
    return rounds.reduce((best, round) => {
        const diff = round.score - round.par;
        const bestDiff = best.score - best.par;
        return diff < bestDiff ? round : best;
    }, rounds[0]);
}

function calculateGoalProgress(bestOverPar, goal, start) {
    const progress = (start - bestOverPar) / (start - goal) * 100;
    return Math.max(0, Math.min(100, progress));
}

// ---- Round cards ----

function renderRoundCard(round) {
    const toPar = formatToPar(round.score, round.par);
    const hasScorecard = scorecardData[round.roundId] ? 'true' : 'false';
    const teeLengthMeters = parseFloat(round.teeLength);

    let teeDisplay = round.teeColor;
    if (!isNaN(teeLengthMeters) && teeLengthMeters > 0) {
        teeDisplay += ` <span class="distance-value" data-meters="${teeLengthMeters}">${formatDistance(teeLengthMeters)}</span>`;
    }

    return `
        <div class="round-card"
             data-round-id="${round.roundId}"
             data-has-scorecard="${hasScorecard}"
             onclick="openScorecard('${round.roundId}')">
            <div class="round-header">
                <span class="round-date">${formatDate(round.date)}</span>
                <span class="round-course">${round.course}</span>
                ${round.roundType === 'scramble' ? '<span class="round-type-badge">Scramble</span>' : ''}
                <span class="round-tees">${teeDisplay}</span>
            </div>
            <div class="round-score-row">
                <span class="round-score">${round.score}</span>
                <span class="round-to-par">(${toPar})</span>
            </div>
            <div class="round-stats">
                ${round.fir ? `<span class="round-stat"><span class="round-stat-label">FIR</span> ${round.fir}</span>` : ''}
                ${round.gir ? `<span class="round-stat"><span class="round-stat-label">GIR</span> ${round.gir}</span>` : ''}
                ${round.putts ? `<span class="round-stat"><span class="round-stat-label">Putts</span> ${round.putts}</span>` : ''}
            </div>
        </div>
    `;
}

function renderPlayerRounds(containerId, rounds) {
    const container = document.getElementById(containerId);
    if (!rounds || rounds.length === 0) {
        container.innerHTML = '<p class="loading">No rounds yet</p>';
        return;
    }
    container.innerHTML = rounds.slice(0, 5).map(r => renderRoundCard(r)).join('');
}

function renderAllRounds(containerId, rounds) {
    const container = document.getElementById(containerId);
    if (!rounds || rounds.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = rounds.map(r => renderRoundCard(r)).join('');
}

function toggleHistory(player) {
    const historyEl = document.getElementById(player + '-history');
    const linkEl = historyEl.previousElementSibling;
    if (historyEl.classList.contains('expanded')) {
        historyEl.classList.remove('expanded');
        linkEl.textContent = 'View all rounds ↓';
    } else {
        historyEl.classList.add('expanded');
        linkEl.textContent = 'Hide older rounds ↑';
    }
}

// ---- Goals ----

function renderGoalRow(label, rounds, goal, startOverPar) {
    const bestRound = getBestOverPar(rounds);
    if (!bestRound) {
        return `
            <div class="goal-row">
                <span class="goal-label">${label}</span>
                <span style="font-size:0.85rem; color:var(--green-400); font-style:italic;">No rounds yet</span>
            </div>
        `;
    }
    const bestOverPar = bestRound.score - bestRound.par;
    const progress = calculateGoalProgress(bestOverPar, goal, startOverPar);
    const strokesToGo = bestOverPar - goal;
    const toParStr = formatToPar(bestRound.score, bestRound.par);
    const clickable = bestRound.roundId ? `onclick="openScorecard('${bestRound.roundId}')"` : '';
    return `
        <div class="goal-row">
            <span class="goal-label">${label}</span>
            <span class="goal-score">${toParStr}</span>
            <div class="goal-bar-wrap">
                <div class="goal-bar">
                    <div class="goal-bar-fill" style="width: ${progress}%;"></div>
                </div>
                <div class="goal-bar-labels">
                    <strong>Goal: +${goal}</strong>
                </div>
                <div class="goal-meta">
                    <span>${bestRound.score} at ${bestRound.course} · ${formatDate(bestRound.date)}${bestRound.roundId ? ' <span class="goal-detail" ' + clickable + '>→ scorecard</span>' : ''}</span>
                    <strong>${strokesToGo > 0 ? strokesToGo + ' to go' : 'Goal reached!'}</strong>
                </div>
            </div>
        </div>
    `;
}

function renderGoalCard(name, eighteenRounds, nineRounds) {
    return `
        <div class="goal-card">
            <h3 class="goal-card-name">${name}</h3>
            ${renderGoalRow('18 Hole', eighteenRounds, GOAL_18_OVER_PAR, 40)}
            ${renderGoalRow('9 Hole', nineRounds, GOAL_9_OVER_PAR, 20)}
        </div>
    `;
}

function renderGoals(data) {
    const competitive = rounds => rounds.filter(r => r.roundType !== 'scramble');
    document.getElementById('goals-grid').innerHTML =
        renderGoalCard('Daniel', competitive(data.daniel), competitive(data.danielPractice)) +
        renderGoalCard('Amelie', competitive(data.amelie), competitive(data.ameliePractice));
}

// ---- Hero stats ----

function renderHeroStats(roundsData) {
    const container = document.getElementById('hero-stats');
    const players = [
        { name: 'Daniel', nine: roundsData.danielPractice, eighteen: roundsData.daniel, all: roundsData.danielAll },
        { name: 'Amelie', nine: roundsData.ameliePractice, eighteen: roundsData.amelie, all: roundsData.amelieAll },
    ];

    const html = players.map(p => {
        const totalHoles = p.all.reduce((sum, r) => sum + r.holes, 0);
        const roundsPlayed = Math.floor(totalHoles / 18);

        const hcp = calculateHandicap(p.all);
        handicapData[p.name] = hcp;
        let whiDisplay = '—';
        let whiLabel = 'Est. Handicap';
        let whiClickable = false;
        if (hcp.whi !== null) {
            whiDisplay = hcp.whi.toFixed(1);
            whiClickable = true;
        } else if (hcp.numDiffs > 0) {
            const needed = 3 - hcp.numDiffs;
            whiLabel = `Need ${needed} more`;
            whiClickable = true;
        }

        const nineCompetitive = p.nine.filter(r => r.roundType !== 'scramble');
        let best9OverPar = '—';
        if (nineCompetitive.length > 0) {
            const best = nineCompetitive.reduce((min, r) => {
                const diff = r.score - r.par;
                return diff < min ? diff : min;
            }, Infinity);
            best9OverPar = (best >= 0 ? '+' : '') + best;
        }

        const eighteenCompetitive = p.eighteen.filter(r => r.roundType !== 'scramble');
        let best18OverPar = '—';
        if (eighteenCompetitive.length > 0) {
            const best = eighteenCompetitive.reduce((min, r) => {
                const diff = r.score - r.par;
                return diff < min ? diff : min;
            }, Infinity);
            best18OverPar = (best >= 0 ? '+' : '') + best;
        }

        let birdieCount = 0;
        p.all.forEach(r => {
            if (r.roundType === 'scramble') return;
            const holes = scorecardData[r.roundId];
            if (!holes) return;
            holes.forEach(h => { if (h.score - h.par <= -1) birdieCount++; });
        });

        return `
            <div class="hero-player">
                <span class="hero-player-name">${p.name}</span>
                <div class="hero-player-stats">
                    <div class="hero-stat">
                        <div class="hero-stat-value">${totalHoles}</div>
                        <div class="hero-stat-label">Holes Played</div>
                    </div>
                    <div class="hero-stat">
                        <div class="hero-stat-value">${roundsPlayed}</div>
                        <div class="hero-stat-label">Rounds Played</div>
                    </div>
                    <div class="hero-stat${whiClickable ? ' hero-stat-clickable' : ''}"${whiClickable ? ` onclick="openHandicap('${p.name}')"` : ''}>
                        <div class="hero-stat-value">${whiDisplay}</div>
                        <div class="hero-stat-label">${whiLabel}</div>
                    </div>
                    <div class="hero-stat">
                        <div class="hero-stat-value">${best18OverPar}</div>
                        <div class="hero-stat-label">Best 18-Hole</div>
                    </div>
                    <div class="hero-stat">
                        <div class="hero-stat-value">${best9OverPar}</div>
                        <div class="hero-stat-label">Best 9-Hole</div>
                    </div>
                    <div class="hero-stat">
                        <div class="hero-stat-value">${birdieCount}</div>
                        <div class="hero-stat-label">Birdies</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="hero-stats-inner">${html}</div>`;
    container.style.display = '';
}

// ---- Stats cards ----

function renderStatsCard(stats) {
    const avgFir = stats.avg_fir || '—';
    const avgGir = stats.avg_gir || '—';
    const puttsPerHole = stats.putts_per_hole || '—';
    const avgDriveRaw = stats.avg_drive || '';
    const favoriteClub = stats.favorite_club || '—';

    const driveMeters = parseFloat(avgDriveRaw);
    let driveDisplay;
    if (!isNaN(driveMeters) && driveMeters > 0) {
        driveDisplay = `<span class="distance-value" data-meters="${driveMeters}">${formatDistance(driveMeters)}</span>`;
    } else {
        driveDisplay = avgDriveRaw || '—';
    }

    return `
        <div class="summary-card">
            <h3>${stats.player}</h3>
            <div class="stat-row">
                <span class="stat-label">Avg. FIR</span>
                <span class="stat-value">${avgFir}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Avg. GIR</span>
                <span class="stat-value">${avgGir}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Putts/Hole</span>
                <span class="stat-value">${puttsPerHole}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Avg. Drive</span>
                <span class="stat-value">${driveDisplay}</span>
            </div>
            <div class="favorite-club">
                <span class="stat-label">Favorite club:</span>
                <span class="stat-value">${favoriteClub}</span>
            </div>
        </div>
    `;
}

function renderStats(statsData) {
    const container = document.getElementById('summary-stats');
    if (!container) return;
    if (!statsData || statsData.length === 0) {
        container.innerHTML = '<p class="loading">No stats available</p>';
        return;
    }
    container.innerHTML = statsData.map(s => renderStatsCard(s)).join('');
}

// ---- Timeline ----

function renderTimeline(milestonesData) {
    const container = document.getElementById('timeline-entries');

    if (!milestonesData || milestonesData.length === 0) {
        container.innerHTML = '<p class="loading">No milestones yet</p>';
        return;
    }

    const TIMELINE_INITIAL = 5;

    milestonesData.sort((a, b) => {
        const dateA = new Date(a.date || '');
        const dateB = new Date(b.date || '');
        if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
        return 0;
    });

    const typeLabels = {
        personal_best: 'Personal Best',
        first: 'First!',
        season: 'Season',
        equipment: 'Equipment',
        milestone: 'Milestone',
        tournament: '🏆 Tournament',
    };

    let html = milestonesData.map((m, i) => {
        const side = i % 2 === 0 ? 'left' : 'right';
        const hiddenClass = i >= TIMELINE_INITIAL ? ' hidden' : '';
        const type = (m.type || 'milestone').trim().toLowerCase().replace(/\s+/g, '_');
        const typeClass = 'type-' + type.replace(/_/g, '-');
        const label = typeLabels[type] || type.replace(/_/g, ' ');
        const imageUrl = cloudinaryAuto((m.image_url || '').trim());

        return `
            <div class="timeline-entry ${side}${hiddenClass}">
                <div class="timeline-dot ${typeClass}"></div>
                <div class="timeline-card">
                    <p class="timeline-date">${m.date || ''}</p>
                    <span class="timeline-badge ${typeClass}">${label}</span>
                    <h3 class="timeline-title">${m.title || ''}</h3>
                    ${m.description ? '<p class="timeline-desc">' + m.description + '</p>' : ''}
                    ${imageUrl ? '<img class="timeline-image" src="' + imageUrl + '" alt="' + (m.title || '') + '" loading="lazy">' : ''}
                </div>
            </div>
        `;
    }).join('');

    if (milestonesData.length > TIMELINE_INITIAL) {
        html += `<button class="timeline-expand" onclick="toggleTimeline(this)">Show all milestones ↓</button>`;
    }

    container.innerHTML = html;
}

function toggleTimeline(btn) {
    const entries = document.querySelectorAll('.timeline-entry.hidden');
    if (entries.length > 0) {
        entries.forEach(el => el.classList.remove('hidden'));
        btn.textContent = 'Show less ↑';
    } else {
        const all = document.querySelectorAll('.timeline-entry');
        all.forEach((el, i) => { if (i >= 5) el.classList.add('hidden'); });
        btn.textContent = 'Show all milestones ↓';
        document.getElementById('timeline').scrollIntoView({ behavior: 'smooth' });
    }
}
