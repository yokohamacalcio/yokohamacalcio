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
        const playersPath = path.join(__dirname, 'players.json');
        const matchesPath = path.join(__dirname, 'matches.json');
        const statsPath = path.join(__dirname, 'stats.json');

        if (!fs.existsSync(playersPath) || !fs.existsSync(matchesPath)) {
            console.error('❌ File players.json o matches.json non trovati.');
            process.exit(1);
        }

        const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
        const matchesData = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

        const playersMap = {}; // Dizionario nativo per prevenire qualsiasi doppione per chiave
        const aliasToId = new Map();

        // 1. Inizializzazione pulita e deterministica della rosa
        playersData.forEach(p => {
            if (p.role === 'staff') return;
            
            let rawId = p.id;
            if (!rawId) {
                const baseName = p.name_romaji || p.name_kanji || `num-${p.number || 'unknown'}`;
                rawId = baseName.toLowerCase().replace(/[^a-z0-9\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-');
            }
            const uniqueId = String(rawId).trim();

            if (playersMap[uniqueId]) return;

            playersMap[uniqueId] = {
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
            };

            const aliases = [uniqueId, p.id, p.name_kanji, p.name_kana, p.name_romaji, p.number !== null ? String(p.number) : null];
            aliases.forEach(alias => {
                if (alias !== null && alias !== undefined) {
                    const c = cleanStr(alias);
                    if (c && c.length > 0) {
                        aliasToId.set(c, uniqueId);
                    }
                }
            });
        });

        function resolveId(raw) {
            if (!raw) return null;
            let t = cleanStr(raw);
            t = t.replace(/\(\d+(?:\+\d+)?['′]?\)/g, '').replace(/x\d+/g, '').trim();
            if (!t || t === 'なし' || t === 'nessuno' || t === 'null') return null;

            if (aliasToId.has(t)) return aliasToId.get(t);

            if (t.length >= 2) {
                for (const [alias, id] of aliasToId.entries()) {
                    if (alias === t || alias.includes(t) || t.includes(alias)) {
                        return id;
                    }
                }
            }
            return null;
        }

        const posRegex = /^(GK|CB|LB|RB|LWB|RWB|DM|CM|LM|RM|AM|LW|RW|FW|ST)(-[LRC123])?$/i;

        function recordPos(rawName, posTag) {
            if (!rawName || !posTag) return;
            const id = resolveId(rawName);
            if (!id || !playersMap[id]) return;
            const tag = String(posTag).trim().toUpperCase();
            if (tag && tag !== 'UNDEFINED' && tag !== 'NULL') {
                playersMap[id].positions_played[tag] = (playersMap[id].positions_played[tag] || 0) + 1;
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

        // Helper per elaborare le singole partite o le sotto-partite (sub_matches)
        function processMatchStats(matchObj, fallbackStarters, fallbackSubs) {
            let gf = 0, ga = 0;
            const s = matchObj.score ? String(matchObj.score).trim() : '';
            if (s.includes('-')) {
                const parts = s.split('-').map(x => parseInt(x.trim(), 10));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    gf = parts[0];
                    ga = parts[1];
                }
            }

            teamTotals.total_matches++;
            teamTotals.goals_for += gf;
            teamTotals.goals_against += ga;
            if (gf > ga) teamTotals.wins++;
            else if (gf === ga) teamTotals.draws++;
            else teamTotals.losses++;
            if (ga === 0) teamTotals.clean_sheets++;

            const processedCaps = new Set();

            // Titolari
            const startersList = matchObj.starters || fallbackStarters;
            if (Array.isArray(startersList)) {
                startersList.forEach(n => {
                    const id = resolveId(n);
                    if (id && playersMap[id] && !processedCaps.has(id)) {
                        playersMap[id].starters++;
                        playersMap[id].caps++;
                        processedCaps.add(id);
                    }
                });
            }

            // Sostituti
            const subsList = matchObj.substitutes_in || fallbackSubs;
            if (Array.isArray(subsList)) {
                subsList.forEach(n => {
                    const id = resolveId(n);
                    if (id && playersMap[id] && !processedCaps.has(id)) {
                        playersMap[id].subs++;
                        playersMap[id].caps++;
                        processedCaps.add(id);
                    }
                });
            }

            // Marcatori
            const scorersStr = matchObj.scorers;
            if (scorersStr && scorersStr !== 'なし' && scorersStr !== 'Nessuno') {
                String(scorersStr).split(/[,、]/).forEach(e => {
                    let txt = String(e).trim(), c = 1;
                    const mm = txt.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                    if (mm) { txt = mm[1].trim(); c = parseInt(mm[2], 10) || 1; }
                    const id = resolveId(txt);
                    if (id && playersMap[id]) playersMap[id].goals += c;
                });
            }

            // Assist
            const assistsStr = matchObj.assists;
            if (assistsStr && assistsStr !== 'なし' && assistsStr !== 'Nessuno') {
                String(assistsStr).split(/[,、]/).forEach(e => {
                    let txt = String(e).trim(), c = 1;
                    const mm = txt.match(/(.*?)\s*(?:[xX\*])\s*(\d+)/);
                    if (mm) { txt = mm[1].trim(); c = parseInt(mm[2], 10) || 1; }
                    const id = resolveId(txt);
                    if (id && playersMap[id]) playersMap[id].assists += c;
                });
            }

            // MVP e Cartellini
            if (matchObj.mvp) {
                String(matchObj.mvp).split(/[,、]/).forEach(n => {
                    const id = resolveId(n);
                    if (id && playersMap[id]) playersMap[id].mvps++;
                });
            }
            if (matchObj.yellow_cards) {
                String(matchObj.yellow_cards).split(/[,、]/).forEach(n => {
                    const id = resolveId(n);
                    if (id && playersMap[id]) playersMap[id].yellows++;
                });
            }
            if (matchObj.red_cards) {
                String(matchObj.red_cards).split(/[,、]/).forEach(n => {
                    const id = resolveId(n);
                    if (id && playersMap[id]) playersMap[id].reds++;
                });
            }

            // Portieri
            const gkStr = matchObj.goalkeepers || matchObj.goalkeeper;
            if (gkStr) {
                String(gkStr).split(/[,、]/).forEach(e => {
                    const mm = e.trim().match(/^(.+?)\s*[(（]\s*(\d+)\s*[)）]\s*$/);
                    let raw = e.trim(), gkGa = ga;
                    if (mm) { raw = mm[1].trim(); const p = parseInt(mm[2], 10); if (!isNaN(p)) gkGa = p; }
                    const id = resolveId(raw);
                    if (id && playersMap[id]) {
                        playersMap[id].goals_conceded += gkGa;
                        if (gkGa === 0) playersMap[id].clean_sheets++;
                    }
                });
            }
        }

        // 2. Elaborazione delle partite (supporto nativo per partite singole e triangolari sub_matches)
        matchesData.forEach(m => {
            if (String(m.status || '').toLowerCase() !== 'past') return;

            if (m.formation) {
                teamTotals.formations_used[m.formation] = (teamTotals.formations_used[m.formation] || 0) + 1;
            }

            const subMatches = m.sub_matches || m.subMatches || [];

            if (subMatches.length > 0) {
                subMatches.forEach(sub => {
                    processMatchStats(sub, m.starters, m.substitutes_in);
                    if (sub.starters_positions && typeof sub.starters_positions === 'object') {
                        Object.entries(sub.starters_positions).forEach(([k, v]) => {
                            if (posRegex.test(k.trim())) recordPos(v, k);
                            else recordPos(k, v);
                        });
                    }
                });
            } else {
                processMatchStats(m, m.starters, m.substitutes_in);
                if (m.starters_positions && typeof m.starters_positions === 'object') {
                    Object.entries(m.starters_positions).forEach(([k, v]) => {
                        if (posRegex.test(k.trim())) recordPos(v, k);
                        else recordPos(k, v);
                    });
                }
                if (Array.isArray(m.bench_details)) {
                    m.bench_details.forEach(b => {
                        if (b && b.subbed_in && b.position_played) recordPos(b.player, b.position_played);
                    });
                }
            }
        });

        const list = Object.values(playersMap);
        const statsOutput = {
            updated_at: new Date().toISOString(),
            team_totals: teamTotals,
            players: playersMap,
            rankings: {
                top_scorers: [...list].filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || b.caps - a.caps).slice(0, 5),
                top_assists: [...list].filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists || b.caps - a.caps).slice(0, 5),
                most_caps: [...list].filter(p => p.caps > 0).sort((a, b) => b.caps - a.caps).slice(0, 5),
                mvps: [...list].filter(p => p.mvps > 0).sort((a, b) => b.mvps - a.mvps).slice(0, 5)
            }
        };

        fs.writeFileSync(statsPath, JSON.stringify(statsOutput, null, 2), 'utf8');
        console.log('✅ stats.json generato perfettamente (con supporto completo ai triangolari).');
    } catch (err) {
        console.error('❌ Errore durante la generazione delle statistiche:', err);
        process.exit(1);
    }
}

buildStats();
