/* js/data.js — caricamento JSON e helper comuni a index, matches, players, stats, about.
   Richiede common.js. Uso: const D = await YC.data.load(['matches','opponents',...]); */
(function () {
  'use strict';

  const FILES = {
    matches: ['matches.json', []],
    opponents: ['opponents.json', {}],
    locations: ['locations.json', {}],
    players: ['players.json', []],
    stats: ['stats.json', {}],
    trainings: ['trainings.json', []],
    news: ['news.json', []]
  };
  const cache = {};
  const LOCALE = { ja: 'ja-JP', it: 'it-IT', en: 'en-US' };
  const CAT = {
    friendly: { cls: 'badge-friendly', ja: '練習試合', it: 'Amichevole', en: 'Friendly' },
    league: { cls: 'badge-official', ja: '公式戦', it: 'Campionato', en: 'League' },
    cup: { cls: 'badge-cup', ja: 'カップ戦', it: 'Coppa', en: 'Cup' },
    tournament: { cls: 'badge-tournament', ja: '大会', it: 'Torneo', en: 'Tournament' }
  };
  const JA_CHARS = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/;

  function load(names) {
    const out = {};
    return Promise.all(names.map(n => {
      if (!cache[n]) cache[n] = YC.fetchJson(FILES[n][0], FILES[n][1]);
      return cache[n].then(v => { out[n] = v; });
    })).then(() => out);
  }

  /* Categoria: 'official' (admin) e 'league' (sito) sono equivalenti */
  const normCat = c => (c === 'official' ? 'league' : (CAT[c] ? c : 'friendly'));
  const catBadge = (c, lang) => { const k = CAT[normCat(c)]; return { cls: k.cls, label: k[lang] || k.ja }; };

  /* Data in fuso orario del Giappone (JST), mai slittata */
  function fmtDate(date, lang, opt) {
    if (!date) return '';
    const d = new Date(String(date).trim().replace(/\./g, '-').slice(0, 10) + 'T12:00:00+09:00');
    if (isNaN(d)) return date;
    return new Intl.DateTimeFormat(LOCALE[lang] || 'ja-JP', Object.assign({ timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }, opt || {})).format(d);
  }
  const ts = (date, time) => new Date(date + 'T' + (time || '00:00') + ':00+09:00').getTime();

  /* ---- Avversari e loghi ---- */
  function hue(str) { let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h); return Math.abs(h) % 360; }
  function hsl2hex(h, s, l) {
    s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0'); };
    return f(0) + f(8) + f(4);
  }
  function avatarUrl(id, name) {
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name || id || '?') + '&background=' + hsl2hex(hue(String(id || name || 'x').toLowerCase()), 70, 40) + '&color=ffffff&bold=true&size=128&rounded=true';
  }
  function oppInfo(m, lang, opponents) {
    const oppId = (m && (m.opponent_id || m.opponent)) || '';
    const o = (opponents || {})[oppId];
    const names = (o && o.name) || {};
    const name = names[lang] || names.ja || (m && m.opponent_name) || oppId || 'Opponent';
    const latin = names.en || names.it || (String(name).replace(/[^\x00-\x7F]/g, '').trim()) || name;
    const avatar = avatarUrl(oppId, latin);
    return { name, logo: (o && o.logo) || avatar, avatar };
  }
  /* <img> con fallback automatico all'avatar generato */
  const logoImg = (src, alt, fallback) => `<img src="${YC.escapeHtml(src)}" alt="${YC.escapeHtml(alt)}" loading="lazy" onerror="this.onerror=null;this.src='${fallback || ''}'">`;

  function locInfo(id, fallback, lang, locations) {
    const l = (locations || {})[id];
    if (!l) { const n = fallback || id || '-'; return { name: n, url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(n), surface: '' }; }
    const name = l[lang] || l.ja || fallback || id;
    const s = l.surface || {};
    return { name, url: l.maps || l.url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name), surface: typeof s === 'object' ? (s[lang] || s.ja || '') : s };
  }

  /* Punteggio sempre "nostri-loro". Supporta sia partite singole che triangolari. */
  function scoreParts(m) {
    if (!m) return { ours: null, theirs: null, text: '-', left: '-' };
    if (m.sub_matches && m.sub_matches.length > 0) {
      let ours = 0, theirs = 0, hasScore = false;
      m.sub_matches.forEach(sub => {
        const mt = String(sub.score || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
        if (mt) {
          hasScore = true;
          const s1 = +mt[1], s2 = +mt[2];
          const isHomeUs = sub.home === 'us' || sub.isHome === true || sub.home_team === 'us';
          if (isHomeUs) { ours += s1; theirs += s2; }
          else { ours += s2; theirs += s1; }
        }
      });
      if (!hasScore && m.score) {
        const mt = String(m.score || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
        if (mt) {
          const o = +mt[1], th = +mt[2], home = m.isHome !== false;
          return { ours: o, theirs: th, text: o + ' - ' + th, left: home ? o + ' - ' + th : th + ' - ' + o };
        }
      }
      if (!hasScore) return { ours: null, theirs: null, text: m.score || '-', left: m.score || '-' };
      const home = m.isHome !== false;
      return { ours, theirs, text: ours + ' - ' + theirs, left: home ? ours + ' - ' + theirs : theirs + ' - ' + ours };
    }
    const mt = String(m.score || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!mt) return { ours: null, theirs: null, text: m.score || '-', left: m.score || '-' };
    const o = +mt[1], th = +mt[2], home = m.isHome !== false;
    return { ours: o, theirs: th, text: o + ' - ' + th, left: home ? o + ' - ' + th : th + ' - ' + o };
  }
  const result = m => { const s = scoreParts(m); return s.ours == null ? null : (s.ours > s.theirs ? 'W' : s.ours === s.theirs ? 'D' : 'L'); };

  /* ---- Giocatori ---- */
  function findPlayer(players, q) {
    if (!q || q === 'なし' || q === 'Nessuno' || !players || !players.length) return null;
    const t = YC.cleanStr(q); if (!t) return null;
    const keys = p => [p.name_kanji, p.name_kana, p.name_romaji, p.id].map(YC.cleanStr);
    let f = players.find(p => keys(p).some(k => k && k === t));
    if (f || t.length < 2) return f || null;
    return players.find(p => keys(p).some(k => k && (k.includes(t) || t.includes(k)))) || null;
  }
  function playerName(p, lang) {
    if (!p) return '';
    if (lang === 'ja') return (p.name_kanji && JA_CHARS.test(p.name_kanji)) ? p.name_kanji : (p.name_kana || p.name_kanji || p.name_romaji);
    return p.name_romaji || p.name_kanji || p.name_kana;
  }
  
  function translatePlayerText(text, lang, players) {
    if (!text || typeof text !== 'string' || text === 'なし' || text === 'Nessuno') return '';
    return text.split(/[,、]/).map(item => {
      let s = item.trim(); if (!s) return '';
      let suffix = '';
      const mult = s.match(/^(.*?)\s*([xX*]\s*\d+)$/); if (mult) { s = mult[1].trim(); suffix = ' ' + mult[2].replace(/\s/g, ''); }
      const min = s.match(/^(.*?)\s*[(（]([^)）]+)[)）]$/);
      if (min) { const p = findPlayer(players, min[1]); const nm = p ? playerName(p, lang) : min[1]; return nm + ' (' + min[2] + ')' + suffix; }
      const p = findPlayer(players, s);
      return (p ? playerName(p, lang) : s) + suffix;
    }).filter(Boolean).join(', ');
  }

  /* Parsing dei gol/assist con quantificatore ("小金井 健斗 x2" -> { name: "小金井 健斗", count: 2 }) */
  function parsePlayerTextCounts(text) {
    const result = [];
    if (!text || typeof text !== 'string' || text === 'なし' || text === 'Nessuno') return result;
    text.split(/[,、]/).forEach(item => {
      let s = item.trim();
      if (!s) return;
      let count = 1;
      const mult = s.match(/^(.*?)\s*([xX*]\s*(\d+))$/);
      if (mult) {
        s = mult[1].trim();
        count = parseInt(mult[3], 10) || 1;
      }
      const min = s.match(/^(.*?)\s*[(（]([^)）]+)[)）]$/);
      if (min) s = min[1].trim();
      if (s) result.push({ name: s, count });
    });
    return result;
  }

  /* Parsing dei portieri e gol subiti ("御村 葵(1)" -> { name: "御村 葵", conceded: 1, cleanSheet: false }) */
  function parseGoalkeepers(text, defaultConceded) {
    const result = [];
    if (!text || typeof text !== 'string' || text === 'なし' || text === 'Nessuno') return result;
    const defGa = typeof defaultConceded === 'number' ? defaultConceded : 0;
    text.split(/[,、]/).forEach(item => {
      const s = item.trim();
      if (!s) return;
      const parsed = s.match(/^([^(（]+)(?:[(（](\d+)[)）])?/);
      if (parsed) {
        const name = parsed[1].trim();
        const conceded = parsed[2] !== undefined ? parseInt(parsed[2], 10) : defGa;
        result.push({ name, conceded, cleanSheet: conceded === 0 });
      }
    });
    return result;
  }

  /* Estrazione unificata di tutti gli eventi (marcatori, assist, sanzioni, portieri) da partite o triangolari */
  function getMatchEvents(m) {
    const scorers = [];
    const assists = [];
    const yellows = [];
    const reds = [];
    const goalkeepers = [];
    const mvps = [];

    if (m.sub_matches && m.sub_matches.length > 0) {
      m.sub_matches.forEach(sub => {
        if (sub.scorers) scorers.push(...parsePlayerTextCounts(sub.scorers));
        if (sub.assists) assists.push(...parsePlayerTextCounts(sub.assists));
        if (sub.yellow_cards) yellows.push(...parsePlayerTextCounts(sub.yellow_cards));
        if (sub.red_cards) reds.push(...parsePlayerTextCounts(sub.red_cards));

        const isHomeUs = sub.home === 'us' || sub.isHome === true || sub.home_team === 'us';
        const mt = String(sub.score || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
        const subTheirs = mt ? (isHomeUs ? +mt[2] : +mt[1]) : 0;

        const gkStr = sub.goalkeeper || sub.goalkeepers;
        if (gkStr) {
          goalkeepers.push(...parseGoalkeepers(gkStr, subTheirs));
        }
      });
      if (m.mvp) mvps.push(...parsePlayerTextCounts(m.mvp));
      if (m.yellow_cards && yellows.length === 0) yellows.push(...parsePlayerTextCounts(m.yellow_cards));
      if (m.red_cards && reds.length === 0) reds.push(...parsePlayerTextCounts(m.red_cards));
    } else {
      const sc = scoreParts(m);
      const mainTheirs = sc.theirs || 0;

      if (m.scorers) scorers.push(...parsePlayerTextCounts(m.scorers));
      if (m.assists) assists.push(...parsePlayerTextCounts(m.assists));
      if (m.yellow_cards) yellows.push(...parsePlayerTextCounts(m.yellow_cards));
      if (m.red_cards) reds.push(...parsePlayerTextCounts(m.red_cards));
      if (m.mvp) mvps.push(...parsePlayerTextCounts(m.mvp));
      if (m.goalkeepers) goalkeepers.push(...parseGoalkeepers(m.goalkeepers, mainTheirs));
    }

    return { scorers, assists, yellows, reds, goalkeepers, mvps };
  }

  /* Aggregazione completa statistiche squadra e singoli giocatori */
  function computeStats(matches, players) {
    const team = { total: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
    const playerStats = {};

    const initPlayer = (name) => {
      if (!playerStats[name]) {
        playerStats[name] = {
          name,
          appearances: 0,
          starts: 0,
          subsIn: 0,
          goals: 0,
          assists: 0,
          gkMatches: 0,
          gkGoalsConceded: 0,
          cleanSheets: 0,
          mvp: 0,
          yellows: 0,
          reds: 0
        };
      }
      return playerStats[name];
    };

    (matches || []).forEach(m => {
      if (!m || m.status === 'upcoming') return;

      const sc = scoreParts(m);
      if (sc.ours !== null) {
        team.total += 1;
        team.gf += sc.ours;
        team.ga += sc.theirs;
        const res = result(m);
        if (res === 'W') team.wins += 1;
        else if (res === 'D') team.draws += 1;
        else if (res === 'L') team.losses += 1;
      }

      const lineup = m.lineup || [];
      const starters = m.starters || (m.starters_positions ? Object.values(m.starters_positions) : []);
      const subsIn = m.substitutes_in || [];

      const participants = new Set([...lineup, ...starters, ...subsIn]);
      participants.forEach(pName => {
        if (!pName) return;
        const st = initPlayer(pName);
        st.appearances += 1;
        if (starters.includes(pName)) st.starts += 1;
        else if (subsIn.includes(pName)) st.subsIn += 1;
      });

      const events = getMatchEvents(m);

      events.scorers.forEach(scItem => {
        const st = initPlayer(scItem.name);
        st.goals += scItem.count;
      });

      events.assists.forEach(asItem => {
        const st = initPlayer(asItem.name);
        st.assists += asItem.count;
      });

      events.yellows.forEach(yItem => {
        const st = initPlayer(yItem.name);
        st.yellows += (yItem.count || 1);
      });

      events.reds.forEach(rItem => {
        const st = initPlayer(rItem.name);
        st.reds += (rItem.count || 1);
      });

      const gksInMatch = new Set();
      events.goalkeepers.forEach(gk => {
        const st = initPlayer(gk.name);
        st.gkGoalsConceded += gk.conceded;
        if (gk.cleanSheet) st.cleanSheets += 1;
        gksInMatch.add(gk.name);
      });
      gksInMatch.forEach(gkName => {
        const st = initPlayer(gkName);
        st.gkMatches += 1;
      });

      events.mvps.forEach(item => {
        const st = initPlayer(item.name);
        st.mvp += item.count;
      });
    });

    return { team, players: playerStats };
  }

  /* Calcolo età da data di nascita */
  function age(birth) {
    if (!birth) return null; const b = new Date(birth); if (isNaN(b)) return null;
    const n = new Date(Date.now() + 9 * 3600e3); let a = n.getUTCFullYear() - b.getUTCFullYear();
    if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--; return a;
  }

  /* ---- Allenamenti (trainings.json) ---- */
  function parseRange(t) { const m = String(t || '').match(/(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})/); return m ? { start: m[1].padStart(5, '0'), end: m[2].padStart(5, '0') } : { start: (String(t || '').match(/\d{1,2}:\d{2}/) || [''])[0], end: '' }; }
  function upcomingTrainings(list) {
    const today = YC.todayJST();
    return (list || []).filter(x => x && x.date && x.date >= today && (x.status || 'upcoming') === 'upcoming')
      .map(x => Object.assign({}, x, parseRange(x.time))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  window.YC.data = {
    load,
    normCat,
    catBadge,
    fmtDate,
    ts,
    avatarUrl,
    oppInfo,
    logoImg,
    locInfo,
    scoreParts,
    result,
    findPlayer,
    playerName,
    translatePlayerText,
    parsePlayerTextCounts,
    parseGoalkeepers,
    getMatchEvents,
    computeStats,
    age,
    parseRange,
    upcomingTrainings
  };
})();
