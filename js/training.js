/* js/training.js — Sezione "Allenamenti e calendario" con griglia mensile, dettagli completi e selezione fino a 3 date prova.
   Dati: trainings.json, matches.json, locations.json, opponents.json.
   Richiede common.js e site-extras.css */
(function () {
  'use strict';
  const ROOT = document.getElementById('trainingRoot');
  if (!ROOT || !window.YC) return;

  // Inietta gli stili per garantire la visibilità del pulsante di selezione data
  if (!document.getElementById('yc-training-custom-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'yc-training-custom-styles';
    styleEl.textContent = `
      .yc-cal-select-date-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        margin-top: 12px !important;
        padding: 9px 18px !important;
        background-color: #003c82 !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 700 !important;
        font-size: 0.88rem !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 2px 6px rgba(0, 60, 130, 0.2) !important;
        width: auto !important;
      }
      .yc-cal-select-date-btn:hover {
        background-color: #00224a !important;
        transform: translateY(-1px) !important;
      }
      .yc-cal-select-date-btn.picked {
        background-color: #10b981 !important;
        color: #ffffff !important;
        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3) !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const LOCALE = { ja: 'ja-JP', it: 'it-IT', en: 'en-US' };

  const I = {
    ja: {
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
      selectedDatePrefix: '選択した日:',
      selectTrialDate: '体験希望日に選ぶ',
      selectedTrialDatesTitle: '選択中の体験希望日 (最大3日)',
      maxDatesReached: '体験希望日は最大3日まで選択できます。',
      proceedToContact: '選んだ日程で体験を申し込む',
      clearDates: '選択をリセット'
    },
    it: {
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
      selectedDatePrefix: 'Data selezionata:',
      selectTrialDate: 'Seleziona per la prova',
      selectedTrialDatesTitle: 'Date di prova selezionate (max 3)',
      maxDatesReached: 'Puoi selezionare un massimo di 3 date per la prova.',
      proceedToContact: 'Procedi con la richiesta per le date scelte',
      clearDates: 'Resetta selezioni'
    },
    en: {
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
      selectedDatePrefix: 'Selected date:',
      selectTrialDate: 'Select for trial',
      selectedTrialDatesTitle: 'Selected trial dates (max 3)',
      maxDatesReached: 'You can select up to 3 dates for trials.',
      proceedToContact: 'Proceed with selected dates',
      clearDates: 'Reset selections'
    }
  };

  const DOW = {
    ja: ['月', '火', '水', '木', '金', '土', '日'],
    it: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  };

  let trainings = [], matches = [], locations = {}, opponents = {};

  const todayObj = new Date(Date.now() + 9 * 3600e3);
  let viewYear = todayObj.getUTCFullYear();
  let viewMonth = todayObj.getUTCMonth();
  let selectedDateStr = null;
  let selectedTrialDates = [];

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name) { const i = h('i', 'fas ' + name); i.setAttribute('aria-hidden', 'true'); return i; }

  // Helper per estrarre stringhe da oggetti multilingua
  function str(val, lang) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val[lang] || val.ja || val.it || val.en || '';
    }
    return String(val);
  }

  function getAllEvents(lang) {
    const ev = [];
    trainings.forEach(t => {
      if (!t || !t.date) return;
      ev.push({ 
        kind: 'training', 
        id: t.id || t.date, 
        date: t.date, 
        time: t.time || '', 
        end: t.end || '',
        loc: t.location_id, 
        trial: !!t.trial_open, 
        note: str(t.note || t.description, lang), 
        title: str(t.title || t.name, lang) 
      });
    });
    matches.forEach(m => {
      if (m.status !== 'upcoming' || !m.date) return;
      const oppObj = opponents[m.opponent_id] || {};
      const oppName = str(oppObj.name || m.opponent_name, lang) || 'Opponent';
      ev.push({ 
        kind: 'match', 
        id: m.id, 
        date: m.date, 
        time: m.time || '', 
        end: m.end || '', 
        loc: m.location_id, 
        opp: m.opponent_id,
        title: `vs ${oppName}`,
        note: str(m.note || m.description, lang)
      });
    });
    ev.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return ev;
  }

  function formatMonthHeader(year, month, lang) {
    const d = new Date(year, month, 1);
    if (lang === 'ja') return `${year}年 ${month + 1}月`;
    return new Intl.DateTimeFormat(LOCALE[lang] || 'ja-JP', { month: 'long', year: 'numeric' }).format(d);
  }

  function renderCalendarWidget(events, lang) {
    const L = I[lang];
    const container = h('div', 'yc-cal-container');

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

    const eventsByDate = {};
    events.forEach(e => {
      if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
      eventsByDate[e.date].push(e);
    });

    const grid = h('div', 'yc-cal-grid');
    const dows = DOW[lang] || DOW.ja;
    dows.forEach((d, idx) => {
      const cls = idx === 5 ? 'yc-cal-dow sat' : (idx === 6 ? 'yc-cal-dow sun' : 'yc-cal-dow');
      grid.appendChild(h('div', cls, d));
    });

    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDow = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const todayStr = YC.todayJST();

    for (let i = startDow - 1; i >= 0; i--) {
      const pDay = daysInPrevMonth - i;
      const cell = h('div', 'yc-cal-cell is-other');
      cell.appendChild(h('span', 'yc-cal-num', String(pDay)));
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${viewYear}-${mStr}-${dStr}`;

      let cellCls = 'yc-cal-cell';
      if (dateKey === todayStr) cellCls += ' is-today';
      if (dateKey === selectedDateStr) cellCls += ' is-selected';
      if (selectedTrialDates.includes(dateKey)) cellCls += ' is-trial-picked';

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
        selectedDateStr = (selectedDateStr === dateKey) ? null : dateKey;
        render();
      });

      grid.appendChild(cell);
    }

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

  function renderSelectedDateDetails(events, lang) {
    if (!selectedDateStr) return null;
    const L = I[lang];
    const dayEvents = events.filter(e => e.date === selectedDateStr);

    const wrapper = h('div', 'yc-cal-details-box');
    const header = h('div', 'yc-cal-details-header');
    header.appendChild(h('h4', null, `${L.selectedDatePrefix} ${selectedDateStr}`));
    wrapper.appendChild(header);

    if (dayEvents.length === 0) {
      wrapper.appendChild(h('p', 'yc-cal-empty-msg', L.emptyDate));
      return wrapper;
    }

    const list = h('div', 'yc-cal-details-list');
    dayEvents.forEach(ev => {
      const card = h('div', `yc-cal-event-card ${ev.kind}`);
      
      const badgeContainer = h('div', 'cal-badges');
      const kindBadge = h('span', 'cal-kind', ev.kind === 'training' ? L.training : L.match);
      badgeContainer.appendChild(kindBadge);
      if (ev.trial) {
        badgeContainer.appendChild(h('span', 'cal-trial', L.trialOk));
      }
      card.appendChild(badgeContainer);

      const titleText = ev.title || (ev.kind === 'training' ? L.training : L.match);
      card.appendChild(h('div', 'cal-title', titleText));

      const meta = h('div', 'cal-meta');
      if (ev.time) {
        meta.append(icon('fa-clock'), document.createTextNode(` ${ev.time}${ev.end ? ' - ' + ev.end : ''}`));
      }
      
      if (ev.kind === 'match' && ev.loc && locations[ev.loc]) {
        const locObj = locations[ev.loc];
        const locName = str(locObj.name, lang) || ev.loc;
        const locSpan = h('span');
        locSpan.appendChild(icon('fa-map-marker-alt'));
        
        if (locObj.url) {
          const locLink = h('a', null, ` ${locName}`);
          locLink.href = locObj.url;
          locLink.target = '_blank';
          locLink.rel = 'noopener noreferrer';
          locSpan.appendChild(locLink);
        } else {
          locSpan.appendChild(document.createTextNode(` ${locName}`));
        }
        meta.appendChild(locSpan);
      }
      
      card.appendChild(meta);

      if (ev.note) {
        card.appendChild(h('p', 'cal-note', ev.note));
      }

      const selectBtn = h('button', 'yc-cal-select-date-btn');
      const isAlreadyPicked = selectedTrialDates.includes(ev.date);
      selectBtn.innerHTML = `<i class="fas ${isAlreadyPicked ? 'fa-check-circle' : 'fa-plus-circle'}"></i> ${isAlreadyPicked ? (lang === 'ja' ? '選択済み' : (lang === 'it' ? 'Data selezionata' : 'Selected')) : L.selectTrialDate}`;
      
      if (isAlreadyPicked) {
        selectBtn.classList.add('picked');
      }

      selectBtn.addEventListener('click', () => {
        if (selectedTrialDates.includes(ev.date)) {
          selectedTrialDates = selectedTrialDates.filter(d => d !== ev.date);
        } else {
          if (selectedTrialDates.length >= 3) {
            alert(L.maxDatesReached);
            return;
          }
          selectedTrialDates.push(ev.date);
        }
        render();
      });

      card.appendChild(selectBtn);
      list.appendChild(card);
    });

    wrapper.appendChild(list);
    return wrapper;
  }

  function renderTrialSelectionBar(lang) {
    if (selectedTrialDates.length === 0) return null;
    const L = I[lang];
    const bar = h('div', 'yc-trial-selection-bar');

    const title = h('div', 'yc-trial-bar-title');
    title.innerHTML = `<i class="fas fa-clipboard-check"></i> <strong>${L.selectedTrialDatesTitle}</strong>`;
    bar.appendChild(title);

    const badges = h('div', 'yc-trial-badges');
    selectedTrialDates.forEach((d, idx) => {
      const badge = h('span', 'yc-trial-badge', `${idx + 1}. ${d}`);
      const removeBtn = h('button', 'yc-trial-remove-btn');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.addEventListener('click', () => {
        selectedTrialDates = selectedTrialDates.filter(item => item !== d);
        render();
      });
      badge.appendChild(removeBtn);
      badges.appendChild(badge);
    });
    bar.appendChild(badges);

    const actions = h('div', 'yc-trial-bar-actions');
    const cta = h('a', 'recruitment-btn', L.proceedToContact);
    cta.href = `contact.html?type=trial&dates=${encodeURIComponent(selectedTrialDates.join(','))}`;
    cta.prepend(icon('fa-paper-plane'));
    actions.appendChild(cta);

    const resetBtn = h('button', 'yc-trial-reset-btn', L.clearDates);
    resetBtn.addEventListener('click', () => {
      selectedTrialDates = [];
      render();
    });
    actions.appendChild(resetBtn);

    bar.appendChild(actions);
    return bar;
  }

  function render() {
    const lang = YC.lang();
    const L = I[lang] || I.ja;
    ROOT.textContent = '';

    const allEvents = getAllEvents(lang);
    
    ROOT.appendChild(renderCalendarWidget(allEvents, lang));

    const detailsBox = renderSelectedDateDetails(allEvents, lang);
    if (detailsBox) ROOT.appendChild(detailsBox);

    const trialBar = renderTrialSelectionBar(lang);
    if (trialBar) ROOT.appendChild(trialBar);

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
