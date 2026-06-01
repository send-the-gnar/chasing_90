const SPREADSHEET_ID = '17QnUv3ufwoaupwfEqqjzJst9YFwuLQjiUdU2cFyZLzE';

const ROUNDS_SHEET     = 'Rounds';
const STATS_SHEET      = 'Stats';
const SCORECARDS_SHEET = 'Scorecards';
const MILESTONES_SHEET = 'Milestones';

function getSheetUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// Global state — written by data.js and read by modals / charts
let scorecardData = {};
let allRoundsData = [];
let handicapData  = {};

const GOAL_18_OVER_PAR = 20;
const GOAL_9_OVER_PAR  = 7;

// Unit toggle
const METERS_TO_YARDS = 1.09361;
let useMetric = localStorage.getItem('chasing90-units') !== 'imperial';

function initUnitToggle() {
    document.getElementById('unit-toggle').textContent = useMetric ? 'Meters' : 'Yards';
}

function toggleUnits() {
    useMetric = !useMetric;
    localStorage.setItem('chasing90-units', useMetric ? 'metric' : 'imperial');
    document.getElementById('unit-toggle').textContent = useMetric ? 'Meters' : 'Yards';
    document.querySelectorAll('.distance-value').forEach(el => {
        const meters = parseFloat(el.dataset.meters);
        if (!isNaN(meters)) el.textContent = formatDistance(meters);
    });
}

function formatDistance(meters) {
    if (useMetric) return Math.round(meters) + 'm';
    return Math.round(meters * METERS_TO_YARDS) + 'yds';
}
