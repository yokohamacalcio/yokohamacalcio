/* js/admin-triangular.js — funzioni PURE per i triangolari (nessun accesso al DOM).
   Modello dati (come in matches.json):
     isTriangular: true, type: "triangular",
     opponent_id: "<avversario 1>", opponents: ["<avv. 1>", "<avv. 2>"],
     sub_matches: [{ opponent_id, home: "us", away: "<id avv.>", score: "ours - theirs" | "VS",
                     scorers, assists, goalkeeper }]        ← uno per OGNI nostro incontro
     Lineup, MVP e cartellini sono della giornata (campi della partita); gol, assist e portiere sono dell'incontro.
     score (partita): risultato complessivo "nostri - subiti", calcolato dagli incontri.            */
(function (g) {
  'use strict';
  const SCORE = /^\s*(\d+)\s*-\s*(\d+)\s*$/;
  const normScore = s => { const m = SCORE.exec(String(s || '')); return m ? `${+m[1]} - ${+m[2]}` : 'VS'; };
  const subList = m => (m && Array.isArray(m.sub_matches) ? m.sub_matches : (m && Array.isArray(m.subMatches) ? m.subMatches : []));
  const isTri = m => !!(m && (m.isTriangular || m.type === 'triangular' || subList(m).length > 0));
  const subOpp = s => s.opponent_id || (s.home === 'us' ? s.away : s.away === 'us' ? s.home : s.away) || '';

  /** risultato di Yokohama Calcio in un incontro: {gf, ga} oppure null se non c'è un punteggio numerico.
      Il punteggio è "nostri - loro"; solo se noi siamo indicati come ospiti ("away":"us") viene invertito. */
  function ourResult(s) {
    const x = SCORE.exec(String((s && (s.score || s.result)) || '')); if (!x) return null;
    const a = +x[1], b = +x[2];
    return s.away === 'us' && s.home !== 'us' ? { gf: b, ga: a } : { gf: a, ga: b };
  }

  /** [avv.1, avv.2]: da m.opponents, altrimenti dagli incontri, altrimenti da opponent_id */
  function opponentsOf(m) {
    const list = Array.isArray(m.opponents) ? m.opponents.filter(Boolean) : [];
    if (list.length) return list;
    const set = []; subList(m).forEach(s => { const o = subOpp(s); if (o && !set.includes(o)) set.push(o); });
    if (!set.length && m.opponent_id) set.push(m.opponent_id);
    return set;
  }

  /** risultato complessivo dei nostri incontri */
  function aggregate(subs) {
    let gf = 0, ga = 0, played = 0;
    (subs || []).forEach(s => { const r = ourResult(s); if (r) { gf += r.gf; ga += r.ga; played++; } });
    return { gf, ga, played, total: (subs || []).length, complete: (subs || []).length > 0 && played === (subs || []).length };
  }

  /** errore (chiave testo m.tri.*) oppure null. Le righe possono avere _bad = punteggio digitato non valido */
  function validate(subs, opp1, opp2) {
    if (!opp2) return 'needOpp2';
    if (opp1 === opp2) return 'sameOpp';
    if (!subs.length) return 'noSub';
    for (const s of subs) { if (!subOpp(s)) return 'noSubOpp'; if (s._bad) return 'badScore'; }
    return null;
  }

  /** unisce le liste degli incontri nei campi della partita (per le pagine pubbliche) */
  function mergeGk(strs) {
    const order = [], sum = {}, loose = [];
    strs.forEach(str => String(str || '').split(/[,、]/).map(x => x.trim()).filter(Boolean).forEach(it => {
      const m = it.match(/^(.+?)\s*[(（]\s*(\d+)\s*[)）]$/);
      if (m) { const k = m[1].trim(); if (!(k in sum)) { sum[k] = 0; order.push(k); } sum[k] += +m[2]; } else loose.push(it);
    }));
    return order.map(k => `${k}(${sum[k]})`).concat(loose).join(', ');
  }
  function mergeEvents(subs) {
    const join = f => subs.map(s => s[f]).filter(x => x && String(x).trim()).join(', ');
    return { scorers: join('scorers'), assists: join('assists'), goalkeepers: mergeGk(subs.map(s => s.goalkeeper || s.goalkeepers)) };
  }

  const api = { SCORE, normScore, subList, isTri, subOpp, ourResult, opponentsOf, aggregate, validate, mergeEvents };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.AD = g.AD || {}; g.AD.tri = api;
})(typeof window !== 'undefined' ? window : globalThis);
