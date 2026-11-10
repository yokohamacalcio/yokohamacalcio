/* js/admin-stats.js — funzioni PURE (nessun DOM): parseList, build (stats.json) e audit (controllo coerenza).
   Regole di calcolo:
   • Il punteggio di una partita è SEMPRE «nostri - loro» (isHome serve solo alla visualizzazione): niente inversioni.
   • Presenze (caps): 1 per giornata per chi è in starters/substitutes_in (anche nei triangolari: la formazione è unica).
   • Triangolari: ogni nostro incontro (sub_matches) è una partita di squadra (V/N/P, gol fatti/subiti, clean sheet);
     gol, assist e portiere si leggono dall'incontro; MVP, cartellini e posizioni dalla giornata.
   • Portiere: gol subiti = il numero tra parentesi; senza numero, se è l'unico portiere, i gol subiti dell'incontro.
     Clean sheet del portiere = 0 subiti E la squadra non ha subito gol.                                                  */
(function (g) {
  'use strict';
  const T = (g.AD && g.AD.tri) || require('./admin-triangular.js');
  const cleanStr = s => String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '').trim();
  const isJa = s => /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(s);
  const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const SEP = /[,、]/;

  /* "小金井 健斗 x2 (23')", "御村 葵(1)", "尾池 勇琉(X2)" … → [{name, n, min}] */
  function parseList(text, gk) {
    if (!text || (Array.isArray(text) && !text.length)) return [];
    const items = Array.isArray(text) ? text : String(text).split(SEP);
    return items.map(x => String(x).trim()).filter(x => x && x !== 'なし' && x !== 'Nessuno' && x !== 'null').map(raw => {
      let s = raw;
      if (gk) {
        const m = s.match(/^(.+?)\s*[(（]\s*(\d+)\s*[)）]\s*$/);
        return m ? { name: m[1].trim(), n: parseInt(m[2], 10), min: '' } : { name: s.trim(), n: null, min: '' };
      }
      let min = '';
      const minMatch = s.match(/\s*[(（]\s*([\d\+'′,\s]+['′min分]?)\s*[)）]\s*$/i);
      if (minMatch && /['′min分]/.test(minMatch[1])) { min = minMatch[1].trim(); s = s.slice(0, minMatch.index).trim(); }
      let n = 1;
      const countMatch = s.match(/(?:\s*[(（]\s*[xX*]?\s*(\d+)\s*[)）]|\s+[xX*]\s*(\d+)|[xX*]\s*(\d+))\s*$/);
      if (countMatch) {
        const numStr = countMatch[1] || countMatch[2] || countMatch[3];
        if (numStr != null) n = parseInt(numStr, 10) || 1;
        s = s.slice(0, countMatch.index).trim();
      } else {
        const trailing = s.match(/\s*[(（]\s*(\d+)\s*[)）]\s*$/);
        if (trailing) { n = parseInt(trailing[1], 10) || 1; s = s.slice(0, trailing.index).trim(); }
      }
      s = s.replace(/^[(（]+|[(（)]+$/g, '').trim();
      return { name: s, n, min };
    }).filter(e => e.name);
  }

  /* rosa → mappa statistiche + risoluzione dei nomi (esatta, poi parziale solo se UNICA: evita Fukuda K./D.) */
  function makeIndex(players) {
    const map = {}, alias = new Map();
    players.forEach(p => {
      if (p.role === 'staff') return;
      const id = String(p.id || slug(p.name_romaji || p.name_kanji || 'x')).trim(); if (map[id]) return;
      map[id] = { id, number: p.number, name_kanji: p.name_kanji, name_kana: p.name_kana, name_romaji: p.name_romaji, role: p.role, position: p.position, caps: 0, starters: 0, subs: 0, goals: 0, assists: 0, mvps: 0, yellows: 0, reds: 0, goals_conceded: 0, clean_sheets: 0, positions_played: {} };
      [id, p.name_kanji, p.name_kana, p.name_romaji, p.number != null ? 'n' + p.number : null].forEach(a => { const c = cleanStr(a); if (c) alias.set(c, id); });
    });
    const fuzzy = [...alias.entries()].filter(([a]) => !/^n\d+$/.test(a) && a.length >= 2);
    function resolve(raw) {
      if (!raw) return null;
      const c = cleanStr(String(raw).replace(/\(\s*\d+(?:\+\d+)?['′]?\s*\)/g, '').replace(/\s*[xX*]\s*\d+\s*$/g, ''));
      if (!c || ['なし', 'nessuno', 'null'].includes(c)) return null;
      if (alias.has(c) && !/^n\d+$/.test(c)) return alias.get(c);
      if (c.length < 2) return null;
      const ids = [...new Set(fuzzy.filter(([a]) => a.includes(c) || c.includes(a)).map(([, id]) => id))];
      return ids.length === 1 ? ids[0] : null;
    }
    return { map, resolve };
  }

  const POS = /^(GK|CB|LB|RB|LWB|RWB|DM|CM|LM|RM|AM|LW|RW|FW|ST)(-[LRC123])?$/i;

  function build(players, matches) {
    const { map, resolve } = makeIndex(players);
    const tt = { total_matches: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, clean_sheets: 0, formations_used: {} };
    const rec = (name, tag) => { const id = resolve(name); if (id && map[id] && tag) { const k = String(tag).trim().toUpperCase(); map[id].positions_played[k] = (map[id].positions_played[k] || 0) + 1; } };
    const add = (text, field, useN) => parseList(text).forEach(e => { const id = resolve(e.name); if (id && map[id]) map[id][field] += useN ? e.n : 1; });

    matches.forEach(m => {
      if (String(m.status).toLowerCase() !== 'past') return;
      if (m.formation) tt.formations_used[m.formation] = (tt.formations_used[m.formation] || 0) + 1;

      // presenze: una per giornata
      const seen = new Set();
      (m.starters || []).forEach(n => { const id = resolve(n); if (id && map[id] && !seen.has(id)) { seen.add(id); map[id].starters++; map[id].caps++; } });
      (m.substitutes_in || []).forEach(n => { const id = resolve(n); if (id && map[id] && !seen.has(id)) { seen.add(id); map[id].subs++; map[id].caps++; } });

      // squadra + eventi: una "unità" per partita, oppure una per ogni nostro incontro del triangolare
      const tri = T.isTri(m), units = tri ? T.subList(m) : [m];
      units.forEach(u => {
        const res = T.ourResult(tri ? u : { score: m.score }), ga = res ? res.ga : null;
        if (res) {
          tt.total_matches++; tt.goals_for += res.gf; tt.goals_against += res.ga;
          if (res.gf > res.ga) tt.wins++; else if (res.gf === res.ga) tt.draws++; else tt.losses++;
          if (res.ga === 0) tt.clean_sheets++;
        }
        add(u.scorers, 'goals', true); add(u.assists, 'assists', true);
        const gks = parseList(u.goalkeeper || u.goalkeepers, true);
        if (gks.length) {
          gks.forEach(e => {
            const id = resolve(e.name); if (!id || !map[id]) return;
            const c = e.n != null ? e.n : (gks.length === 1 && ga != null ? ga : 0);
            map[id].goals_conceded += c;
            if (c === 0 && (ga == null || ga === 0)) map[id].clean_sheets++;
          });
        } else if (ga != null) {                       // nessun portiere indicato: si usa il GK titolare
          const id = resolve(m.starters_positions && m.starters_positions.GK);
          if (id && map[id]) { map[id].goals_conceded += ga; if (ga === 0) map[id].clean_sheets++; }
        }
      });

      // dati di giornata
      add(m.mvp, 'mvps', false); add(m.yellow_cards, 'yellows', true); add(m.red_cards, 'reds', true);
      Object.entries(m.starters_positions || {}).forEach(([k, v]) => (POS.test(k.trim()) ? rec(v, k) : rec(k, v)));
      (m.bench_details || []).forEach(b => { if (b && b.subbed_in && b.position_played) rec(b.player, b.position_played); });
    });

    const L = Object.values(map), top = f => L.filter(p => p[f] > 0).sort((a, b) => b[f] - a[f] || b.caps - a.caps).slice(0, 5);
    return { updated_at: new Date().toISOString(), team_totals: tt, players: map, rankings: { top_scorers: top('goals'), top_assists: top('assists'), most_caps: top('caps'), mvps: top('mvps') } };
  }

  /* controllo coerenza: [{id, date, level:'error'|'warn'|'info', text}] — only = array di id da controllare */
  function audit(matches, players, only) {
    const { map, resolve } = makeIndex(players), out = [];
    matches.forEach(m => {
      if (only && !only.includes(m.id)) return;
      const add = (level, text) => out.push({ id: m.id, date: m.date || '', level, text });
      const past = String(m.status).toLowerCase() === 'past', tri = T.isTri(m), subs = T.subList(m), unknown = new Set();
      const chk = raw => { const n = String(raw || '').trim(); if (n && !resolve(n)) unknown.add(n); };

      if (tri) {
        const opps = T.opponentsOf(m);
        if (opps.length < 2) add('error', 'Triangolare: servono due avversari (opponents).');
        if (!subs.length) add('error', 'Triangolare: nessun incontro (sub_matches).');
        subs.forEach(s => { const o = T.subOpp(s); if (!o) add('error', 'Incontro senza avversario.'); else if (opps.length && !opps.includes(o)) add('error', `Incontro contro "${o}" che non è tra gli avversari.`); });
        if (!m.opponent_id) add('warn', 'opponent_id vuoto: le pagine pubbliche non mostrano l\'avversario (salva dall\'admin per impostarlo).');
      } else if (!m.opponent_id) add('error', 'Avversario mancante.');
      if (!past) return;

      const starters = m.starters || [], subsIn = m.substitutes_in || [];
      if (starters.length && starters.length !== 11) add('warn', `${starters.length} titolari (attesi 11).`);
      const dup = starters.filter((x, i) => starters.indexOf(x) !== i); if (dup.length) add('error', `Titolare ripetuto: ${[...new Set(dup)].join(', ')}.`);
      const both = subsIn.filter(x => starters.includes(x)); if (both.length) add('error', `In campo e anche tra i subentrati: ${[...new Set(both)].join(', ')}.`);
      const benchIn = (m.bench_details || []).filter(b => b && b.subbed_in).map(b => b.player);
      if (m.bench_details && (benchIn.length !== subsIn.length || benchIn.some(x => !subsIn.includes(x)))) add('warn', 'substitutes_in e bench_details non coincidono.');

      starters.forEach(chk); subsIn.forEach(chk); (m.bench_details || []).forEach(b => chk(b && b.player));
      parseList(m.mvp).forEach(e => chk(e.name)); parseList(m.yellow_cards).forEach(e => chk(e.name)); parseList(m.red_cards).forEach(e => chk(e.name));
      const lineupIds = new Set([...starters, ...subsIn].map(resolve).filter(Boolean));
      const mvp = parseList(m.mvp)[0]; if (mvp && resolve(mvp.name) && !lineupIds.has(resolve(mvp.name))) add('info', `MVP "${mvp.name}" non risulta in formazione.`);

      const units = tri ? subs : [m];
      units.forEach(u => {
        const label = tri ? `[vs ${T.subOpp(u) || '?'}] ` : '';
        const res = T.ourResult(tri ? u : { score: m.score });
        if (!res) add('warn', `${label}Punteggio mancante o non valido: la partita non entra nelle statistiche di squadra.`);
        const sc = parseList(u.scorers), as = parseList(u.assists), gk = parseList(u.goalkeeper || u.goalkeepers, true);
        sc.forEach(e => chk(e.name)); as.forEach(e => chk(e.name)); gk.forEach(e => chk(e.name));
        if (res) {
          const goals = sc.reduce((a, e) => a + e.n, 0), asN = as.reduce((a, e) => a + e.n, 0);
          if (goals !== res.gf && (goals || res.gf)) add('warn', `${label}Marcatori ${goals} ≠ gol fatti ${res.gf}.`);
          if (asN > res.gf) add('warn', `${label}Assist ${asN} > gol fatti ${res.gf}.`);
          if (gk.length && gk.every(e => e.n != null)) { const c = gk.reduce((a, e) => a + e.n, 0); if (c !== res.ga) add('warn', `${label}Portieri: ${c} subiti ≠ ${res.ga} dal punteggio.`); }
          if (!gk.length && !(m.starters_positions && m.starters_positions.GK)) add('info', `${label}Nessun portiere indicato: i gol subiti non vanno a nessun giocatore.`);
        }
      });
      const gkIds = new Set(units.flatMap(u => parseList(u.goalkeeper || u.goalkeepers, true).map(e => resolve(e.name)).filter(Boolean)));
      (m.bench_details || []).forEach(b => { if (b && b.subbed_in && b.position_played === 'GK') { const id = resolve(b.player); if (id && !gkIds.has(id)) add('warn', `${b.player} è entrato come GK ma non compare tra i portieri.`); } });
      if (unknown.size) add('warn', `Nomi non riconosciuti (non in rosa o ambigui): ${[...unknown].join(', ')}.`);
    });
    const rank = { error: 0, warn: 1, info: 2 };
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || rank[a.level] - rank[b.level]);
  }

  const api = { parseList, makeIndex, build, audit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.AD = g.AD || {}; g.AD.stats = api;
})(typeof window !== 'undefined' ? window : globalThis);
