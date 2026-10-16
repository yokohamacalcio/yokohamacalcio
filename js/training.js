/* js/training.js — sezione "Allenamenti e calendario" con calendario interattivo a date selezionabili
   Dati: trainings.json (allenamenti), matches.json (partite in programma), locations.json, opponents.json.
   Markup necessario:  <section class="section" id="training"><div class="container"><div id="trainingRoot"></div></div></section>
   Richiede common.js */
(function () {
  'use strict';
  const ROOT = document.getElementById('trainingRoot');
  if (!ROOT || !window.YC) return;

  const LOCALE = { ja: 'ja-JP', it: 'it-IT', en: 'en-US' };

  const I = {
    ja: {
      title: '今後の予定・体験練習カレンダー',
      lead: 'カレンダーの日付を選択すると、その日の練習・試合の予定を確認できます。',
      training: '練習', match: '試合', trialOk: '体験OK',
      add: 'カレンダーに追加', subAll: '全予定をカレンダーに登録',
      subApple: 'Apple / Outlook', subGoogle: 'Google カレンダー',
      emptyDate: '選択された日付の予定はありません。',
      emptyMonth: '今月の予定はありません。次回の発表をお待ちください。',
      apply: '体験参加を申し込む',
      infoTitle: '体験参加について',
      info: [
        '入部前に3回の体験参加をお願いしています（1回500円）。',
        '対象は18〜40歳のサッカー経験者です。ブランクがあっても大丈夫です。',
        '持ち物：運動着、シューズ、すね当て、飲み物、参加費。',
        '雨天・グラウンド不良の場合は、2〜3時間前にLINEで連絡します。'
      ],
      prevMonth: '前月', nextMonth: '次月',
      showAll: 'すべての予定を表示',
      selectedDatePrefix: '選択した日:'
    },
    it: {
      title: 'Calendario Allenamenti & Eventi',
      lead: 'Seleziona una data nel calendario per visualizzare i dettagli degli allenamenti e delle partite.',
      training: 'Allenamento', match: 'Partita', trialOk: 'Prova aperta',
      add: 'Aggiungi al calendario', subAll: 'Iscriviti a tutto il calendario',
      subApple: 'Apple / Outlook', subGoogle: 'Google Calendar',
      emptyDate: 'Nessun evento in programma per questa data.',
      emptyMonth: 'Nessun evento in programma per questo mese.',
      apply: 'Prenota una prova',
      infoTitle: 'Come funziona la prova',
      info: [
        'Prima dell\'iscrizione servono 3 prove (500 yen a prova).',
        'Età 18–40 anni, con esperienza calcistica. Anche dopo una pausa.',
        'Porta: abbigliamento sportivo, scarpe, parastinchi, acqua e la quota.',
        'In caso di pioggia o campo impraticabile avvisiamo su LINE 2–3 ore prima.'
      ],
      prevMonth: 'Mese prec.', nextMonth: 'Mese succ.',
      showAll: 'Mostra tutti gli eventi',
      selectedDatePrefix: 'Data selezionata:'
    },
    en: {
      title: 'Schedule & Trial Calendar',
      lead: 'Select a date on the calendar to view training sessions and match details.',
      training: 'Training', match: 'Match', trialOk: 'Trial welcome',
      add: 'Add to calendar', subAll: 'Subscribe to the full calendar',
      subApple: 'Apple / Outlook', subGoogle: 'Google Calendar',
      emptyDate: 'No events scheduled for this date.',
      emptyMonth: 'No events scheduled for this month.',
      apply: 'Book a trial',
      infoTitle: 'How trials work',
      info: [
        '3 trial sessions are required before joining (500 yen each).',
        'Ages 18–40 with football experience. A break from the game is fine.',
        'Bring: sportswear, boots, shin guards, water and the fee.',
        'If it rains or the pitch is unplayable we message you on LINE 2–3 hours before.'
      ],
      prevMonth: 'Prev month', nextMonth: 'Next month',
      showAll: 'Show all events',
      selectedDatePrefix: 'Selected date:'
    }
  };

  const DOW = {
    ja: ['月', '火', '水', '木', '金', '土', '日'],
    it: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  };

  let trainings = [], matches = [], locations = {}, opponents = {};

  // Stato navigazione e selezione
  const todayObj = new Date(Date.now() + 9 * 3600e3);
  let viewYear = todayObj.getUTCFullYear();
  let viewMonth = todayObj.getUTCMonth(); // 0-11
  let selectedDateStr = null; // "YYYY-MM-DD"

  /* ---------- Iniezione CSS dinamico per il Calendario ---------- */
  function injectStyles() {
    if (document.getElementById('yc-cal-inline-styles')) return;
    const style = document.createElement('style');
    style.id = 'yc-cal-inline-styles';
    style.textContent = `
      .yc-cal-container {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        padding: 20px;
        margin-bottom: 24px;
        box-shadow: 0 4px 18px rgba(0, 34, 74, 0.05);
      }
      .yc-cal-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .yc-cal-month-title {
        font-size: 1.2rem;
        font-weight: 800;
        color: #00224a;
        margin: 0;
      }
      .yc-cal-nav-btn {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #00224a;
        border-radius: 8px;
        padding: 6px 14px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .yc-cal-nav-btn:hover {
        background: #003c82;
        color: #ffffff;
        border-color: #003c82;
      }
      .yc-cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 6px;
      }
      .yc-cal-dow {
        text-align: center;
        font-weight: 800;
        font-size: 0.8rem;
        color: #64748b;
        padding: 8px 0;
        border-bottom: 2px solid #f1f5f9;
      }
      .yc-cal-dow.sat { color: #2563eb; }
      .yc-cal-dow.sun { color: #dc2626; }
      .yc-cal-cell {
        min-height: 52px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        padding: 6px 4px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        user-select: none;
      }
      .yc-cal-cell:hover {
        border-color: #87ceeb;
        background: #f0f9ff;
      }
      .yc-cal-cell.is-other {
        opacity: 0.3;
        background: #f1f5f9;
      }
      .yc-cal-cell.is-today {
        border: 2px solid #003c82;
        font-weight: 800;
      }
      .yc-cal-cell.is-selected {
        background: #003c82 !important;
        color: #ffffff !important;
        border-color: #003c82 !important;
        box-shadow: 0 4px 10px rgba(0, 60, 130, 0.3);
      }
      .yc-cal-cell.is-selected .yc-cal-num {
        color: #ffffff !important;
      }
      .yc-cal-num {
        font-size: 0.88rem;
        font-weight: 700;
        color: #1e293b;
      }
      .yc-cal-dots {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        align-items: center;
      }
      .yc-cal-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .yc-cal-dot-training { background: #003c82; }
      .yc-cal-dot-match { background: #dc2626; }
      .yc-cal-cell.is-selected .yc-cal-dot-training { background: #87ceeb; }
      .yc-cal-cell.is-selected .yc-cal-dot-match { background: #fca5a5; }

      .yc-cal-filter-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding: 10px 16px;
        background: #f1f5f9;
        border-radius: 8px;
        border-left: 4px solid #003c82;
      }
      .yc-cal-filter-title {
        font-size: 0.95rem;
        font-weight: 800;
        color: #00224a;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .yc-cal-reset-btn {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        color: #003c82;
        border-radius: 6px;
        padding: 4px 12px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .yc-cal-reset-btn:hover {
        background: #003c82;
        color: #ffffff;
      }
      @media (max-width: 600px) {
        .yc-cal-container { padding: 12px 8px; }
        .yc-cal-cell { min-height: 44px; padding: 4px 2px; }
        .yc-cal-num { font-size: 0.8rem; }
        .yc-cal-month-title { font-size: 1rem; }
      }
    `;
    document.head.appendChild(style);
  }

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

  /* ---------- Mappatura Dati ---------- */
  function getAllEvents() {
    const ev = [];
    trainings.forEach(t => {
      if (!t || !t.date) return;
      ev.push({ kind: 'training', id: t.id || t.date, date: t.date, time: t.time || '', end: t.end || '',
        loc: t.location_id, trial: !!t.trial_open, note: t.note, title: t.title });
    });
    matches.forEach(m => {
      if (m.status !== 'upcoming' || !m.date) return;
      ev.push({ kind: 'match', id: m.id, date: m.date, time: m.time || '', end: '', loc: m.location_id, opp: m.opponent_id });
    });
    ev.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return ev;
  }

  function locInfo(id, lang) {
    const l = locations[id];
    if (!l) return { name: id || '', url: null };
    return { name: l[lang] || l.ja || id, url: safeUrl(l.maps || l.url) };
  }

  function oppLabel(id, lang) {
    const o = opponents[id];
    return (o && o.name && (o.name[lang] || o.name.ja)) || id || '?';
  }

  /* ---------- .ics Download ---------- */
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

  /* ---------- Formattazione Mese / Data ---------- */
  function formatMonthHeader(year, month, lang) {
    const d = new Date(year, month, 1);
    if (lang === 'ja') return `${year}年 ${month + 1}月`;
    return new Intl.DateTimeFormat(LOCALE[lang] || 'ja-JP', { month: 'long', year: 'numeric' }).format(d);
  }

  function formatDateFull(dateStr, lang) {
    const d = new Date(dateStr + 'T12:00:00+09:00');
    if (isNaN(d)) return dateStr;
    return new Intl.DateTimeFormat(LOCALE[lang] || 'ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    }).format(d);
  }

  /* ---------- Render Card Evento ---------- */
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

  /* ---------- Render Widget Calendario Griglia ---------- */
  function renderCalendarWidget(events, lang) {
    const L = I[lang];
    const container = h('div', 'yc-cal-container');

    // Header Navigazione Mese
    const nav = h('div', 'yc-cal-nav');
    const prevBtn = h('button', 'yc-cal-nav-btn');
    prevBtn.append(icon('fa-chevron-left'), document.createTextNode(' ' + L.prevMonth));
    prevBtn.addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      selectedDateStr = null;
      render();
    });

    const monthTitle = h('h3', 'yc-cal-month-title', formatMonthHeader(viewYear, viewMonth, lang));

    const nextBtn = h('button', 'yc-cal-nav-btn');
    nextBtn.append(document.createTextNode(L.nextMonth + ' '), icon('fa-chevron-right'));
    nextBtn.addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      selectedDateStr = null;
      render();
    });

    nav.append(prevBtn, monthTitle, nextBtn);
    container.appendChild(nav);

    // Mappa Eventi per data YYYY-MM-DD
    const eventsByDate = {};
    events.forEach(e => {
      if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
      eventsByDate[e.date].push(e);
    });

    // Griglia Giorni della Settimana
    const grid = h('div', 'yc-cal-grid');
    const dows = DOW[lang] || DOW.ja;
    dows.forEach((d, idx) => {
      const cls = idx === 5 ? 'yc-cal-dow sat' : (idx === 6 ? 'yc-cal-dow sun' : 'yc-cal-dow');
      grid.appendChild(h('div', cls, d));
    });

    // Calcolo Celle (Inizio Lunedì)
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDow = (firstDay.getDay() + 6) % 7; // Lunedì = 0, Domenica = 6
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const todayStr = YC.todayJST();

    // 1. Giorni Mese Precedente
    for (let i = startDow - 1; i >= 0; i--) {
      const pDay = daysInPrevMonth - i;
      const cell = h('div', 'yc-cal-cell is-other');
      cell.appendChild(h('span', 'yc-cal-num', String(pDay)));
      grid.appendChild(cell);
    }

    // 2. Giorni Mese Corrente
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${viewYear}-${mStr}-${dStr}`;

      let cellCls = 'yc-cal-cell';
      if (dateKey === todayStr) cellCls += ' is-today';
      if (dateKey === selectedDateStr) cellCls += ' is-selected';

      const dayEvents = eventsByDate[dateKey] || [];
      if (dayEvents.length > 0) cellCls += ' has-event';

      const cell = h('div', cellCls);
      cell.appendChild(h('span', 'yc-cal-num', String(day)));

      if (dayEvents.length > 0) {
        const dots = h('div', 'yc-cal-dots');
        dayEvents.forEach(ev => {
          dots.appendChild(h('span', 'yc-cal-dot yc-cal-dot-' + ev.kind));
        });
        cell.appendChild(dots);
      }

      cell.addEventListener('click', () => {
        if (selectedDateStr === dateKey) {
          selectedDateStr = null; // Deseleziona
        } else {
          selectedDateStr = dateKey; // Seleziona
        }
        render();
      });

      grid.appendChild(cell);
    }

    // 3. Giorni Mese Successivo per completare la griglia (35 o 42 celle)
    const totalCells = startDow + daysInMonth;
    const nextPadding = (7 - (totalCells % 7)) % 7;
    for (let n = 1; n <= nextPadding; n++) {
      const cell = h('div', 'yc-cal-cell is-other');
      cell.appendChild(h('span', 'yc-cal-num', String(n)));
      grid.appendChild(cell);
    }

    container.appendChild(grid);
    return container;
  }

  /* ---------- Render Principale ---------- */
  function render() {
    const lang = YC.lang();
    const L = I[lang] || I.ja;
    ROOT.textContent = '';

    const head = h('div', 'cal-head');
    head.append(h('h2', 'section-title', L.title), h('p', 'cal-lead', L.lead));
    ROOT.appendChild(head);

    const allEvents = getAllEvents();

    // Inserisci Widget Calendario
    ROOT.appendChild(renderCalendarWidget(allEvents, lang));

    // Filtro Lista Eventi
    let filteredEvents = [];
    const mPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

    if (selectedDateStr) {
      filteredEvents = allEvents.filter(e => e.date === selectedDateStr);
    } else {
      // Mostra tutti gli eventi del mese visualizzato
      filteredEvents = allEvents.filter(e => e.date.startsWith(mPrefix));
    }

    // Barra stato filtro (se una data è selezionata)
    if (selectedDateStr) {
      const filterBar = h('div', 'yc-cal-filter-bar');
      const title = h('div', 'yc-cal-filter-title');
      title.append(icon('fa-filter'), document.createTextNode(` ${L.selectedDatePrefix} ${formatDateFull(selectedDateStr, lang)}`));

      const resetBtn = h('button', 'yc-cal-reset-btn', L.showAll);
      resetBtn.addEventListener('click', () => {
        selectedDateStr = null;
        render();
      });

      filterBar.append(title, resetBtn);
      ROOT.appendChild(filterBar);
    }

    // Lista Eventi
    const list = h('div', 'cal-list');
    if (filteredEvents.length) {
      filteredEvents.forEach(e => list.appendChild(card(e, lang)));
    } else {
      const emptyTxt = selectedDateStr ? L.emptyDate : L.emptyMonth;
      list.appendChild(h('p', 'cal-empty', emptyTxt));
    }
    ROOT.appendChild(list);

    // Feed / Abbonamento Calendario Completo
    const feed = location.host + '/calendar.ics';
    const sub = h('div', 'cal-sub');
    sub.appendChild(h('span', 'cal-sub-label', L.subAll));
    const a1 = h('a', 'cal-sub-link', L.subApple); a1.href = 'webcal://' + feed;
    const a2 = h('a', 'cal-sub-link', L.subGoogle);
    a2.href = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent('webcal://' + feed);
    a2.target = '_blank'; a2.rel = 'noopener noreferrer';
    sub.append(a1, a2);
    ROOT.appendChild(sub);

    // Box Informativo Prova
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

  injectStyles();

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
