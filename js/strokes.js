// Stroke Audit page: where the strokes between current form and the goal actually go,
// what each fix is worth, and a round replay simulator.
// Relies on globals from config.js (scorecardData, allRoundsData), helpers from data.js,
// render.js (formatDate, formatToPar) and courses.js (COURSE_VIEWS, PLAYERS, courseRounds).

// Shares the course selection with the Trends page so the site remembers one choice.
let auditCourse = localStorage.getItem('chasing90-trends-course') || 'park';
if (!COURSE_VIEWS[auditCourse]) auditCourse = 'park';

let breakdownChart = null;
let whatifRounds   = [];   // scorecard rounds for the current course, newest first

const FORM_WINDOW = 10;    // rounds in the "current form" average, matching the Trends pace fit

function auditCardedRounds(playerKey) {
    return courseRounds(playerKey, auditCourse)
        .filter(r => (scorecardData[r.roundId] || []).length > 0);
}

function fmt1(v) {
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// ---- Core audit numbers for one player on the current course ----

function buildAudit(playerKey) {
    const course = COURSE_VIEWS[auditCourse];
    const rounds = courseRounds(playerKey, auditCourse);
    if (rounds.length === 0) return null;

    const recent = rounds.slice(-FORM_WINDOW);
    const form   = recent.reduce((s, r) => s + r.score, 0) / recent.length;

    const a = {
        playerKey,
        roundCount: rounds.length,
        form,
        formRounds: recent.length,
        gap: form - course.target,
        carded: 0,
        // strokes over par per category (s) and holes in each (n), summed over all carded rounds
        cat: {
            giveback: { n: 0, s: 0 },  // under-par holes, s is negative
            bogey:    { n: 0, s: 0 },
            double:   { n: 0, s: 0 },
            triple:   { n: 0, s: 0 },
        },
        parTypes: {},                  // par -> { holes, over }
        front: 0, back: 0, fbRounds: 0,
        puttRounds: 0, threePuttHoles: 0, threePuttLoss: 0,
        holes: {},                     // hole number -> { plays, over, par }
    };

    auditCardedRounds(playerKey).forEach(r => {
        const hs = scorecardData[r.roundId];
        a.carded++;
        hs.forEach(h => {
            const d = h.score - h.par;
            if      (d < 0)   { a.cat.giveback.n++; a.cat.giveback.s += d; }
            else if (d === 1) { a.cat.bogey.n++;    a.cat.bogey.s    += d; }
            else if (d === 2) { a.cat.double.n++;   a.cat.double.s   += d; }
            else if (d >= 3)  { a.cat.triple.n++;   a.cat.triple.s   += d; }

            if (!a.parTypes[h.par]) a.parTypes[h.par] = { holes: 0, over: 0 };
            a.parTypes[h.par].holes++;
            a.parTypes[h.par].over += d;

            if (!a.holes[h.hole]) a.holes[h.hole] = { plays: 0, over: 0, par: h.par };
            a.holes[h.hole].plays++;
            a.holes[h.hole].over += d;
        });

        if (course.holes === 18 && hs.length === 18) {
            a.front += hs.filter(h => h.hole <= 9).reduce((s, h) => s + h.score - h.par, 0);
            a.back  += hs.filter(h => h.hole >  9).reduce((s, h) => s + h.score - h.par, 0);
            a.fbRounds++;
        }

        if (hs.every(h => h.putts !== null)) {
            a.puttRounds++;
            hs.forEach(h => {
                if (h.putts >= 3) { a.threePuttHoles++; a.threePuttLoss += h.putts - 2; }
            });
        }
    });

    a.nemesis = Object.entries(a.holes)
        .map(([hole, h]) => ({ hole: +hole, par: h.par, plays: h.plays, avgOver: h.over / h.plays }))
        .filter(h => h.plays >= 2)
        .sort((x, y) => y.avgOver - x.avgOver)
        .slice(0, 3);

    return a;
}

// ---- 1. The Gap ----

function renderGap() {
    const course = COURSE_VIEWS[auditCourse];
    const cards = PLAYERS.map(p => {
        const a = buildAudit(p.key);
        if (!a) {
            return `<div class="gap-card"><h3 class="records-player" style="color:${p.color.solid}">${p.name}</h3>
                <p class="record-sub">No rounds on this course yet.</p></div>`;
        }
        const atGoal = a.gap <= 0;
        return `
            <div class="gap-card">
                <h3 class="records-player" style="color:${p.color.solid}">${p.name}</h3>
                <p class="gap-number">${atGoal ? '0' : fmt1(a.gap)}</p>
                <p class="gap-label">${atGoal ? `current form is at the goal — keep it there` : `strokes between current form and ${course.target}`}</p>
                <p class="record-sub">${a.formRounds}-round average: ${fmt1(a.form)} · target: ${course.target} (par ${course.par})</p>
            </div>`;
    });
    document.getElementById('gap-grid').innerHTML = cards.join('');
}

// ---- 2. Where the strokes go ----

const AUDIT_CATS = [
    { key: 'giveback', label: 'Birdies+ (given back)', color: '#2d7a2d' },
    { key: 'bogey',    label: 'Bogeys',                color: '#e3c44d' },
    { key: 'double',   label: 'Doubles',               color: '#cf6b3a' },
    { key: 'triple',   label: 'Triples or worse',      color: '#962f1f' },
];

function renderBreakdown() {
    const wrap = document.getElementById('breakdown-chart-wrap');
    wrap.innerHTML = '<canvas></canvas>';
    if (breakdownChart) { breakdownChart.destroy(); breakdownChart = null; }

    const audits = PLAYERS.map(p => ({ p, a: buildAudit(p.key) })).filter(x => x.a && x.a.carded >= 2);
    const note = document.getElementById('breakdown-note');

    if (audits.length === 0) {
        wrap.innerHTML = '<p class="loading" style="padding:0">Not enough scorecard rounds on this course yet.</p>';
        note.textContent = '';
        document.getElementById('partype-table').innerHTML = '';
        document.getElementById('frontback-note').innerHTML = '';
        return;
    }

    note.textContent = 'Average strokes vs par per round by hole result · '
        + audits.map(x => `${x.p.name}: ${x.a.carded} scorecard rounds`).join(' · ');

    breakdownChart = new Chart(wrap.querySelector('canvas'), {
        type: 'bar',
        data: {
            labels: audits.map(x => x.p.name),
            datasets: AUDIT_CATS.map(c => ({
                label: c.label,
                data: audits.map(x => +(x.a.cat[c.key].s / x.a.carded).toFixed(2)),
                backgroundColor: c.color,
                borderRadius: 2,
            })),
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { font: { size: 10 } },
                    title: { display: true, text: 'Strokes vs par per round', font: { size: 10 }, color: '#6b9b6b' },
                },
                y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
            },
            plugins: {
                legend: { labels: { font: { size: 10 }, boxWidth: 12, padding: 10 } },
                tooltip: {
                    callbacks: {
                        label: item => {
                            const audit = audits[item.dataIndex].a;
                            const cat = AUDIT_CATS[item.datasetIndex];
                            const perRound = (audit.cat[cat.key].n / audit.carded).toFixed(1);
                            return ` ${cat.label}: ${item.parsed.x} strokes/round (${perRound} holes/round)`;
                        },
                    },
                },
            },
        },
    });

    // Front-vs-back fade, Champion course only
    const fb = audits
        .filter(x => x.a.fbRounds >= 2)
        .map(x => {
            const f = x.a.front / x.a.fbRounds, b = x.a.back / x.a.fbRounds;
            const diff = b - f;
            const verdict = Math.abs(diff) < 0.8 ? 'even split'
                : diff > 0 ? `the back nine costs ${fmt1(diff)} more` : `the front nine costs ${fmt1(-diff)} more`;
            return `<strong style="color:${x.p.color.solid}">${x.p.name}</strong>: front 9 +${fmt1(f)} vs back 9 +${fmt1(b)} per round — ${verdict}`;
        });
    document.getElementById('frontback-note').innerHTML =
        fb.length ? fb.map(s => `<p class="pace-summary-line" style="margin-top:var(--space-xs)">${s}</p>`).join('') : '';

    // Per-par-type table
    const pars = [...new Set(audits.flatMap(x => Object.keys(x.a.parTypes).map(Number)))].sort();
    const rows = pars.map(par => {
        const cells = audits.map(x => {
            const t = x.a.parTypes[par];
            if (!t) return '<td class="month-empty">—</td><td class="month-empty">—</td>';
            return `<td>+${(t.over / t.holes).toFixed(2)}</td><td>+${(t.over / x.a.carded).toFixed(1)}</td>`;
        }).join('');
        return `<tr><td>Par ${par}s</td>${cells}</tr>`;
    }).join('');

    document.getElementById('partype-table').innerHTML = `
        <table class="scoring-dist-table">
            <thead>
                <tr><th></th>${audits.map(x => `<th colspan="2">${x.p.name}</th>`).join('')}</tr>
                <tr class="scoring-table-subhead"><th>Hole type</th>${audits.map(() => '<th>per hole</th><th>per round</th>').join('')}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// ---- 3. Costliest holes ----

function renderNemesis() {
    const grid = document.getElementById('nemesis-grid');
    document.getElementById('nemesis-note').textContent =
        'Average score vs par per hole, worst first · min. 2 plays · "potential" = strokes/round back if the hole became an average bogey';

    grid.innerHTML = PLAYERS.map(p => {
        const a = buildAudit(p.key);
        let body;
        if (!a || a.nemesis.length === 0) {
            body = '<p class="record-sub">Needs scorecard data.</p>';
        } else {
            body = a.nemesis.map(h => {
                const potential = Math.max(0, h.avgOver - 1);
                return `
                    <div class="nemesis-row">
                        <span class="nemesis-hole">Hole ${h.hole}</span>
                        <span class="nemesis-stats">par ${h.par} · avg +${fmt1(h.avgOver)} over ${h.plays} plays</span>
                        <span class="nemesis-potential">${potential >= 0.3 ? `−${fmt1(potential)}/round` : 'fine'}</span>
                    </div>`;
            }).join('');
        }
        return `<div><p class="scoring-chart-label" style="color:${p.color.solid}">${p.name}</p>${body}</div>`;
    }).join('');
}

// ---- 4. Putting ----

function renderPutting() {
    const note = document.getElementById('putting-note');
    const el   = document.getElementById('putting-table');

    const audits = PLAYERS.map(p => ({ p, a: buildAudit(p.key) })).filter(x => x.a);
    const withPutts = audits.filter(x => x.a.puttRounds >= 2);

    if (withPutts.length === 0) {
        note.textContent = '';
        el.innerHTML = '<p class="loading">Not enough rounds with putt data on this course yet.</p>';
        return;
    }

    note.textContent = 'Every putt past the second is a stroke handed back · only rounds with complete putt data count';

    const row = (label, fn) => `<tr><td>${label}</td>${audits.map(x =>
        x.a.puttRounds >= 2 ? `<td>${fn(x.a)}</td>` : '<td class="month-empty">—</td>').join('')}</tr>`;

    el.innerHTML = `
        <table class="scoring-dist-table">
            <thead><tr><th></th>${audits.map(x => `<th>${x.p.name}</th>`).join('')}</tr></thead>
            <tbody>
                ${row('Rounds with putt data', a => `${a.puttRounds} of ${a.carded}`)}
                ${row('Three-putts per round', a => fmt1(a.threePuttHoles / a.puttRounds))}
                ${row('Strokes lost to 3-putts / round', a => fmt1(a.threePuttLoss / a.puttRounds))}
            </tbody>
        </table>`;
}

// ---- 5. Fastest path ----

function buildLevers(a) {
    if (!a || a.carded < 3) return [];
    const levers = [];

    const overBogey = (a.cat.double.s - a.cat.double.n) + (a.cat.triple.s - a.cat.triple.n);
    const doubleHoles = a.cat.double.n + a.cat.triple.n;
    if (overBogey / a.carded >= 0.3) {
        levers.push({
            save: overBogey / a.carded,
            label: 'Turn doubles-or-worse into bogeys',
            note: `${fmt1(doubleHoles / a.carded)} holes/round currently go double or worse`,
        });
    }

    if (a.puttRounds >= 2 && a.threePuttLoss / a.puttRounds >= 0.3) {
        levers.push({
            save: a.threePuttLoss / a.puttRounds,
            label: 'Kill the three-putts',
            note: `${fmt1(a.threePuttHoles / a.puttRounds)} three-putts/round across ${a.puttRounds} measured rounds`,
        });
    }

    const topTwo = a.nemesis.slice(0, 2).filter(h => h.avgOver > 1);
    const nemesisSave = topTwo.reduce((s, h) => s + (h.avgOver - 1), 0);
    if (nemesisSave >= 0.3) {
        levers.push({
            save: nemesisSave,
            label: `Tame hole${topTwo.length > 1 ? 's' : ''} ${topTwo.map(h => h.hole).join(' & ')}`,
            note: `currently ${topTwo.map(h => `+${fmt1(h.avgOver)}`).join(' and ')} vs par on average — bogey there is enough`,
        });
    }

    // Par-type weakness: the hole type that plays worst relative to your own per-hole
    // baseline. Relative framing keeps it from re-counting the doubles lever's strokes.
    const types = Object.entries(a.parTypes).map(([par, t]) => ({
        par: +par, perHole: t.over / t.holes, perRound: t.holes / a.carded, holes: t.holes,
    }));
    const totalHoles = types.reduce((s, t) => s + t.holes, 0);
    const overallPerHole = types.reduce((s, t) => s + t.perHole * t.holes, 0) / totalHoles;
    const worstType = types
        .filter(t => t.holes >= a.carded) // at least ~1 such hole per round, real sample
        .sort((x, y) => y.perHole - x.perHole)[0];
    if (worstType) {
        const typeSave = (worstType.perHole - overallPerHole) * worstType.perRound;
        if (typeSave >= 0.4) {
            levers.push({
                save: typeSave,
                label: `Sharpen your par ${worstType.par}s`,
                note: `they play to +${fmt1(worstType.perHole)}/hole vs +${fmt1(overallPerHole)}/hole across the rest of your round`,
            });
        }
    }

    // Front/back fade (18-hole only): the cost of not playing your better nine twice.
    if (a.fbRounds >= 2) {
        const front = a.front / a.fbRounds, back = a.back / a.fbRounds;
        const fade = Math.abs(back - front);
        if (fade >= 0.8) {
            const worse = back > front ? 'back' : 'front';
            const better = worse === 'back' ? 'front' : 'back';
            levers.push({
                save: fade,
                label: `Steady the ${worse} nine`,
                note: `+${fmt1(Math.max(front, back))} on the ${worse} vs +${fmt1(Math.min(front, back))} on the ${better} — match your better nine`,
            });
        }
    }

    return levers.sort((x, y) => y.save - x.save);
}

function renderLevers() {
    const course = COURSE_VIEWS[auditCourse];
    document.getElementById('path-title').textContent =
        course.target === 90 ? 'Fastest Path to Breaking 90' : `Fastest Path to ${course.target}`;

    document.getElementById('levers-grid').innerHTML = PLAYERS.map(p => {
        const a = buildAudit(p.key);
        const levers = buildLevers(a);
        let body;
        if (!a) {
            body = '<p class="record-sub">No rounds on this course yet.</p>';
        } else if (levers.length === 0) {
            body = '<p class="record-sub">Needs at least 3 scorecard rounds for the math to mean anything.</p>';
        } else {
            body = '<ol class="lever-list">' + levers.map(l => `
                <li class="lever-item">
                    <div class="lever-head">
                        <span class="lever-label">${l.label}</span>
                        <span class="lever-save">~${fmt1(l.save)}/rd</span>
                    </div>
                    <p class="lever-note">${l.note}</p>
                </li>`).join('') + '</ol>';

            const total = levers.reduce((s, l) => s + l.save, 0);
            let verdict;
            if (a.gap <= 0) {
                verdict = `Current form is already at ${course.target} — these are how it stays there.`;
            } else {
                let cum = 0, k = 0;
                for (const l of levers) { cum += l.save; k++; if (cum >= a.gap) break; }
                verdict = cum >= a.gap
                    ? `The gap is ${fmt1(a.gap)} strokes. Lever${k > 1 ? `s 1–${k}` : ' 1'} (~${fmt1(cum)}) would cover it on paper.`
                    : `The gap is ${fmt1(a.gap)} strokes. All levers together (~${fmt1(total)}) get most of the way — the rest is steady improvement.`;
            }
            body += `<p class="lever-verdict">${verdict}</p>`;
        }
        return `<div><p class="scoring-chart-label" style="color:${p.color.solid}">${p.name}</p>${body}</div>`;
    }).join('');
}

// ---- 6. What-if simulator ----

function renderWhatIf() {
    const body = document.getElementById('whatif-body');
    whatifRounds = PLAYERS.flatMap(p =>
        auditCardedRounds(p.key).map(r => ({ round: r, playerName: p.name }))
    ).sort((x, y) => new Date(y.round.date) - new Date(x.round.date));

    if (whatifRounds.length === 0) {
        body.innerHTML = '<p class="loading">No scorecard rounds on this course yet.</p>';
        return;
    }

    const options = whatifRounds.map(({ round, playerName }) =>
        `<option value="${round.roundId}">${playerName} · ${formatDate(round.date)} · ${round.score} (${formatToPar(round.score, round.par)})</option>`
    ).join('');

    body.innerHTML = `
        <div class="whatif-controls">
            <select id="whatif-round" onchange="updateWhatIf()">${options}</select>
            <label class="whatif-toggle"><input type="checkbox" id="whatif-nodoubles" onchange="updateWhatIf()"> Doubles or worse become bogeys</label>
            <label class="whatif-toggle" id="whatif-no3putt-label"><input type="checkbox" id="whatif-no3putt" onchange="updateWhatIf()"> No three-putts</label>
        </div>
        <div class="whatif-result" id="whatif-result"></div>`;

    updateWhatIf();
}

function updateWhatIf() {
    const course  = COURSE_VIEWS[auditCourse];
    const roundId = document.getElementById('whatif-round').value;
    const entry   = whatifRounds.find(x => x.round.roundId === roundId);
    if (!entry) return;
    const { round } = entry;
    const holes = scorecardData[roundId];

    const hasPutts   = holes.some(h => h.putts !== null);
    const no3puttBox = document.getElementById('whatif-no3putt');
    no3puttBox.disabled = !hasPutts;
    document.getElementById('whatif-no3putt-label').classList.toggle('whatif-disabled', !hasPutts);
    if (!hasPutts) no3puttBox.checked = false;

    const noDoubles = document.getElementById('whatif-nodoubles').checked;
    const no3putt   = no3puttBox.checked;

    // Putt savings first, then the bogey cap, so a fixed three-putt double isn't saved twice
    let adjusted = 0, changedHoles = 0;
    holes.forEach(h => {
        let s = h.score;
        if (no3putt && h.putts !== null && h.putts >= 3) s -= h.putts - 2;
        if (noDoubles) s = Math.min(s, h.par + 1);
        adjusted += s;
        if (s !== h.score) changedHoles++;
    });

    const saved = round.score - adjusted;
    // "Break 90" means 89 or better; the park goal of 36 counts when you shoot it
    const reaches = course.target === 90 ? adjusted < course.target : adjusted <= course.target;

    let verdict;
    if (!noDoubles && !no3putt) verdict = 'Toggle a fix above to replay the round.';
    else if (saved === 0)       verdict = 'Nothing to fix — this round had none of that.';
    else {
        const goalBit = reaches
            ? `<strong class="whatif-goal-hit">${course.target === 90 ? 'that breaks 90 🎉' : `that reaches the goal of ${course.target} 🎉`}</strong>`
            : `still ${fmt1(adjusted - course.target + (course.target === 90 ? 1 : 0))} ${course.target === 90 ? `from breaking ${course.target}` : `short of ${course.target}`}`;
        verdict = `saves ${saved} stroke${saved !== 1 ? 's' : ''} across ${changedHoles} hole${changedHoles !== 1 ? 's' : ''} — ${goalBit}`;
    }

    document.getElementById('whatif-result').innerHTML = `
        <p class="whatif-score">${round.score} <span class="whatif-arrow">→</span> ${adjusted}
            <span class="whatif-topar">(${formatToPar(adjusted, round.par)})</span></p>
        <p class="whatif-verdict">${verdict}</p>
        <p class="pace-disclaimer">A replay, not a prediction — the holes you birdie after a blow-up are part of golf too.</p>`;
}

// ---- Course switching + page load ----

function renderAudit() {
    document.querySelectorAll('.course-tab').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.course === auditCourse));
    renderGap();
    renderBreakdown();
    renderNemesis();
    // renderPutting();  // hidden until both players have putt data (section removed from strokes.html)
    renderLevers();
    renderWhatIf();
}

function setAuditCourse(key) {
    if (!COURSE_VIEWS[key] || key === auditCourse) return;
    auditCourse = key;
    localStorage.setItem('chasing90-trends-course', key);
    renderAudit();
}

async function loadAuditData() {
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

        renderAudit();

    } catch (error) {
        console.error('Error loading stroke audit data:', error);
        ['gap-grid', 'whatif-body'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<p class="loading">Error loading data. Check console for details.</p>';
        });
    }
}

document.addEventListener('DOMContentLoaded', loadAuditData);
