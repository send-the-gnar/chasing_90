// Season recap page: one season told as a story, at recap.html?season=2026. Everything but the
// players' own notes (Recaps sheet) comes from the live data, so a season in progress keeps
// updating and next year's page needs no code.
// Relies on config.js, data.js, handicap.js, birdies.js, render.js, heatmap.js, courses.js,
// scorecard-modal.js, handicap-chart.js, birdie-modal.js (birdieCourseCard) and head-to-head.js.

const RECAPS_SHEET = 'Recaps';
const NEMESIS_MIN_PLAYS = 3;   // same idea as the heatmap's minimum, over a whole season

let recapSeason = null;

function inRecapSeason(round) {
    return seasonOf(round.date) === recapSeason;
}

function playerRounds(player) {
    return allRoundsData.filter(r => r.player.toLowerCase() === player.key);
}

function courseSeasonRounds(player, courseKey) {
    return courseRounds(player.key, courseKey).filter(inRecapSeason);
}

function formatCount(n) {
    return n.toLocaleString('en-US');
}

function totalHoles(rounds) {
    return rounds.reduce((s, r) => s + r.holes, 0);
}

function daysOut(rounds) {
    return new Set(rounds.map(r => r.date)).size;
}

function roundLink(round, text) {
    return `<button class="recap-round-link" onclick="openScorecard('${round.roundId}')">${text}</button>`;
}

// ---- Opening ----

function renderOpening(noteRow) {
    const seasons   = allSeasons();
    const number    = [...seasons].reverse().indexOf(recapSeason) + 1;
    const rounds    = allRoundsData.filter(inRecapSeason);
    const dates     = rounds.map(r => r.date).sort();
    const isFinal   = recapSeason < String(new Date().getFullYear());

    const players = PLAYERS.map(p => {
        const mine = playerRounds(p).filter(inRecapSeason);
        return `
            <div class="recap-opening-player">
                <span class="recap-opening-name">${p.name}</span>
                <span class="recap-opening-stat"><strong>${formatCount(totalHoles(mine))}</strong> holes</span>
                <span class="recap-opening-stat"><strong>${daysOut(mine)}</strong> days out</span>
            </div>`;
    }).join('');

    document.getElementById('recap-opening').innerHTML = `
        <p class="recap-eyebrow">${isFinal ? 'Final' : `Season in progress · through ${formatDateLong(dates[dates.length - 1])}`}</p>
        <h2 class="recap-title">Season ${number}</h2>
        <p class="recap-year">${recapSeason}</p>
        <p class="recap-lede"><strong>${formatCount(totalHoles(rounds))}</strong> holes between us, starting ${formatDateLong(dates[0])}</p>
        <div class="recap-opening-players">${players}</div>
        ${noteRow && noteRow.intro ? `<p class="recap-intro">${escapeHtml(noteRow.intro)}</p>` : ''}`;
    document.title = `Chasing 90 — ${recapSeason} Season Recap`;
}

// ---- In our own words ----

function renderNotes(noteRow) {
    document.getElementById('recap-notes-grid').innerHTML = PLAYERS.map(p => {
        const note = noteRow ? (noteRow[`${p.key}_note`] || '').trim() : '';
        const body = note
            ? note.split(/\n+/).map(line => `<p>${escapeHtml(line)}</p>`).join('')
            : `<p class="recap-note-pending">${p.name}'s note on the season is on the way.</p>`;
        return `
            <div class="stats-card recap-note">
                <h3 style="color:${p.color.solid}">${p.name}</h3>
                ${body}
            </div>`;
    }).join('');
}

// ---- Index story ----

function indexStory(player) {
    const progression = handicapData[player.name].progression;
    const points = progression.filter(pt => seasonOf(pt.date) === recapSeason);
    if (points.length === 0) return '';

    const before = progression.filter(pt => seasonOf(pt.date) < recapSeason);
    const start  = before.length ? before[before.length - 1].whi : points[0].whi;
    const end    = points[points.length - 1].whi;
    const low    = points.reduce((a, b) => b.whi < a.whi ? b : a);
    const change = Math.round((end - start) * 10) / 10;
    const net    = change === 0 ? 'level on the year'
        : `${Math.abs(change).toFixed(1)} ${change < 0 ? 'better' : 'worse'} on the year`;
    const finish = end === low.whi ? 'and finished right there' : `and finished at ${end.toFixed(1)}`;

    return `<p class="recap-story"><strong style="color:${player.color.solid}">${player.name}</strong> opened at ${start.toFixed(1)}, reached a low of ${low.whi.toFixed(1)} on ${formatDate(low.date)}, ${finish}: ${net}.</p>`;
}

// ---- Best days ----

function bestDayMilestone(player, date, milestones) {
    const match = milestones.find(m => m.date === date
        && (m.type || '').toLowerCase() === 'personal_best'
        && (m.title || '').toLowerCase().includes(player.key));
    return match ? match.description : '';
}

function bestDayCard(player, courseKey, milestones) {
    const rounds = courseSeasonRounds(player, courseKey);
    if (rounds.length === 0) return '';

    const score = Math.min(...rounds.map(r => r.score));
    const best  = rounds.filter(r => r.score === score);
    const first = best[0];

    // Compare with everything before this round, not just this season
    const earlier = courseRounds(player.key, courseKey).filter(r => r.date < first.date);
    const previous = earlier.length ? Math.min(...earlier.map(r => r.score)) : null;
    const gain = previous !== null && previous > score
        ? `${pluralize(previous - score, 'stroke')} better than the previous best of ${previous}.` : '';
    const when = best.map(r => roundLink(r, formatDate(r.date))).join(' ');
    const story = bestDayMilestone(player, first.date, milestones);

    return `
        <div class="stats-card recap-best">
            <p class="recap-best-who" style="color:${player.color.solid}">${player.name} · ${COURSE_VIEWS[courseKey].label}</p>
            <p class="recap-best-score">${score} <span>${formatToPar(score, first.par)}</span></p>
            <p class="recap-best-when">${best.length > 1 ? `${best.length} times: ` : ''}${when}</p>
            ${gain ? `<p class="recap-best-gain">${gain}</p>` : ''}
            ${story ? `<p class="recap-best-story">${escapeHtml(story)}</p>` : ''}
        </div>`;
}

// ---- Birdie chase ----

function renderBirdieChase() {
    document.getElementById('recap-birdies-grid').innerHTML = PLAYERS.map(p => {
        // The chase runs across seasons, so it reads as it stood at the end of this one
        const b = calculateBirdies(playerRounds(p).filter(r => seasonOf(r.date) <= recapSeason));
        const count = b.log.filter(e => seasonOf(e.date) === recapSeason).length;
        return `
            <div>
                <p class="recap-birdie-total"><strong style="color:${p.color.solid}">${p.name}</strong> · ${pluralize(count, 'birdie')} in ${recapSeason}</p>
                ${b.courses.map(birdieCourseCard).join('')}
            </div>`;
    }).join('');
}

// ---- Favorite and nemesis holes ----

function holeSeasonStats(player, courseKey) {
    const holes = {};
    playerRounds(player)
        .filter(r => inRecapSeason(r) && COURSE_VIEWS[courseKey].match(r)
            && r.roundType !== 'scramble' && !r.excludeFromHandicap)
        .forEach(r => (scorecardData[r.roundId] || []).forEach(h => {
            if (h.score <= 0) return;   // hole not played on a partial round
            const slot = holes[h.hole] || (holes[h.hole] = { hole: h.hole, par: h.par, plays: 0, over: 0 });
            slot.plays++;
            slot.over += h.score - h.par;
        }));

    const ranked = Object.values(holes)
        .filter(h => h.plays >= NEMESIS_MIN_PLAYS)
        .map(h => ({ ...h, avg: h.over / h.plays }))
        .sort((a, b) => a.avg - b.avg);
    return ranked.length ? { favorite: ranked[0], nemesis: ranked[ranked.length - 1] } : null;
}

function holeCell(h) {
    const avg = `${h.avg >= 0 ? '+' : ''}${h.avg.toFixed(1)}`;
    return `<strong>#${h.hole}</strong> <span class="recap-hole-detail">par ${h.par} · ${avg} avg · ${h.plays} plays</span>`;
}

function renderHoles() {
    const rows = Object.keys(COURSE_VIEWS).flatMap(courseKey => PLAYERS.map(p => {
        const stats = holeSeasonStats(p, courseKey);
        if (!stats) return '';
        return `
            <tr>
                <td>${COURSE_VIEWS[courseKey].label.replace(' Course', '')}</td>
                <td style="color:${p.color.solid}">${p.name}</td>
                <td>${holeCell(stats.favorite)}</td>
                <td>${holeCell(stats.nemesis)}</td>
            </tr>`;
    })).join('');

    document.getElementById('recap-holes').innerHTML = rows ? `
        <table class="recap-table">
            <thead><tr><th>Course</th><th>Player</th><th>Favorite</th><th>Nemesis</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>` : '';
    return Boolean(rows);
}

// ---- On the road ----

// Away rounds side by side, matched the same way as the head-to-head: same day, same course,
// same length, in the order played.
function renderRoad() {
    const rows = {};
    PLAYERS.forEach(p => {
        const seen = {};
        playerRounds(p)
            .filter(r => inRecapSeason(r) && !isParkCourse(r) && !isChampionCourse(r))
            .sort((a, b) => a.date.localeCompare(b.date) || a.roundId.localeCompare(b.roundId))
            .forEach(r => {
                const base = `${r.date}|${courseGroupLabel(r.course)}|${r.holes}`;
                seen[base] = (seen[base] || 0) + 1;
                const key = `${base}|${seen[base]}`;
                (rows[key] = rows[key] || { date: r.date, label: courseGroupLabel(r.course), holes: r.holes })[p.key] = r;
            });
    });

    const list = Object.values(rows).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length === 0) return false;

    const cell = r => r ? roundLink(r, `${r.score} <span class="recap-hole-detail">${formatToPar(r.score, r.par)}</span>`) : '—';
    document.getElementById('recap-road').innerHTML = `
        <table class="recap-table">
            <thead><tr><th>Date</th><th>Course</th>${PLAYERS.map(p => `<th>${p.name}</th>`).join('')}</tr></thead>
            <tbody>${list.map(row => `
                <tr>
                    <td>${formatDate(row.date)}</td>
                    <td>${row.label} <span class="recap-hole-detail">${row.holes}h</span></td>
                    ${PLAYERS.map(p => `<td>${cell(row[p.key])}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
        </table>`;
    return true;
}

// ---- Photos ----

function renderPhotos(milestones, posts) {
    const photos = [
        ...milestones.map(m => ({ date: m.date, url: m.image_url, title: m.title, href: 'journal.html#timeline' })),
        ...posts.map(b => ({ date: b.date, url: b.image_url, title: b.title, href: 'journal.html#blog' })),
    ].filter(ph => (ph.url || '').trim() && seasonOf(ph.date) === recapSeason)
     .sort((a, b) => a.date.localeCompare(b.date));

    document.getElementById('recap-photos').innerHTML = photos.map(ph => `
        <a class="recap-photo" href="${ph.href}">
            <img src="${escapeHtml(cloudinaryAuto(ph.url.trim()))}" alt="${escapeHtml(ph.title || '')}" loading="lazy">
            <span>${escapeHtml(ph.title || '')} · ${formatDate(ph.date)}</span>
        </a>`).join('');
    return photos.length > 0;
}

// ---- Numbers to beat ----

function chasingHook() {
    const target = COURSE_VIEWS.champion.target;
    const scores = PLAYERS.map(p => {
        const rounds = courseSeasonRounds(p, 'champion');
        return { name: p.name, best: rounds.length ? Math.min(...rounds.map(r => r.score)) : null };
    }).filter(s => s.best !== null);
    if (scores.length === 0) return '';

    const broke = scores.filter(s => s.best < target);
    if (broke.length) {
        return `${broke.map(s => `${s.name} (${s.best})`).join(' and ')} broke ${target} on Champion in ${recapSeason}.`;
    }
    const closest = Math.min(...scores.map(s => s.best));
    const names = scores.filter(s => s.best === closest).map(s => s.name).join(' and ');
    const next = Number(recapSeason) + 1;
    return `Nobody broke ${target} on Champion in ${recapSeason}. ${names}'s ${closest} came closest, so Chasing ${target} carries into ${next}.`;
}

function renderNumbersToBeat() {
    const best = (p, course) => {
        const rounds = courseSeasonRounds(p, course);
        return rounds.length ? String(Math.min(...rounds.map(r => r.score))) : '—';
    };
    const avg = (p, course) => {
        const rounds = courseSeasonRounds(p, course);
        return rounds.length ? (rounds.reduce((s, r) => s + r.score, 0) / rounds.length).toFixed(1) : '—';
    };
    const lowIndex = p => {
        const points = handicapData[p.name].progression.filter(pt => seasonOf(pt.date) === recapSeason);
        return points.length ? Math.min(...points.map(pt => pt.whi)).toFixed(1) : '—';
    };
    const birdies = p => String(calculateBirdies(playerRounds(p)).log.filter(e => seasonOf(e.date) === recapSeason).length);

    const marks = [
        ['Best on Champion', p => best(p, 'champion')],
        ['Best on Park', p => best(p, 'park')],
        ['Champion average', p => avg(p, 'champion')],
        ['Park average', p => avg(p, 'park')],
        ['Lowest index', lowIndex],
        ['Birdies', birdies],
        ['Holes played', p => formatCount(totalHoles(playerRounds(p).filter(inRecapSeason)))],
        ['Days out', p => String(daysOut(playerRounds(p).filter(inRecapSeason)))],
    ];

    document.getElementById('recap-beat-title').textContent = `Numbers to Beat in ${Number(recapSeason) + 1}`;
    document.getElementById('recap-hook').textContent = chasingHook();
    document.getElementById('recap-beat').innerHTML = `
        <table class="recap-table recap-beat-table">
            <thead><tr><th></th>${PLAYERS.map(p => `<th style="color:${p.color.solid}">${p.name}</th>`).join('')}</tr></thead>
            <tbody>${marks.map(([label, value]) => `
                <tr><td>${label}</td>${PLAYERS.map(p => `<td><strong>${value(p)}</strong></td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>`;
}

// ---- Page ----

function showSection(id, visible) {
    document.getElementById(id).hidden = !visible;
}

function renderRecap(milestones, posts, noteRow) {
    PLAYERS.forEach(p => {
        handicapData[p.name] = calculateHandicap(playerRounds(p));
    });

    renderOpening(noteRow);
    renderNotes(noteRow);

    renderHandicapCompare(recapSeason);
    document.getElementById('recap-index-story').innerHTML = PLAYERS.map(indexStory).join('');

    // Champion first, and the lower score first within each course
    document.getElementById('recap-best-grid').innerHTML = ['champion', 'park']
        .flatMap(course => PLAYERS
            .map(p => ({ p, rounds: courseSeasonRounds(p, course) }))
            .filter(x => x.rounds.length)
            .sort((a, b) => Math.min(...a.rounds.map(r => r.score)) - Math.min(...b.rounds.map(r => r.score)))
            .map(x => bestDayCard(x.p, course, milestones)))
        .join('');

    const h2h = Object.keys(COURSE_VIEWS).map(c => headToHeadCard(c, recapSeason)).join('');
    document.getElementById('recap-h2h-grid').innerHTML = h2h;
    showSection('recap-h2h', Boolean(h2h));

    renderBirdieChase();
    showSection('recap-holes-section', renderHoles());

    showSection('recap-road-section', renderRoad());
    renderTournaments(recapSeason);

    showSection('recap-photos-section', renderPhotos(milestones, posts));
    renderNumbersToBeat();
}

async function sheetRows(name) {
    try {
        const response = await fetch(getSheetUrl(name));
        return response.ok ? parseCSV(await response.text()) : [];
    } catch (error) {
        console.error(`Error loading ${name}:`, error);
        return [];
    }
}

async function loadRecap() {
    const main = document.getElementById('recap-main');
    try {
        const [roundRows, scorecardRows, milestones, posts, recapRows] = await Promise.all([
            sheetRows(ROUNDS_SHEET),
            sheetRows(SCORECARDS_SHEET),
            sheetRows(MILESTONES_SHEET),
            sheetRows('Blog'),
            sheetRows(RECAPS_SHEET),
        ]);

        scorecardData = processScorecardData(scorecardRows);
        processRoundsData(roundRows);

        const asked = new URLSearchParams(location.search).get('season');
        recapSeason = allSeasons().includes(asked) ? asked : latestSeason;
        if (!recapSeason) {
            main.innerHTML = '<p class="loading">No rounds logged yet.</p>';
            return;
        }

        // Google answers an unknown tab name with a different sheet, so only trust rows with our season
        const noteRow = recapRows.find(row => (row.season || '').trim() === recapSeason) || null;
        renderRecap(milestones, posts, noteRow);
        main.hidden = false;
        document.getElementById('recap-loading').hidden = true;
    } catch (error) {
        console.error('Error loading recap:', error);
        document.getElementById('recap-loading').textContent = 'Error loading the recap. Check console for details.';
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeScorecard();
});

document.addEventListener('DOMContentLoaded', loadRecap);
