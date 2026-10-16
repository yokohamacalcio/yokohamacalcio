/* ticker.js — striscia news alimentata da news.json + dati automatici di matches.json
   Richiede common.js. Markup necessario in index.html:
   <div class="news-ticker-bar" id="newsTickerBar" hidden> ... <div class="ticker-track" id="tickerTrack"></div> ... </div>
*/
(function () {
  'use strict';
  const BAR = document.getElementById('newsTickerBar');
  const TRACK = document.getElementById('tickerTrack');
  if (!BAR || !TRACK || !window.YC) return;

  const CFG = {
    maxItems: 6,      // massimo di elementi nella striscia
    speed: 60,        // pixel al secondo
    autoNext: true,   // aggiunge "prossima partita" da matches.json
    autoResult: true  // aggiunge "ultimo risultato" da matches.json
  };

  const TAGS = {
    league: { ja: 'リーグ', it: 'Campionato', en: 'League' },
    trial:  { ja: 'メンバー募集', it: 'Selezioni', en: 'Recruitment' },
    match:  { ja: '試合情報', it: 'Partite', en: 'Matches' },
    info:   { ja: 'お知らせ', it: 'Avviso', en: 'Notice' },
    next:   { ja: '次戦', it: 'Prossima', en: 'Next' },
    result: { ja: '結果', it: 'Risultato', en: 'Result' }
  };
  const TAG_CLASS = { trial: 'badge-trial', match: 'badge-notice', next: 'badge-notice' };

  let news = [], matches = [], opponents = {};

  function oppName(m, lang) {
    const o = opponents[m.opponent_id];
    return (o && o.name && (o.name[lang] || o.name.ja)) || m.opponent_name || m.opponent_id || '?';
  }
  const md = d => String(d).slice(5).replace('-', '/');

  function buildItems(lang) {
    const today = YC.todayJST();
    const items = [];

    // 1) news manuali: visibili da "date" fino a "expires" (inclusa), le più recenti prima
    news
      .filter(n => n && n.title && n.date && n.date <= today && (!n.expires || n.expires >= today))
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(n => items.push({
        date: n.date, type: TAGS[n.type] ? n.type : 'info', link: n.link || null,
        text: n.title[lang] || n.title.it || n.title.en || n.title.ja || ''
      }));

    // 2) prossima partita (automatica)
    if (CFG.autoNext) {
      const next = matches.filter(m => m.status === 'upcoming' && m.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (next) items.push({
        date: next.date, type: 'next', link: 'matches.html#' + next.id,
        text: `${md(next.date)}${next.time ? ' ' + next.time : ''} · vs ${oppName(next, lang)}`
      });
    }
    // 3) ultimo risultato (automatico). Il punteggio nel JSON è sempre "nostri-loro"
    if (CFG.autoResult) {
      const last = matches.filter(m => m.status === 'past' && /\d/.test(m.score || ''))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (last) items.push({
        date: last.date, type: 'result', link: 'matches.html#' + last.id,
        text: `Yokohama Calcio ${String(last.score).replace(/\s+/g, '')} ${oppName(last, lang)}`
      });
    }
    return items.filter(i => i.text).slice(0, CFG.maxItems);
  }

  function node(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function itemNode(it, lang) {
    const a = node(it.link ? 'a' : 'span', 'ticker-item');
    if (it.link) a.href = it.link;
    a.append(
      node('span', 'ticker-date', it.date.replace(/-/g, '.')),
      node('span', 'ticker-tag ' + (TAG_CLASS[it.type] || ''), (TAGS[it.type] || {})[lang] || it.type),
      node('span', '', it.text)
    );
    return a;
  }

  function makeSet(items, lang, hidden) {
    const s = node('div', 'ticker-set');
    items.forEach(it => {
      s.appendChild(itemNode(it, lang));
      const d = node('span', 'ticker-divider');
      d.innerHTML = '<i class="fas fa-circle" aria-hidden="true"></i>';
      s.appendChild(d);
    });
    if (hidden) {
      s.setAttribute('aria-hidden', 'true');
      s.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
    }
    return s;
  }

  function render() {
    const lang = YC.lang();
    const items = buildItems(lang);
    if (!items.length) { BAR.hidden = true; return; }
    BAR.hidden = false;
    TRACK.textContent = '';

    const first = makeSet(items, lang, false);
    TRACK.appendChild(first);
    const w = first.getBoundingClientRect().width || 1;
    const wrapW = TRACK.parentElement.clientWidth || window.innerWidth;
    // ogni metà della traccia deve riempire lo schermo, altrimenti si vedono buchi
    const copies = Math.max(1, Math.ceil(wrapW / w));
    for (let i = 1; i < copies; i++) TRACK.appendChild(makeSet(items, lang, true));
    for (let i = 0; i < copies; i++) TRACK.appendChild(makeSet(items, lang, true));
    TRACK.style.animationDuration = Math.max(15, (w * copies) / CFG.speed) + 's';
  }

  Promise.all([
    YC.fetchJson('news.json', []),
    YC.fetchJson('matches.json', []),
    YC.fetchJson('opponents.json', {})
  ]).then(([n, m, o]) => {
    news = Array.isArray(n) ? n : [];
    matches = Array.isArray(m) ? m : [];
    opponents = o && typeof o === 'object' ? o : {};
    render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  });

  document.addEventListener('yc:langchange', render);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 250); });
})();
