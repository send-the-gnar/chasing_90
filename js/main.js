async function loadData() {
    try {
        const [roundsResponse, statsResponse, scorecardsResponse, milestonesResponse] = await Promise.all([
            fetch(getSheetUrl(ROUNDS_SHEET)),
            fetch(getSheetUrl(STATS_SHEET)),
            fetch(getSheetUrl(SCORECARDS_SHEET)).catch(() => null),
            fetch(getSheetUrl(MILESTONES_SHEET)).catch(() => null),
        ]);

        const roundsCsv  = await roundsResponse.text();
        const statsCsv   = await statsResponse.text();
        const rawRoundsData = parseCSV(roundsCsv);
        const statsData  = parseCSV(statsCsv);

        if (scorecardsResponse && scorecardsResponse.ok) {
            const scorecardsCsv = await scorecardsResponse.text();
            scorecardData = processScorecardData(parseCSV(scorecardsCsv));
        }

        const roundsData = processRoundsData(rawRoundsData);

        renderHeroStats(roundsData);
        renderGoals(roundsData);
        renderRoadTo90(roundsData);
        renderHeatmap('heatmap-champion', r => isChampionCourse(r) && r.holes === 18 && r.roundType !== 'scramble' && !r.excludeFromHandicap, { rollingN: 5 });
        renderHeatmap('heatmap-park',     r => isParkCourse(r) && r.roundType !== 'scramble' && !r.excludeFromHandicap, { rollingN: 10 });
        renderParkHistogram();
        renderScoringStats();
        renderStats(statsData);
        renderPlayerRounds('daniel-rounds',          roundsData.daniel);
        renderPlayerRounds('amelie-rounds',          roundsData.amelie);
        renderAllRounds('daniel-all-rounds',         roundsData.daniel);
        renderAllRounds('amelie-all-rounds',         roundsData.amelie);
        renderPlayerRounds('daniel-practice-rounds', roundsData.danielPractice);
        renderPlayerRounds('amelie-practice-rounds', roundsData.ameliePractice);
        renderAllRounds('daniel-all-practice-rounds', roundsData.danielPractice);
        renderAllRounds('amelie-all-practice-rounds', roundsData.ameliePractice);

        if (milestonesResponse && milestonesResponse.ok) {
            const milestonesCsv = await milestonesResponse.text();
            renderTimeline(parseCSV(milestonesCsv));
        } else {
            document.getElementById('timeline-entries').innerHTML =
                '<p class="loading">Add a "Milestones" sheet to your spreadsheet to start your timeline.</p>';
        }

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('goals-grid').innerHTML =
            '<p class="loading">Error loading data. Check console for details.</p>';
        const statsEl = document.getElementById('summary-stats');
        if (statsEl) statsEl.innerHTML = '<p class="loading">Error loading stats.</p>';
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeScorecard(); closeHandicap(); closeHoleDetail(); }
});

document.addEventListener('DOMContentLoaded', () => {
    initUnitToggle();
    loadData();
});
