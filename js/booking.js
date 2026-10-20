/* js/booking.js — calendario mensile degli allenamenti con selezione di 1–3 date (prove).
   Richiede common.js + data.js. Markup: <div id="bookingRoot"></div>
   Emette l'evento  yc:booking  con detail = { items:[training…], noDate:boolean }  */
(function () {
  'use strict';
  const root = document.getElementById('bookingRoot');
  if (!root || !window.YC || !YC.data) return;
  const MAX = 3, esc = YC.escapeHtml, t = k => YC.t(k);
  const LOC = { ja: 'ja-JP', it: 'it-IT', en: 'en-US' };

  YC.register({
    ja: { 'b.title': '練習日程カレンダー', 'b.lead': '体験参加を希望する練習日を1〜3日選んでください（入部前に3回の体験参加をお願いしています）。', 'b.prev': '前の月', 'b.next': '次の月', 'b.legend_av': '体験可', 'b.legend_sel': '選択中', 'b.legend_closed': 'チーム練習のみ', 'b.select': '希望日に追加', 'b.selected': '選択済み（解除）', 'b.max': '選べるのは最大3日までです。', 'b.counter': '選択中 {n} / 3', 'b.none_sel': 'まだ日程が選ばれていません。', 'b.no_sessions': '現在、公開中の練習日程はありません。お問い合わせフォームのメッセージ欄にご希望をご記入ください。', 'b.meet': '集合', 'b.trial_open': '体験参加OK', 'b.team_only': 'チーム練習（体験不可）', 'b.no_date_ok': '都合の合う日がない／日程は後で相談したい', 'b.remove': '削除', 'b.pick_day': '日付をタップすると詳細が表示されます。' },
    it: { 'b.title': 'Calendario allenamenti', 'b.lead': 'Scegli da 1 a 3 date per le tue prove (prima dell\'iscrizione sono richieste 3 prove).', 'b.prev': 'Mese precedente', 'b.next': 'Mese successivo', 'b.legend_av': 'Prova possibile', 'b.legend_sel': 'Selezionata', 'b.legend_closed': 'Solo squadra', 'b.select': 'Aggiungi alle mie date', 'b.selected': 'Selezionata (rimuovi)', 'b.max': 'Puoi selezionare al massimo 3 date.', 'b.counter': 'Selezionate {n} / 3', 'b.none_sel': 'Nessuna data selezionata.', 'b.no_sessions': 'Al momento non ci sono allenamenti pubblicati. Indica le tue disponibilità nel messaggio del modulo.', 'b.meet': 'Ritrovo', 'b.trial_open': 'Prove aperte', 'b.team_only': 'Allenamento di squadra (no prove)', 'b.no_date_ok': 'Nessuna data va bene / ne parliamo dopo', 'b.remove': 'Rimuovi', 'b.pick_day': 'Tocca una data per vedere i dettagli.' },
    en: { 'b.title': 'Training calendar', 'b.lead': 'Pick 1 to 3 training dates for your trials (3 trials are required before joining).', 'b.prev': 'Previous month', 'b.next': 'Next month', 'b.legend_av': 'Trial open', 'b.legend_sel': 'Selected', 'b.legend_closed': 'Team only', 'b.select': 'Add to my dates', 'b.selected': 'Selected (remove)', 'b.max': 'You can select up to 3 dates.', 'b.counter': 'Selected {n} / 3', 'b.none_sel': 'No dates selected yet.', 'b.no_sessions': 'No training sessions are published right now. Please tell us your availability in the form message.', 'b.meet': 'Meet-up', 'b.trial_open': 'Trials open', 'b.team_only': 'Team session (no trials)', 'b.no_date_ok': 'None of these dates work / let\'s talk later', 'b.remove': 'Remove', 'b.pick_day': 'Tap a date to see the details.' }
  });

  let sessions = [], locs = {}, sel = new Set(), month = '', focus = '', noDate = false, msg = '';
  const byId = id => sessions.find(s => s.id === id);
  const selectable = s => s.trial_open !== false;
  const pad = n => String(n).padStart(2, '0');
  const thisMonth = () => YC.todayJST().slice(0, 7);
  const shift = (ym, d) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + d, 1)); return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1); };

  function describe(s, lang) {
    const l = locs[s.location_id] || {}, venue = s.venue || l[lang] || l.ja || s.location_id || '';
    return { date: s.date, time: s.start ? (s.end ? s.start + ' - ' + s.end : s.start) : '', venue, meet: s.meet_time || '', surface: s.surface || '', url: s.url || l.maps || '' };
  }
  const items = () => [...sel].map(byId).filter(Boolean).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  function emit() { document.dispatchEvent(new CustomEvent('yc:booking', { detail: { items: items(), noDate } })); }

  function toggle(id) {
    const s = byId(id); if (!s || !selectable(s)) return;
    if (sel.has(id)) { sel.delete(id); msg = ''; }
    else if (sel.size >= MAX) { msg = t('b.max'); }
    else { sel.add(id); msg = ''; noDate = false; }
    render(); emit();
  }

  function sessionCard(s) {
    const lang = YC.lang(), d = describe(s, lang), on = sel.has(s.id), ok = selectable(s);
    const note = s.note && (s.note[lang] || s.note.ja || s.note.it || s.note.en);
    const venue = d.venue ? (d.url && /^https?:\/\//.test(d.url) ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.venue)} <i class="fas fa-external-link-alt"></i></a>` : esc(d.venue)) : '';
    return `<div class="bk-session ${on ? 'on' : ''}">
      <div class="bk-s-top"><b>${esc(YC.data.fmtDate(s.date, lang))}</b><span class="bk-tag ${ok ? 'ok' : 'no'}">${ok ? t('b.trial_open') : t('b.team_only')}</span></div>
      <div class="bk-s-meta">${d.time ? `<span><i class="far fa-clock"></i> ${esc(d.time)}</span>` : ''}${d.meet ? `<span><i class="fas fa-flag"></i> ${t('b.meet')} ${esc(d.meet)}</span>` : ''}${venue ? `<span><i class="fas fa-map-marker-alt"></i> ${venue}</span>` : ''}${d.surface ? `<span><i class="fas fa-layer-group"></i> ${esc(d.surface)}</span>` : ''}</div>
      ${note ? `<p class="bk-note">${esc(note)}</p>` : ''}
      ${ok ? `<button type="button" class="bk-pick ${on ? 'on' : ''}" data-act="toggle" data-id="${esc(s.id)}"><i class="fas ${on ? 'fa-check-circle' : 'fa-plus-circle'}"></i> ${on ? t('b.selected') : t('b.select')}</button>` : ''}
    </div>`;
  }

  function render() {
    if (!sessions.length) { root.innerHTML = `<p class="bk-empty">${t('b.no_sessions')}</p>`; return; }
    const lang = YC.lang(), [y, m] = month.split('-').map(Number), weekStart = lang === 'it' ? 1 : 0;
    const byDate = {}; sessions.forEach(s => (byDate[s.date] = byDate[s.date] || []).push(s));
    const today = YC.todayJST(), min = thisMonth(), last = sessions[sessions.length - 1].date.slice(0, 7), max = last < min ? min : last;
    const fmt = (o, d) => new Intl.DateTimeFormat(LOC[lang], Object.assign({ timeZone: 'UTC' }, o)).format(d);
    const head = Array.from({ length: 7 }, (_, i) => `<div class="bk-wd">${esc(fmt({ weekday: 'short' }, new Date(Date.UTC(2023, 0, 1 + (i + weekStart) % 7))))}</div>`).join('');
    const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() - weekStart + 7) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let cells = '<div></div>'.repeat(offset);
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${pad(m)}-${pad(d)}`, list = byDate[key] || [], has = list.length > 0;
      const isSel = list.some(s => sel.has(s.id)), open = list.some(selectable);
      cells += `<button type="button" class="bk-day ${has ? (open ? 'has' : 'closed') : ''} ${isSel ? 'sel' : ''} ${key === today ? 'today' : ''} ${key === focus ? 'focus' : ''}" ${has ? `data-act="day" data-date="${key}"` : 'disabled'} aria-label="${key}" ${has ? `aria-pressed="${isSel}"` : ''}>${d}${has ? '<i class="bk-dot"></i>' : ''}</button>`;
    }
    const panel = focus && byDate[focus] ? byDate[focus].map(sessionCard).join('') : `<p class="bk-hint">${t('b.pick_day')}</p>`;
    const chosen = items();
    root.innerHTML = `<div class="bk ${noDate ? 'bk-off' : ''}">
      <div class="bk-nav"><button type="button" class="bk-arrow" data-act="prev" aria-label="${t('b.prev')}" ${month <= min ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button><b class="bk-month">${esc(fmt({ year: 'numeric', month: 'long' }, new Date(Date.UTC(y, m - 1, 1))))}</b><button type="button" class="bk-arrow" data-act="next" aria-label="${t('b.next')}" ${month >= max ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button></div>
      <div class="bk-grid">${head}${cells}</div>
      <div class="bk-legend"><span><i class="bk-dot has"></i> ${t('b.legend_av')}</span><span><i class="bk-dot sel"></i> ${t('b.legend_sel')}</span><span><i class="bk-dot closed"></i> ${t('b.legend_closed')}</span></div>
      <div class="bk-panel">${panel}</div>
      ${msg ? `<p class="bk-msg" role="alert"><i class="fas fa-exclamation-triangle"></i> ${esc(msg)}</p>` : ''}
      <div class="bk-chosen"><b>${t('b.counter').replace('{n}', chosen.length)}</b>${chosen.length ? `<div class="bk-chips">${chosen.map(s => { const d = describe(s, lang); return `<span class="bk-chip">${esc(YC.data.fmtDate(s.date, lang, { year: undefined, weekday: 'short' }))} ${esc(d.time.split(' - ')[0])}<button type="button" data-act="remove" data-id="${esc(s.id)}" aria-label="${t('b.remove')}"><i class="fas fa-times"></i></button></span>`; }).join('')}</div>` : `<span class="bk-hint">${t('b.none_sel')}</span>`}</div>
    </div>
    <label class="bk-nodate"><input type="checkbox" id="bkNoDate" ${noDate ? 'checked' : ''}> <span>${t('b.no_date_ok')}</span></label>`;
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'prev') { month = shift(month, -1); focus = ''; render(); }
    else if (a === 'next') { month = shift(month, 1); focus = ''; render(); }
    else if (a === 'day') { focus = b.dataset.date; const list = sessions.filter(s => s.date === focus && selectable(s)); if (list.length === 1 && !noDate) { toggle(list[0].id); } else render(); }
    else if (a === 'toggle') toggle(b.dataset.id);
    else if (a === 'remove') { sel.delete(b.dataset.id); msg = ''; render(); emit(); }
  });
  root.addEventListener('change', e => {
    if (e.target.id !== 'bkNoDate') return;
    noDate = e.target.checked; if (noDate) { sel.clear(); msg = ''; } render(); emit();
  });
  document.addEventListener('yc:langchange', () => sessions.length && render());

  window.YCBooking = {
    clear() { sel.clear(); noDate = false; msg = ''; render(); emit(); },
    hasSelectable: () => sessions.some(selectable),
    describe, focusCalendar() { const el = document.getElementById('training'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  YC.data.load(['trainings', 'locations']).then(d => {
    locs = d.locations || {};
    sessions = YC.data.upcomingTrainings(d.trainings);
    month = sessions.length ? (sessions[0].date.slice(0, 7) < thisMonth() ? thisMonth() : sessions[0].date.slice(0, 7)) : thisMonth();
    const first = sessions.find(selectable); if (first && first.date.slice(0, 7) === month) focus = first.date;
    render(); emit();
  });
})();
