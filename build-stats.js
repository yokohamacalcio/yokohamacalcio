const fs = require('fs');
const path = require('path');

const PLAYERS_FILE = path.join(__dirname, 'players.json');
const MATCHES_FILE = path.join(__dirname, 'matches.json');
const OUTPUT_FILE = path.join(__dirname, 'stats.json');

function cleanStr(s) {
    return String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '').trim();
}

function isJapanese(s) {
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(s);
}

function generateStatsFromMatches() {
    console.log('🔄 Lettura di matches.json e calcolo statistiche...');

    if (!fs.existsSync(PLAYERS_FILE) || !fs.existsSync(MATCHES_FILE)) {
        console.error('❌ Errore: File players.json o matches.json non trovati.');
        process.exit(1);
    }

    const playersData = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    const matchesData = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));

    // 1. Mappatura giocatori e alias
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
            positions_played: {}
        });

        [id, p.name_kanji, p.name_kana, p.name_romaji].forEach(name => {
            if (name) {
                const cleaned = cleanStr(name);
                if (cleaned) aliasToId.set(cleaned, id);
            }
        });
    });

    function resolvePlayerId(rawName) {
        if (!rawName) return null;
        const target = cleanStr(rawName);
        if (!target || target === 'なし' || target === 'nessuno' || target === 'null') return null;

        if (aliasToId.has(target)) return aliasToId.get(target);

        const minLen = isJapanese(target) ? 2 : 3;
        if (target.length >= minLen) {
            for (let [alias, id] of aliasToId.entries()) {
                if (alias.length >= minLen && (alias.includes(target) || target.includes(alias))) {
                    return id;
                }
            }
        }
        return null;
    }

    function recordPositionPlayed(rawPlayerName, posTag) {
        if (!rawPlayerName || !posTag) return;
        const pId = resolvePlayerId(rawPlayerName);
        if (!pId || !playerMap.has(pId)) return;

        const player = playerMap.get(pId);
        const tag = String(posTag).trim().toUpperCase();
        if (tag && tag !== 'UNDEFINED' && tag !== 'NULL') {
            player.positions_played[tag] = (player.positions_played[tag] || 0) + 1;
        }
    }

    // 2. Statistiche generali di squadra
    const teamTotals = {
        total_matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        clean_sheets: 0,
        formations_used: {}
    };

    const knownPosRegex = /^(GK|CB|LB|RB|LWB|RWB|DM|CM|LM|RM|AM|LW|RW|FW|ST)(-[LRC123])?$/i;

    // 3. Elaborazione partite concluse (status === 'past')
    matchesData.forEach(m => {
        if (String(m.status || '').toLowerCase() !== 'past') return;

        teamTotals.total_matches++;

        if (m.formation) {
            const form = String(m.formation).trim();
            teamTotals.formations_used[form] = (teamTotals.formations_used[form] || 0) + 1;
        }

        let matchGF = 0;
        let matchGA = 0;
        const scoreText = m.score ? m.score.trim() : '';

        if (scoreText && scoreText.includes('-')) {
            const parts = scoreText.split('-').map(n => parseInt(n.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                matchGF = parts[0];
                matchGA = parts[1];
            }
        }

        teamTotals.goals_for += matchGF;
        teamTotals.goals_against += matchGA;

        if (matchGF > matchGA) teamTotals.wins++;
        else if (matchGF === matchGA) teamTotals.draws++;
        else teamTotals.losses++;

        if (matchGA === 0) teamTotals.clean_sheets++;

        const processedCaps = new Set();

        // Titolari
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

        // Posizioni Titolari
        if (m.starters_positions && typeof m.starters_positions === 'object') {
            Object.entries(m.starters_positions).forEach(([key, val]) => {
                if (knownPosRegex.test(key.trim())) recordPositionPlayed(val, key);
                else recordPositionPlayed(key, val);
            });
        }

        // Subentrati
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

        // Posizioni Subentrati
        if (Array.isArray(m.bench_details)) {
            m.bench_details.forEach(item => {
                if (item && item.subbed_in && item.position_played) {
                    recordPositionPlayed(item.player, item.position_played);
                }
            });
        }

        // Gol
        if (m.scorers && m.scorers !== 'なし' && m.scorers !== 'Nessuno') {
            m.scorers.split(/[,、]/).forEach(entry => {
                let text = entry.trim(), count = 1;
                const multMatch = text.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                if (multMatch) { text = multMatch[1].trim(); count = parseInt(multMatch[2], 10) || 1; }
                const pId = resolvePlayerId(text);
                if (pId && playerMap.has(pId)) playerMap.get(pId).goals += count;
            });
        }

        // Assist
        if (m.assists && m.assists !== 'なし' && m.assists !== 'Nessuno') {
            m.assists.split(/[,、]/).forEach(entry => {
                let text = entry.trim(), count = 1;
                const multMatch = text.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                if (multMatch) { text = multMatch[1].trim(); count = parseInt(multMatch[2], 10) || 1; }
                const pId = resolvePlayerId(text);
                if (pId && playerMap.has(pId)) playerMap.get(pId).assists += count;
            });
        }

        // MVP & Cartellini
        if (m.mvp) m.mvp.split(/[,、]/).forEach(name => { const pId = resolvePlayerId(name); if (pId && playerMap.has(pId)) playerMap.get(pId).mvps++; });
        if (m.yellow_cards) m.yellow_cards.split(/[,、]/).forEach(name => { const pId = resolvePlayerId(name); if (pId && playerMap.has(pId)) playerMap.get(pId).yellows++; });
        if (m.red_cards) m.red_cards.split(/[,、]/).forEach(name => { const pId = resolvePlayerId(name); if (pId && playerMap.has(pId)) playerMap.get(pId).reds++; });

        // Portieri
        if (m.goalkeepers) {
            m.goalkeepers.split(/[,、]/).forEach(entry => {
                const match = entry.trim().match(/^([^(（]+)[(（]\s*(\d+)\s*[)）]$/);
                let rawGk = entry.trim(), gkGa = matchGA;
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

    // 4. Ranking (Top 5)
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
    console.log(`✅ stats.json aggiornato con successo da matches.json!`);
    return statsOutput;
}

generateStatsFromMatches();
