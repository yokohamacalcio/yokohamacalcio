/* js/admin-matches.js — editor partite + formazione + statistiche. Richiede admin-core.js (window.AD). */
'use strict';
(function () {
  const { State, $, $$, esc, cleanStr, isJa, todayJST, t, toast, confirmBox, promptBox, save, hooks, actions } = AD;
  const D = State.data;
  AD.addDict({
    it: { 'm.selectLabel': 'Seleziona partita da modificare', 'm.load': 'Carica', 'm.byId': 'Oppure cerca per ID', 'm.new': 'Nuova partita', 'm.dup': 'Duplica corrente', 'm.del': 'Elimina corrente', 'm.info': 'Informazioni partita', 'm.status': 'Stato', 'm.past': 'Finita (past)', 'm.upcoming': 'In programma (upcoming)', 'm.time': 'Orario K.O.', 'm.competition': 'Competizione', 'm.typeLabel': 'Etichetta tipo', 'm.opponent': 'Avversario', 'm.venue': 'Campo', 'm.homeAway': 'Casa / Trasferta', 'm.home': 'Casa (noi vs loro)', 'm.away': 'Trasferta (loro vs noi)', 'm.score': 'Risultato (sempre nostri - loro)', 'm.events': 'Eventi e prestazioni', 'm.scorers': 'Marcatori', 'm.assists': 'Assistman', 'm.gks': 'Portieri e gol subiti', 'm.yellows': 'Gialli', 'm.reds': 'Rossi', 'm.add': 'Aggiungi', 'm.tactics': 'Assetto tattico e convocati', 'm.formation': 'Modulo', 'm.mister': 'Suggerimento Mister', 'm.misterSub': 'Basato sull\'uso nei ruoli (stats.json)', 'm.suggest': 'Suggerisci formazione', 'm.starters': 'Titolari', 'm.clear': 'Cancella', 'm.bench': 'Panchina (10)', 'm.addTrialist': '+ Giocatore in prova', 'm.trialists': 'In prova (solo questo match):', 'm.saveMatch': 'Salva partita e aggiorna stats + caps', 'm.lineTitle': 'Convocazioni LINE', 'm.lineSub': 'Messaggio pronto da incollare nel gruppo LINE.', 'm.lineGen': 'Genera testo', 'm.lineCopy': 'Copia', 'm.goals': 'Gol', 'm.assistN': 'Assist', 'm.conceded': 'Subiti', 'm.minute': 'min', 'm.trialPrompt': 'Nome del giocatore in prova:', 'm.noId': 'Specifica un ID (usa «Nuova partita»).', 'm.notFound': 'Partita non trovata', 'm.pickFirst': 'Seleziona prima una partita.', 'm.deleteQ': 'Eliminare definitivamente la partita', 'm.badScore': 'Risultato non valido (es. 2 - 1).', 'm.goalsMismatch': 'Attenzione: i marcatori ({s}) non corrispondono ai nostri gol ({g}).', 'm.notInSquad': 'non in rosa', 'm.noStats': 'Nessun dato statistico: salva qualche partita.', 'm.suggested': 'Formazione suggerita', 'm.noneOpt': '— nessuno —', 'm.sub': 'Subentrato', 'm.bn': 'Panchina', 'm.copied': 'Testo copiato', 'm.genFirst': 'Genera prima il testo.', 'm.recalcDone': 'stats.json e caps aggiornati', 'm.dupDone': 'Duplicata: aggiorna data e avversario.', 'm.format': 'Formato', 'm.fSingle': 'Partita singola', 'm.fTri': 'Triangolare (3角戦)', 'm.typeFriendly': 'Amichevole', 'm.typeTri': 'Triangolare', 'm.typeOfficial': 'Ufficiale', 'm.tri.title': 'Triangolare: avversari e nostri incontri', 'm.tri.opp2': 'Avversario 2 (terza squadra)', 'm.tri.list': 'I nostri incontri (gol, assist e portiere per ogni incontro)', 'm.tri.hint': 'Per ogni incontro: punteggio «nostri - loro». Formazione, MVP e cartellini sono della giornata. Il risultato complessivo si calcola da solo.', 'm.tri.add': 'Aggiungi incontro', 'm.tri.auto': 'Calcola risultato complessivo', 'm.tri.aggDone': 'Risultato complessivo: {s}', 'm.tri.needScores': 'Inserisci il punteggio di tutti gli incontri per calcolare il risultato complessivo.', 'm.tri.needOpp2': 'Scegli il secondo avversario del triangolare.', 'm.tri.sameOpp': 'I due avversari devono essere diversi.', 'm.tri.noSub': 'Aggiungi almeno un incontro.', 'm.tri.noSubOpp': 'Ogni incontro deve avere un avversario.', 'm.tri.badScore': 'Punteggio di un incontro non valido (es. 2 - 1 oppure VS).', 'm.auditTitle': 'Controllo coerenza dati', 'm.auditSub': 'Segnala punteggi, portieri, marcatori e formazioni che non tornano.', 'm.auditBtn': 'Controlla tutte le partite', 'm.auditNone': 'Nessun problema trovato.', 'm.auditN': '{n} avvisi sui dati di questa partita: apri Strumenti → Controllo coerenza.' },
    ja: { 'm.selectLabel': '編集する試合を選択', 'm.load': '読込', 'm.byId': 'ID で検索', 'm.new': '新規試合', 'm.dup': '複製', 'm.del': '削除', 'm.info': '試合情報', 'm.status': 'ステータス', 'm.past': '終了', 'm.upcoming': '予定', 'm.time': 'K.O.', 'm.competition': '大会', 'm.typeLabel': '種別ラベル', 'm.opponent': '対戦相手', 'm.venue': '会場', 'm.homeAway': 'ホーム/アウェイ', 'm.home': 'ホーム', 'm.away': 'アウェイ', 'm.score': 'スコア（常に自-相手）', 'm.events': 'イベント', 'm.scorers': '得点者', 'm.assists': 'アシスト', 'm.gks': 'GK・失点', 'm.yellows': '警告', 'm.reds': '退場', 'm.add': '追加', 'm.tactics': 'フォーメーション', 'm.formation': '布陣', 'm.mister': '監督サジェスト', 'm.misterSub': 'ポジション使用率に基づく', 'm.suggest': '布陣を提案', 'm.starters': '先発', 'm.clear': 'クリア', 'm.bench': '控え (10)', 'm.addTrialist': '+ 練習生を追加', 'm.trialists': '練習生（この試合のみ）:', 'm.saveMatch': '試合を保存してスタッツ・出場数を更新', 'm.lineTitle': 'LINE招集文', 'm.lineSub': 'LINEにそのまま貼れる案内文を生成します。', 'm.lineGen': '生成', 'm.lineCopy': 'コピー', 'm.goals': '得点', 'm.assistN': 'アシスト', 'm.conceded': '失点', 'm.minute': '分', 'm.trialPrompt': '練習生の名前:', 'm.noId': 'IDを指定してください（「新規試合」）。', 'm.notFound': '試合が見つかりません', 'm.pickFirst': '先に試合を選択してください。', 'm.deleteQ': '次の試合を完全に削除しますか', 'm.badScore': 'スコアが不正です（例 2 - 1）。', 'm.goalsMismatch': '注意: 得点者 ({s}) と自チーム得点 ({g}) が一致しません。', 'm.notInSquad': '名簿外', 'm.noStats': 'スタッツがありません。', 'm.suggested': '布陣を提案しました', 'm.noneOpt': '— なし —', 'm.sub': '途中出場', 'm.bn': '控え', 'm.copied': 'コピーしました', 'm.genFirst': '先に生成してください。', 'm.recalcDone': 'stats.json と caps を更新しました', 'm.dupDone': '複製しました。日付と相手を更新してください。', 'm.format': 'フォーマット', 'm.fSingle': '単独試合', 'm.fTri': '3角戦（トライアングル）', 'm.typeFriendly': '練習試合', 'm.typeTri': '3角戦', 'm.typeOfficial': '公式戦', 'm.tri.title': '3角戦：対戦相手と自チームの試合', 'm.tri.opp2': '対戦相手2（3チーム目）', 'm.tri.list': '自チームの試合（各試合の得点・アシスト・GK）', 'm.tri.hint': '各試合のスコアは「自 - 相手」。メンバー・MVP・カードは当日分です。総合スコアは自動計算されます。', 'm.tri.add': '試合を追加', 'm.tri.auto': '総合スコアを計算', 'm.tri.aggDone': '総合スコア: {s}', 'm.tri.needScores': '総合スコアを計算するには全試合のスコアを入力してください。', 'm.tri.needOpp2': '2チーム目の対戦相手を選択してください。', 'm.tri.sameOpp': '2つの対戦相手は別のチームにしてください。', 'm.tri.noSub': '試合を1つ以上追加してください。', 'm.tri.noSubOpp': '各試合に対戦相手を選択してください。', 'm.tri.badScore': 'スコアが不正です（例 2 - 1 または VS）。', 'm.auditTitle': 'データ整合性チェック', 'm.auditSub': 'スコア・GK・得点者・先発の不整合を表示します。', 'm.auditBtn': '全試合をチェック', 'm.auditNone': '問題は見つかりませんでした。', 'm.auditN': 'この試合に{n}件の警告: ツール → 整合性チェックを確認してください。' },
    en: { 'm.selectLabel': 'Select match to edit', 'm.load': 'Load', 'm.byId': 'Or search by ID', 'm.new': 'New match', 'm.dup': 'Duplicate current', 'm.del': 'Delete current', 'm.info': 'Match information', 'm.status': 'Status', 'm.past': 'Finished (past)', 'm.upcoming': 'Scheduled (upcoming)', 'm.time': 'Kick-off', 'm.competition': 'Competition', 'm.typeLabel': 'Type label', 'm.opponent': 'Opponent', 'm.venue': 'Venue', 'm.homeAway': 'Home / Away', 'm.home': 'Home (us vs them)', 'm.away': 'Away (them vs us)', 'm.score': 'Score (always us - them)', 'm.events': 'Events & performance', 'm.scorers': 'Scorers', 'm.assists': 'Assists', 'm.gks': 'Goalkeepers & conceded', 'm.yellows': 'Yellows', 'm.reds': 'Reds', 'm.add': 'Add', 'm.tactics': 'Tactics & squad', 'm.formation': 'Formation', 'm.mister': 'Manager suggestion', 'm.misterSub': 'Based on role usage (stats.json)', 'm.suggest': 'Suggest lineup', 'm.starters': 'Starting XI', 'm.clear': 'Clear', 'm.bench': 'Bench (10)', 'm.addTrialist': '+ Add trialist', 'm.trialists': 'Trialists (this match only):', 'm.saveMatch': 'Save match & update stats + caps', 'm.lineTitle': 'LINE announcement', 'm.lineSub': 'Ready-to-paste message for the LINE group.', 'm.lineGen': 'Generate', 'm.lineCopy': 'Copy', 'm.goals': 'Goals', 'm.assistN': 'Assists', 'm.conceded': 'Conceded', 'm.minute': 'min', 'm.trialPrompt': 'Trialist name:', 'm.noId': 'Specify an ID (use “New match”).', 'm.notFound': 'Match not found', 'm.pickFirst': 'Select a match first.', 'm.deleteQ': 'Permanently delete match', 'm.badScore': 'Invalid score (e.g. 2 - 1).', 'm.goalsMismatch': 'Note: scorers ({s}) do not match our goals ({g}).', 'm.notInSquad': 'not in squad', 'm.noStats': 'No stats yet: save some matches.', 'm.suggested': 'Lineup suggested', 'm.noneOpt': '— none —', 'm.sub': 'Subbed in', 'm.bn': 'Bench', 'm.copied': 'Text copied', 'm.genFirst': 'Generate the text first.', 'm.recalcDone': 'stats.json and caps updated', 'm.dupDone': 'Duplicated: update date and opponent.', 'm.format': 'Format', 'm.fSingle': 'Single match', 'm.fTri': 'Triangular (3-team)', 'm.typeFriendly': 'Friendly', 'm.typeTri': 'Triangular', 'm.typeOfficial': 'Official', 'm.tri.title': 'Triangular: opponents & our fixtures', 'm.tri.opp2': 'Opponent 2 (third team)', 'm.tri.list': 'Our fixtures (goals, assists and goalkeeper per fixture)', 'm.tri.hint': 'Per fixture: score “us - them”. Line-up, MVP and cards belong to the day. The overall result is calculated automatically.', 'm.tri.add': 'Add fixture', 'm.tri.auto': 'Calculate overall score', 'm.tri.aggDone': 'Overall score: {s}', 'm.tri.needScores': 'Enter the score of every fixture to calculate the overall result.', 'm.tri.needOpp2': 'Choose the second opponent of the triangular.', 'm.tri.sameOpp': 'The two opponents must be different.', 'm.tri.noSub': 'Add at least one fixture.', 'm.tri.noSubOpp': 'Every fixture needs an opponent.', 'm.tri.badScore': 'Invalid fixture score (e.g. 2 - 1 or VS).', 'm.auditTitle': 'Data consistency check', 'm.auditSub': 'Flags scores, goalkeepers, scorers and line-ups that do not add up.', 'm.auditBtn': 'Check all matches', 'm.auditNone': 'No problems found.', 'm.auditN': '{n} warnings on this match: open Tools → Consistency check.' }
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
  const T = AD.tri, parseList = AD.stats.parseList;

  const allPeople = () => [...D.players, ...trialists];
  const pval = p => p.name_kanji || p.name_romaji;
  const pdisp = p => AD.pname(p, State.lang) || pval(p);
  function findValue(raw) {
    const parsed = parseList(raw)[0];
    const cleanName = parsed ? parsed.name : String(raw || '').replace(/\(.*?\)/g, '').replace(/\s*[xX*]\s*\d+/g, '').trim();
    const c = cleanStr(cleanName); if (!c) return '';
    const L = allPeople();
    let p = L.find(x => [x.id, x.name_kanji, x.name_kana, x.name_romaji].some(v => cleanStr(v) === c));
    if (!p && c.length >= (isJa(c) ? 2 : 3)) {
      const hits = L.filter(x => [x.name_kanji, x.name_kana, x.name_romaji, x.id].some(v => { const cv = cleanStr(v); return cv && (cv.includes(c) || c.includes(cv)); }));
      if (hits.length === 1) p = hits[0];
    }
    return p ? pval(p) : cleanName;
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
    $$('.psel, #mvpSelect').forEach(sel => {      // MVP incluso: prima non riceveva mai l'elenco giocatori
      const cur = sel.value, squad = sel.classList.contains('squad-sel');
      sel.innerHTML = playerOptions(sel.classList.contains('gk-sel')).map(([v, l]) => { const dis = squad && v && taken.has(v) && v !== cur; return `<option value="${esc(v)}" ${dis ? 'disabled' : ''}>${esc(l + (dis ? ' ✓' : ''))}</option>`; }).join('');
      if (cur) ensureOption(sel, cur);
    });
    updateCards();
  }

  /* ---------- selettori dati ---------- */
  const oppName = k => AD.nm((D.opponents[k] || {}).name, State.lang) || k;
  const locName = k => (D.locations[k] || {})[State.lang] || (D.locations[k] || {}).it || k;
  const oppLabel = m => (T.isTri(m) ? '🔺 ' + (T.opponentsOf(m).map(oppName).join(' & ') || '?') : oppName(m.opponent_id));
  function renderSelects() {
    const keep = id => $(id).value;
    const [o, o2, l, c] = [keep('opponentSelect'), keep('triOpponent2Select'), keep('locationSelect'), keep('competitionSelect')];
    const oppOpts = Object.keys(D.opponents).sort().map(k => `<option value="${esc(k)}">${esc(oppName(k))} (${esc(k)})</option>`).join('');
    $('opponentSelect').innerHTML = oppOpts;
    $('triOpponent2Select').innerHTML = '<option value="">—</option>' + oppOpts;
    $('locationSelect').innerHTML = Object.keys(D.locations).sort().map(k => `<option value="${esc(k)}">${esc(locName(k))} (${esc(k)})</option>`).join('');
    $('competitionSelect').innerHTML = (D.competitions.length ? D.competitions : [{ id: 'friendly', name: { it: 'Amichevoli' } }]).map(x => { const bits = [x.division && (State.lang === 'ja' ? x.division + '部' : 'Div. ' + x.division), x.block && (State.lang === 'ja' ? x.block + 'ブロック' : 'Blocco ' + x.block), x.season && x.season !== 'all' && '(' + x.season + ')'].filter(Boolean).join(' '); return `<option value="${esc(x.id)}">${esc(AD.nm(x.name, State.lang) + (bits ? ' ' + bits : '') + ' [' + x.id + ']')}</option>`; }).join('');
    if (o) $('opponentSelect').value = o; if (o2) $('triOpponent2Select').value = o2; if (l) $('locationSelect').value = l; if (c) $('competitionSelect').value = c;
    rememberOpp();
    const sorted = [...D.matches].sort((a, b) => { const up = x => (x.status === 'upcoming' || x.status === 'live') ? 0 : 1; return up(a) - up(b) || String(b.date).localeCompare(a.date); });
    const cur = $('matchSelector').value;
    $('matchSelector').innerHTML = `<option value="">— ${sorted.length} —</option>` + sorted.map(m => `<option value="${esc(m.id)}">${(m.status === 'upcoming' || m.status === 'live') ? '🟢' : '⚪'} ${esc(m.date)} — vs ${esc(oppLabel(m))}${m.score && m.score !== 'VS' ? ' (' + esc(m.score) + ')' : ''} · [${esc(m.id)}]</option>`).join('');
    if (cur) $('matchSelector').value = cur;
    refreshSubOpp();
  }

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
  const SUBKIND = { scorer: 'sub-scorer', assist: 'sub-assist', gk: 'sub-gk' };
  const rowBox = (kind, scope) => (scope ? scope.querySelector('.' + SUBKIND[kind]) : $(ROWS[kind][0]));
  function addRow(kind, data, scope) {
    const o = ROWS[kind][1], div = document.createElement('div'); div.className = 'stat-row'; div.dataset.kind = kind;
    div.innerHTML = `<select class="form-control psel row-sel ${o.gk ? 'gk-sel' : ''}"></select>${o.min ? `<input type="text" class="form-control minute-input" placeholder="${t('m.minute')}">` : ''}${o.count ? `<label>${t(o.count)}:</label><input type="number" class="form-control count-input" value="${o.gk ? 0 : 1}" min="0" max="30">` : ''}<button type="button" class="btn-remove-row" data-action="remove-row"><i class="fas fa-trash"></i></button>`;
    rowBox(kind, scope).appendChild(div); refreshSelects();
    if (data) { ensureOption(div.querySelector('.row-sel'), findValue(data.name) || data.name); const c = div.querySelector('.count-input'); if (c && data.n != null) c.value = data.n; const m = div.querySelector('.minute-input'); if (m && data.min) m.value = data.min; }
    return div;
  }
  const rowsOf = (kind, scope) => $$('.stat-row', rowBox(kind, scope)).map(r => ({ name: r.querySelector('.row-sel').value, n: parseInt((r.querySelector('.count-input') || {}).value, 10), min: ((r.querySelector('.minute-input') || {}).value || '').trim() })).filter(r => r.name);
  const fmtNames = (arr, withMin) => arr.map(r => `${r.name}${r.n > 1 ? ' x' + r.n : ''}${withMin && r.min ? ` (${r.min}')` : ''}`).join(', ');

  /* ---------- triangolari: un riquadro per ogni nostro incontro ---------- */
  const isTriForm = () => $('isTriangular').value === 'true';
  const subOppIds = () => [...new Set([$('opponentSelect').value, $('triOpponent2Select').value].filter(Boolean))];
  const subOppOptions = sel => { const ids = subOppIds(); if (sel && !ids.includes(sel)) ids.push(sel); return ids.map(id => `<option value="${esc(id)}" ${id === sel ? 'selected' : ''}>${esc(oppName(id))}</option>`).join(''); };
  function rememberOpp() { $('opponentSelect').dataset.prev = $('opponentSelect').value; $('triOpponent2Select').dataset.prev = $('triOpponent2Select').value; }
  function addSubCard(sub) {
    const opp = sub ? T.subOpp(sub) : (subOppIds()[$$('#subMatchesContainer .sub-match-card').length] || subOppIds()[0] || '');
    const div = document.createElement('div'); div.className = 'sub-match-card';
    const grp = (kind, key, icon) => `<div class="sub-group"><label><i class="fas ${icon}"></i> ${t(key)}</label><div class="${SUBKIND[kind]}"></div><button type="button" class="btn-add-row" data-action="sub-add-row" data-kind="${kind}"><i class="fas fa-plus"></i> ${t('m.add')}</button></div>`;
    div.innerHTML = `<div class="sub-head"><strong class="sub-us">Yokohama Calcio</strong><span class="sub-vs">VS</span><select class="form-control sub-opp">${subOppOptions(opp)}</select><input type="text" class="form-control sub-score" placeholder="2 - 1" value="${esc(sub ? T.normScore(sub.score) : 'VS')}" aria-label="${esc(t('m.score'))}"><button type="button" class="btn-remove-row" data-action="remove-sub-match" aria-label="Remove"><i class="fas fa-trash"></i></button></div><div class="sub-events">${grp('scorer', 'm.scorers', 'fa-futbol')}${grp('assist', 'm.assists', 'fa-handshake')}${grp('gk', 'm.gks', 'fa-mitten')}</div>`;
    $('subMatchesContainer').appendChild(div);
    if (sub) { parseList(sub.scorers).forEach(e => addRow('scorer', e, div)); parseList(sub.assists).forEach(e => addRow('assist', e, div)); parseList(sub.goalkeeper || sub.goalkeepers, true).forEach(e => addRow('gk', e, div)); }
    refreshSelects(); return div;
  }
  function refreshSubOpp(prev, now) {            // aggiorna i menu degli incontri quando cambiano gli avversari
    $$('#subMatchesContainer .sub-opp').forEach(sel => { let cur = sel.value; if (prev && cur === prev) cur = now || ''; sel.innerHTML = subOppOptions(cur); if (cur) sel.value = cur; });
    if (isTriForm()) subOppIds().forEach(id => { if (!$$('#subMatchesContainer .sub-opp').some(s => s.value === id)) addSubCard({ opponent_id: id, score: 'VS' }); });
  }
  function toggleTriUI() {
    const on = isTriForm();
    $('triangularSection').classList.toggle('hidden', !on);
    ['groupScorers', 'groupAssists', 'groupGk'].forEach(id => $(id).classList.toggle('hidden', on));
    if (on) refreshSubOpp();
    if (on && !$$('#subMatchesContainer .sub-match-card').length) addSubCard(null);
  }
  function readSubCards() {
    return $$('#subMatchesContainer .sub-match-card').map(c => {
      const opp = c.querySelector('.sub-opp').value, raw = c.querySelector('.sub-score').value.trim(), as = {};
      rowsOf('assist', c).forEach(r => as[r.name] = (as[r.name] || 0) + (r.n || 1));
      return { opponent_id: opp, home: 'us', away: opp, score: T.normScore(raw), _bad: !!raw && !/^vs$/i.test(raw) && !T.SCORE.test(raw), scorers: fmtNames(rowsOf('scorer', c), true), assists: Object.keys(as).map(k => as[k] > 1 ? `${k} x${as[k]}` : k).join(', '), goalkeeper: rowsOf('gk', c).map(r => `${r.name}(${r.n || 0})`).join(', ') };
    });
  }
  function syncAggregate(notify) {                // risultato complessivo = somma dei nostri incontri
    const a = T.aggregate(readSubCards());
    if (a.complete) { $('matchScore').value = `${a.gf} - ${a.ga}`; if (notify) toast('success', t('m.tri.aggDone').replace('{s}', $('matchScore').value)); }
    else if (notify) toast('warn', t('m.tri.needScores'));
  }
  const ensureTypeOption = v => { const sel = $('matchType'); if (v && ![...sel.options].some(o => o.value === v)) { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); } };
  const oppsText = m => (m.isTriangular && m.opponents && m.opponents.length > 1 ? '🔺 ' + m.opponents.map(oppName).join(' & ') : oppName(m.opponent_id));

  function readForm() {
    const up = $('matchStatus').value === 'upcoming', tri = isTriForm(), sp = {}, starters = [], bench = [], subsIn = [], subsOut = [];
    $$('#pitchGrid .squad-sel').forEach(s => { if (s.value) { sp[s.dataset.pos] = s.value; starters.push(s.value); } });
    $$('#benchGrid .bench-card').forEach(c => { const p = c.querySelector('.bench-sel').value, sub = c.querySelector('.bench-in').checked; if (p) { bench.push({ player: p, subbed_in: sub, position_played: sub ? c.querySelector('.bench-pos').value : null }); (sub ? subsIn : subsOut).push(p); } });
    const sc = rowsOf('scorer'), as = {}; rowsOf('assist').forEach(r => as[r.name] = (as[r.name] || 0) + (r.n || 1));
    const m = { id: $('matchId').value.trim() || currentId, category: $('matchCategory').value, competition_id: $('competitionSelect').value || 'friendly', date: $('matchDate').value, time: $('matchTime').value || '11:00', status: $('matchStatus').value, type: $('matchType').value || '練習試合', opponent_id: $('opponentSelect').value, isHome: $('isHome').value === 'true', score: ($('matchScore').value.trim() || (up ? 'VS' : '0 - 0')), scorers: up ? '' : fmtNames(sc, true), assists: up ? '' : Object.keys(as).map(k => as[k] > 1 ? `${k} x${as[k]}` : k).join(', '), mvp: up ? '' : $('mvpSelect').value, yellow_cards: up ? '' : fmtNames(rowsOf('yellow').map(r => ({ ...r, n: 1 })), true), red_cards: up ? '' : fmtNames(rowsOf('red').map(r => ({ ...r, n: 1 })), true), location_id: $('locationSelect').value, goalkeepers: up ? '' : rowsOf('gk').map(r => `${r.name}(${r.n || 0})`).join(', ') };
    if (tri) {
      const opp1 = $('opponentSelect').value, opp2 = $('triOpponent2Select').value, subs = readSubCards(), ev = T.mergeEvents(subs), agg = T.aggregate(subs);
      Object.assign(m, { isTriangular: true, type: 'triangular', opponent_id: opp1, opponents: [opp1, opp2].filter(Boolean), sub_matches: subs, scorers: up ? '' : ev.scorers, assists: up ? '' : ev.assists, goalkeepers: up ? '' : ev.goalkeepers });
      if (up) m.score = 'VS'; else if (agg.complete) m.score = `${agg.gf} - ${agg.ga}`;
    }
    if (!up || starters.length || bench.length) Object.assign(m, { formation: $('formationSelect').value, starters_positions: sp, starters, substitutes_in: subsIn, substitutes_unused: subsOut, bench_details: bench, lineup: [...starters, ...subsIn] });
    return m;
  }
  function fillForm(m) {
    const subs = T.subList(m), tri = T.isTri(m);
    $('matchStatus').value = m.status || 'past'; $('matchDate').value = m.date || todayJST(); $('matchTime').value = m.time || '11:00';
    $('matchCategory').value = m.category === 'official' ? 'league' : (['friendly', 'league', 'cup'].includes(m.category) ? m.category : 'friendly');
    const type = tri ? 'triangular' : (m.type || '練習試合'); ensureTypeOption(type); $('matchType').value = type;
    renderSelects();
    const comp = m.competition_id || (D.competitions.find(c => c.category === $('matchCategory').value) || {}).id || 'friendly'; $('competitionSelect').value = comp;
    const opps = T.opponentsOf(m);
    if (tri ? opps[0] : m.opponent_id) $('opponentSelect').value = tri ? opps[0] : m.opponent_id;
    $('triOpponent2Select').value = tri ? (opps[1] || '') : '';
    $('isTriangular').value = String(tri); rememberOpp();
    if (m.location_id) $('locationSelect').value = m.location_id;
    $('isHome').value = String(m.isHome !== false); $('matchScore').value = m.score || 'VS';
    $('formationSelect').value = FORM[m.formation] ? m.formation : '4-4-2';
    trialists = m._trialists || trialists; renderTrialists();
    renderPitch();
    Object.entries(m.starters_positions || {}).forEach(([pos, n]) => { const s = document.querySelector(`#pitchGrid .squad-sel[data-pos="${pos}"]`); if (s) ensureOption(s, findValue(n)); });
    (m.bench_details || []).forEach((b, i) => { const c = document.querySelector(`[data-slot="${i + 1}"]`); if (!c) return; ensureOption(c.querySelector('.bench-sel'), findValue(b.player)); const chk = c.querySelector('.bench-in'); chk.checked = !!b.subbed_in; c.querySelector('.bench-pos').disabled = !b.subbed_in; if (b.position_played) c.querySelector('.bench-pos').value = b.position_played; });
    Object.values(ROWS).forEach(([cid]) => $(cid).innerHTML = ''); $('subMatchesContainer').innerHTML = '';
    if (tri) subs.forEach(s => addSubCard(s));
    else { parseList(m.scorers).forEach(e => addRow('scorer', e)); parseList(m.assists).forEach(e => addRow('assist', e)); parseList(m.goalkeepers || m.goalkeeper, true).forEach(e => addRow('gk', e)); }
    parseList(m.yellow_cards).forEach(e => addRow('yellow', e)); parseList(m.red_cards).forEach(e => addRow('red', e));
    toggleTriUI();
    refreshSelects();
    if (m.mvp && m.mvp !== 'なし' && m.mvp !== 'Nessuno') ensureOption($('mvpSelect'), findValue(m.mvp));
    updateCards(); renderMister();
  }
  function resetForm() {
    $('matchForm').reset(); trialists = []; currentId = ''; $('matchSelector').value = ''; $('statusMsg').textContent = ''; $('subMatchesContainer').innerHTML = '';
    renderSelects(); renderPitch(); Object.values(ROWS).forEach(([cid]) => $(cid).innerHTML = ''); renderTrialists(); toggleTriUI(); $('matchDate').value = todayJST(); dirty = false; clearDraft();
  }
  function loadMatch(id, quiet) {
    const m = D.matches.find(x => String(x.id).toLowerCase() === String(id).toLowerCase());
    if (!m) { if (!quiet) toast('info', `${t('m.notFound')}: ${id}`); return null; }
    currentId = m.id; fillForm(m); $('matchId').value = m.id; $('matchSelector').value = m.id; dirty = false; if (!quiet) toast('info', '✅ ' + m.id); return m;
  }
  const nextId = () => 'match-' + (D.matches.reduce((mx, m) => Math.max(mx, parseInt((String(m.id).match(/match-(\d+)/i) || [0, 0])[1], 10) || 0), 0) + 1);

  const buildStats = AD.stats.build; AD.buildStats = buildStats;

  const syncCaps = (players, stats) => players.map(p => stats.players[p.id] ? { ...p, caps: stats.players[p.id].caps || 0 } : (p.role === 'staff' ? p : { ...p, caps: 0 }));
  AD.recalc = async () => { const stats = buildStats(D.players, D.matches); if (await save({ stats, players: syncCaps(D.players, stats) }, 'Admin: recalc stats & caps')) { toast('success', '✅ ' + t('m.recalcDone')); AD.renderEntities(); renderMister(); updateCards(); } };

  /* ---------- salva / elimina ---------- */
  async function saveMatch(e) {
    e.preventDefault();
    const m = readForm(); if (!m.id) { toast('warn', t('m.noId')); $('searchInputWrap').classList.add('open'); return $('matchId').focus(); }
    $('matchId').value = m.id;
    const tri = !!m.isTriangular;
    if (tri) {
      const err = T.validate(m.sub_matches, m.opponents[0], m.opponents[1]); if (err) return toast('warn', t('m.tri.' + err), 6000);
      m.sub_matches.forEach(s => delete s._bad);
      if (m.status === 'past' && !T.aggregate(m.sub_matches).complete) toast('warn', t('m.tri.needScores'), 6000);
    } else if (m.status === 'past') {
      const sm = m.score.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/); if (!sm) return toast('warn', t('m.badScore'));
      m.score = `${sm[1]} - ${sm[2]}`;
      const sGoals = parseList(m.scorers).reduce((a, r) => a + r.n, 0); if (sGoals && sGoals !== +sm[1]) toast('warn', t('m.goalsMismatch').replace('{s}', sGoals).replace('{g}', sm[1]), 7000);
    }
    const old = D.matches.find(x => String(x.id).toLowerCase() === m.id.toLowerCase()), payload = { ...(old || {}), ...m };
    if (!tri) ['isTriangular', 'opponents', 'sub_matches', 'subMatches'].forEach(k => delete payload[k]); else delete payload.subMatches;
    if (m.status === 'upcoming' && !('formation' in m)) ['formation', 'starters_positions', 'starters', 'substitutes_in', 'substitutes_unused', 'bench_details', 'lineup'].forEach(k => delete payload[k]);
    const matches = D.matches.some(x => x.id === old?.id && old) ? D.matches.map(x => x === old ? payload : x) : [...D.matches, payload];
    const stats = buildStats(D.players, matches), issues = AD.stats.audit(matches, D.players, [payload.id]);
    const btn = $('submitBtn'); btn.disabled = true; $('statusMsg').style.color = 'var(--sky-dark)'; $('statusMsg').innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('saving')}`;
    const ok = await save({ matches, stats, players: syncCaps(D.players, stats) }, `Admin: ${old ? 'update' : 'add'} ${payload.id}`);
    btn.disabled = false;
    if (ok) {
      currentId = payload.id; dirty = false; clearDraft(); renderSelects(); $('matchSelector').value = payload.id; AD.renderEntities(); renderMister(); updateCards();
      $('statusMsg').style.color = 'var(--green)'; $('statusMsg').textContent = '✅ ' + t('saved'); toast('success', `✅ ${payload.id} · matches + stats + players`);
      if (issues.length) toast('warn', '⚠️ ' + t('m.auditN').replace('{n}', issues.length), 10000);
    } else { $('statusMsg').style.color = 'var(--red)'; $('statusMsg').textContent = '❌'; }
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
    currentId = ''; $('matchId').value = nid; $('matchDate').value = ''; $('matchScore').value = 'VS'; $$('#subMatchesContainer .sub-score').forEach(i => { i.value = 'VS'; }); $('matchStatus').value = 'upcoming'; $('matchSelector').value = ''; markDirty(); toast('info', `📋 ${nid}: ${t('m.dupDone')}`);
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
    $('lineTextOutput').value = `⚽ 【Yokohama Calcio ${tr('Annuncio Partita', 'Match Announcement', '試合案内')}】 ⚽\n\n📅 ${tr('Data', 'Date', '日付')}: ${m.date || 'TBD'}\n⏰ ${tr('Orario', 'Time', '時間')}: ${m.time}\n🛡️ ${tr('Avversario', 'Opponent', '対戦相手')}: ${oppsText(m)}\n📍 ${tr('Campo', 'Venue', '会場')}: ${locName(m.location_id)}\n${loc.maps ? '🗺️ Google Maps: ' + loc.maps + '\n' : ''}\n------------------------------\n【Titolari / スタメン】\n${st.join('\n') || 'TBD / 未定'}\n\n【Panchina / ベンチ】\n${bn.join('\n') || 'TBD / 未定'}\n------------------------------\n\nForza Yokohama Calcio! 🔥`;
  }

  /* ---------- bozza ---------- */
  function runAudit() {
    const issues = AD.stats.audit(D.matches, D.players), box = $('auditOut'), ic = { error: '⛔', warn: '⚠️', info: 'ℹ️' };
    if (!issues.length) { box.innerHTML = `<div class="audit-ok">✅ ${esc(t('m.auditNone'))}</div>`; return; }
    box.innerHTML = `<div class="audit-sum">${['error', 'warn', 'info'].map(l => `${ic[l]} ${issues.filter(i => i.level === l).length}`).join(' · ')}</div>` + issues.map(i => `<div class="audit-item audit-${i.level}"><span class="audit-ic">${ic[i.level]}</span><span><b class="audit-id" data-action="audit-open" data-id="${esc(i.id)}">${esc(i.id)}</b> <small>${esc(i.date)}</small><br>${esc(i.text)}</span></div>`).join('');
  }

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
    'restore-draft': restoreDraft, 'discard-draft': clearDraft,
    'add-sub-match': () => { addSubCard(null); markDirty(); },
    'remove-sub-match': el => { el.closest('.sub-match-card').remove(); syncAggregate(false); markDirty(); },
    'sub-add-row': el => { addRow(el.dataset.kind, null, el.closest('.sub-match-card')); markDirty(); },
    'tri-auto-score': () => syncAggregate(true),
    'run-audit': runAudit,
    'audit-open': el => { document.querySelector('.tab-btn[data-tab="tab-matches"]').click(); setTimeout(() => loadMatch(el.dataset.id), 60); }
  });
  $('subMatchesContainer').addEventListener('input', e => { if (e.target.classList.contains('sub-score')) syncAggregate(false); });
  $('matchForm').addEventListener('submit', saveMatch);
  $('tab-matches').addEventListener('input', markDirty);
  $('tab-matches').addEventListener('change', e => {
    const el = e.target; markDirty();
    if (el.id === 'isTriangular') {
      if (el.value === 'true') { ensureTypeOption('triangular'); $('matchType').value = 'triangular'; } else if ($('matchType').value === 'triangular') $('matchType').value = '練習試合';
      toggleTriUI();
    } else if (el.id === 'matchType') { const on = el.value === 'triangular'; if (on !== isTriForm()) { $('isTriangular').value = String(on); toggleTriUI(); } }
    else if (el.id === 'opponentSelect' || el.id === 'triOpponent2Select') { const prev = el.dataset.prev || ''; el.dataset.prev = el.value; refreshSubOpp(prev, el.value); }
    else if (el.id === 'formationSelect') renderPitch();
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
