function parseCSV(csvText) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        if (char === '"') {
            current += char;
            if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
                current += csvText[i + 1];
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === '\n' && !inQuotes) {
            if (current.trim()) rows.push(current);
            current = '';
        } else if (char === '\r' && !inQuotes) {
            // skip carriage returns outside quotes
        } else {
            current += char;
        }
    }
    if (current.trim()) rows.push(current);

    if (rows.length < 2) return [];

    const headers = parseCSVRow(rows[0]);
    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const values = parseCSVRow(rows[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim().toLowerCase()] = values[index] ? values[index].trim() : '';
        });
        data.push(row);
    }
    return data;
}

function parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
            if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function rowToRound(row) {
    return {
        roundId:            row.round_id || '',
        player:             row.player || '',
        date:               row.date || '',
        course:             row.course || '',
        teeColor:           row.tee_color || '',
        teeLength:          row.tee_length || '',
        par:                parseInt(row.par) || 72,
        score:              parseInt(row.score) || 0,
        holes:              parseInt(row.holes) || 18,
        putts:              row.putts ? parseInt(row.putts) : null,
        fir:                row.fir || null,
        gir:                row.gir || null,
        excludeFromHandicap: (row.exclude_from_handicap || '').toLowerCase() === 'true',
        roundType:          (row.round_type || 'regular').toLowerCase(),
    };
}

function processRoundsData(rawData) {
    const rounds = rawData.map(rowToRound).filter(r => r.score > 0);
    rounds.sort((a, b) => new Date(b.date) - new Date(a.date));
    allRoundsData = rounds;

    return {
        daniel:        rounds.filter(r => r.player.toLowerCase() === 'daniel' && r.holes === 18),
        amelie:        rounds.filter(r => r.player.toLowerCase() === 'amelie' && r.holes === 18),
        danielPractice: rounds.filter(r => r.player.toLowerCase() === 'daniel' && r.holes === 9),
        ameliePractice: rounds.filter(r => r.player.toLowerCase() === 'amelie' && r.holes === 9),
        danielAll:     rounds.filter(r => r.player.toLowerCase() === 'daniel'),
        amelieAll:     rounds.filter(r => r.player.toLowerCase() === 'amelie'),
    };
}

function processScorecardData(rawData) {
    const lookup = {};
    rawData.forEach(row => {
        const id = (row.round_id || '').trim();
        if (!id) return;
        if (!lookup[id]) lookup[id] = [];
        lookup[id].push({
            hole:  parseInt(row.hole) || 0,
            par:   parseInt(row.par) || 0,
            score: parseInt(row.score) || 0,
            putts: row.putts ? parseInt(row.putts) : null,
        });
    });
    Object.values(lookup).forEach(holes => holes.sort((a, b) => a.hole - b.hole));
    return lookup;
}
