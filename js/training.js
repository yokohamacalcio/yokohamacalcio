/* training.js — sezione "Allenamenti e calendario" (index.html)
   Dati: trainings.json (allenamenti), matches.json (partite in programma), locations.json, opponents.json.
   Markup necessario:  <section class="section" id="training"><div class="container"><div id="trainingRoot"></div></div></section>
   Richiede common.js */
(function () {
  'use strict';
  const ROOT = document.getElementById('trainingRoot');
  if (!ROOT || !window.YC) return;

  const MAX_EVENTS = 6;
  const LOCALE = { ja: 'ja-JP', it: 'it-IT', en: 'en-US' };

  const I = {
    ja: {
      title: '今後の予定・体験練習',
      lead: '練習と試合の予定です。体験参加は練習日に受け付けています。',
      training: '練習', match: '試合', trialOk: '体験OK',
      add: 'カレンダーに追加', subAll: '全予定をカレンダーに登録',
      subApple: 'Apple / Outlook', subGoogle: 'Google カレンダー',
      empty: '次回の予定は毎月25日以降に発表します。',
      apply: '体験参加を申し込む',
      infoTitle: '体験参加について',
      info: [
        '入部前に3回の体験参加をお願いしています（1回500円）。',
        '対象は18〜40歳のサッカー経験者です。ブランクがあっても大丈夫です。',
        '持ち物：運動着、シューズ、すね当て、飲み物、参加費。',
        '雨天・グラウンド不良の場合は、2〜3時間前にLINEで連絡します。'
      ]
    },
    it: {
      title: 'Prossimi appuntamenti e prove',
      lead: 'Allenamenti e partite in programma. Le prove si fanno nei giorni di allenamento.',
      training: 'Allenamento', match: 'Partita', trialOk: 'Prova aperta',
      add: 'Aggiungi al calendario', subAll: 'Iscriviti a tutto il calendario',
      subApple: 'Apple / Outlook', subGoogle: 'Google Calendar',
      empty: 'Il calendario del mese prossimo esce dal 25 di ogni mese.',
      apply: 'Prenota una prova',
      infoTitle: 'Come funziona la prova',
      info: [
        'Prima dell\'iscrizione servono 3 prove (500 yen a prova).',
        'Età 18–40 anni, con esperienza calcistica. Anche dopo una pausa.',
        'Porta: abbigliamento sportivo, scarpe, parastinchi, acqua e la quota.',
        'In caso di pioggia o campo impraticabile avvisiamo su LINE 2–3 ore prima.'
      ]
    },
    en: {
      title: 'Upcoming sessions & trials',
      lead: 'Scheduled training sessions and matches. Trials take place on training days.',
      training: 'Training', match: 'Match', trialOk: 'Trial welcome',
      add: 'Add to calendar', subAll: 'Subscribe to the full calendar',
      subApple: 'Apple / Outlook', subGoogle: 'Google Calendar',
      empty: 'Next month\'s schedule is published from the 25th of each month.',
      apply: 'Book a trial',
      infoTitle: 'How trials work',
      info: [
        '3 trial sessions are required before joining (500 yen each).',
        'Ages 18–40 with football experience. A break from the game is fine.',
        'Bring: sportswear, boots, shin guards, water and the fee.',
        'If it rains or the pitch is unplayable we message you on LINE 2–3 hours before.'
      ]
    }
  };

  let trainings = [], matches = [], locations = {}, opponents = {};

  /* ---------- helpers DOM ---------- */
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name) { const i = h('i', 'fas ' + name); i.setAttribute('aria-hidden', 'true'); return i; }
  const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : null);
  const pick = (o, lang) => (o && (o[lang] || o.it || o.en || o.ja)) || '';

  /* ---------- dati ---------- */
  function collect() {
    const today = YC.todayJST();
    const ev = [];
    trainings.forEach(t => {
      if (!t || !t.date || t.date < today) return;
      ev.push({ kind: 'training', id: t.id || t.date, date: t.date, time: t.time || '', end: t.end || '',
        loc: t.location_id, trial: !!t.trial_open, note: t.note, title: t.title });
    });
    matches.forEach(m => {
      if (m.status !== 'upcoming' || !m.date || m.date < today) return;
      ev.push({ kind: 'match', id: m.id, date: m.date, time: m.time || '', end: '', loc: m.location_id, opp: m.opponent_id });
    });
    ev.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return ev.slice(0, MAX_EVENTS);
  }

  function locInfo(id, lang) {
    const l = locations[id];
    if (!l) return { name: id || '', url: null };
    return { name: l[lang] || l.ja || id, url: safeUrl(l.maps || l.url) };
  }

  /* ---------- .ics singolo evento (client-side) ---------- */
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    const enc = new TextEncoder(), dec = new TextDecoder();
    let b = enc.encode(line), limit = 75;
    const out = [];
    while (b.length > limit) {
      let cut = limit;
      while (cut > 0 && (b[cut] & 0xC0) === 0x80) cut--;
      out.push(dec.decode(b.slice(0, cut)));
      b = b.slice(cut); limit = 74;
    }
    out.push(dec.decode(b));
    return out.join('\r\n ');
  }
  const utc = d => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  function downloadIcs(e, lang) {
    const L = I[lang];
    const loc = locInfo(e.loc, lang);
    const summary = e.kind === 'match'
      ? 'Yokohama Calcio vs ' + oppLabel(e.opp, lang)
      : 'Yokohama Calcio ' + (pick(e.title, lang) || L.training);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Yokohama Calcio//Site//EN', 'BEGIN:VEVENT',
      'UID:' + e.kind + '-' + e.id + '@yokohamacalcio.com', 'SUMMARY:' + icsEsc(summary)];
    if (e.time) {
      const start = new Date(e.date + 'T' + e.time + ':00+09:00');
      const end = e.end ? new Date(e.date + 'T' + e.end + ':00+09:00') : new Date(start.getTime() + 2 * 3600e3);
      lines.push('DTSTAMP:' + utc(start), 'DTSTART:' + utc(start), 'DTEND:' + utc(end));
    } else {
      lines.push('DTSTAMP:' + e.date.replace(/-/g, '') + 'T000000Z', 'DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''));
    }
    if (loc.name) lines.push('LOCATION:' + icsEsc(loc.name));
    if (loc.url) lines.push('URL:' + loc.url);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    const blob = new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = summary.replace(/[^\w\-]+/g, '_') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function oppLabel(id, lang) {
    const o = opponents[id];
    return (o && o.name && (o.name[lang] || o.name.ja)) || id || '?';
  }

  /* ---------- card evento ---------- */
  function card(e, lang) {
    const L = I[lang];
    const d = new Date(e.date + 'T12:00:00+09:00');
    const fmt = opt => new Intl.DateTimeFormat(LOCALE[lang], Object.assign({ timeZone: 'Asia/Tokyo' }, opt)).format(d);
    const el = h('article', 'cal-card cal-' + e.kind);

    const date = h('div', 'cal-date');
    date.append(h('span', 'cal-day', fmt({ day: 'numeric' })), h('span', 'cal-mon', fmt({ month: 'short' })), h('span', 'cal-wd', fmt({ weekday: 'short' })));

    const body = h('div', 'cal-body');
    const badges = h('div', 'cal-badges');
    badges.appendChild(h('span', 'cal-kind', e.kind === 'match' ? L.match : L.training));
    if (e.kind === 'training' && e.trial) badges.appendChild(h('span', 'cal-trial', L.trialOk));
    body.appendChild(badges);

    const title = e.kind === 'match'
      ? 'Yokohama Calcio vs ' + oppLabel(e.opp, lang)
      : (pick(e.title, lang) || L.training);
    body.appendChild(h('div', 'cal-title', title));

    const meta = h('div', 'cal-meta');
    if (e.time) {
      const t = h('span'); t.append(icon('fa-clock'), document.createTextNode(' ' + e.time + (e.end ? '–' + e.end : '')));
      meta.appendChild(t);
    }
    const loc = locInfo(e.loc, lang);
    if (loc.name) {
      const wrap = loc.url ? h('a') : h('span');
      if (loc.url) { wrap.href = loc.url; wrap.target = '_blank'; wrap.rel = 'noopener noreferrer'; }
      wrap.append(icon('fa-map-marker-alt'), document.createTextNode(' ' + loc.name));
      meta.appendChild(wrap);
    }
    body.appendChild(meta);

    const note = pick(e.note, lang);
    if (note) body.appendChild(h('p', 'cal-note', note));

    const add = h('button', 'cal-add');
    add.type = 'button';
    add.append(icon('fa-calendar-plus'), document.createTextNode(' ' + L.add));
    add.addEventListener('click', () => downloadIcs(e, lang));

    el.append(date, body, add);
    return el;
  }

  /* ---------- render ---------- */
  function render() {
    const lang = YC.lang();
    const L = I[lang] || I.ja;
    ROOT.textContent = '';

    const head = h('div', 'cal-head');
    head.append(h('h2', 'section-title', L.title), h('p', 'cal-lead', L.lead));
    ROOT.appendChild(head);

    const events = collect();
    const list = h('div', 'cal-list');
    if (events.length) events.forEach(e => list.appendChild(card(e, lang)));
    else list.appendChild(h('p', 'cal-empty', L.empty));
    ROOT.appendChild(list);

    // iscrizione al calendario completo (calendar.ics generato dal workflow)
    const feed = location.host + '/calendar.ics';
    const sub = h('div', 'cal-sub');
    sub.appendChild(h('span', 'cal-sub-label', L.subAll));
    const a1 = h('a', 'cal-sub-link', L.subApple); a1.href = 'webcal://' + feed;
    const a2 = h('a', 'cal-sub-link', L.subGoogle);
    a2.href = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent('webcal://' + feed);
    a2.target = '_blank'; a2.rel = 'noopener noreferrer';
    sub.append(a1, a2);
    ROOT.appendChild(sub);

    const info = h('div', 'cal-info');
    info.appendChild(h('h3', null, L.infoTitle));
    const ul = h('ul');
    L.info.forEach(t => ul.appendChild(h('li', null, t)));
    info.appendChild(ul);
    const cta = h('a', 'recruitment-btn', L.apply);
    cta.href = 'contact.html?type=trial';
    cta.prepend(icon('fa-paper-plane'));
    info.appendChild(cta);
    ROOT.appendChild(info);
  }

  Promise.all([
    YC.fetchJson('trainings.json', []),
    YC.fetchJson('matches.json', []),
    YC.fetchJson('locations.json', {}),
    YC.fetchJson('opponents.json', {})
  ]).then(([t, m, l, o]) => {
    trainings = Array.isArray(t) ? t : [];
    matches = Array.isArray(m) ? m : [];
    locations = l && typeof l === 'object' ? l : {};
    opponents = o && typeof o === 'object' ? o : {};
    render();
  });
  document.addEventListener('yc:langchange', render);
})();
