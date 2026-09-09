const fs = require('fs');
const path = require('path');

const matchesPath = path.join(__dirname, 'matches.json');
const opponentsPath = path.join(__dirname, 'opponents.json');

try {
    const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
    let opponents = fs.existsSync(opponentsPath) ? JSON.parse(fs.readFileSync(opponentsPath, 'utf8')) : {};
    let updated = false;

    matches.forEach(match => {
        const teamName = match.team2Name;
        if (!teamName) return;

        const key = match.opponent_id || teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

        if (!opponents[key]) {
            opponents[key] = {
                name: {
                    ja: teamName,
                    it: teamName,
                    en: teamName
                },
                logo: match.team2Logo || ""
            };
            updated = true;
            console.log(`Aggiunta squadra: "${teamName}" -> ID: "${key}"`);
        }

        match.opponent_id = key;
        delete match.team2Name;
        delete match.team2Logo;
    });

    if (updated) {
        fs.writeFileSync(opponentsPath, JSON.stringify(opponents, null, 2), 'utf8');
        fs.writeFileSync(matchesPath, JSON.stringify(matches, null, 2), 'utf8');
        console.log('Sincronizzazione completata con successo!');
    } else {
        console.log('Tutti gli avversari sono già sincronizzati.');
    }
} catch (err) {
    console.error('Errore durante la sincronizzazione:', err.message);
    process.exit(1);
}
