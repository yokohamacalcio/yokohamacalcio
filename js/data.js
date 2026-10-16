/* js/data.js — caricamento JSON e helper comuni a index, matches, players, stats, about.
   Richiede common.js. Uso:  const D = await YC.data.load(['matches','opponents',...]); */
(function () {
  'use strict';
  const FILES = { matches: ['matches.json', []], opponents: ['opponents.json', {}], locations: ['locations.json', {}], players: ['players.json', []], stats: ['stats.json', {}], trainings: ['trainings.json', []], news: ['news.json', []] };
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

  /* categoria: 'official' (admin) e 'league' (sito) sono la stessa cosa */
  const normCat = c => (c === 'official' ? 'league' : (CAT[c] ? c : 'friendly'));
  const catBadge = (c, lang) => { const k = CAT[normCat(c)]; return { cls: k.cls, label: k[lang] || k.ja }; };

  /* data in fuso del Giappone, mai slittata */
  function fmtDate(date, lang, opt) {
    if (!date) return '';
    const d = new Date(String(date).trim().replace(/\./g, '-').slice(0, 10) + 'T12:00:00+09:00');
    if (isNaN(d)) return date;
    return new Intl.DateTimeFormat(LOCALE[lang] || 'ja-JP', Object.assign({ timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }, opt || {})).format(d);
  }
  const ts = (date, time) => new Date(date + 'T' + (time || '00:00') + ':00+09:00').getTime();

  /* ---- avversari e loghi ---- */
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
    const o = (opponents || {})[m.opponent_id];
    const names = (o && o.name) || {};
    const name = names[lang] || names.ja || m.opponent_name || m.opponent_id || 'Opponent';
    const latin = names.en || names.it || (String(name).replace(/[^\x00-\x7F]/g, '').trim()) || name;
    const avatar = avatarUrl(m.opponent_id, latin);
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

  /* il punteggio nel JSON è SEMPRE "nostri-loro". In casa: noi a sinistra; in trasferta: avversario a sinistra */
  function scoreParts(m) {
    const mt = String(m.score || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!mt) return { ours: null, theirs: null, text: m.score || '-', left: m.score || '-' };
    const o = +mt[1], th = +mt[2], home = m.isHome !== false;
    return { ours: o, theirs: th, text: o + ' - ' + th, left: home ? o + ' - ' + th : th + ' - ' + o };
  }
  const result = m => { const s = scoreParts(m); return s.ours == null ? null : (s.ours > s.theirs ? 'W' : s.ours === s.theirs ? 'D' : 'L'); };

  /* ---- giocatori ---- */
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
  /* "小金井 健斗 x2, 川合 翔 (23')" -> testo nella lingua scelta */
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
  /* calcolo età da data di nascita; il sito mostra solo l'età */
  function age(birth) {
    if (!birth) return null; const b = new Date(birth); if (isNaN(b)) return null;
    const n = new Date(Date.now() + 9 * 3600e3); let a = n.getUTCFullYear() - b.getUTCFullYear();
    if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--; return a;
  }

  /* ---- allenamenti (trainings.json) ---- */
  function parseRange(t) { const m = String(t || '').match(/(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})/); return m ? { start: m[1].padStart(5, '0'), end: m[2].padStart(5, '0') } : { start: (String(t || '').match(/\d{1,2}:\d{2}/) || [''])[0], end: '' }; }
  function upcomingTrainings(list) {
    const today = YC.todayJST();
    return (list || []).filter(x => x && x.date && x.date >= today && (x.status || 'upcoming') === 'upcoming')
      .map(x => Object.assign({}, x, parseRange(x.time))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  window.YC.data = { load, normCat, catBadge, fmtDate, ts, avatarUrl, oppInfo, logoImg, locInfo, scoreParts, result, findPlayer, playerName, translatePlayerText, age, parseRange, upcomingTrainings };
})();
