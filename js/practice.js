// Practice page: two checkable, at-the-course practice routines.
//   • "After-Work Tune-Up"  — ~55 min, leaves time to still play 9 holes
//   • "Deep Session"        — ~1 hr 40, with a choose-your-focus branch
//
// This page is fully static (no sheet fetch). The routines are built for
// Daniel at a ~17 handicap, from what the data actually says (Stroke Audit /
// Clubs pages, Aug 2026):
//   - fairways ~63% → the tee ball is fine; driver gets maintenance only
//   - greens ~15% on the Champion course (~3 of 18) → approach irons are the
//     #1 leak — and the new custom irons need calibrating anyway
//   - ~15 missed greens a round → up-and-downs decide the score
//   - ~36 putts a round → lag pace, not stroke mechanics
// Pressure work lives on the practice green and range: the course is busy,
// so multi-ball on-course games are out. Transfer happens through the Round
// Rules card — process goals that work in a normal group on a full tee sheet.
//
// Each drill carries a target so it stays measurable, and a checkbox so it's
// easy to follow standing on the range. Checks + the chosen view persist in
// localStorage so a screen-lock mid-session doesn't wipe your place.

// ---- Routine content -------------------------------------------------------

const SHORT_ROUTINE = {
    key: 'short',
    label: 'After-Work Tune-Up',
    time: '~55 min',
    tagline: 'Short enough to still play 9 · putting pace, up-and-downs and approach irons — the three things the data says pay.',
    blocks: [
        {
            title: 'Putting — pace first',
            time: '12 min',
            where: 'Practice green',
            drills: [
                {
                    id: 's_putt_lag',
                    name: 'Lag ladder — 5 / 10 / 15 m',
                    detail: '3 balls to each distance. Roll every one to die just past the hole, inside a putter-length.',
                    target: '7 of 9 in the safe zone, none short.',
                    why: 'At ~36 putts a round, pace on the first putt is the cheapest stroke on this list.',
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
                    detail: 'Drop a towel as your landing spot. Bump-and-run with PW/9i and land 5 on it.',
                    target: '5 landings on the towel.',
                },
                {
                    id: 's_chip_updown',
                    name: 'Up-and-down game — 6 lies',
                    detail: '6 balls, 6 different spots around the green. Chip, then putt out. Count your up-and-downs.',
                    target: 'Beat last time — 3 of 6 is a good day.',
                    why: 'You miss ~15 greens a round on the big course. Converting even 3 more of those is the whole gap to 90.',
                },
            ],
        },
        {
            title: 'Approach irons — the scoring window',
            time: '18 min',
            where: 'Range',
            drills: [
                {
                    id: 's_iron_contact',
                    name: 'Wedge contact ladder',
                    detail: '8 half-swings, feet almost together, PW. Ball-then-turf. Add speed only once the strike is clean.',
                    target: '6 of 8 flush.',
                },
                {
                    id: 's_iron_greens',
                    name: 'Green-hitting game — 110 / 130 / 150',
                    detail: '3 balls to each of three flags with the matching iron, full routine every ball. A "green" is anything you\'d be putting from.',
                    target: '4 of 9 greens — beat it next time.',
                    why: '15% greens on the Champion course is the #1 leak. This is that stat, rehearsed.',
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
                detail: 'Wedge half-swings → 9i → 7i, 5 balls each, growing from half to full as contact stays clean.',
                target: 'Clean strike before adding speed.',
            },
        ],
    },
    {
        title: 'Putting foundation',
        time: '15 min',
        where: 'Practice green',
        drills: [
            {
                id: 'l_putt_gate',
                name: 'Gate drill — start line (1 m)',
                detail: 'Two tees just wider than the putter head. Make 10 through the gate without a clink.',
                target: '10 clean rolls.',
            },
            {
                id: 'l_putt_lag',
                name: 'Lag ladder — 6 / 12 / 18 m',
                detail: '3 balls to each. Finish inside a "safe circle" one putter-length past the hole.',
                target: 'None short, none at 3-putt distance.',
                why: '~36 putts a round means the long ones aren\'t finishing close. This drill is that fix.',
            },
        ],
    },
];

const LONG_BRANCHES = {
    irons: {
        key: 'irons',
        label: 'New Irons & Approach',
        blurb: 'Calibration day — learn what the new irons actually do, then turn that into greens hit.',
        time: '~60 min',
        blocks: [
            {
                title: 'New Irons & Approach',
                time: '60 min',
                where: 'Range',
                drills: [
                    {
                        id: 'l_ir_carry',
                        name: 'Carry calibration — one club at a time',
                        detail: '8 balls each with PW → 9i → 8i → 7i → 6i. Ignore the best and worst — note the carry of your STOCK strike against the range markers. Write each number in your phone.',
                        target: 'A carry number you trust for all five clubs.',
                        why: 'New shafts and lofts mean the old numbers are dead. Every approach until you do this is a guess.',
                    },
                    {
                        id: 'l_ir_lowpoint',
                        name: 'Low-point control',
                        detail: 'Lay a towel down, ball just ahead of it. 12 iron shots that bruise the turf AFTER the ball — never behind.',
                        target: '9 of 12 divots in front of the towel.',
                    },
                    {
                        id: 'l_ir_nine',
                        name: '9-green approach game',
                        detail: 'Play 9 imaginary approach shots: random flags between 100 and 160 m, pick the club from your new numbers, full routine. Count honest "greens."',
                        target: '4 of 9 — log it, beat it.',
                        why: 'You hit ~3 of 18 greens on the Champion course. Every extra green is roughly a stroke.',
                    },
                    {
                        id: 'l_ir_par3',
                        name: 'Par-3 rehearsal',
                        detail: 'The Champion par 3s off the tee: pick the actual distances, tee it low, middle-of-green target. 2 balls each.',
                        target: 'Half of them puttable.',
                        why: 'Par-3 average is 4.13 — an iron off a perfect lie should be the easiest green of the day.',
                    },
                ],
            },
        ],
    },
    short_game: {
        key: 'short_game',
        label: 'Short Game & Scoring',
        blurb: 'The biggest lever — wedge distances, up-and-downs, and the bunker basics.',
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
                        detail: 'Carry stations at 30 / 50 / 70 / 90 m, 5 balls each. Learn your stock carry for each swing length — write the numbers next to the iron carries.',
                        target: 'Know your three wedge numbers.',
                    },
                    {
                        id: 'l_sg_updown',
                        name: 'Up-and-down circuit — 9 lies',
                        detail: '9 balls around the green: tight lie, rough, upslope, downslope, bump-and-run, one high floater. Chip + putt out, score out of 9.',
                        target: 'Beat last time — 3 of 9 is solid at 17.',
                        why: 'With ~15 missed greens a round, this circuit IS your scoring. Nothing else on this page saves more.',
                    },
                    {
                        id: 'l_sg_bunker',
                        name: 'Greenside bunker basics',
                        detail: 'Pick a spot 5 cm behind the ball and hit THAT spot — let the sand lift it out. 10 splash shots.',
                        target: '8 of 10 out and on the green.',
                    },
                    {
                        id: 'l_sg_proximity',
                        name: 'Proximity chips — 2 m circle',
                        detail: 'Pace out a 2 m circle around a hole. 10 chips from one honest lie. Inside the circle = a putt you make.',
                        target: '5 of 10 inside — beat it next time.',
                    },
                ],
            },
        ],
    },
    pressure: {
        key: 'pressure',
        label: 'Pressure Games',
        blurb: 'Consequences without needing an empty course — every game lives on the practice green and range.',
        time: '~60 min',
        blocks: [
            {
                title: 'Pressure Games',
                time: '60 min',
                where: 'Practice green + range',
                drills: [
                    {
                        id: 'l_pr_par18',
                        name: 'Par-18 — up-and-down holes',
                        detail: '9 "holes" around the practice green, each par 2 (chip + putt). Total your score against 18. Play it like it counts: one ball, no re-hits.',
                        target: '22 or better — log every attempt.',
                    },
                    {
                        id: 'l_pr_gauntlet',
                        name: 'Putting gauntlet',
                        detail: 'Make 5 in a row at 1 m, then 5 in a row at 1.5 m, then 3 in a row at 2 m. Any miss restarts that rung.',
                        target: 'Clear all three rungs.',
                    },
                    {
                        id: 'l_pr_duel',
                        name: 'Up-and-down duel',
                        detail: 'Best against Amelie — or against your own record. Alternate picking the lie (no cruelty: it must be a lie you\'d accept yourself). First to 3 up-and-downs wins.',
                        target: 'Play to a result. Loser collects the balls.',
                        why: 'A shot that matters to someone is worth ten that don\'t. This is the on-course nerves, rebuilt legally.',
                    },
                    {
                        id: 'l_pr_nine',
                        name: 'Range round — Champion front 9',
                        detail: 'Play the front nine in your head on the range: real tee club, real approach distance from your carry numbers, full routine, one ball per shot. Score honest FIR / "GIR."',
                        target: '5 fairways, 3 greens — beat your card.',
                        why: 'The closest thing to on-course practice that a full tee sheet allows.',
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
                detail: 'Write one thing that worked, one number that moved (greens game, Par-18, up-and-downs), and one thing for next time.',
                target: 'Three lines in the journal.',
            },
        ],
    },
];

const FOCUS_ORDER = ['irons', 'short_game', 'pressure'];

// Which deep session today? A simple decision rule beats deciding on the spot.
const FOCUS_HINT = 'New irons still settling in → <strong>New Irons & Approach</strong>. '
    + 'Played two rounds since last practice → <strong>Short Game & Scoring</strong>. '
    + 'Tournament coming up → <strong>Pressure Games</strong>.';

// ---- Round Rules — transfer without an empty course ------------------------
// Not drills: process goals for real rounds, in a normal group, on a full tee
// sheet. Rendered as a static card below the routine.

const ROUND_RULES = {
    title: 'Take It to the Course',
    intro: 'The old "on-course practice" games need an empty course. These don\'t — '
         + 'they\'re rules for any normal round, and they\'re where practice becomes score.',
    rules: [
        {
            name: 'Tee club = the one that finds grass',
            note: 'You hit 63% of fairways. Whatever club is doing that on each hole keeps the job — no hero driver on tight holes.',
        },
        {
            name: 'Middle of the green, every approach',
            note: 'At 15% greens the pin is decoration. Pick the club from your calibration numbers and aim at the fat of the green.',
        },
        {
            name: 'Short-side ban',
            note: 'When you miss a green — and you will, ~15 times — miss on the side with green to work with. Choose the miss before you swing.',
        },
        {
            name: 'Bogey is a good score',
            note: 'Ninety needs seventeen of them. On every par 4 and 5, play for the easy bogey and let pars happen. Count doubles avoided, not birdies missed.',
        },
        {
            name: 'First putt dies at the hole',
            note: 'Lag the long ones to tap-in range like the ladder drill. A two-putt from anywhere is a win at ~36 putts a round.',
        },
        {
            name: 'Log the round',
            note: 'Score, putts, fairways, greens — same as always. It feeds the Clubs page verdict on the new irons.',
        },
    ],
};

// ---- State ----------------------------------------------------------------

let routineView = localStorage.getItem('chasing90-routine-view') || 'short';
if (routineView !== 'short' && routineView !== 'long') routineView = 'short';

let focusBranch = localStorage.getItem('chasing90-routine-focus') || 'irons';
if (!LONG_BRANCHES[focusBranch]) focusBranch = 'irons';

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
        el.innerHTML = `<span class="routine-time">~1 hr 40 min</span> · Foundation + <strong>${b.label}</strong> + pressure finish.`;
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
        <p class="focus-blurb">${LONG_BRANCHES[focusBranch].blurb}</p>
        <p class="focus-hint">${FOCUS_HINT}</p>`;
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

function renderRoundRules() {
    const el = document.getElementById('round-rules');
    if (!el) return;
    el.innerHTML = `
        <div class="analytics-card">
            <div class="pblock-head">
                <h3 class="pblock-title">${ROUND_RULES.title}</h3>
                <div class="pblock-tags"><span class="pchip pchip-where">Any real round</span></div>
            </div>
            <p class="rules-intro">${ROUND_RULES.intro}</p>
            <div class="rules-list">
                ${ROUND_RULES.rules.map((r, i) => `
                    <div class="rule-item">
                        <span class="rule-num">${i + 1}</span>
                        <span class="rule-body">
                            <span class="rule-name">${r.name}</span>
                            <span class="rule-note">${r.note}</span>
                        </span>
                    </div>`).join('')}
            </div>
        </div>`;
}

function renderRoutine() {
    document.querySelectorAll('.routine-toggle .course-tab').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.view === routineView));
    renderMeta();
    renderFocus();
    renderProgress();
    document.getElementById('routine-blocks').innerHTML = currentBlocks().map(blockHTML).join('');
    renderRoundRules();
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
