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

// Score-to-par buckets shared by the Hole Scoring Breakdown and the round report card.
const HOLE_SCORE_CATS = [
    { key: 'eagle',  label: 'Eagle+',  color: '#c9a227', text: '#fff' },
    { key: 'birdie', label: 'Birdie',  color: '#2d7a2d', text: '#fff' },
    { key: 'par',    label: 'Par',     color: '#8fb88f', text: '#1a2e1a' },
    { key: 'bogey',  label: 'Bogey',   color: '#e3c44d', text: '#1a2e1a' },
    { key: 'double', label: 'Double',  color: '#cf6b3a', text: '#fff' },
    { key: 'triple', label: 'Triple+', color: '#962f1f', text: '#fff' },
];

function holeScoreKey(diff) {
    if (diff <= -2) return 'eagle';
    if (diff === -1) return 'birdie';
    if (diff === 0) return 'par';
    if (diff === 1) return 'bogey';
    if (diff === 2) return 'double';
    return 'triple';
}

function emptyHoleScoreCounts() {
    return Object.fromEntries(HOLE_SCORE_CATS.map(c => [c.key, 0]));
}

// "2026-09-19" parses as UTC midnight, which toLocaleDateString then renders as
// the previous day anywhere west of Greenwich — every date on the site reads a
// day early while we're in the US. Build the date in local time instead.
function parseLocalDate(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr).trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(dateStr);
}

// Dates in the newest season stay short; anything older needs its year to be unambiguous.
function formatDate(dateStr) {
    const options = { month: 'short', day: 'numeric' };
    if (latestSeason && seasonOf(dateStr) !== latestSeason) options.year = 'numeric';
    return parseLocalDate(dateStr).toLocaleDateString('en-US', options);
}

function formatDateLong(dateStr) {
    return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

    const tournamentClass = round.roundType === 'tournament' ? ' round-card-tournament' : '';

    return `
        <div class="round-card${tournamentClass}"
             data-round-id="${round.roundId}"
             data-has-scorecard="${hasScorecard}"
             onclick="openScorecard('${round.roundId}')">
            <div class="round-header">
                <span class="round-date">${formatDate(round.date)}</span>
                <span class="round-course">${round.course}</span>
                ${round.roundType === 'tournament' ? '<span class="round-type-badge round-type-tournament">🏆 Tournament</span>' : ''}
                ${round.roundType === 'scramble' ? '<span class="round-type-badge">Scramble</span>' : ''}
                ${round.excludeFromHandicap && round.roundType !== 'scramble' ? '<span class="round-type-badge">Casual</span>' : ''}
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

// One list per player with a shared course filter: nines, 18s and partial rounds all live
// here. Arrow functions because heatmap.js loads after this file.
const ROUND_LIST_INITIAL = 5;
const ROUND_LIST_FILTERS = {
    all:      () => true,
    park:     r => isParkCourse(r),
    champion: r => isChampionCourse(r),
    away:     r => !isParkCourse(r) && !isChampionCourse(r),
};
let roundListCourse = 'all';

function renderRoundLists() {
    PLAYERS.forEach(p => {
        const rounds = allRoundsData.filter(r =>
            r.player.toLowerCase() === p.key && ROUND_LIST_FILTERS[roundListCourse](r));
        const history = document.getElementById(`${p.key}-history`);

        document.getElementById(`${p.key}-rounds`).innerHTML = rounds.length
            ? rounds.slice(0, ROUND_LIST_INITIAL).map(renderRoundCard).join('')
            : '<p class="loading">No rounds yet</p>';
        document.getElementById(`${p.key}-all-rounds`).innerHTML =
            rounds.slice(ROUND_LIST_INITIAL).map(renderRoundCard).join('');

        history.classList.remove('expanded');
        const link = history.previousElementSibling;
        link.dataset.total = rounds.length;
        link.textContent = `View all ${rounds.length} rounds ↓`;
        link.style.display = rounds.length > ROUND_LIST_INITIAL ? '' : 'none';
    });
}

function setRoundsCourse(course) {
    roundListCourse = course;
    document.querySelectorAll('[data-rounds-course]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.roundsCourse === course));
    renderRoundLists();
}

function toggleHistory(player) {
    const historyEl = document.getElementById(player + '-history');
    const linkEl = historyEl.previousElementSibling;
    const open = historyEl.classList.toggle('expanded');
    linkEl.textContent = open ? 'Hide older rounds ↑' : `View all ${linkEl.dataset.total} rounds ↓`;
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

// The hero shows one season at a time ('2026') or 'all'. It opens on the newest season with a
// logged round, so last season's final numbers stay up all winter instead of a row of zeros.
let heroPlayers = [];
let heroSeason  = 'all';

function inHeroSeason(dateStr) {
    return heroSeason === 'all' || seasonOf(dateStr) === heroSeason;
}

function heroSeasonLabel() {
    if (heroSeason === 'all') return 'All time';
    return `${heroSeason} ${heroSeason < String(new Date().getFullYear()) ? 'final' : 'season'}`;
}

function heroStat(value, label, sub, onclick) {
    return `
        <div class="hero-stat${onclick ? ' hero-stat-clickable' : ''}"${onclick ? ` onclick="${onclick}"` : ''}>
            <div class="hero-stat-value">${value}</div>
            <div class="hero-stat-label">${label}</div>
            ${sub ? `<div class="hero-stat-sub">${sub}</div>` : ''}
        </div>`;
}

// The index is a rolling last 20 differentials, so it never resets. A season only changes
// which stretch of it the tile reads: the value at the end of the season, plus the change
// from where the previous season left off.
function heroIndexStat(p) {
    const hcp = handicapData[p.name];
    const onclick = hcp.numDiffs > 0 ? `openHandicap('${p.name}')` : '';
    if (hcp.whi === null) {
        return heroStat('—', hcp.numDiffs > 0 ? `Need ${3 - hcp.numDiffs} more` : 'Est. Handicap', '', onclick);
    }

    const points = hcp.progression.filter(pt => inHeroSeason(pt.date));
    const before = heroSeason === 'all' ? [] : hcp.progression.filter(pt => seasonOf(pt.date) < heroSeason);
    const carried = before.length ? before[before.length - 1].whi : null;
    if (points.length === 0) {
        return heroStat((carried ?? hcp.whi).toFixed(1), 'Est. Handicap', 'carried over', onclick);
    }

    const whi = points[points.length - 1].whi;
    const low = Math.min(...points.map(pt => pt.whi)).toFixed(1);
    let sub = `low ${low} · started ${points[0].whi.toFixed(1)}`;
    if (carried !== null) {
        const change = Math.round((whi - carried) * 10) / 10;
        sub = change === 0
            ? `no change · low ${low}`
            : `${change > 0 ? '+' : ''}${change.toFixed(1)} this season · low ${low}`;
    }
    return heroStat(whi.toFixed(1), 'Est. Handicap', sub, onclick);
}

// Per course, because par 29 and par 73 don't blend: complete, competitive rounds only (courseRounds).
function heroCourseStat(p, courseKey, label) {
    const career = courseRounds(p.key, courseKey);
    const rounds = career.filter(r => inHeroSeason(r.date));
    if (rounds.length === 0) return heroStat('—', label, 'no rounds yet');

    const avg  = rounds.reduce((s, r) => s + r.score, 0) / rounds.length;
    const best = Math.min(...rounds.map(r => r.score));
    let sub = `best ${best}`;
    if (rounds.length < career.length) {
        const pb = Math.min(...career.map(r => r.score));
        sub += best === pb ? ' · PB' : ` · PB ${pb}`;
    }
    return heroStat(avg.toFixed(1), label, sub);
}

function heroCountStat(seasonCount, careerCount, label, onclick) {
    const fmt = n => n.toLocaleString('en-US');
    return heroStat(fmt(seasonCount), label, seasonCount < careerCount ? `career ${fmt(careerCount)}` : '', onclick);
}

function heroPlayerHtml(p) {
    const rounds = p.all.filter(r => inHeroSeason(r.date));
    const holes  = list => list.reduce((sum, r) => sum + r.holes, 0);
    const days   = list => new Set(list.map(r => r.date)).size;
    const log    = birdieData[p.name].log;

    return `
        <div class="hero-player">
            <span class="hero-player-name">${p.name}</span>
            <div class="hero-player-stats">
                ${heroIndexStat(p)}
                ${heroCourseStat(p, 'park', 'Park Avg')}
                ${heroCourseStat(p, 'champion', 'Champion Avg')}
                ${heroCountStat(holes(rounds), holes(p.all), 'Holes Played')}
                ${heroCountStat(days(rounds), days(p.all), 'Days Out')}
                ${heroCountStat(log.filter(e => inHeroSeason(e.date)).length, log.length, 'Birdies', `openBirdies('${p.name}')`)}
            </div>
        </div>`;
}

function drawHeroStats() {
    const seasons = [...new Set(allRoundsData.map(r => seasonOf(r.date)))].sort().reverse();
    // With a single season "all time" would just repeat it, so the switch waits for a second one.
    const tabs = seasons.length < 2 ? '' : [...seasons, 'all'].map(s => `
        <button class="hero-season-tab${s === heroSeason ? ' active' : ''}" onclick="setHeroSeason('${s}')">${s === 'all' ? 'All time' : s}</button>`).join('');

    document.getElementById('hero-stats').innerHTML = `
        <div class="hero-season">
            <span class="hero-season-label">${heroSeasonLabel()}</span>
            ${tabs ? `<div class="hero-season-tabs">${tabs}</div>` : ''}
        </div>
        <div class="hero-stats-inner">${heroPlayers.map(heroPlayerHtml).join('')}</div>`;
}

function setHeroSeason(season) {
    heroSeason = season;
    drawHeroStats();
}

function renderHeroStats(roundsData) {
    heroPlayers = [
        { name: 'Daniel', key: 'daniel', all: roundsData.danielAll },
        { name: 'Amelie', key: 'amelie', all: roundsData.amelieAll },
    ];
    // Both stay career-long: the index is rolling and the birdie-every-hole chase never resets.
    heroPlayers.forEach(p => {
        handicapData[p.name] = calculateHandicap(p.all);
        birdieData[p.name]   = calculateBirdies(p.all);
    });

    heroSeason = latestSeason || 'all';
    drawHeroStats();
    document.getElementById('hero-stats').style.display = '';
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

// ---- Tournaments ----

// Longest run of shared leading words across course names, used as the event
// venue — e.g. "Mieming Champion Course" + "Mieming Park Course" → "Mieming".
function commonVenue(courses) {
    const names = courses.filter(Boolean).map(c => c.trim());
    if (names.length === 0) return 'Tournament';
    if (names.length === 1) return names[0];
    const words = names.map(c => c.split(/\s+/));
    const shared = [];
    for (let i = 0; i < words[0].length; i++) {
        const w = words[0][i];
        if (words.every(list => list[i] === w)) shared.push(w);
        else break;
    }
    return shared.join(' ') || names.join(' · ');
}

function renderTournamentRound(round) {
    const toPar = formatToPar(round.score, round.par);
    const hasScorecard = scorecardData[round.roundId] ? 'true' : 'false';

    const stats = [];
    if (round.putts) stats.push(`<span class="round-stat"><span class="round-stat-label">Putts</span> ${round.putts}</span>`);
    if (round.fir)   stats.push(`<span class="round-stat"><span class="round-stat-label">FIR</span> ${round.fir}</span>`);
    if (round.gir)   stats.push(`<span class="round-stat"><span class="round-stat-label">GIR</span> ${round.gir}</span>`);

    return `
        <div class="tournament-round"
             data-has-scorecard="${hasScorecard}"
             onclick="openScorecard('${round.roundId}')">
            <div class="tournament-round-info">
                <span class="tournament-round-player">${round.player}</span>
                <span class="tournament-round-course">${round.course}</span>
                <span class="tournament-round-holes">${round.holes} holes</span>
            </div>
            <div class="tournament-round-result">
                <span class="tournament-round-score">${round.score}</span>
                <span class="tournament-round-topar">(${toPar})</span>
            </div>
            ${stats.length ? `<div class="round-stats tournament-round-stats">${stats.join('')}</div>` : ''}
        </div>
    `;
}

function renderTournaments() {
    const section = document.getElementById('tournaments');
    const container = document.getElementById('tournament-list');
    if (!container) return;

    const rounds = allRoundsData.filter(r => r.roundType === 'tournament');
    if (rounds.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    // Rounds played on the same day form one tournament event.
    const byDate = {};
    rounds.forEach(r => { (byDate[r.date] = byDate[r.date] || []).push(r); });
    const dates = Object.keys(byDate).sort((a, b) => new Date(b) - new Date(a));

    container.innerHTML = dates.map(date => {
        const eventRounds = byDate[date].slice().sort((a, b) => b.holes - a.holes);
        const venue = commonVenue(eventRounds.map(r => r.course));
        return `
            <div class="tournament-event">
                <div class="tournament-event-header">
                    <span class="tournament-trophy">🏆</span>
                    <div class="tournament-event-heading">
                        <p class="tournament-event-name">${venue}</p>
                        <p class="tournament-event-date">${formatDateLong(date)}</p>
                    </div>
                </div>
                <div class="tournament-round-group">
                    ${eventRounds.map(renderTournamentRound).join('')}
                </div>
            </div>
        `;
    }).join('');

    if (section) section.style.display = '';
}
