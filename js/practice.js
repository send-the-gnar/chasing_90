// Practice page: two checkable, at-the-course practice routines.
//   • "After-Work Tune-Up"  — ~1 hr, leaves time to still play 9 holes
//   • "Deep Session"        — ~1 hr 45, with a choose-your-focus branch
//
// This page is fully static (no sheet fetch). The routines are hand-designed
// around where our games actually leak strokes — see the Stroke Audit page:
//   - too many double-or-worse holes (missed greens we don't get up-and-down)
//   - three-putts (Amelie ~1 in 3 holes, Daniel ~1 in 6)
//   - par 4s our worst hole type
// Each drill carries a target so it stays measurable, and a checkbox so it's
// easy to follow standing on the range. Checks + the chosen view persist in
// localStorage so a screen-lock mid-session doesn't wipe your place.

// ---- Routine content -------------------------------------------------------

const SHORT_ROUTINE = {
    key: 'short',
    label: 'After-Work Tune-Up',
    time: '~55 min',
    tagline: 'Short enough to still play 9 · warms you up and sharpens the shots that save the most strokes.',
    blocks: [
        {
            title: 'Putting — pace & confidence',
            time: '10 min',
            where: 'Practice green',
            drills: [
                {
                    id: 's_putt_ladder',
                    name: 'Lag ladder — 5 / 10 / 15 m',
                    detail: '3 balls to each distance. Roll every one to die just past the hole, inside a putter-length.',
                    target: 'Every ball past the hole, none left short.',
                    why: '3-putts are our cheapest strokes to save — pace is the whole game.',
                },
                {
                    id: 's_putt_circle',
                    name: 'Short-putt circle — 1 m',
                    detail: '6 balls in a ring around one hole. Make all 6 in a row before you move on.',
                    target: '6 in a row, twice.',
                },
            ],
        },
        {
            title: 'Around the green — up & down',
            time: '15 min',
            where: 'Chipping area',
            drills: [
                {
                    id: 's_chip_land',
                    name: 'Landing-spot chips',
                    detail: 'Drop a towel as your landing spot. Bump-and-run with PW/9i and land 5 in a row on it.',
                    target: '5 landings on the towel.',
                },
                {
                    id: 's_chip_updown',
                    name: 'Up-and-down game — 6 lies',
                    detail: '6 balls, 6 different spots around the green. Chip, then putt out. Count your up-and-downs.',
                    target: 'Beat last time — aim 3 of 6.',
                    why: 'Half our big-course holes go double-or-worse, almost all from a missed green we never save. This is the #1 lever.',
                },
            ],
        },
        {
            title: 'Range — groove the swing',
            time: '18 min',
            where: 'Range',
            drills: [
                {
                    id: 's_range_contact',
                    name: 'Wedge contact ladder',
                    detail: '10 half-swings, feet almost together, PW. Ball-then-turf. Add speed only once the strike is clean.',
                    target: '8 of 10 flush.',
                },
                {
                    id: 's_range_bag',
                    name: 'Work the bag with a routine',
                    detail: '3 balls each: PW → 7i → 5w/hybrid → driver. Full pre-shot routine and a NEW target on every ball.',
                    target: 'Never two shots at the same target.',
                    why: 'A repeatable routine is what actually travels to the first tee.',
                },
            ],
        },
        {
            title: 'Transfer & go',
            time: '10 min',
            where: 'Range → green',
            drills: [
                {
                    id: 's_transfer_holes',
                    name: 'Play holes 1–3 on the range',
                    detail: 'Hit the real shots you\'ll face: tee club, then the approach — one ball each, full routine. Finish each hole in your head.',
                    target: 'Committed, full routine on every ball.',
                },
                {
                    id: 's_transfer_finish',
                    name: 'Warm putts, then straight to the tee',
                    detail: 'Back to the green: 3 long lag putts + 3 short putts, then walk to the first tee still warm.',
                    target: 'Last putt a make — then go.',
                },
            ],
        },
    ],
};

const LONG_FOUNDATION = [
    {
        title: 'Wake up the body & swing',
        time: '10 min',
        where: 'Range',
        drills: [
            {
                id: 'l_warm_dynamic',
                name: 'Dynamic warm-up',
                detail: 'Leg swings, trunk rotations, a few slow rehearsal swings. Get loose before you hit a ball.',
                target: 'Loose and lightly sweating.',
            },
            {
                id: 'l_warm_ladder',
                name: 'Contact ladder, short to long',
                detail: 'Wedge half-swings → 9i → 7i → mid-iron, 5 balls each, growing from half to full as contact stays clean.',
                target: 'Clean strike before adding speed.',
            },
        ],
    },
    {
        title: 'Putting foundation',
        time: '20 min',
        where: 'Practice green',
        drills: [
            {
                id: 'l_putt_gate',
                name: 'Gate drill — start line (1 m)',
                detail: 'Two tees just wider than the putter head. Make 15 through the gate without a clink.',
                target: '15 clean rolls.',
            },
            {
                id: 'l_putt_lag',
                name: 'Lag ladder — 6 / 12 / 18 m',
                detail: '3 balls to each. Finish inside a "safe circle" one putter-length past the hole.',
                target: 'None short, none at 3-putt distance.',
            },
            {
                id: 'l_putt_game',
                name: '9-hole putting game',
                detail: 'Random putts 3–15 m across the green, hole out each one. Count total putts over 9 "holes."',
                target: '16 or fewer (mostly 2-putts, zero 3-putts).',
                why: 'Attacks our 3-putt rate head-on — the second-biggest leak.',
            },
        ],
    },
];

const LONG_BRANCHES = {
    striking: {
        key: 'striking',
        label: 'Tee to Green',
        blurb: 'Ball-striking day — strike, start line, and a plan off the tee.',
        time: '~60 min',
        blocks: [
            {
                title: 'Tee to Green — ball-striking',
                time: '60 min',
                where: 'Range',
                drills: [
                    {
                        id: 'l_str_align',
                        name: 'Alignment station',
                        detail: 'Sticks down — one on the target line, one along your feet. 10 balls, 7i, groove start line and strike.',
                        target: '8 of 10 starting on line.',
                    },
                    {
                        id: 'l_str_lowpoint',
                        name: 'Low-point control',
                        detail: 'Lay a towel down, ball just ahead of it. 15 iron shots that bruise the turf AFTER the ball — never behind.',
                        target: '12 of 15 divots in front of the towel.',
                    },
                    {
                        id: 'l_str_driver',
                        name: 'Fairway finder — driver',
                        detail: 'Pick a fairway ~30 m wide. 10 stock drives, count how many are "in play." Then 10 at 3/4 tempo — compare the counts.',
                        target: '3/4 tempo matches or beats the stock swing.',
                        why: 'Par 4s are our worst holes (Amelie +2.3, Daniel +1.7 vs par). More fairways kills the double at its source.',
                    },
                    {
                        id: 'l_str_teeplan',
                        name: 'Par-4 tee plan',
                        detail: 'Rehearse driver vs 5-wood off the tee. Decide the club that finds the short grass most often — that becomes your default.',
                        target: 'One decided go-to tee club.',
                    },
                ],
            },
        ],
    },
    short_game: {
        key: 'short_game',
        label: 'Short Game & Scoring',
        blurb: 'The biggest lever — wedges, up-and-downs, and putting under pressure.',
        time: '~60 min',
        blocks: [
            {
                title: 'Short Game & Scoring',
                time: '60 min',
                where: 'Short-game area',
                drills: [
                    {
                        id: 'l_sg_ladder',
                        name: 'Wedge distance ladder',
                        detail: 'Carry stations at 30 / 50 / 70 / 90 m, 5 balls each. Learn your stock carry for each swing length.',
                        target: 'Know your three wedge numbers.',
                    },
                    {
                        id: 'l_sg_updown',
                        name: 'Up-and-down circuit — 9 lies',
                        detail: '9 balls around the green: tight lie, rough, upslope, downslope, bump-and-run, one high floater. Chip + putt out, score out of 9.',
                        target: 'Beat last time — aim 4 of 9.',
                        why: 'Converting missed greens into bogeys is the single biggest score-saver we have.',
                    },
                    {
                        id: 'l_sg_bunker',
                        name: 'Greenside bunker basics',
                        detail: 'Pick a spot 2 inches behind the ball and hit THAT spot — let the sand lift it out. 10 splash shots.',
                        target: '8 of 10 out and on the green.',
                    },
                    {
                        id: 'l_sg_pressure',
                        name: 'Putting pressure ladder',
                        detail: 'Make 5 in a row at 1.5 m, then 5 in a row at 2 m. Any miss restarts that distance.',
                        target: 'Clear both rungs.',
                    },
                ],
            },
        ],
    },
    on_course: {
        key: 'on_course',
        label: 'On-Course / Pressure',
        blurb: 'Take it to the course — games with consequences that train the scoring brain.',
        time: '~60 min',
        blocks: [
            {
                title: 'On-Course / Pressure',
                time: '60 min',
                where: 'Course + practice green',
                drills: [
                    {
                        id: 'l_oc_worstball',
                        name: 'Worst-ball — 4 to 6 holes',
                        detail: 'Play two balls on every shot and always continue with the WORSE one. Brutal, but it exposes the weak link fast.',
                        target: 'Get round without a blow-up hole.',
                    },
                    {
                        id: 'l_oc_par18',
                        name: 'Par-18 up-and-down holes',
                        detail: '9 "holes" around the practice green, each par 2 (chip + putt). Total your score against par 18.',
                        target: 'Beat 18.',
                    },
                    {
                        id: 'l_oc_oneball',
                        name: 'One-ball, full routine — 9 holes',
                        detail: 'One ball, a target and full routine on every shot, no re-hits. Track fairways, greens, up-and-downs and 3-putts.',
                        target: 'A routine on 100% of shots.',
                    },
                    {
                        id: 'l_oc_bogeygame',
                        name: 'Bogey-is-great game',
                        detail: 'On every par 4 and 5 your goal is bogey — take the aggressive line only when it\'s clearly smart. Count your doubles.',
                        target: 'Zero doubles.',
                        why: 'Our scores aren\'t killed by missing birdies — they\'re killed by big numbers. This trains the decision that removes them.',
                    },
                ],
            },
        ],
    },
};

const LONG_FINISH = [
    {
        title: 'Finish under pressure',
        time: '15 min',
        where: 'Practice green',
        drills: [
            {
                id: 'l_fin_pressure',
                name: 'Must-make putt-off',
                detail: '9 putts from 1–2 m around one hole. Every one counts — a miss means a lap of the green (or restart the set).',
                target: '8 of 9.',
            },
            {
                id: 'l_fin_log',
                name: 'Log the session',
                detail: 'Write one thing that worked and one thing to carry into the next round.',
                target: 'Two lines in the journal.',
            },
        ],
    },
];

const FOCUS_ORDER = ['short_game', 'striking', 'on_course'];

// ---- State ----------------------------------------------------------------

let routineView = localStorage.getItem('chasing90-routine-view') || 'short';
if (routineView !== 'short' && routineView !== 'long') routineView = 'short';

let focusBranch = localStorage.getItem('chasing90-routine-focus') || 'short_game';
if (!LONG_BRANCHES[focusBranch]) focusBranch = 'short_game';

const checkKey = id => `chasing90-drill-${id}`;
const isChecked = id => localStorage.getItem(checkKey(id)) === '1';

// ---- Rendering ------------------------------------------------------------

function drillHTML(d) {
    return `
        <label class="drill ${isChecked(d.id) ? 'done' : ''}" for="chk_${d.id}">
            <input type="checkbox" class="drill-check" id="chk_${d.id}" data-drill="${d.id}"
                ${isChecked(d.id) ? 'checked' : ''} onchange="toggleDrill('${d.id}', this.checked)">
            <span class="drill-body">
                <span class="drill-name">${d.name}</span>
                <span class="drill-detail">${d.detail}</span>
                <span class="drill-target"><span class="drill-target-tag">Target</span>${d.target}</span>
                ${d.why ? `<span class="drill-why">${d.why}</span>` : ''}
            </span>
        </label>`;
}

function blockHTML(b) {
    return `
        <div class="analytics-card pblock">
            <div class="pblock-head">
                <h3 class="pblock-title">${b.title}</h3>
                <div class="pblock-tags">
                    <span class="pchip pchip-time">${b.time}</span>
                    <span class="pchip pchip-where">${b.where}</span>
                </div>
            </div>
            <div class="drill-list">${b.drills.map(drillHTML).join('')}</div>
        </div>`;
}

function currentBlocks() {
    if (routineView === 'short') return SHORT_ROUTINE.blocks;
    return [...LONG_FOUNDATION, ...LONG_BRANCHES[focusBranch].blocks, ...LONG_FINISH];
}

function renderMeta() {
    const el = document.getElementById('routine-meta');
    if (routineView === 'short') {
        el.innerHTML = `<span class="routine-time">${SHORT_ROUTINE.time}</span> · ${SHORT_ROUTINE.tagline}`;
    } else {
        const b = LONG_BRANCHES[focusBranch];
        el.innerHTML = `<span class="routine-time">~1 hr 45 min</span> · Foundation + <strong>${b.label}</strong> + pressure finish. `
            + `A deeper session — pick the day's focus below.`;
    }
}

function renderFocus() {
    const wrap = document.getElementById('focus-bar');
    if (routineView !== 'long') { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    wrap.innerHTML = `
        <p class="focus-label">Today's focus</p>
        <div class="course-tabs">
            ${FOCUS_ORDER.map(k => {
                const b = LONG_BRANCHES[k];
                return `<button class="course-tab ${k === focusBranch ? 'active' : ''}" onclick="setFocus('${k}')">${b.label}</button>`;
            }).join('')}
        </div>
        <p class="focus-blurb">${LONG_BRANCHES[focusBranch].blurb}</p>`;
}

function renderProgress() {
    const blocks = currentBlocks();
    const drills = blocks.flatMap(b => b.drills);
    const done = drills.filter(d => isChecked(d.id)).length;
    const pct = drills.length ? Math.round((done / drills.length) * 100) : 0;
    const wrap = document.getElementById('routine-progress');
    const complete = done === drills.length && drills.length > 0;
    wrap.innerHTML = `
        <div class="pprogress-top">
            <span class="pprogress-count">${complete ? '✓ Session complete — go play' : `${done} of ${drills.length} done`}</span>
            <button class="pprogress-reset" onclick="resetChecks()">Reset</button>
        </div>
        <div class="pprogress-bar"><div class="pprogress-fill" style="width:${pct}%"></div></div>`;
}

function renderRoutine() {
    document.querySelectorAll('.routine-toggle .course-tab').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.view === routineView));
    renderMeta();
    renderFocus();
    renderProgress();
    document.getElementById('routine-blocks').innerHTML = currentBlocks().map(blockHTML).join('');
}

// ---- Interaction ----------------------------------------------------------

function toggleDrill(id, checked) {
    if (checked) localStorage.setItem(checkKey(id), '1');
    else localStorage.removeItem(checkKey(id));
    const label = document.querySelector(`label[for="chk_${id}"]`);
    if (label) label.classList.toggle('done', checked);
    renderProgress();
}

function setRoutineView(view) {
    if (view === routineView || (view !== 'short' && view !== 'long')) return;
    routineView = view;
    localStorage.setItem('chasing90-routine-view', view);
    renderRoutine();
}

function setFocus(key) {
    if (!LONG_BRANCHES[key] || key === focusBranch) return;
    focusBranch = key;
    localStorage.setItem('chasing90-routine-focus', key);
    renderRoutine();
}

function resetChecks() {
    currentBlocks().flatMap(b => b.drills).forEach(d => localStorage.removeItem(checkKey(d.id)));
    renderRoutine();
}

document.addEventListener('DOMContentLoaded', renderRoutine);
