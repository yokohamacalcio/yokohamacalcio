const fs = require('fs');
const path = require('path');

// Percorsi dei file
const PLAYERS_FILE = path.join(__dirname, 'players.json');
const MATCHES_FILE = path.join(__dirname, 'matches.json');
const OUTPUT_FILE = path.join(__dirname, 'stats.json');

function cleanStr(s) {
    return String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '').trim();
}

function main() {
    console.log('🔄 Avvio calcolo statistiche...');

    if (!fs.existsSync(PLAYERS_FILE) || !fs.existsSync(MATCHES_FILE)) {
        console.error('❌ Errore: File players.json o matches.json non trovati.');
        process.exit(1);
    }

    const playersData = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    const matchesData = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));

    // 1. Mappatura giocatori per ID univoco e alias per la ricerca
    const playerMap = new Map();
    const aliasToId = new Map();

    playersData.forEach(p => {
        if (p.role === 'staff') return;

        const id = p.id || String(p.number) || p.name_kanji;

        playerMap.set(id, {
            id: id,
            number: p.number,
            name_kanji: p.name_kanji,
            name_kana: p.name_kana,
            name_romaji: p.name_romaji,
            role: p.role,
            position: p.position,
            caps: 0,
            starters: 0,
            subs: 0,
            goals: 0,
            assists: 0,
            mvps: 0,
            yellows: 0,
            reds: 0,
            goals_conceded: 0,
            clean_sheets: 0,
            positions_played: {} // ← Conteggio presenze suddiviso per ruolo (es. {"CM-R": 5, "RM": 2})
        });

        [id, p.name_kanji, p.name_kana, p.name_romaji].forEach(name => {
            if (name) aliasToId.set(cleanStr(name), id);
        });
    });

    function resolvePlayerId(rawName) {
        if (!rawName) return null;
        const target = cleanStr(rawName);
        if (!target || target === 'なし' || target === 'nessuno') return null;

        if (aliasToId.has(target)) return aliasToId.get(target);

        for (let [alias, id] of aliasToId.entries()) {
            if (alias.includes(target) || target.includes(alias)) return id;
        }
        return null;
    }

    // Helper per aggiornare il conteggio della posizione ricoperta
    function recordPositionPlayed(pId, posTag) {
        if (!pId || !posTag || !playerMap.has(pId)) return;
        const player = playerMap.get(pId);
        const tag = String(posTag).trim().toUpperCase();
        player.positions_played[tag] = (player.positions_played[tag] || 0) + 1;
    }

    // Statistiche generali di squadra
    const teamTotals = {
        total_matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        clean_sheets: 0,
        formations_used: {} // ← Tracciamento utilizzo moduli tattici (es. {"4-4-2": 8, "4-3-3": 2})
    };

    // 2. Elaborazione delle partite passate
    matchesData.forEach(m => {
        if (m.status !== 'past') return;

        teamTotals.total_matches++;

        // Conteggio moduli utilizzati
        if (m.formation) {
            const form = String(m.formation).trim();
            teamTotals.formations_used[form] = (teamTotals.formations_used[form] || 0) + 1;
        }

        let matchGF = 0;
        let matchGA = 0;
        const scoreText = m.score ? m.score.trim() : '';

        // ⚠️ CONVENZIONE matches.json:
        // Il punteggio è SEMPRE "NOSTRI - LORO", indipendentemente da casa/trasferta.
        if (scoreText && scoreText.includes('-')) {
            const parts = scoreText.split('-').map(n => parseInt(n.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                matchGF = parts[0];   // ← gol nostri
                matchGA = parts[1];   // ← gol loro
            }
        }

        teamTotals.goals_for += matchGF;
        teamTotals.goals_against += matchGA;

        if (matchGF > matchGA) teamTotals.wins++;
        else if (matchGF === matchGA) teamTotals.draws++;
        else teamTotals.losses++;

        if (matchGA === 0) teamTotals.clean_sheets++;

        // Presenze e Posizioni Ricoperte
        const processedCaps = new Set();

        // A. Presenze Titolari
        if (Array.isArray(m.starters)) {
            m.starters.forEach(name => {
                const pId = resolvePlayerId(name);
                if (pId && playerMap.has(pId)) {
                    playerMap.get(pId).starters++;
                    playerMap.get(pId).caps++;
                    processedCaps.add(pId);
                }
            });
        }

        // A2. Tracciamento Posizioni Titolari (da starters_positions)
        if (m.starters_positions && typeof m.starters_positions === 'object') {
            Object.entries(m.starters_positions).forEach(([posTag, name]) => {
                const pId = resolvePlayerId(name);
                if (pId) recordPositionPlayed(pId, posTag);
            });
        }

        // B. Presenze Subentrati
        if (Array.isArray(m.substitutes_in)) {
            m.substitutes_in.forEach(name => {
                const pId = resolvePlayerId(name);
                if (pId && playerMap.has(pId) && !processedCaps.has(pId)) {
                    playerMap.get(pId).subs++;
                    playerMap.get(pId).caps++;
                    processedCaps.add(pId);
                }
            });
        }

        // B2. Tracciamento Posizioni Subentrati (da bench_details)
        if (Array.isArray(m.bench_details)) {
            m.bench_details.forEach(item => {
                if (item.subbed_in && item.position_played) {
                    const pId = resolvePlayerId(item.player);
                    if (pId) recordPositionPlayed(pId, item.position_played);
                }
            });
        }

        // Gol
        if (m.scorers && m.scorers !== 'なし' && m.scorers !== 'Nessuno') {
            m.scorers.split(/[,、]/).forEach(entry => {
                let text = entry.trim();
                let count = 1;
                const multMatch = text.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                if (multMatch) {
                    text = multMatch[1].trim();
                    count = parseInt(multMatch[2], 10) || 1;
                }
                const pId = resolvePlayerId(text);
                if (pId && playerMap.has(pId)) playerMap.get(pId).goals += count;
            });
        }

        // Assist
        if (m.assists && m.assists !== 'なし' && m.assists !== 'Nessuno') {
            m.assists.split(/[,、]/).forEach(entry => {
                let text = entry.trim();
                let count = 1;
                const multMatch = text.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                if (multMatch) {
                    text = multMatch[1].trim();
                    count = parseInt(multMatch[2], 10) || 1;
                }
                const pId = resolvePlayerId(text);
                if (pId && playerMap.has(pId)) playerMap.get(pId).assists += count;
            });
        }

        // MVP, Cartellini
        if (m.mvp) {
            m.mvp.split(/[,、]/).forEach(name => {
                const pId = resolvePlayerId(name);
                if (pId && playerMap.has(pId)) playerMap.get(pId).mvps++;
            });
        }
        if (m.yellow_cards) {
            m.yellow_cards.split(/[,、]/).forEach(name => {
                const pId = resolvePlayerId(name);
                if (pId && playerMap.has(pId)) playerMap.get(pId).yellows++;
            });
        }
        if (m.red_cards) {
            m.red_cards.split(/[,、]/).forEach(name => {
                const pId = resolvePlayerId(name);
                if (pId && playerMap.has(pId)) playerMap.get(pId).reds++;
            });
        }

        // Portieri
        if (m.goalkeepers) {
            m.goalkeepers.split(/[,、]/).forEach(entry => {
                const match = entry.trim().match(/^([^(（]+)[(（]\s*(\d+)\s*[)）]$/);
                let rawGk = entry.trim();
                let gkGa = matchGA;   // fallback: usa i gol subiti totali della partita
                if (match) {
                    rawGk = match[1].trim();
                    const parsed = parseInt(match[2], 10);
                    if (!isNaN(parsed)) gkGa = parsed;
                }
                const pId = resolvePlayerId(rawGk);
                if (pId && playerMap.has(pId)) {
                    playerMap.get(pId).goals_conceded += gkGa;
                    if (gkGa === 0) playerMap.get(pId).clean_sheets++;
                }
            });
        }
    });

    // 3. Classifiche
    const allPlayersList = Array.from(playerMap.values());

    const statsOutput = {
        updated_at: new Date().toISOString(),
        team_totals: teamTotals,
        players: Object.fromEntries(playerMap),
        rankings: {
            top_scorers: [...allPlayersList].sort((a, b) => b.goals - a.goals || b.caps - a.caps).slice(0, 5),
            top_assists: [...allPlayersList].sort((a, b) => b.assists - a.assists || b.caps - a.caps).slice(0, 5),
            most_caps: [...allPlayersList].sort((a, b) => b.caps - a.caps).slice(0, 5),
            mvps: [...allPlayersList].sort((a, b) => b.mvps - a.mvps).slice(0, 5)
        }
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(statsOutput, null, 2), 'utf8');
    console.log(`✅ Successo! Il file ${OUTPUT_FILE} è stato generato correttamente.`);
    console.log(`📊 Partite: ${teamTotals.total_matches} | V: ${teamTotals.wins} | N: ${teamTotals.draws} | P: ${teamTotals.losses} | GF: ${teamTotals.goals_for} | GS: ${teamTotals.goals_against}`);
}

main();
