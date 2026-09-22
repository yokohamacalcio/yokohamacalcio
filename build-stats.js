const fs = require('fs');
const path = require('path');

function cleanStr(s) {
    return String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '').trim();
}

function isJapanese(s) {
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(s);
}

function buildStats() {
    try {
        // Percorsi dei file JSON nella root del progetto
        const playersPath = path.join(__dirname, 'players.json');
        const matchesPath = path.join(__dirname, 'matches.json');
        const statsPath = path.join(__dirname, 'stats.json');

        if (!fs.existsSync(playersPath) || !fs.existsSync(matchesPath)) {
            console.error('❌ File players.json o matches.json non trovati.');
            process.exit(1);
        }

        const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        const matchesData = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

        const playerMap = new Map();
        const aliasToId = new Map();

        // 1. Inizializzazione della mappa giocatori basata sugli ID univoci
        playersData.forEach(p => {
            if (p.role === 'staff') return;
            const uniqueId = p.id || `player-${p.number || Math.random()}`;

            playerMap.set(uniqueId, {
                id: uniqueId,
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

            // Mappatura degli alias per il riconoscimento sicuro dai match
            [uniqueId, p.name_kanji, p.name_kana, p.name_romaji, p.number !== null ? String(p.number) : null].forEach(n => {
                const c = cleanStr(n);
                if (c) aliasToId.set(c, uniqueId);
            });
        });

        function resolveId(raw) {
            if (!raw) return null;
            let t = cleanStr(raw);
            t = t.replace(/\(\d+(?:\+\d+)?['′]?\)/g, '').replace(/x\d+/g, '').trim();
            if (!t || t === 'なし' || t === 'nessuno' || t === 'null') return null;

            if (aliasToId.has(t)) return aliasToId.get(t);

            const minLen = isJapanese(t) ? 2 : 3;
            if (t.length >= minLen) {
                for (const [alias, id] of aliasToId.entries()) {
                    if (alias.length >= minLen && (alias.includes(t) || t.includes(alias))) return id;
                }
            }
            return null;
        }

        const posRegex = /^(GK|CB|LB|RB|LWB|RWB|DM|CM|LM|RM|AM|LW|RW|FW|ST)(-[LRC123])?$/i;

        function recordPos(rawName, posTag) {
            if (!rawName || !posTag) return;
            const id = resolveId(rawName);
            if (!id || !playerMap.has(id)) return;
            const tag = String(posTag).trim().toUpperCase();
            if (tag && tag !== 'UNDEFINED' && tag !== 'NULL') {
                const p = playerMap.get(id);
                p.positions_played[tag] = (p.positions_played[tag] || 0) + 1;
            }
        }

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

        // 2. Elaborazione delle partite passate
        matchesData.forEach(m => {
            if (String(m.status || '').toLowerCase() !== 'past') return;
            teamTotals.total_matches++;

            if (m.formation) {
                teamTotals.formations_used[m.formation] = (teamTotals.formations_used[m.formation] || 0) + 1;
            }

            let gf = 0, ga = 0;
            const s = m.score ? m.score.trim() : '';
            if (s.includes('-')) {
                const parts = s.split('-').map(x => parseInt(x.trim(), 10));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    gf = parts[0];
                    ga = parts[1];
                }
            }

            teamTotals.goals_for += gf;
            teamTotals.goals_against += ga;
            if (gf > ga) teamTotals.wins++;
            else if (gf === ga) teamTotals.draws++;
            else teamTotals.losses++;
            if (ga === 0) teamTotals.clean_sheets++;

            const processedCaps = new Set();

            // Titolari
            if (Array.isArray(m.starters)) {
                m.starters.forEach(n => {
                    const id = resolveId(n);
                    if (id && playerMap.has(id) && !processedCaps.has(id)) {
                        playerMap.get(id).starters++;
                        playerMap.get(id).caps++;
                        processedCaps.add(id);
                    }
                });
            }

            if (m.starters_positions && typeof m.starters_positions === 'object') {
                Object.entries(m.starters_positions).forEach(([k, v]) => {
                    if (posRegex.test(k.trim())) recordPos(v, k);
                    else recordPos(k, v);
                });
            }

            // Sostituti entrati
            if (Array.isArray(m.substitutes_in)) {
                m.substitutes_in.forEach(n => {
                    const id = resolveId(n);
                    if (id && playerMap.has(id) && !processedCaps.has(id)) {
                        playerMap.get(id).subs++;
                        playerMap.get(id).caps++;
                        processedCaps.add(id);
                    }
                });
            }

            if (Array.isArray(m.bench_details)) {
                m.bench_details.forEach(b => {
                    if (b && b.subbed_in && b.position_played) recordPos(b.player, b.position_played);
                });
            }

            // Marcatori
            if (m.scorers && m.scorers !== 'なし' && m.scorers !== 'Nessuno') {
                m.scorers.split(/[,、]/).forEach(e => {
                    let txt = String(e).trim(), c = 1;
                    const mm = txt.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                    if (mm) { txt = mm[1].trim(); c = parseInt(mm[2], 10) || 1; }
                    const id = resolveId(txt);
                    if (id && playerMap.has(id)) playerMap.get(id).goals += c;
                });
            }

            // Assist
            if (m.assists && m.assists !== 'なし' && m.assists !== 'Nessuno') {
                m.assists.split(/[,、]/).forEach(e => {
                    let txt = String(e).trim(), c = 1;
                    const mm = txt.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                    if (mm) { txt = mm[1].trim(); c = parseInt(mm[2], 10) || 1; }
                    const id = resolveId(txt);
                    if (id && playerMap.has(id)) playerMap.get(id).assists += c;
                });
            }

            if (m.mvp) {
                m.mvp.split(/[,、]/).forEach(n => {
                    const id = resolveId(n);
                    if (id && playerMap.has(id)) playerMap.get(id).mvps++;
                });
            }
            if (m.yellow_cards) {
                m.yellow_cards.split(/[,、]/).forEach(n => {
                    const id = resolveId(n);
                    if (id && playerMap.has(id)) playerMap.get(id).yellows++;
                });
            }
            if (m.red_cards) {
                m.red_cards.split(/[,、]/).forEach(n => {
                    const id = resolveId(n);
                    if (id && playerMap.has(id)) playerMap.get(id).reds++;
                });
            }

            if (m.goalkeepers) {
                m.goalkeepers.split(/[,、]/).forEach(e => {
                    const mm = e.trim().match(/^(.+?)\s*[(（]\s*(\d+)\s*[)）]\s*$/);
                    let raw = e.trim(), gkGa = ga;
                    if (mm) { raw = mm[1].trim(); const p = parseInt(mm[2], 10); if (!isNaN(p)) gkGa = p; }
                    const id = resolveId(raw);
                    if (id && playerMap.has(id)) {
                        playerMap.get(id).goals_conceded += gkGa;
                        if (gkGa === 0) playerMap.get(id).clean_sheets++;
                    }
                });
            }
        });

        const list = Array.from(playerMap.values());
        const statsOutput = {
            updated_at: new Date().toISOString(),
            team_totals: teamTotals,
            players: Object.fromEntries(playerMap),
            rankings: {
                top_scorers: [...list].filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || b.caps - a.caps).slice(0, 5),
                top_assists: [...list].filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists || b.caps - a.caps).slice(0, 5),
                most_caps: [...list].filter(p => p.caps > 0).sort((a, b) => b.caps - a.caps).slice(0, 5),
                mvps: [...list].filter(p => p.mvps > 0).sort((a, b) => b.mvps - a.mvps).slice(0, 5)
            }
        };

        fs.writeFileSync(statsPath, JSON.stringify(statsOutput, null, 2), 'utf8');
        console.log('✅ stats.json generato con successo da build-stats.js');
    } catch (err) {
        console.error('❌ Errore durante la generazione delle statistiche:', err);
        process.exit(1);
    }
}

buildStats();
