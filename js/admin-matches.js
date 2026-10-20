/* js/admin-matches.js — editor partite + formazione + statistiche. Richiede admin-core.js (window.AD). */
'use strict';
(function () {
  const { State, $, $$, esc, cleanStr, isJa, todayJST, t, toast, confirmBox, promptBox, save, hooks, actions } = AD;
  const D = State.data;
  AD.addDict({
    it: { 'm.selectLabel': 'Seleziona partita da modificare', 'm.load': 'Carica', 'm.byId': 'Oppure cerca per ID', 'm.new': 'Nuova partita', 'm.dup': 'Duplica corrente', 'm.del': 'Elimina corrente', 'm.info': 'Informazioni partita', 'm.status': 'Stato', 'm.past': 'Finita (past)', 'm.upcoming': 'In programma (upcoming)', 'm.time': 'Orario K.O.', 'm.competition': 'Competizione', 'm.typeLabel': 'Etichetta tipo', 'm.opponent': 'Avversario', 'm.venue': 'Campo', 'm.homeAway': 'Casa / Trasferta', 'm.home': 'Casa (noi vs loro)', 'm.away': 'Trasferta (loro vs noi)', 'm.score': 'Risultato (sempre nostri - loro)', 'm.events': 'Eventi e prestazioni', 'm.scorers': 'Marcatori', 'm.assists': 'Assistman', 'm.gks': 'Portieri e gol subiti', 'm.yellows': 'Gialli', 'm.reds': 'Rossi', 'm.add': 'Aggiungi', 'm.tactics': 'Assetto tattico e convocati', 'm.formation': 'Modulo', 'm.mister': 'Suggerimento Mister', 'm.misterSub': 'Basato sull\'uso nei ruoli (stats.json)', 'm.suggest': 'Suggerisci formazione', 'm.starters': 'Titolari', 'm.clear': 'Cancella', 'm.bench': 'Panchina (10)', 'm.addTrialist': '+ Giocatore in prova', 'm.trialists': 'In prova (solo questo match):', 'm.saveMatch': 'Salva partita e aggiorna stats + caps', 'm.lineTitle': 'Convocazioni LINE', 'm.lineSub': 'Messaggio pronto da incollare nel gruppo LINE.', 'm.lineGen': 'Genera testo', 'm.lineCopy': 'Copia', 'm.goals': 'Gol', 'm.assistN': 'Assist', 'm.conceded': 'Subiti', 'm.minute': 'min', 'm.trialPrompt': 'Nome del giocatore in prova:', 'm.noId': 'Specifica un ID (usa «Nuova partita»).', 'm.notFound': 'Partita non trovata', 'm.pickFirst': 'Seleziona prima una partita.', 'm.deleteQ': 'Eliminare definitivamente la partita', 'm.badScore': 'Risultato non valido (es. 2 - 1).', 'm.goalsMismatch': 'Attenzione: i marcatori ({s}) non corrispondono ai nostri gol ({g}).', 'm.notInSquad': 'non in rosa', 'm.noStats': 'Nessun dato statistico: salva qualche partita.', 'm.suggested': 'Formazione suggerita', 'm.noneOpt': '— nessuno —', 'm.sub': 'Subentrato', 'm.bn': 'Panchina', 'm.copied': 'Testo copiato', 'm.genFirst': 'Genera prima il testo.', 'm.recalcDone': 'stats.json e caps aggiornati', 'm.dupDone': 'Duplicata: aggiorna data e avversario.' },
    ja: { 'm.selectLabel': '編集する試合を選択', 'm.load': '読込', 'm.byId': 'ID で検索', 'm.new': '新規試合', 'm.dup': '複製', 'm.del': '削除', 'm.info': '試合情報', 'm.status': 'ステータス', 'm.past': '終了', 'm.upcoming': '予定', 'm.time': 'K.O.', 'm.competition': '大会', 'm.typeLabel': '種別ラベル', 'm.opponent': '対戦相手', 'm.venue': '会場', 'm.homeAway': 'ホーム/アウェイ', 'm.home': 'ホーム', 'm.away': 'アウェイ', 'm.score': 'スコア（常に自-相手）', 'm.events': 'イベント', 'm.scorers': '得点者', 'm.assists': 'アシスト', 'm.gks': 'GK・失点', 'm.yellows': '警告', 'm.reds': '退場', 'm.add': '追加', 'm.tactics': 'フォーメーション', 'm.formation': '布陣', 'm.mister': '監督サジェスト', 'm.misterSub': 'ポジション使用率に基づく', 'm.suggest': '布陣を提案', 'm.starters': '先発', 'm.clear': 'クリア', 'm.bench': '控え (10)', 'm.addTrialist': '+ 練習生を追加', 'm.trialists': '練習生（この試合のみ）:', 'm.saveMatch': '試合を保存してスタッツ・出場数を更新', 'm.lineTitle': 'LINE招集文', 'm.lineSub': 'LINEにそのまま貼れる案内文を生成します。', 'm.lineGen': '生成', 'm.lineCopy': 'コピー', 'm.goals': '得点', 'm.assistN': 'アシスト', 'm.conceded': '失点', 'm.minute': '分', 'm.trialPrompt': '練習生の名前:', 'm.noId': 'IDを指定してください（「新規試合」）。', 'm.notFound': '試合が見つかりません', 'm.pickFirst': '先に試合を選択してください。', 'm.deleteQ': '次の試合を完全に削除しますか', 'm.badScore': 'スコアが不正です（例 2 - 1）。', 'm.goalsMismatch': '注意: 得点者 ({s}) と自チーム得点 ({g}) が一致しません。', 'm.notInSquad': '名簿外', 'm.noStats': 'スタッツがありません。', 'm.suggested': '布陣を提案しました', 'm.noneOpt': '— なし —', 'm.sub': '途中出場', 'm.bn': '控え', 'm.copied': 'コピーしました', 'm.genFirst': '先に生成してください。', 'm.recalcDone': 'stats.json と caps を更新しました', 'm.dupDone': '複製しました。日付と相手を更新してください。' },
    en: { 'm.selectLabel': 'Select match to edit', 'm.load': 'Load', 'm.byId': 'Or search by ID', 'm.new': 'New match', 'm.dup': 'Duplicate current', 'm.del': 'Delete current', 'm.info': 'Match information', 'm.status': 'Status', 'm.past': 'Finished (past)', 'm.upcoming': 'Scheduled (upcoming)', 'm.time': 'Kick-off', 'm.competition': 'Competition', 'm.typeLabel': 'Type label', 'm.opponent': 'Opponent', 'm.venue': 'Venue', 'm.homeAway': 'Home / Away', 'm.home': 'Home (us vs them)', 'm.away': 'Away (them vs us)', 'm.score': 'Score (always us - them)', 'm.events': 'Events & performance', 'm.scorers': 'Scorers', 'm.assists': 'Assists', 'm.gks': 'Goalkeepers & conceded', 'm.yellows': 'Yellows', 'm.reds': 'Reds', 'm.add': 'Add', 'm.tactics': 'Tactics & squad', 'm.formation': 'Formation', 'm.mister': 'Manager suggestion', 'm.misterSub': 'Based on role usage (stats.json)', 'm.suggest': 'Suggest lineup', 'm.starters': 'Starting XI', 'm.clear': 'Clear', 'm.bench': 'Bench (10)', 'm.addTrialist': '+ Add trialist', 'm.trialists': 'Trialists (this match only):', 'm.saveMatch': 'Save match & update stats + caps', 'm.lineTitle': 'LINE announcement', 'm.lineSub': 'Ready-to-paste message for the LINE group.', 'm.lineGen': 'Generate', 'm.lineCopy': 'Copy', 'm.goals': 'Goals', 'm.assistN': 'Assists', 'm.conceded': 'Conceded', 'm.minute': 'min', 'm.trialPrompt': 'Trialist name:', 'm.noId': 'Specify an ID (use “New match”).', 'm.notFound': 'Match not found', 'm.pickFirst': 'Select a match first.', 'm.deleteQ': 'Permanently delete match', 'm.badScore': 'Invalid score (e.g. 2 - 1).', 'm.goalsMismatch': 'Note: scorers ({s}) do not match our goals ({g}).', 'm.notInSquad': 'not in squad', 'm.noStats': 'No stats yet: save some matches.', 'm.suggested': 'Lineup suggested', 'm.noneOpt': '— none —', 'm.sub': 'Subbed in', 'm.bn': 'Bench', 'm.copied': 'Text copied', 'm.genFirst': 'Generate the text first.', 'm.recalcDone': 'stats.json and caps updated', 'm.dupDone': 'Duplicated: update date and opponent.' }
  });

  const FORM = {
    '4-4-2': { GK: [50, 92], LB: [15, 75], 'CB-L': [38, 78], 'CB-R': [62, 78], RB: [85, 75], LM: [12, 52], 'CM-L': [38, 55], 'CM-R': [62, 55], RM: [88, 52], 'FW-L': [35, 22], 'FW-R': [65, 22] },
    '4-3-3': { GK: [50, 92], LB: [15, 75], 'CB-L': [38, 78], 'CB-R': [62, 78], RB: [85, 75], DM: [50, 60], 'CM-L': [28, 52], 'CM-R': [72, 52], LW: [20, 25], ST: [50, 18], RW: [80, 25] },
    '4-2-3-1': { GK: [50, 92], LB: [15, 75], 'CB-L': [38, 78], 'CB-R': [62, 78], RB: [85, 75], 'DM-L': [35, 62], 'DM-R': [65, 62], 'AM-L': [20, 42], 'AM-C': [50, 42], 'AM-R': [80, 42], ST: [50, 18] },
    '3-5-2': { GK: [50, 92], 'CB-L': [25, 78], 'CB-C': [50, 80], 'CB-R': [75, 78], LWB: [10, 55], 'CM-L': [32, 55], 'CM-C': [50, 58], 'CM-R': [68, 55], RWB: [90, 55], 'FW-L': [35, 22], 'FW-R': [65, 22] },
    '3-4-3': { GK: [50, 92], 'CB-L': [25, 78], 'CB-C': [50, 80], 'CB-R': [75, 78], LM: [12, 55], 'CM-L': [38, 55], 'CM-R': [62, 55], RM: [88, 55], LW: [20, 25], ST: [50, 18], RW: [80, 25] },
    '5-3-2': { GK: [50, 92], LWB: [8, 72], 'CB-L': [28, 78], 'CB-C': [50, 80], 'CB-R': [72, 78], RWB: [92, 72], 'CM-L': [28, 52], 'CM-C': [50, 55], 'CM-R': [72, 52], 'FW-L': [35, 22], 'FW-R': [65, 22] },
    '4-1-4-1': { GK: [50, 92], LB: [15, 75], 'CB-L': [38, 78], 'CB-R': [62, 78], RB: [85, 75], DM: [50, 62], LM: [12, 45], 'CM-L': [38, 48], 'CM-R': [62, 48], RM: [88, 45], ST: [50, 18] }
  };
  const MACRO = { GK: 'GK', LB: 'DEF', LWB: 'DEF', 'CB-L': 'DEF', 'CB-C': 'DEF', 'CB-R': 'DEF', RB: 'DEF', RWB: 'DEF', DM: 'MID', 'DM-L': 'MID', 'DM-R': 'MID', 'CM-L': 'MID', 'CM-C': 'MID', 'CM-R': 'MID', LM: 'MID', RM: 'MID', 'AM-L': 'ATT_MID', 'AM-C': 'ATT_MID', 'AM-R': 'ATT_MID', LW: 'ATT', 'FW-L': 'ATT', ST: 'ATT', 'FW-R': 'ATT', RW: 'ATT' };
  const SEP = /[,、]/;
  let trialists = [], dirty = false, currentId = '', autosave = null;
  AD.isDirty = () => dirty;
  const markDirty = () => { dirty = true; };

  /* ---------- parsing coerente con il sito ("Nome x2 (23')", "Portiere(3)") ---------- */
  function parseList(text, gk) {
    if (!text || Array.isArray(text) && !text.length) return [];
    const items = Array.isArray(text) ? text : String(text).split(SEP);
    return items.map(x => String(x).trim()).filter(x => x && x !== 'なし' && x !== 'Nessuno').map(s => {
      if (gk) { const m = s.match(/^(.+?)\s*[(（]\s*(\d+)\s*[)）]$/); return m ? { name: m[1].trim(), n: +m[2] } : { name: s, n: 0 }; }
      let min = ''; const mm = s.match(/\s*[(（](\d+(?:\+\d+)?)['′]?[)）]\s*$/); if (mm) { min = mm[1]; s = s.slice(0, mm.index).trim(); }
      let n = 1; const mc = s.match(/\s*[xX*]\s*(\d+)\s*$/); if (mc) { n = parseInt(mc[1], 10) || 1; s = s.slice(0, mc.index).trim(); }
      return { name: s, n, min };
    }).filter(e => e.name);
  }

  /* ---------- giocatori e menu ---------- */
  const allPeople = () => [...D.players, ...trialists];
  const pval = p => p.name_kanji || p.name_romaji;
  const pdisp = p => AD.pname(p, State.lang) || pval(p);
  function findValue(raw) {
    const clean = String(raw || '').replace(/\(.*?\)/g, '').replace(/\s*[xX*]\s*\d+/g, '').trim(), c = cleanStr(clean); if (!c) return '';
    const L = allPeople();
    let p = L.find(x => [x.id, x.name_kanji, x.name_kana, x.name_romaji].some(v => cleanStr(v) === c));
    if (!p && c.length >= (isJa(c) ? 2 : 3)) { const hits = L.filter(x => [x.name_kanji, x.name_kana, x.name_romaji, x.id].some(v => { v = cleanStr(v); return v && (v.includes(c) || c.includes(v)); })); if (hits.length === 1) p = hits[0]; }
    return p ? pval(p) : clean;
  }
  function ensureOption(sel, value) {
    if (!sel || !value) return;
    if (![...sel.options].some(o => o.value === value)) { const o = document.createElement('option'); o.value = value; o.textContent = `${value} (${t('m.notInSquad')})`; o.style.color = '#dc2626'; sel.appendChild(o); }
    sel.value = value;
  }
  function playerOptions(onlyGK) {
    let L = allPeople().filter(p => p.role !== 'staff'); if (onlyGK) L = L.filter(p => p.role === 'gk' || p.position === 'TRIAL');
    L.sort((a, b) => pdisp(a).localeCompare(pdisp(b)));
    return [['', t('m.noneOpt')], ...L.map(p => [pval(p), pdisp(p) + (p.position === 'TRIAL' ? ' (PROVA)' : '')])];
  }
  function refreshSelects() {
    const taken = new Set($$('.squad-sel').map(s => s.value).filter(Boolean));
    $$('.psel').forEach(sel => {
      const cur = sel.value, squad = sel.classList.contains('squad-sel');
      sel.innerHTML = playerOptions(sel.classList.contains('gk-sel')).map(([v, l]) => { const dis = squad && v && taken.has(v) && v !== cur; return `<option value="${esc(v)}" ${dis ? 'disabled' : ''}>${esc(l + (dis ? ' ✓' : ''))}</option>`; }).join('');
      if (cur) ensureOption(sel, cur);
    });
    updateCards();
  }

  /* ---------- selettori dati ---------- */
  const oppName = k => AD.nm((D.opponents[k] || {}).name, State.lang) || k;
  const locName = k => (D.locations[k] || {})[State.lang] || (D.locations[k] || {}).it || k;
  function renderSelects() {
    const keep = id => $(id).value;
    const [o, l, c] = [keep('opponentSelect'), keep('locationSelect'), keep('competitionSelect')];
    $('opponentSelect').innerHTML = Object.keys(D.opponents).sort().map(k => `<option value="${esc(k)}">${esc(oppName(k))} (${esc(k)})</option>`).join('');
    $('locationSelect').innerHTML = Object.keys(D.locations).sort().map(k => `<option value="${esc(k)}">${esc(locName(k))} (${esc(k)})</option>`).join('');
    $('competitionSelect').innerHTML = (D.competitions.length ? D.competitions : [{ id: 'friendly', name: { it: 'Amichevoli' } }]).map(x => { const bits = [x.division && (State.lang === 'ja' ? x.division + '部' : 'Div. ' + x.division), x.block && (State.lang === 'ja' ? x.block + 'ブロック' : 'Blocco ' + x.block), x.season && x.season !== 'all' && '(' + x.season + ')'].filter(Boolean).join(' '); return `<option value="${esc(x.id)}">${esc(AD.nm(x.name, State.lang) + (bits ? ' ' + bits : '') + ' [' + x.id + ']')}</option>`; }).join('');
    if (o) $('opponentSelect').value = o; if (l) $('locationSelect').value = l; if (c) $('competitionSelect').value = c;
    const sorted = [...D.matches].sort((a, b) => { const up = x => (x.status === 'upcoming' || x.status === 'live') ? 0 : 1; return up(a) - up(b) || (up(a) ? String(b.date).localeCompare(a.date) : String(a.date).localeCompare(b.date)); });
    const cur = $('matchSelector').value;
    $('matchSelector').innerHTML = `<option value="">— ${sorted.length} —</option>` + sorted.map(m => `<option value="${esc(m.id)}">${(m.status === 'upcoming' || m.status === 'live') ? '🟢' : '⚪'} ${esc(m.date)} — vs ${esc(oppName(m.opponent_id))}${m.score && m.score !== 'VS' ? ' (' + esc(m.score) + ')' : ''} · [${esc(m.id)}]</option>`).join('');
    if (cur) $('matchSelector').value = cur;
  }

  /* ---------- campo e panchina ---------- */
  function renderPitch() {
    const coords = FORM[$('formationSelect').value] || FORM['4-4-2'];
    const prev = {}; $$('#pitchGrid .squad-sel').forEach(s => prev[s.dataset.pos] = s.value);
    const prevBench = $$('#benchGrid .bench-card').map(c => ({ p: c.querySelector('.bench-sel').value, s: c.querySelector('.bench-in').checked, pos: c.querySelector('.bench-pos').value }));
    $('pitchGrid').innerHTML = Object.entries(coords).map(([tag, [x, y]]) => `<div class="pitch-position-card" data-card="${tag}" style="left:${x}%;top:${y}%"><div class="pitch-pos-header"><span class="pos-badge">${tag}</span><span class="affinity-badge hidden" data-aff="${tag}"></span></div><select class="pitch-player-select psel squad-sel ${tag === 'GK' ? 'gk-sel' : ''}" data-pos="${tag}"></select></div>`).join('');
    let b = ''; for (let i = 1; i <= 10; i++) b += `<div class="bench-card" data-slot="${i}"><div class="bench-card-header">#${i} ${t('m.bn')}</div><select class="form-control psel squad-sel bench-sel"></select><div class="bench-sub-row"><label><input type="checkbox" class="bench-in"> ${t('m.sub')}</label><select class="form-control bench-pos" style="font-size:.8rem;padding:4px" disabled>${Object.keys(coords).map(p => `<option>${p}</option>`).join('')}</select></div></div>`;
    $('benchGrid').innerHTML = b;
    refreshSelects();
    Object.entries(prev).forEach(([pos, v]) => { const s = document.querySelector(`#pitchGrid .squad-sel[data-pos="${pos}"]`); if (s && v) ensureOption(s, v); });
    $$('#benchGrid .bench-card').forEach((c, i) => { const d = prevBench[i]; if (!d) return; if (d.p) ensureOption(c.querySelector('.bench-sel'), d.p); const chk = c.querySelector('.bench-in'); chk.checked = d.s; c.querySelector('.bench-pos').disabled = !d.s; if (d.pos && [...c.querySelector('.bench-pos').options].some(o => o.value === d.pos)) c.querySelector('.bench-pos').value = d.pos; });
    refreshSelects(); renderMister();
  }

  /* ---------- affinità e Mister virtuale ---------- */
  const statsPlayers = () => (D.stats && D.stats.players) || {};
  function macroOf(p) { return p.role === 'gk' ? 'GK' : p.role === 'df' ? 'DEF' : p.role === 'mf' ? 'MID' : p.role === 'fw' ? 'ATT' : 'UNK'; }
  function affinity(p, tag) {
    const pos = (statsPlayers()[p.id] || {}).positions_played || {}, total = Object.values(pos).reduce((a, b) => a + b, 0), exact = pos[tag] || 0, pm = MACRO[tag] || '';
    let macroTotal = 0; Object.entries(pos).forEach(([k, v]) => { if (MACRO[k] === pm) macroTotal += v; });
    const pctE = total ? exact / total * 100 : 0, pctM = total ? macroTotal / total * 100 : 0, mac = macroOf(p);
    let score;
    if (tag === 'GK') score = mac === 'GK' ? 100 + pctE : -100; else if (mac === 'GK') score = -50;
    else { const bonus = (mac === 'DEF' && pm === 'DEF') || (mac === 'MID' && (pm === 'MID' || pm === 'ATT_MID')) || (mac === 'ATT' && (pm === 'ATT' || pm === 'ATT_MID')) ? 30 : 0; score = pctE + pctM * .5 + bonus + Math.min(exact * 2, 20); }
    return { total, exact, macroTotal, pctE, score };
  }
  function updateCards() {
    $$('#pitchGrid .pitch-position-card').forEach(card => {
      const sel = card.querySelector('select'), tag = card.dataset.card, b = card.querySelector('[data-aff]');
      card.classList.remove('filled', 'affinity-medium', 'affinity-low', 'affinity-new');
      if (!sel.value) { b.classList.add('hidden'); return; }
      card.classList.add('filled');
      const p = allPeople().find(x => pval(x) === sel.value), a = p ? affinity(p, tag) : { exact: 0, macroTotal: 0 }, m = Math.max(0, a.macroTotal - a.exact);
      let label, cls; if (a.exact >= 3) { label = '★ ' + a.exact; cls = 'high'; } else if (a.exact >= 1 || m >= 2) { label = '◆ ' + (a.exact + m); cls = 'medium'; card.classList.add('affinity-medium'); } else if (m >= 1) { label = '○ ' + m; cls = 'low'; card.classList.add('affinity-low'); } else { label = '⚠ NEW'; cls = 'new'; card.classList.add('affinity-new'); }
      b.className = 'affinity-badge ' + cls; b.textContent = label;
    });
  }
  function renderMister() {
    const box = $('misterHelperBody'); if (!box) return;
    if (!Object.keys(statsPlayers()).length) { box.innerHTML = `<div style="color:#94a3b8;font-size:.8rem;grid-column:1/-1;text-align:center;padding:12px"><i class="fas fa-info-circle"></i> ${t('m.noStats')}</div>`; return; }
    const used = new Set($$('#pitchGrid .squad-sel').map(s => s.value).filter(Boolean));
    box.innerHTML = Object.keys(FORM[$('formationSelect').value] || FORM['4-4-2']).map(tag => {
      const top = allPeople().filter(p => p.role !== 'staff').map(p => ({ p, a: affinity(p, tag) })).filter(x => x.a.total > 0 && x.a.score > 0).sort((x, y) => y.a.score - x.a.score).slice(0, 3);
      const lines = top.length ? top.map((x, i) => `<div class="mister-player-line rank-${i + 1}"><span class="mister-player-name" title="${esc(pdisp(x.p))}">${esc(pdisp(x.p))}${used.has(pval(x.p)) ? ' ✓' : ''}</span><span class="mister-player-count" title="${x.a.exact}/${x.a.total}">${Math.round(x.a.pctE)}%</span></div>`).join('') : '<div class="mister-player-line empty">—</div>';
      return `<div class="mister-pos-suggestion"><div class="mister-pos-head"><span class="pos-label">${tag}</span><span class="pos-macro">${MACRO[tag] || ''}</span></div><div class="mister-top-players">${lines}</div></div>`;
    }).join('');
  }
  function suggestLineup() {
    if (!Object.keys(statsPlayers()).length) return toast('warn', t('m.noStats'));
    const coords = FORM[$('formationSelect').value] || FORM['4-4-2'], order = { GK: 0, 'CB-C': 1, 'CB-L': 1, 'CB-R': 1, LB: 2, RB: 2, LWB: 2, RWB: 2, DM: 3, 'DM-L': 3, 'DM-R': 3, 'CM-C': 4, 'CM-L': 4, 'CM-R': 4, LM: 5, RM: 5, 'AM-C': 6, 'AM-L': 6, 'AM-R': 6, ST: 7, 'FW-L': 7, 'FW-R': 7, LW: 8, RW: 8 };
    const used = new Set(); let n = 0;
    Object.keys(coords).sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99)).forEach(tag => {
      const c = allPeople().filter(p => p.role !== 'staff' && !used.has(pval(p))).map(p => ({ p, s: affinity(p, tag).score })).filter(x => x.s > 0).sort((a, b) => b.s - a.s)[0];
      if (!c) return; used.add(pval(c.p)); n++; ensureOption(document.querySelector(`#pitchGrid .squad-sel[data-pos="${tag}"]`), pval(c.p));
    });
    markDirty(); refreshSelects(); renderMister(); toast('success', `✨ ${t('m.suggested')} (${n})`);
  }

  /* ---------- righe statistiche ---------- */
  const ROWS = { scorer: ['scorersContainer', { count: 'm.goals', min: 1 }], assist: ['assistsContainer', { count: 'm.assistN' }], gk: ['gkContainer', { count: 'm.conceded', gk: 1 }], yellow: ['yellowCardsContainer', { min: 1 }], red: ['redCardsContainer', { min: 1 }] };
  function addRow(kind, data) {
    const [cid, o] = ROWS[kind], div = document.createElement('div'); div.className = 'stat-row'; div.dataset.kind = kind;
    div.innerHTML = `<select class="form-control psel row-sel ${o.gk ? 'gk-sel' : ''}"></select>${o.min ? `<input type="text" class="form-control minute-input" placeholder="${t('m.minute')}">` : ''}${o.count ? `<label>${t(o.count)}:</label><input type="number" class="form-control count-input" value="${o.gk ? 0 : 1}" min="0" max="30">` : ''}<button type="button" class="btn-remove-row" data-action="remove-row"><i class="fas fa-trash"></i></button>`;
    $(cid).appendChild(div); refreshSelects();
    if (data) { ensureOption(div.querySelector('.row-sel'), findValue(data.name) || data.name); const c = div.querySelector('.count-input'); if (c && data.n != null) c.value = data.n; const m = div.querySelector('.minute-input'); if (m && data.min) m.value = data.min; }
    return div;
  }
  const rowsOf = kind => $$(`#${ROWS[kind][0]} .stat-row`).map(r => ({ name: r.querySelector('.row-sel').value, n: parseInt((r.querySelector('.count-input') || {}).value, 10), min: ((r.querySelector('.minute-input') || {}).value || '').trim() })).filter(r => r.name);
  const fmtNames = (arr, withMin) => arr.map(r => `${r.name}${r.n > 1 ? ' x' + r.n : ''}${withMin && r.min ? ` (${r.min}')` : ''}`).join(', ');

  /* ---------- lettura / scrittura del modulo ---------- */
  function readForm() {
    const up = $('matchStatus').value === 'upcoming', sp = {}, starters = [], bench = [], subsIn = [], subsOut = [];
    $$('#pitchGrid .squad-sel').forEach(s => { if (s.value) { sp[s.dataset.pos] = s.value; starters.push(s.value); } });
    $$('#benchGrid .bench-card').forEach(c => { const p = c.querySelector('.bench-sel').value, sub = c.querySelector('.bench-in').checked; if (p) { bench.push({ player: p, subbed_in: sub, position_played: sub ? c.querySelector('.bench-pos').value : null }); (sub ? subsIn : subsOut).push(p); } });
    const sc = rowsOf('scorer'), as = {}; rowsOf('assist').forEach(r => as[r.name] = (as[r.name] || 0) + (r.n || 1));
    const m = { id: $('matchId').value.trim() || currentId, category: $('matchCategory').value, competition_id: $('competitionSelect').value || 'friendly', date: $('matchDate').value, time: $('matchTime').value || '11:00', status: $('matchStatus').value, type: $('matchType').value.trim() || '練習試合', opponent_id: $('opponentSelect').value, isHome: $('isHome').value === 'true', score: ($('matchScore').value.trim() || (up ? 'VS' : '0 - 0')), scorers: up ? '' : fmtNames(sc, true), assists: up ? '' : Object.keys(as).map(k => as[k] > 1 ? `${k} x${as[k]}` : k).join(', '), mvp: up ? '' : $('mvpSelect').value, yellow_cards: up ? '' : fmtNames(rowsOf('yellow').map(r => ({ ...r, n: 1 })), true), red_cards: up ? '' : fmtNames(rowsOf('red').map(r => ({ ...r, n: 1 })), true), location_id: $('locationSelect').value, goalkeepers: up ? '' : rowsOf('gk').map(r => `${r.name}(${r.n || 0})`).join(', ') };
    if (!up || starters.length || bench.length) Object.assign(m, { formation: $('formationSelect').value, starters_positions: sp, starters, substitutes_in: subsIn, substitutes_unused: subsOut, bench_details: bench, lineup: [...starters, ...subsIn] });
    return m;
  }
  function fillForm(m) {
    $('matchStatus').value = m.status || 'past'; $('matchDate').value = m.date || todayJST(); $('matchTime').value = m.time || '11:00';
    $('matchCategory').value = m.category === 'official' ? 'league' : (m.category || 'friendly'); $('matchType').value = m.type || '練習試合';
    renderSelects();
    const comp = m.competition_id || (D.competitions.find(c => c.category === $('matchCategory').value) || {}).id || 'friendly'; $('competitionSelect').value = comp;
    if (m.opponent_id) $('opponentSelect').value = m.opponent_id; if (m.location_id) $('locationSelect').value = m.location_id;
    $('isHome').value = String(m.isHome !== false); $('matchScore').value = m.score || 'VS';
    $('formationSelect').value = FORM[m.formation] ? m.formation : '4-4-2';
    trialists = m._trialists || trialists; renderTrialists();
    renderPitch();
    Object.entries(m.starters_positions || {}).forEach(([pos, n]) => { const s = document.querySelector(`#pitchGrid .squad-sel[data-pos="${pos}"]`); if (s) ensureOption(s, findValue(n)); });
    (m.bench_details || []).forEach((b, i) => { const c = document.querySelector(`[data-slot="${i + 1}"]`); if (!c) return; ensureOption(c.querySelector('.bench-sel'), findValue(b.player)); const chk = c.querySelector('.bench-in'); chk.checked = !!b.subbed_in; c.querySelector('.bench-pos').disabled = !b.subbed_in; if (b.position_played) c.querySelector('.bench-pos').value = b.position_played; });
    Object.values(ROWS).forEach(([cid]) => $(cid).innerHTML = '');
    parseList(m.scorers).forEach(e => addRow('scorer', e)); parseList(m.assists).forEach(e => addRow('assist', e)); parseList(m.goalkeepers, true).forEach(e => addRow('gk', e));
    parseList(m.yellow_cards).forEach(e => addRow('yellow', e)); parseList(m.red_cards).forEach(e => addRow('red', e));
    refreshSelects(); if (m.mvp && m.mvp !== 'なし' && m.mvp !== 'Nessuno') ensureOption($('mvpSelect'), findValue(m.mvp));
    updateCards(); renderMister();
  }
  function resetForm() {
    $('matchForm').reset(); trialists = []; currentId = ''; $('matchSelector').value = ''; $('statusMsg').textContent = '';
    renderSelects(); renderPitch(); Object.values(ROWS).forEach(([cid]) => $(cid).innerHTML = ''); renderTrialists(); $('matchDate').value = todayJST(); dirty = false; clearDraft();
  }
  function loadMatch(id, quiet) {
    const m = D.matches.find(x => String(x.id).toLowerCase() === String(id).toLowerCase());
    if (!m) { if (!quiet) toast('info', `${t('m.notFound')}: ${id}`); return null; }
    currentId = m.id; fillForm(m); $('matchId').value = m.id; $('matchSelector').value = m.id; dirty = false; if (!quiet) toast('info', '✅ ' + m.id); return m;
  }
  const nextId = () => 'match-' + (D.matches.reduce((mx, m) => Math.max(mx, parseInt((String(m.id).match(/match-(\d+)/i) || [0, 0])[1], 10) || 0), 0) + 1);

  /* ---------- statistiche (stessa struttura di stats.json) ---------- */
  function buildStats(players, matches) {
    const map = {}, alias = new Map();
    players.forEach(p => {
      if (p.role === 'staff') return; const id = String(p.id || slugOf(p)).trim(); if (map[id]) return;
      map[id] = { id, number: p.number, name_kanji: p.name_kanji, name_kana: p.name_kana, name_romaji: p.name_romaji, role: p.role, position: p.position, caps: 0, starters: 0, subs: 0, goals: 0, assists: 0, mvps: 0, yellows: 0, reds: 0, goals_conceded: 0, clean_sheets: 0, positions_played: {} };
      [id, p.name_kanji, p.name_kana, p.name_romaji, p.number != null ? 'n' + p.number : null].forEach(a => { const c = cleanStr(a); if (c) alias.set(c, id); });
    });
    const slugOf = p => AD.slug(p.name_romaji || p.name_kanji || 'x');
    const fuzzy = [...alias.entries()].filter(([a]) => !/^n\d+$/.test(a) && a.length >= 2);
    function resolve(raw) {
      let c = cleanStr(raw).replace(/\(\d+(?:\+\d+)?['′]?\)/g, '').replace(/x\d+$/, '').trim(); if (!c || ['なし', 'nessuno', 'null'].includes(c)) return null;
      if (alias.has(c) && !/^n\d+$/.test(c)) return alias.get(c);
      if (c.length < 2) return null;
      const ids = [...new Set(fuzzy.filter(([a]) => a.includes(c) || c.includes(a)).map(([, id]) => id))]; return ids.length === 1 ? ids[0] : null;   // ambiguo → nessuno (evita Fukuda K./D.)
    }
    const tt = { total_matches: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, clean_sheets: 0, formations_used: {} };
    const posRe = /^(GK|CB|LB|RB|LWB|RWB|DM|CM|LM|RM|AM|LW|RW|FW|ST)(-[LRC123])?$/i;
    const rec = (name, tag) => { const id = resolve(name); if (id && map[id] && tag) { const k = String(tag).trim().toUpperCase(); map[id].positions_played[k] = (map[id].positions_played[k] || 0) + 1; } };
    matches.forEach(m => {
      if (String(m.status).toLowerCase() !== 'past') return; tt.total_matches++;
      if (m.formation) tt.formations_used[m.formation] = (tt.formations_used[m.formation] || 0) + 1;
      let gf = 0, ga = 0; const sm = String(m.score || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/); if (sm) { gf = +sm[1]; ga = +sm[2]; }
      tt.goals_for += gf; tt.goals_against += ga; gf > ga ? tt.wins++ : gf === ga ? tt.draws++ : tt.losses++; if (!ga) tt.clean_sheets++;
      const seen = new Set();
      (m.starters || []).forEach(n => { const id = resolve(n); if (id && map[id] && !seen.has(id)) { map[id].starters++; map[id].caps++; seen.add(id); } });
      Object.entries(m.starters_positions || {}).forEach(([k, v]) => posRe.test(k.trim()) ? rec(v, k) : rec(k, v));
      (m.substitutes_in || []).forEach(n => { const id = resolve(n); if (id && map[id] && !seen.has(id)) { map[id].subs++; map[id].caps++; seen.add(id); } });
      (m.bench_details || []).forEach(b => { if (b && b.subbed_in && b.position_played) rec(b.player, b.position_played); });
      parseList(m.scorers).forEach(e => { const id = resolve(e.name); if (id && map[id]) map[id].goals += e.n; });
      parseList(m.assists).forEach(e => { const id = resolve(e.name); if (id && map[id]) map[id].assists += e.n; });
      parseList(m.mvp).forEach(e => { const id = resolve(e.name); if (id && map[id]) map[id].mvps++; });
      parseList(m.yellow_cards).forEach(e => { const id = resolve(e.name); if (id && map[id]) map[id].yellows++; });
      parseList(m.red_cards).forEach(e => { const id = resolve(e.name); if (id && map[id]) map[id].reds++; });
      parseList(m.goalkeepers, true).forEach(e => { const id = resolve(e.name); if (id && map[id]) { const c = e.n || (String(m.goalkeepers).includes('(') ? 0 : ga); map[id].goals_conceded += c; if (!c) map[id].clean_sheets++; } });
    });
    const L = Object.values(map), top = (f, k) => L.filter(p => p[f] > 0).sort((a, b) => b[f] - a[f] || b.caps - a.caps).slice(0, 5);
    return { updated_at: new Date().toISOString(), team_totals: tt, players: map, rankings: { top_scorers: top('goals'), top_assists: top('assists'), most_caps: top('caps'), mvps: top('mvps') } };
  }
  const syncCaps = (players, stats) => players.map(p => stats.players[p.id] ? { ...p, caps: stats.players[p.id].caps || 0 } : (p.role === 'staff' ? p : { ...p, caps: 0 }));
  AD.recalc = async () => { const stats = buildStats(D.players, D.matches); if (await save({ stats, players: syncCaps(D.players, stats) }, 'Admin: recalc stats & caps')) { toast('success', '✅ ' + t('m.recalcDone')); AD.renderEntities(); renderMister(); updateCards(); } };

  /* ---------- salva / elimina ---------- */
  async function saveMatch(e) {
    e.preventDefault();
    const m = readForm(); if (!m.id) { toast('warn', t('m.noId')); $('searchInputWrap').classList.add('open'); return $('matchId').focus(); }
    $('matchId').value = m.id;
    if (m.status === 'past') {
      const sm = m.score.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/); if (!sm) return toast('warn', t('m.badScore'));
      m.score = `${sm[1]} - ${sm[2]}`;
      const sGoals = parseList(m.scorers).reduce((a, r) => a + r.n, 0); if (sGoals && sGoals !== +sm[1]) toast('warn', t('m.goalsMismatch').replace('{s}', sGoals).replace('{g}', sm[1]), 7000);
    }
    const old = D.matches.find(x => String(x.id).toLowerCase() === m.id.toLowerCase()), payload = { ...(old || {}), ...m };
    if (m.status === 'upcoming' && !('formation' in m)) ['formation', 'starters_positions', 'starters', 'substitutes_in', 'substitutes_unused', 'bench_details', 'lineup'].forEach(k => delete payload[k]);
    const matches = D.matches.some(x => x.id === old?.id && old) ? D.matches.map(x => x === old ? payload : x) : [...D.matches, payload];
    const stats = buildStats(D.players, matches), btn = $('submitBtn'); btn.disabled = true; $('statusMsg').style.color = 'var(--sky-dark)'; $('statusMsg').innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('saving')}`;
    const ok = await save({ matches, stats, players: syncCaps(D.players, stats) }, `Admin: ${old ? 'update' : 'add'} ${payload.id}`);
    btn.disabled = false;
    if (ok) { currentId = payload.id; dirty = false; clearDraft(); renderSelects(); $('matchSelector').value = payload.id; AD.renderEntities(); renderMister(); updateCards(); $('statusMsg').style.color = 'var(--green)'; $('statusMsg').textContent = '✅ ' + t('saved'); toast('success', `✅ ${payload.id} · matches + stats + players`); }
    else { $('statusMsg').style.color = 'var(--red)'; $('statusMsg').textContent = '❌'; }
  }
  async function deleteMatch() {
    const id = currentId || $('matchId').value.trim() || $('matchSelector').value; if (!id) return toast('warn', t('m.pickFirst'));
    const m = D.matches.find(x => String(x.id).toLowerCase() === id.toLowerCase()); if (!m) return toast('error', t('m.notFound'));
    if (!await confirmBox(`${t('m.deleteQ')} "${m.id}"?`, true)) return;
    const matches = D.matches.filter(x => x !== m), stats = buildStats(D.players, matches);
    if (await save({ matches, stats, players: syncCaps(D.players, stats) }, 'Admin: delete ' + m.id)) { resetForm(); AD.renderEntities(); toast('success', '✅ ' + m.id); }
  }
  function newMatch() { resetForm(); $('matchId').value = nextId(); $('searchInputWrap').classList.add('open'); toast('success', '✨ ' + $('matchId').value); }
  function duplicateMatch() {
    const id = currentId || $('matchId').value.trim() || $('matchSelector').value; if (!id) return toast('warn', t('m.pickFirst'));
    const m = loadMatch(id, true); if (!m) return; const nid = nextId();
    currentId = ''; $('matchId').value = nid; $('matchDate').value = ''; $('matchScore').value = 'VS'; $('matchStatus').value = 'upcoming'; $('matchSelector').value = ''; markDirty(); toast('info', `📋 ${nid}: ${t('m.dupDone')}`);
  }

  /* ---------- in prova ---------- */
  function renderTrialists() {
    $('trialistListContainer').innerHTML = trialists.length ? trialists.map(p => `<div class="trialist-item"><span><i class="fas fa-user-clock"></i> ${esc(p.name_kanji)}</span><button type="button" class="btn-remove-trialist" data-action="remove-trialist" data-id="${esc(p.id)}"><i class="fas fa-times-circle"></i></button></div>`).join('') : '<span class="muted">—</span>';
  }
  async function addTrialist() {
    const n = await promptBox(t('m.trialPrompt')); if (!n || !String(n).trim()) return;
    trialists.push({ id: 'trialist_' + Date.now(), name_kanji: n.trim(), name_romaji: n.trim(), position: 'TRIAL', role: 'mf' }); renderTrialists(); refreshSelects(); markDirty();
  }

  /* ---------- LINE ---------- */
  function generateLine() {
    const L = State.lang, m = readForm(), tr = (a, b, c) => L === 'it' ? a : L === 'en' ? b : c, loc = D.locations[m.location_id] || {};
    const st = Object.entries(m.starters_positions || {}).map(([p, n]) => `・[${p}] ${AD.pname(allPeople().find(x => pval(x) === n) || { name_kanji: n }, L) || n}`), bn = (m.bench_details || []).map(b => `・${AD.pname(allPeople().find(x => pval(x) === b.player) || { name_kanji: b.player }, L) || b.player}`);
    $('lineTextOutput').value = `⚽ 【Yokohama Calcio ${tr('Annuncio Partita', 'Match Announcement', '試合案内')}】 ⚽\n\n📅 ${tr('Data', 'Date', '日付')}: ${m.date || 'TBD'}\n⏰ ${tr('Orario', 'Time', '時間')}: ${m.time}\n🛡️ ${tr('Avversario', 'Opponent', '対戦相手')}: ${oppName(m.opponent_id)}\n📍 ${tr('Campo', 'Venue', '会場')}: ${locName(m.location_id)}\n${loc.maps ? '🗺️ Google Maps: ' + loc.maps + '\n' : ''}\n------------------------------\n【Titolari / スタメン】\n${st.join('\n') || 'TBD / 未定'}\n\n【Panchina / ベンチ】\n${bn.join('\n') || 'TBD / 未定'}\n------------------------------\n\nForza Yokohama Calcio! 🔥`;
  }

  /* ---------- bozza ---------- */
  const DRAFT = 'yc_admin_draft';
  function clearDraft() { sessionStorage.removeItem(DRAFT); $('draftBanner').classList.add('hidden'); }
  function saveDraft() { if (!dirty) return; try { sessionStorage.setItem(DRAFT, JSON.stringify({ ...readForm(), _trialists: trialists })); } catch (_) {} }
  function checkDraft() { $('draftBanner').classList.toggle('hidden', !sessionStorage.getItem(DRAFT)); }
  function restoreDraft() { try { const d = JSON.parse(sessionStorage.getItem(DRAFT)); currentId = d.id || ''; fillForm(d); $('matchId').value = d.id || ''; clearDraft(); markDirty(); toast('success', '✅ Draft'); } catch (e) { toast('error', e.message); } }

  /* ---------- eventi ---------- */
  Object.assign(actions, {
    'load-match-selector': () => { const id = $('matchSelector').value; if (!id) return toast('warn', t('m.pickFirst')); loadMatch(id); $('searchInputWrap').classList.add('open'); },
    'search-by-id': () => { const id = $('matchId').value.trim(); if (!id) return $('matchId').focus(); loadMatch(id); }, 'toggle-id-search': () => { $('searchInputWrap').classList.toggle('open'); setTimeout(() => $('matchId').focus(), 80); },
    'new-match': newMatch, 'duplicate-match': duplicateMatch, 'delete-match': deleteMatch,
    'add-scorer': () => { addRow('scorer'); markDirty(); }, 'add-assist': () => { addRow('assist'); markDirty(); }, 'add-gk': () => { addRow('gk'); markDirty(); }, 'add-yellow': () => { addRow('yellow'); markDirty(); }, 'add-red': () => { addRow('red'); markDirty(); },
    'remove-row': el => { el.closest('.stat-row').remove(); markDirty(); },
    'clear-pitch': () => { $$('#pitchGrid .squad-sel, #benchGrid .squad-sel').forEach(s => s.value = ''); $$('#benchGrid .bench-in').forEach(c => { c.checked = false; c.closest('.bench-sub-row').querySelector('.bench-pos').disabled = true; }); refreshSelects(); renderMister(); markDirty(); },
    'suggest-lineup': suggestLineup, 'add-trialist': addTrialist,
    'remove-trialist': el => { const v = trialists.find(x => x.id === el.dataset.id); trialists = trialists.filter(x => x.id !== el.dataset.id); $$('.psel').forEach(s => { if (v && s.value === v.name_kanji) s.value = ''; }); renderTrialists(); refreshSelects(); },
    'generate-line': generateLine, 'copy-line': async () => { const ta = $('lineTextOutput'); if (!ta.value) return toast('warn', t('m.genFirst')); try { await navigator.clipboard.writeText(ta.value); } catch (_) { ta.select(); document.execCommand('copy'); } toast('success', '✅ ' + t('m.copied')); },
    'restore-draft': restoreDraft, 'discard-draft': clearDraft
  });
  $('matchForm').addEventListener('submit', saveMatch);
  $('tab-matches').addEventListener('input', markDirty);
  $('tab-matches').addEventListener('change', e => {
    const el = e.target; markDirty();
    if (el.id === 'formationSelect') renderPitch();
    else if (el.id === 'matchSelector') { if (el.value) loadMatch(el.value); }
    else if (el.id === 'competitionSelect') { const c = D.competitions.find(x => x.id === el.value); if (c && c.category) $('matchCategory').value = c.category; }
    else if (el.classList.contains('bench-in')) el.closest('.bench-sub-row').querySelector('.bench-pos').disabled = !el.checked;
    else if (el.classList.contains('psel')) { refreshSelects(); renderMister(); }
  });
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && !$('tab-matches').classList.contains('hidden') && !$('adminDashboard').classList.contains('hidden')) { e.preventDefault(); $('matchForm').requestSubmit(); } });

  hooks.loaded.push(() => { renderSelects(); if (!$('pitchGrid').children.length) renderPitch(); else refreshSelects(); renderMister(); checkDraft(); });
  hooks.lang.push(() => { renderSelects(); renderPitch(); });
  document.addEventListener('DOMContentLoaded', () => { $('matchDate').value = todayJST(); renderSelects(); renderPitch(); renderTrialists(); clearInterval(autosave); autosave = setInterval(saveDraft, 30000); });
})();
