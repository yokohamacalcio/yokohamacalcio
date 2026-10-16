/* js/training.js — Sezione "Allenamenti e calendario" con griglia mensile, dettagli completi e selezione fino a 3 date prova.
   Dati: trainings.json, matches.json, locations.json, opponents.json.
   Richiede common.js e site-extras.css */
(function () {
  'use strict';
  const ROOT = document.getElementById('trainingRoot');
  if (!ROOT || !window.YC) return;

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

  function getAllEvents() {
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
        note: t.note || t.description || '', 
        title: t.title || t.name || '' 
      });
    });
    matches.forEach(m => {
      if (m.status !== 'upcoming' || !m.date) return;
      const oppObj = opponents[m.opponent_id] || {};
      const oppName = oppObj.name || m.opponent_name || 'Vs Opponent';
      ev.push({ 
        kind: 'match', 
        id: m.id, 
        date: m.date, 
        time: m.time || '', 
        end: m.end || '', 
        loc: m.location_id, 
        opp: m.opponent_id,
        title: `vs ${oppName}`,
        note: m.note || m.description || ''
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
      const dStr = String(day).padStart(
