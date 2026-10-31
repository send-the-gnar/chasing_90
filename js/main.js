async function loadData() {
    try {
        const [roundsResponse, statsResponse, scorecardsResponse] = await Promise.all([
            fetch(getSheetUrl(ROUNDS_SHEET)),
            fetch(getSheetUrl(STATS_SHEET)),
            fetch(getSheetUrl(SCORECARDS_SHEET)).catch(() => null),
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
        renderLatestRound();
        renderGoals(roundsData);
        renderRoadTo90(roundsData);
        // Per-hole heatmaps count every hole actually played, so partial rounds
        // (e.g. 12 of 18) are included — no full-round length requirement.
        renderHeatmap('heatmap-champion', r => isChampionCourse(r) && r.roundType !== 'scramble' && !r.excludeFromHandicap, { rollingN: 5 });
        renderHeatmap('heatmap-park',     r => isParkCourse(r) && r.roundType !== 'scramble' && !r.excludeFromHandicap, { rollingN: 10 });
        renderScoringAverages();
        // renderGirChart();  // monthly GIR card is hidden in index.html for now
        renderParkHistogram();
        renderScoringStats();
        renderHandicapCompare();
        renderStats(statsData);
        renderRoundLists();

    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('goals-grid').innerHTML =
            '<p class="loading">Error loading data. Check console for details.</p>';
        const statsEl = document.getElementById('summary-stats');
        if (statsEl) statsEl.innerHTML = '<p class="loading">Error loading stats.</p>';
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeScorecard(); closeHandicap(); closeBirdies(); closeHoleDetail(); }
});

document.addEventListener('DOMContentLoaded', () => {
    initUnitToggle();
    loadData();
});
