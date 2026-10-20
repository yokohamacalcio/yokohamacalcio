/* js/admin-core.js — nucleo del pannello admin.
   Legge/scrive TUTTI i JSON del sito con un commit atomico (un solo push = un solo run del workflow).
   Espone window.AD per i moduli (admin-matches.js). */
'use strict';
(function () {
  const REPO = 'yokohamacalcio/yokohamacalcio', TOKEN_KEY = 'yc_gh_token';
  const $ = id => document.getElementById(id), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const cleanStr = s => String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '').trim();
  const isJa = s => /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(s);
  const todayJST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const num = v => (v === '' || v == null || isNaN(+v) ? null : parseInt(v, 10));
  const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  /* ---------- file gestiti ---------- */
  const FILES = {
    matches: { path: 'matches.json', def: [] }, players: { path: 'players.json', def: [] },
    opponents: { path: 'opponents.json', def: {} }, locations: { path: 'locations.json', def: {} },
    competitions: { path: 'competitions.json', def: [] }, news: { path: 'news.json', def: [] },
    trainings: { path: 'trainings.json', def: [] }, standings: { path: 'standings.json', def: {} }, stats: { path: 'stats.json', def: {} }
  };
  const State = { lang: sessionStorage.getItem('yc_admin_lang') || localStorage.getItem('preferred_lang') || 'it', token: sessionStorage.getItem(TOKEN_KEY) || '', branch: 'main', canPush: true, data: {}, shas: {}, wrap: {}, sort: {}, q: {}, editing: {} };
  Object.keys(FILES).forEach(k => { State.data[k] = JSON.parse(JSON.stringify(FILES[k].def)); });

  /* ---------- i18n ---------- */
  const DICT = { it: {}, ja: {}, en: {} };
  function addDict(d) { ['it', 'ja', 'en'].forEach(l => Object.assign(DICT[l], d[l] || {})); }
  const t = k => (DICT[State.lang] && DICT[State.lang][k] != null ? DICT[State.lang][k] : (DICT.it[k] != null ? DICT.it[k] : k));
  addDict({
    it: { exists: '"{k}" esiste già. Sovrascrivere?', loginSub: 'Inserisci il GitHub Token (PAT) per accedere.', loginBtn: 'Accedi', authenticated: 'Autenticato', logout: 'Logout', reset: 'Reset', save: 'Salva su GitHub', cancel: 'Annulla', search: 'Cerca…', actions: 'Azioni', yes: 'Sì', no: 'No', saving: 'Salvataggio…', saved: 'Salvato', none: 'Nessuno', confirmDelete: 'Confermi l\'eliminazione di', usedBy: 'Usato in {n} partite/record. Eliminare comunque?', stale: 'Il file {f} è cambiato su GitHub dopo il caricamento (altro editor?). Sovrascrivere?', readOnly: 'Il token non ha permessi di scrittura sul repository.', unsavedTitle: 'Modifiche non salvate', unsavedMsg: 'Ci sono modifiche non salvate. Cambiare tab?', draftFound: 'Trovato un draft non salvato.', draftRestore: 'Ripristina', draftDiscard: 'Scarta',
      tMatches: '1. Partite', tPlayers: '2. Rosa', tOpponents: '3. Avversari', tLocations: '4. Campi', tCompetitions: '5. Competizioni', tNews: '6. News', tTrainings: '7. Allenamenti', tLine: '8. Testo LINE', tJson: '9. JSON / Strumenti',
      hPlayers: 'Giocatore / Staff', hOpponents: 'Avversario', hLocations: 'Campo / Impianto', hCompetitions: 'Competizione', hNews: 'News (striscia home)', hTrainings: 'Allenamento', list: 'Elenco',
      lNumber: 'Numero maglia', lKanji: 'Nome ufficiale / Kanji', lKana: 'Nome Kana', lRomaji: 'Nome Romaji', lRole: 'Ruolo', lPosition: 'Posizione (es. CM/SB)', lLeadership: 'Leadership', lBirth: 'Data di nascita', lHometown: 'Provenienza', lPhoto: 'Foto (URL)', lCaps: 'Presenze (auto)',
      oNone: 'Nessuno', oCaptain: 'Capitano', oVice: 'Vice capitano (più di uno ok)', oManager: 'Fondatore / Mister', oGk: 'gk – Portiere', oDf: 'df – Difensore', oMf: 'mf – Centrocampista', oFw: 'fw – Attaccante', oStaff: 'staff – Tecnico',
      lKey: 'Key ID', lNameJa: 'Nome JA', lNameIt: 'Nome IT', lNameEn: 'Nome EN', lLogo: 'Logo (percorso)', lSurface: 'Superficie', lMaps: 'Link Google Maps', sArtificial: 'Sintetico', sClay: 'Terra battuta', sGrass: 'Erba naturale', sKeep: '(mantieni attuale)',
      lId: 'ID', lCategory: 'Categoria', lSeason: 'Stagione', lDivision: 'Divisione', lBlock: 'Blocco', lShortJa: 'Sigla JA', lShortIt: 'Sigla IT', lShortEn: 'Sigla EN', lStandings: 'Ha classifica', lColor: 'Colore badge', cFriendly: 'Amichevole', cLeague: 'Campionato', cCup: 'Coppa',
      lDate: 'Data', lType: 'Tipo', lLink: 'Link', lTitleJa: 'Titolo JA', lTitleIt: 'Titolo IT', lTitleEn: 'Titolo EN', lExpires: 'Scade il (opz.)', nInfo: 'Avviso', nTrial: 'Selezioni giocatori', nStaff: 'Selezioni staff', nLeague: 'Campionato', nCup: 'Coppa', nMatch: 'Partite', nNotice: 'Importante',
      lStart: 'Inizio', lEnd: 'Fine', lMeet: 'Ritrovo', lVenue: 'Sede', lUrl: 'Link mappa', lSurfaceTxt: 'Terreno (testo)', lStatus: 'Stato', lTrialOpen: 'Prove aperte', lLocation: 'Campo (opzionale)', lNoteJa: 'Nota JA', lNoteIt: 'Nota IT', lNoteEn: 'Nota EN', stUpcoming: 'In programma', stPast: 'Svolto', stCancelled: 'Annullato', dup7: 'Duplica +7 giorni', thName: 'Nome', thRole: 'Ruolo', thPos: 'Pos.', thTitle: 'Titolo', thLogo: 'Logo', thUsed: 'Usi',
      jsonFile: 'File', jsonLoad: 'Carica', jsonValidate: 'Valida', jsonSave: 'Salva file', jsonOk: 'JSON valido', recalcTitle: 'Ricalcola stats e presenze', recalcBtn: 'Ricalcola stats.json e caps', backup: 'Backup / Ripristino', exportBtn: 'Esporta backup', importBtn: 'Importa backup', jsonWarn: 'Attenzione: modifica diretta del file. Usa il formato corretto.' },
    ja: { exists: '「{k}」は既に存在します。上書きしますか？', loginSub: 'アクセスするには GitHub Token (PAT) を入力してください。', loginBtn: 'ログイン', authenticated: '認証済み', logout: 'ログアウト', reset: 'リセット', save: 'GitHub に保存', cancel: 'キャンセル', search: '検索…', actions: '操作', yes: 'はい', no: 'いいえ', saving: '保存中…', saved: '保存しました', none: 'なし', confirmDelete: '削除しますか:', usedBy: '{n}件で使用中です。それでも削除しますか？', stale: '{f} は読込後にGitHub上で変更されています。上書きしますか？', readOnly: 'このトークンには書き込み権限がありません。', unsavedTitle: '未保存の変更', unsavedMsg: '未保存の変更があります。タブを切り替えますか？', draftFound: '未保存の下書きがあります。', draftRestore: '復元', draftDiscard: '破棄',
      tMatches: '1. 試合', tPlayers: '2. 選手', tOpponents: '3. 対戦相手', tLocations: '4. 会場', tCompetitions: '5. 大会', tNews: '6. ニュース', tTrainings: '7. 練習', tLine: '8. LINE文', tJson: '9. JSON・ツール',
      hPlayers: '選手・スタッフ', hOpponents: '対戦相手', hLocations: '会場', hCompetitions: '大会・リーグ', hNews: 'ニュース（トップ帯）', hTrainings: '練習日程', list: '一覧',
      lNumber: '背番号', lKanji: '氏名', lKana: 'フリガナ', lRomaji: 'ローマ字', lRole: '役割', lPosition: 'ポジション (例 CM/SB)', lLeadership: '役職', lBirth: '生年月日', lHometown: '出身地', lPhoto: '写真URL', lCaps: '出場数 (自動)',
      oNone: 'なし', oCaptain: 'キャプテン', oVice: '副キャプテン（複数可）', oManager: '創設者・監督', oGk: 'gk – GK', oDf: 'df – DF', oMf: 'mf – MF', oFw: 'fw – FW', oStaff: 'staff – スタッフ',
      lKey: 'Key ID', lNameJa: '名称 JA', lNameIt: '名称 IT', lNameEn: '名称 EN', lLogo: 'ロゴ (パス)', lSurface: 'ピッチ', lMaps: 'Google Maps', sArtificial: '人工芝', sClay: 'クレー（土）', sGrass: '天然芝', sKeep: '(現状維持)',
      lId: 'ID', lCategory: 'カテゴリ', lSeason: 'シーズン', lDivision: '部', lBlock: 'ブロック', lShortJa: '略称 JA', lShortIt: '略称 IT', lShortEn: '略称 EN', lStandings: '順位表あり', lColor: 'バッジ色', cFriendly: '練習試合', cLeague: 'リーグ戦', cCup: 'カップ戦',
      lDate: '日付', lType: '種別', lLink: 'リンク', lTitleJa: 'タイトル JA', lTitleIt: 'タイトル IT', lTitleEn: 'タイトル EN', lExpires: '掲載終了日 (任意)', nInfo: 'お知らせ', nTrial: '選手募集', nStaff: 'スタッフ募集', nLeague: 'リーグ', nCup: 'カップ', nMatch: '試合情報', nNotice: '重要',
      lStart: '開始', lEnd: '終了', lMeet: '集合', lVenue: '場所', lUrl: '地図リンク', lSurfaceTxt: '路面', lStatus: '状態', lTrialOpen: '体験受付中', lLocation: '会場 (任意)', lNoteJa: '備考 JA', lNoteIt: '備考 IT', lNoteEn: '備考 EN', stUpcoming: '予定', stPast: '終了', stCancelled: '中止', dup7: '+7日で複製', thName: '氏名', thRole: '役割', thPos: 'Pos', thTitle: 'タイトル', thLogo: 'ロゴ', thUsed: '使用',
      jsonFile: 'ファイル', jsonLoad: '読込', jsonValidate: '検証', jsonSave: '保存', jsonOk: 'JSON は正常です', recalcTitle: 'スタッツ・出場数の再計算', recalcBtn: 'stats.json と caps を再計算', backup: 'バックアップ・復元', exportBtn: 'バックアップを出力', importBtn: 'バックアップを読込', jsonWarn: '注意: ファイルを直接編集します。形式に注意してください。' },
    en: { exists: '"{k}" already exists. Overwrite?', loginSub: 'Enter your GitHub Personal Access Token (PAT).', loginBtn: 'Login', authenticated: 'Authenticated', logout: 'Logout', reset: 'Reset', save: 'Save to GitHub', cancel: 'Cancel', search: 'Search…', actions: 'Actions', yes: 'Yes', no: 'No', saving: 'Saving…', saved: 'Saved', none: 'None', confirmDelete: 'Delete', usedBy: 'Used in {n} records. Delete anyway?', stale: '{f} changed on GitHub since it was loaded (another editor?). Overwrite?', readOnly: 'This token has no write permission on the repository.', unsavedTitle: 'Unsaved changes', unsavedMsg: 'You have unsaved changes. Switch tab?', draftFound: 'Unsaved draft found.', draftRestore: 'Restore', draftDiscard: 'Discard',
      tMatches: '1. Matches', tPlayers: '2. Squad', tOpponents: '3. Opponents', tLocations: '4. Venues', tCompetitions: '5. Competitions', tNews: '6. News', tTrainings: '7. Trainings', tLine: '8. LINE text', tJson: '9. JSON / Tools',
      hPlayers: 'Player / Staff', hOpponents: 'Opponent', hLocations: 'Venue', hCompetitions: 'Competition', hNews: 'News (home ticker)', hTrainings: 'Training session', list: 'List',
      lNumber: 'Shirt number', lKanji: 'Official name / Kanji', lKana: 'Kana name', lRomaji: 'Romaji name', lRole: 'Role', lPosition: 'Position (e.g. CM/SB)', lLeadership: 'Leadership', lBirth: 'Birth date', lHometown: 'Hometown', lPhoto: 'Photo (URL)', lCaps: 'Caps (auto)',
      oNone: 'None', oCaptain: 'Captain', oVice: 'Vice captain (several allowed)', oManager: 'Founder / Manager', oGk: 'gk – Goalkeeper', oDf: 'df – Defender', oMf: 'mf – Midfielder', oFw: 'fw – Forward', oStaff: 'staff – Technical',
      lKey: 'Key ID', lNameJa: 'Name JA', lNameIt: 'Name IT', lNameEn: 'Name EN', lLogo: 'Logo (path)', lSurface: 'Surface', lMaps: 'Google Maps link', sArtificial: 'Artificial turf', sClay: 'Clay / dirt', sGrass: 'Natural grass', sKeep: '(keep current)',
      lId: 'ID', lCategory: 'Category', lSeason: 'Season', lDivision: 'Division', lBlock: 'Block', lShortJa: 'Short JA', lShortIt: 'Short IT', lShortEn: 'Short EN', lStandings: 'Has standings', lColor: 'Badge colour', cFriendly: 'Friendly', cLeague: 'League', cCup: 'Cup',
      lDate: 'Date', lType: 'Type', lLink: 'Link', lTitleJa: 'Title JA', lTitleIt: 'Title IT', lTitleEn: 'Title EN', lExpires: 'Expires (opt.)', nInfo: 'Notice', nTrial: 'Player recruitment', nStaff: 'Staff recruitment', nLeague: 'League', nCup: 'Cup', nMatch: 'Matches', nNotice: 'Important',
      lStart: 'Start', lEnd: 'End', lMeet: 'Meet-up', lVenue: 'Venue', lUrl: 'Map link', lSurfaceTxt: 'Surface (text)', lStatus: 'Status', lTrialOpen: 'Trials open', lLocation: 'Venue (optional)', lNoteJa: 'Note JA', lNoteIt: 'Note IT', lNoteEn: 'Note EN', stUpcoming: 'Upcoming', stPast: 'Done', stCancelled: 'Cancelled', dup7: 'Duplicate +7 days', thName: 'Name', thRole: 'Role', thPos: 'Pos', thTitle: 'Title', thLogo: 'Logo', thUsed: 'Uses',
      jsonFile: 'File', jsonLoad: 'Load', jsonValidate: 'Validate', jsonSave: 'Save file', jsonOk: 'JSON is valid', recalcTitle: 'Recalculate stats & caps', recalcBtn: 'Recalculate stats.json and caps', backup: 'Backup / Restore', exportBtn: 'Export backup', importBtn: 'Import backup', jsonWarn: 'Warning: editing the file directly. Keep the correct format.' }
  });
  function applyI18n() {
    $$('[data-i18n]').forEach(el => { const v = DICT[State.lang][el.dataset.i18n]; if (v != null) el.textContent = v; });
    $$('[data-i18n-ph]').forEach(el => { const v = DICT[State.lang][el.dataset.i18nPh]; if (v != null) el.setAttribute('placeholder', v); });
    $$('.lang-btn-admin').forEach(b => b.classList.toggle('active', b.dataset.lang === State.lang));
    document.documentElement.lang = State.lang;
  }
  const hooks = { lang: [], loaded: [] };
  function setLanguage(l) {
    if (!DICT[l]) return;
    State.lang = l; sessionStorage.setItem('yc_admin_lang', l);
    applyI18n(); renderEntities(); hooks.lang.forEach(f => f());
  }

  /* ---------- toast & modali ---------- */
  function toast(type, msg, ms = 4000) {
    const c = $('toastContainer'), d = document.createElement('div');
    const ic = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warn: 'fa-exclamation-triangle' }[type] || 'fa-info-circle';
    d.className = 'toast toast-' + type; d.innerHTML = `<i class="fas ${ic}"></i><div>${esc(msg)}</div>`;
    c.appendChild(d); requestAnimationFrame(() => d.classList.add('show'));
    setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 300); }, ms);
  }
  let modalResolve = null;
  function modal(o = {}) {
    return new Promise(res => {
      modalResolve = res; $('modalTitle').textContent = o.title || ''; $('modalBody').innerHTML = o.body || '';
      const ok = $('modalConfirm'); ok.textContent = o.ok || 'OK'; ok.className = o.danger ? 'btn-modal-danger' : 'btn-modal-confirm';
      $('modalCancel').textContent = o.cancel || t('cancel'); $('modalOverlay').classList.add('show');
      setTimeout(() => { const i = $('modalBody').querySelector('input,textarea'); (i || ok).focus(); }, 80);
    });
  }
  function closeModal(r) { $('modalOverlay').classList.remove('show'); if (modalResolve) { modalResolve(r); modalResolve = null; } }
  const confirmBox = (msg, danger = false, title) => modal({ title: title || '⚠️', body: `<p>${esc(msg)}</p>`, ok: t('yes'), cancel: t('no'), danger });
  const promptBox = (title, ph = '') => modal({ title, body: `<input type="text" class="form-control" placeholder="${esc(ph)}">` });

  /* ---------- GitHub ---------- */
  const b64 = s => { const b = new TextEncoder().encode(s); let r = ''; b.forEach(x => r += String.fromCharCode(x)); return btoa(r); };
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, '')), c => c.charCodeAt(0)));
  async function gh(method, path, body) {
    const r = await fetch('https://api.github.com/repos/' + REPO + path, { method, headers: { Authorization: 'Bearer ' + State.token, Accept: 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404) return null;
    if (!r.ok) {
      let d = ''; try { d = (await r.json()).message || ''; } catch (_) {}
      const msg = { 401: 'Token scaduto/non valido', 403: 'Permessi insufficienti o rate limit', 409: 'Conflitto: ricarica la pagina', 422: 'Richiesta non valida' }[r.status] || 'Errore';
      const e = new Error(`${r.status} ${msg} ${d}`.trim()); e.status = r.status; throw e;
    }
    return r.json();
  }
  /* i file "array" possono essere avvolti ({competitions:[…]}): lo ricordo e lo ripristino in scrittura */
  function unwrap(name, raw) {
    const def = FILES[name].def;
    if (Array.isArray(def) && raw && !Array.isArray(raw) && typeof raw === 'object') {
      const k = Array.isArray(raw[name]) ? name : Object.keys(raw).find(x => Array.isArray(raw[x]));
      if (k) { State.wrap[name] = k; return raw[k]; }
    }
    return raw == null ? JSON.parse(JSON.stringify(def)) : raw;
  }
  const wrapOut = (name, data) => (State.wrap[name] ? { [State.wrap[name]]: data } : data);
  const serialize = (name, data) => JSON.stringify(wrapOut(name, data), null, 2) + '\n';

  async function readFile(name) {
    const f = await gh('GET', '/contents/' + FILES[name].path + '?ref=' + encodeURIComponent(State.branch));
    if (!f) { State.shas[name] = null; State.data[name] = JSON.parse(JSON.stringify(FILES[name].def)); return; }
    State.shas[name] = f.sha;
    State.data[name] = unwrap(name, JSON.parse(unb64(f.content)));
  }
  /** Salva uno o più file in UN commit. changes = { players: [...], stats: {...} } */
  async function commit(changes, message) {
    if (!State.canPush) throw new Error(t('readOnly'));
    const names = Object.keys(changes);
    for (const n of names) {                       // controllo concorrenza
      const cur = await gh('GET', '/contents/' + FILES[n].path + '?ref=' + encodeURIComponent(State.branch));
      if (cur && State.shas[n] && cur.sha !== State.shas[n]) {
        if (!await confirmBox(t('stale').replace('{f}', FILES[n].path), true)) throw new Error('cancelled');
      }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = await gh('GET', '/git/ref/heads/' + State.branch);
      const head = ref.object.sha, hc = await gh('GET', '/git/commits/' + head);
      const tree = [], blobShas = {};
      for (const n of names) {
        const b = await gh('POST', '/git/blobs', { content: serialize(n, changes[n]), encoding: 'utf-8' });
        blobShas[n] = b.sha; tree.push({ path: FILES[n].path, mode: '100644', type: 'blob', sha: b.sha });
      }
      const nt = await gh('POST', '/git/trees', { base_tree: hc.tree.sha, tree });
      const nc = await gh('POST', '/git/commits', { message, tree: nt.sha, parents: [head] });
      try {
        await gh('PATCH', '/git/refs/heads/' + State.branch, { sha: nc.sha });
        names.forEach(n => { State.data[n] = changes[n]; State.shas[n] = blobShas[n]; });
        return;
      } catch (e) { if (e.status !== 422 || attempt) throw e; }   // il ramo si è mosso: riprova una volta
    }
  }
  const save = async (changes, msg) => { try { await commit(changes, msg); return true; } catch (e) { if (e.message !== 'cancelled') toast('error', '❌ ' + e.message, 8000); if (e.status === 401) setTimeout(logout, 2500); return false; } };

  /* ---------- login ---------- */
  async function login(token) {
    const err = $('loginError'), btn = $('loginBtn'); err.textContent = ''; btn.disabled = true;
    try {
      State.token = token;
      const r = await fetch('https://api.github.com/repos/' + REPO, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) { err.textContent = r.status === 401 ? '❌ Token non valido o scaduto.' : '❌ Repository non accessibile (' + r.status + ').'; sessionStorage.removeItem(TOKEN_KEY); State.token = ''; return; }
      const info = await r.json(); State.branch = info.default_branch || 'main'; State.canPush = !info.permissions || info.permissions.push !== false;
      sessionStorage.setItem(TOKEN_KEY, token);
      $('loginSection').classList.add('hidden'); $('adminDashboard').classList.remove('hidden');
      if (!State.canPush) toast('warn', t('readOnly'), 8000);
      await loadAll();
    } catch (e) { err.textContent = '❌ ' + e.message; } finally { btn.disabled = false; }
  }
  function logout() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem('yc_admin_draft'); location.reload(); }
  async function loadAll() {
    const res = await Promise.allSettled(Object.keys(FILES).map(readFile));
    const bad = res.map((r, i) => r.status === 'rejected' ? Object.keys(FILES)[i] : null).filter(Boolean);
    if (bad.length) toast('error', '⚠️ ' + bad.join(', '), 7000);
    renderEntities(); hooks.loaded.forEach(f => f());
  }

  /* ---------- motore CRUD generico ---------- */
  const PREF = 'hokkaido aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma saitama chiba tokyo kanagawa niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi mie shiga kyoto osaka hyogo nara wakayama tottori shimane okayama hiroshima yamaguchi tokushima kagawa ehime kochi fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa'.split(' ').concat(['italy', 'mexico']);
  const SURF = { artificial: { ja: '人工芝', it: 'Sintetico', en: 'Artificial Turf' }, clay: { ja: 'クレー（土）', it: 'Terra battuta', en: 'Clay / Dirt' }, grass: { ja: '天然芝', it: 'Erba naturale', en: 'Natural Grass' } };
  const surfKey = s => { const j = (s && (s.ja || s)) || ''; return /クレー|土|clay/i.test(j) ? 'clay' : /天然芝|grass/i.test(j) ? 'grass' : /人工芝|artificial/i.test(j) ? 'artificial' : ''; };
  const F = (n, l, o = {}) => Object.assign({ n, l, t: 'text' }, o);
  const matchRefs = (pred) => (State.data.matches || []).filter(pred).length;
  const nm = (o, lang) => (o && (o[lang] || o.it || o.en || o.ja)) || '';
  const badge = (txt, cls) => `<span class="pos-badge ${cls || ''}">${esc(txt)}</span>`;
  const LEAD = { captain: ['👑 CAP', 'badge-captain'], vice_captain: ['🎖️ VICE', 'badge-vice'], manager: ['🧢 MGR', 'badge-mgr'], founder: ['🧢 MGR', 'badge-mgr'] };
  const pname = (p, lang) => lang === 'ja' ? ((p.name_kanji && isJa(p.name_kanji)) ? p.name_kanji : (p.name_kana || p.name_kanji || p.name_romaji)) : (p.name_romaji || p.name_kanji || p.name_kana);

  const ENT = {
    players: {
      file: 'players', kind: 'array', icon: 'fa-users', title: 'hPlayers',
      rows: [[F('number', 'lNumber', { t: 'number' }), F('name_kanji', 'lKanji', { req: 1 }), F('name_kana', 'lKana'), F('name_romaji', 'lRomaji')],
        [F('role', 'lRole', { t: 'select', o: [['gk', 'oGk'], ['df', 'oDf'], ['mf', 'oMf'], ['fw', 'oFw'], ['staff', 'oStaff']] }), F('position', 'lPosition'), F('leadership_role', 'lLeadership', { t: 'select', o: [['', 'oNone'], ['captain', 'oCaptain'], ['vice_captain', 'oVice'], ['manager', 'oManager']] })],
        [F('birth_date', 'lBirth', { t: 'date' }), F('hometown', 'lHometown', { list: PREF }), F('photo', 'lPhoto', { t: 'url' })]],
      cols: [['#', o => `<b>${o.number ?? '-'}</b>`, o => o.number ?? 9999], ['thName', o => esc(pname(o, State.lang)), o => cleanStr(pname(o, State.lang))], ['Romaji', o => esc(o.name_romaji || '-'), o => cleanStr(o.name_romaji)], ['thRole', o => badge((o.role || '').toUpperCase()), o => o.role], ['thPos', o => esc(o.position || '-'), o => o.position], ['lLeadership', o => LEAD[o.leadership_role] ? badge(...LEAD[o.leadership_role].slice(0, 1), LEAD[o.leadership_role][1]) : '-', o => o.leadership_role || 'z'], ['lHometown', o => esc(o.hometown || '-'), o => o.hometown], ['lCaps', o => `<b>${o.caps ?? 0}</b>`, o => o.caps || 0]],
      defSort: 0,
      fill: o => ({ number: o.number ?? '', name_kanji: o.name_kanji || '', name_kana: o.name_kana || '', name_romaji: o.name_romaji || '', role: o.role || 'mf', position: o.position || '', leadership_role: o.leadership_role || '', birth_date: o.birth_date || '', hometown: o.hometown || '', photo: o.photo || '' }),
      makeId: v => { const base = slug(v.name_romaji) || (v.number !== '' ? 'player-' + v.number : 'player-' + Date.now()); let id = base, i = 2; while (State.data.players.some(p => p.id === id)) id = base + '-' + i++; return id; },
      build: (v, old, id) => { const rest = { ...(old || {}) }; ['id', 'number', 'role', 'position', 'leadership_role', 'name_kanji', 'name_kana', 'name_romaji', 'birth_date', 'hometown', 'caps', 'photo'].forEach(k => delete rest[k]);
        const o = { id, number: num(v.number), role: v.role, position: v.position.toUpperCase(), leadership_role: v.leadership_role || null, name_kanji: v.name_kanji, name_kana: v.name_kana, name_romaji: v.name_romaji, birth_date: v.birth_date || null, hometown: (v.hometown || 'kanagawa').toLowerCase(), caps: old ? (old.caps || 0) : 0 };
        if (v.photo || (old && 'photo' in old)) o.photo = v.photo || null; return { ...o, ...rest }; },
      pre: async (v, old) => {   // un solo capitano: se ne esiste un altro chiede di sostituirlo (i vice possono essere più d'uno)
        if (v.leadership_role !== 'captain') return true;
        const other = State.data.players.find(p => p.leadership_role === 'captain' && p.id !== (old && old.id));
        if (!other) return true;
        if (!await confirmBox(`${pname(other, State.lang)} → ${t('oNone')}?`, false, t('oCaptain'))) return false;
        other.leadership_role = null; return true; },
      refs: p => matchRefs(m => JSON.stringify(m).includes(p.name_kanji || '\u0000') || JSON.stringify(m).includes(p.name_romaji || '\u0000')),
      summary: () => { const L = State.data.players, c = L.filter(p => p.leadership_role === 'captain').map(p => pname(p, State.lang)), v = L.filter(p => p.leadership_role === 'vice_captain').map(p => pname(p, State.lang)); return `${L.length} · 👑 ${c.join(', ') || '–'} · 🎖️ ${v.join(', ') || '–'}`; }
    },
    opponents: {
      file: 'opponents', kind: 'map', icon: 'fa-shield-halved', title: 'hOpponents',
      rows: [[F('key', 'lKey', { req: 1 }), F('ja', 'lNameJa', { req: 1 }), F('it', 'lNameIt'), F('en', 'lNameEn')], [F('logo', 'lLogo')]],
      cols: [['lKey', (o, k) => `<b>${esc(k)}</b>`, (o, k) => k], ['lNameJa', o => esc(nm(o.name, 'ja')), o => nm(o.name, 'ja')], ['lNameIt', o => esc(nm(o.name, 'it')), o => nm(o.name, 'it')], ['lNameEn', o => esc(nm(o.name, 'en')), o => nm(o.name, 'en')], ['thLogo', o => o.logo ? `<img src="${esc(String(o.logo).replace(/^\.\//, ''))}" alt="" class="thumb" onerror="this.style.display='none'">` : '-', null], ['thUsed', (o, k) => matchRefs(m => m.opponent_id === k), (o, k) => matchRefs(m => m.opponent_id === k)]],
      defSort: 0,
      fill: (o, k) => ({ key: k, ja: nm(o.name, 'ja'), it: (o.name || {}).it || '', en: (o.name || {}).en || '', logo: o.logo || '' }),
      keyOf: v => slug(v.key),
      build: (v, old, k) => ({ ...(old || {}), name: { ja: v.ja, it: v.it || v.en || v.ja, en: v.en || v.it || v.ja }, logo: v.logo || `./immagini/opponents/${k}.png` }),
      refs: (o, k) => matchRefs(m => m.opponent_id === k)
    },
    locations: {
      file: 'locations', kind: 'map', icon: 'fa-map-marker-alt', title: 'hLocations',
      rows: [[F('key', 'lKey', { req: 1 }), F('surface', 'lSurface', { t: 'select', o: [['artificial', 'sArtificial'], ['clay', 'sClay'], ['grass', 'sGrass'], ['__keep', 'sKeep']] })], [F('ja', 'lNameJa', { req: 1 }), F('it', 'lNameIt'), F('en', 'lNameEn')], [F('maps', 'lMaps', { t: 'url' })]],
      cols: [['lKey', (o, k) => `<b>${esc(k)}</b>`, (o, k) => k], ['lNameJa', o => esc(o.ja || ''), o => o.ja], ['lNameIt', o => esc(o.it || '-'), o => o.it], ['lSurface', o => esc((o.surface && (o.surface[State.lang] || o.surface.it)) || '-'), o => surfKey(o.surface)], ['Maps', o => o.maps ? `<a href="${esc(o.maps)}" target="_blank" rel="noopener">Link</a>` : '-', null], ['thUsed', (o, k) => matchRefs(m => m.location_id === k) + State.data.trainings.filter(x => x.location_id === k).length, null]],
      defSort: 0,
      fill: (o, k) => ({ key: k, surface: surfKey(o.surface) || '__keep', ja: o.ja || '', it: o.it || '', en: o.en || '', maps: o.maps || '' }),
      keyOf: v => slug(v.key),
      build: (v, old) => ({ ...(old || {}), ja: v.ja, it: v.it || v.ja, en: v.en || v.ja, surface: v.surface === '__keep' ? (old && old.surface) || SURF.artificial : SURF[v.surface], maps: v.maps }),
      refs: (o, k) => matchRefs(m => m.location_id === k) + State.data.trainings.filter(x => x.location_id === k).length
    },
    competitions: {
      file: 'competitions', kind: 'array', icon: 'fa-trophy', title: 'hCompetitions',
      rows: [[F('id', 'lId', { req: 1 }), F('category', 'lCategory', { t: 'select', o: [['friendly', 'cFriendly'], ['league', 'cLeague'], ['cup', 'cCup']] }), F('season', 'lSeason', { ph: '2027 / all' }), F('division', 'lDivision'), F('block', 'lBlock')], [F('name_ja', 'lNameJa', { req: 1 }), F('name_it', 'lNameIt'), F('name_en', 'lNameEn')], [F('short_ja', 'lShortJa'), F('short_it', 'lShortIt'), F('short_en', 'lShortEn'), F('badge_color', 'lColor', { t: 'color' }), F('has_standings', 'lStandings', { t: 'checkbox' })]],
      cols: [['lId', o => `<b>${esc(o.id)}</b>`, o => o.id], ['lCategory', o => badge(o.category), o => o.category], ['lSeason', o => esc(o.season || '-'), o => o.season], ['lDivision', o => esc([o.division && o.division + '部', o.block && o.block + 'ブロック'].filter(Boolean).join(' ') || '-'), null], ['lNameJa', o => esc(nm(o.name, 'ja')), o => nm(o.name, 'ja')], ['lNameIt', o => esc(nm(o.name, 'it')), null], ['lStandings', o => o.has_standings ? '✅' : '–', null], ['lColor', o => `<span class="swatch" style="background:${esc(o.badge_color || '#64748b')}"></span>`, null]],
      defSort: 2,
      fill: o => ({ id: o.id, category: o.category || 'friendly', season: o.season || '', division: o.division || '', block: o.block || '', name_ja: (o.name || {}).ja || '', name_it: (o.name || {}).it || '', name_en: (o.name || {}).en || '', short_ja: (o.short_name || {}).ja || '', short_it: (o.short_name || {}).it || '', short_en: (o.short_name || {}).en || '', badge_color: o.badge_color || '#64748b', has_standings: !!o.has_standings }),
      makeId: v => slug(v.id).replace(/-/g, '_'),
      build: (v, old, id) => ({ ...(old || {}), id, category: v.category, season: v.season || 'all', division: v.division, block: v.block, name: { ja: v.name_ja, it: v.name_it || v.name_en || v.name_ja, en: v.name_en || v.name_it || v.name_ja }, short_name: { ja: v.short_ja || v.name_ja, it: v.short_it || v.name_it || v.name_ja, en: v.short_en || v.name_en || v.name_ja }, has_standings: !!v.has_standings, badge_color: v.badge_color }),
      refs: c => matchRefs(m => m.competition_id === c.id)
    },
    news: {
      file: 'news', kind: 'array', icon: 'fa-newspaper', title: 'hNews',
      rows: [[F('date', 'lDate', { t: 'date', req: 1 }), F('type', 'lType', { t: 'select', o: [['info', 'nInfo'], ['trial', 'nTrial'], ['staff', 'nStaff'], ['league', 'nLeague'], ['cup', 'nCup'], ['match', 'nMatch'], ['notice', 'nNotice']] }), F('link', 'lLink', { ph: 'contact.html?type=trial' }), F('expires', 'lExpires', { t: 'date' })], [F('ja', 'lTitleJa', { req: 1 }), F('it', 'lTitleIt'), F('en', 'lTitleEn')]],
      cols: [['lDate', o => `<b>${esc(o.date)}</b>`, o => o.date], ['lType', o => badge(o.type), o => o.type], ['lTitleJa', o => esc((o.ja || (o.title || {}).ja || '')), null], ['lTitleIt', o => esc((o.it || (o.title || {}).it || '-')), null], ['lLink', o => esc(o.link || '-'), null], ['lExpires', o => esc(o.expires || '-'), o => o.expires || '']],
      defSort: 0, defDir: -1,
      fill: o => ({ date: o.date || '', type: o.type || 'info', link: o.link || '', expires: o.expires || '', ja: o.ja || (o.title || {}).ja || '', it: o.it || (o.title || {}).it || '', en: o.en || (o.title || {}).en || '' }),
      makeId: v => { const base = 'news_' + String(v.date).replace(/-/g, ''); let id = base, i = 2; while (State.data.news.some(n => n.id === id)) id = base + '_' + i++; return id; },
      build: (v, old, id) => { const o = { ...(old || {}) }; delete o.title; Object.assign(o, { id, date: v.date, type: v.type, link: v.link || '', ja: v.ja }); if (v.it) o.it = v.it; else delete o.it; if (v.en) o.en = v.en; else delete o.en; if (v.expires) o.expires = v.expires; else delete o.expires; return o; }
    },
    trainings: {
      file: 'trainings', kind: 'array', icon: 'fa-running', title: 'hTrainings',
      rows: [[F('date', 'lDate', { t: 'date', req: 1 }), F('start', 'lStart', { t: 'time' }), F('end', 'lEnd', { t: 'time' }), F('meet_time', 'lMeet', { t: 'time' }), F('status', 'lStatus', { t: 'select', o: [['upcoming', 'stUpcoming'], ['past', 'stPast'], ['cancelled', 'stCancelled']] }), F('trial_open', 'lTrialOpen', { t: 'checkbox' })], [F('title_ja', 'lTitleJa'), F('title_it', 'lTitleIt'), F('title_en', 'lTitleEn')], [F('location_id', 'lLocation', { t: 'select', dyn: 'locations' }), F('venue', 'lVenue'), F('url', 'lUrl', { t: 'url' }), F('surface', 'lSurfaceTxt')], [F('note_ja', 'lNoteJa'), F('note_it', 'lNoteIt'), F('note_en', 'lNoteEn')]],
      cols: [['lDate', o => `<b>${esc(o.date)}</b>`, o => o.date], ['lStart', o => esc(o.time || '-'), null], ['lMeet', o => esc(o.meet_time || '-'), null], ['thTitle', o => esc(nm(o.title, State.lang) || '-'), null], ['lVenue', o => esc(o.venue || (State.data.locations[o.location_id] || {})[State.lang] || o.location_id || '-'), null], ['lSurfaceTxt', o => esc(o.surface || '-'), null], ['lStatus', o => badge(o.status || 'upcoming'), o => o.status], ['lTrialOpen', o => o.trial_open ? '✅' : '–', null]],
      defSort: 0, defDir: -1,
      actions: [['dup7', 'fa-clone', 'dup7']],
      fill: o => { const m = String(o.time || '').match(/(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})/), s = m ? m[1] : (String(o.time || '').match(/\d{1,2}:\d{2}/) || [''])[0]; return { date: o.date || '', start: (s ? s.padStart(5, '0') : ''), end: m ? m[2] : '', meet_time: o.meet_time || '', status: o.status || 'upcoming', trial_open: !!o.trial_open, title_ja: (o.title || {}).ja || '', title_it: (o.title || {}).it || '', title_en: (o.title || {}).en || '', location_id: o.location_id || '', venue: o.venue || '', url: o.url || '', surface: o.surface || '', note_ja: (o.note || {}).ja || '', note_it: (o.note || {}).it || '', note_en: (o.note || {}).en || '' }; },
      makeId: v => { const base = 'tr_' + String(v.date).replace(/-/g, ''); let id = base, i = 2; while (State.data.trainings.some(n => n.id === id)) id = base + '_' + i++; return id; },
      build: (v, old, id) => { const o = { ...(old || {}) }; const time = v.start ? (v.end ? v.start + ' - ' + v.end : v.start) : ''; const tt = { ja: v.title_ja || 'チームトレーニング', it: v.title_it || 'Allenamento di Squadra', en: v.title_en || 'Team Training' }; Object.assign(o, { id, date: v.date, time, meet_time: v.meet_time || '', title: tt, location_id: v.location_id || '', venue: v.venue || '', url: v.url || '', surface: v.surface || '', status: v.status, trial_open: !!v.trial_open }); const note = { ja: v.note_ja, it: v.note_it, en: v.note_en }; if (note.ja || note.it || note.en) o.note = note; else delete o.note; return o; }
    }
  };
  const entList = n => { const e = ENT[n], d = State.data[e.file]; return e.kind === 'map' ? Object.keys(d).map(k => ({ k, o: d[k] })) : d.map(o => ({ k: o.id, o })); };

  function fieldHtml(en, f) {
    const id = `f_${en}_${f.n}`, lab = `<label for="${id}" data-i18n="${f.l}">${esc(t(f.l))}</label>`;
    if (f.t === 'select') { const opts = f.dyn ? [['', '—'], ...Object.keys(State.data[f.dyn]).map(k => [k, (State.data[f.dyn][k][State.lang] || State.data[f.dyn][k].it || k) + ' (' + k + ')'])] : f.o; return `<div class="form-group">${lab}<select id="${id}" class="form-control">${opts.map(([v, l]) => `<option value="${esc(v)}">${esc(DICT.it[l] != null ? t(l) : l)}</option>`).join('')}</select></div>`; }
    if (f.t === 'checkbox') return `<div class="form-group chk">${lab.replace('<label', '<label class="inline"')}<input type="checkbox" id="${id}"></div>`;
    return `<div class="form-group">${lab}<input type="${f.t}" id="${id}" class="form-control" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.list ? `list="dl_${en}_${f.n}"` : ''} ${f.req ? 'required' : ''}>${f.list ? `<datalist id="dl_${en}_${f.n}">${f.list.map(x => `<option value="${x}">`).join('')}</datalist>` : ''}</div>`;
  }
  function buildEntityShell(en) {
    const e = ENT[en], host = $('tab-' + en); if (!host) return;
    host.innerHTML = `<div class="section-box"><h3><i class="fas ${e.icon}"></i> <span data-i18n="${e.title}"></span></h3>
      <form class="ent-form" data-ent="${en}" autocomplete="off">${e.rows.map(r => `<div class="row">${r.map(f => fieldHtml(en, f)).join('')}</div>`).join('')}
      <input type="hidden" id="edit_${en}"><div class="btn-row"><button type="submit" class="btn-submit green" data-i18n="save"></button><button type="button" class="btn-reset" data-action="ent-reset" data-ent="${en}" data-i18n="cancel"></button></div></form></div>
      <div class="section-box"><h3><i class="fas fa-list-ul"></i> <span data-i18n="list"></span> <span class="muted" id="sum_${en}"></span></h3>
      <div class="table-toolbar"><input class="form-control ent-search" data-ent="${en}" data-i18n-ph="search" style="max-width:300px"></div>
      <div class="data-table-container"><table class="data-table"><thead id="th_${en}"></thead><tbody id="tb_${en}"></tbody></table></div></div>`;
  }
  function refreshDynamicSelects() {   // select che dipendono da altri file (es. campi negli allenamenti)
    Object.keys(ENT).forEach(en => ENT[en].rows.flat().filter(f => f.dyn).forEach(f => {
      const el = $(`f_${en}_${f.n}`); if (!el) return; const cur = el.value;
      el.innerHTML = [['', '—'], ...Object.keys(State.data[f.dyn]).map(k => [k, (State.data[f.dyn][k][State.lang] || State.data[f.dyn][k].it || k) + ' (' + k + ')'])].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''); el.value = cur;
    }));
  }
  function renderEntity(en) {
    const e = ENT[en], th = $('th_' + en), tb = $('tb_' + en); if (!th || !tb) return;
    const s = State.sort[en] || (State.sort[en] = { i: e.defSort || 0, dir: e.defDir || 1 }), q = (State.q[en] || '').toLowerCase();
    th.innerHTML = `<tr>${e.cols.map((c, i) => `<th ${c[2] ? `data-action="ent-sort" data-ent="${en}" data-i="${i}" style="cursor:pointer"` : ''}>${esc(DICT.it[c[0]] != null ? t(c[0]) : c[0])}${s.i === i ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th>${t('actions')}</th></tr>`;
    let rows = entList(en);
    if (q) rows = rows.filter(r => JSON.stringify(r.o).toLowerCase().includes(q) || String(r.k).toLowerCase().includes(q));
    const sc = e.cols[s.i] && e.cols[s.i][2];
    if (sc) rows.sort((a, b) => { const x = sc(a.o, a.k), y = sc(b.o, b.k); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))) * s.dir; });
    tb.innerHTML = rows.map(({ k, o }) => `<tr>${e.cols.map(c => `<td>${c[1](o, k)}</td>`).join('')}<td class="nowrap">${(e.actions || []).map(a => `<button type="button" class="btn-edit" title="${esc(t(a[2]))}" data-action="ent-act" data-ent="${en}" data-k="${esc(k)}" data-fn="${a[0]}"><i class="fas ${a[1]}"></i></button>`).join(' ')}
      <button type="button" class="btn-edit" data-action="ent-edit" data-ent="${en}" data-k="${esc(k)}"><i class="fas fa-edit"></i></button>
      <button type="button" class="btn-delete" data-action="ent-del" data-ent="${en}" data-k="${esc(k)}"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    $('sum_' + en).textContent = e.summary ? e.summary() : '(' + rows.length + ')';
  }
  function renderEntities() { Object.keys(ENT).forEach(en => { if (!$('f_' + en + '_' + ENT[en].rows[0][0].n)) buildEntityShell(en); }); applyI18n(); refreshDynamicSelects(); Object.keys(ENT).forEach(renderEntity); }

  const getVals = en => { const v = {}; ENT[en].rows.flat().forEach(f => { const el = $(`f_${en}_${f.n}`); v[f.n] = f.t === 'checkbox' ? el.checked : String(el.value || '').trim(); }); return v; };
  const setVals = (en, v) => ENT[en].rows.flat().forEach(f => { const el = $(`f_${en}_${f.n}`); if (!el) return; if (f.t === 'checkbox') el.checked = !!v[f.n]; else el.value = v[f.n] == null ? (f.t === 'select' ? el.options[0].value : '') : v[f.n]; });
  function resetEntForm(en) { $('f_' + en + '_' + ENT[en].rows[0][0].n).closest('form').reset(); $('edit_' + en).value = ''; ENT[en].rows.flat().filter(f => f.t === 'select').forEach(f => { const el = $(`f_${en}_${f.n}`); el.value = el.options[0] ? el.options[0].value : ''; }); }

  async function saveEntity(en) {
    const e = ENT[en], v = getVals(en), editKey = $('edit_' + en).value, list = State.data[e.file];
    const old = editKey ? (e.kind === 'map' ? list[editKey] : list.find(x => x.id === editKey)) : null;
    if (e.pre && !await e.pre(v, old)) return;
    const copy = JSON.parse(JSON.stringify(list));
    if (e.kind === 'map') {
      const k = e.keyOf(v); if (!k) return toast('warn', t('lKey') + '?');
      if (!editKey && copy[k] && !await confirmBox(t('exists').replace('{k}', k), true)) return;
      if (editKey && editKey !== k) delete copy[editKey];
      copy[k] = e.build(v, old, k);
    } else {
      const id = editKey || e.makeId(v); if (!id) return toast('warn', t('lId') + '?');
      const obj = e.build(v, old, id), i = copy.findIndex(x => x.id === id);
      if (i >= 0) copy[i] = obj; else copy.push(obj);
    }
    const changes = { [e.file]: copy };
    if (await save(changes, `Admin: ${editKey ? 'update' : 'add'} ${en}`)) { toast('success', '✅ ' + FILES[e.file].path); resetEntForm(en); renderEntities(); hooks.loaded.forEach(f => f()); }
  }
  async function deleteEntity(en, k) {
    const e = ENT[en], list = State.data[e.file], obj = e.kind === 'map' ? list[k] : list.find(x => x.id === k); if (!obj) return;
    const n = e.refs ? e.refs(obj, k) : 0;
    if (!await confirmBox(n ? t('usedBy').replace('{n}', n) : `${t('confirmDelete')} "${k}"?`, true)) return;
    const copy = e.kind === 'map' ? (() => { const c = { ...list }; delete c[k]; return c; })() : list.filter(x => x.id !== k);
    if (await save({ [e.file]: copy }, `Admin: delete ${en} ${k}`)) { toast('success', '✅'); renderEntities(); hooks.loaded.forEach(f => f()); }
  }
  const ACT = {
    dup7: async k => {
      const src = State.data.trainings.find(x => x.id === k); if (!src) return;
      const d = new Date(src.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7); const date = d.toISOString().slice(0, 10);
      if (State.data.trainings.some(x => x.date === date)) return toast('warn', date + ' ✔');
      const copy = { ...JSON.parse(JSON.stringify(src)), id: 'tr_' + date.replace(/-/g, ''), date, status: 'upcoming' };
      if (await save({ trainings: [...State.data.trainings, copy] }, 'Admin: duplicate training +7d')) { toast('success', '✅ ' + date); renderEntities(); }
    }
  };

  /* ---------- JSON grezzo, backup, azioni ---------- */
  async function jsonLoad() { const n = $('jsonFile').value; $('jsonArea').value = serialize(n, State.data[n]); $('jsonMsg').textContent = ''; }
  function jsonValidate() { try { JSON.parse($('jsonArea').value); $('jsonMsg').style.color = 'var(--green)'; $('jsonMsg').textContent = '✅ ' + t('jsonOk'); return true; } catch (e) { $('jsonMsg').style.color = 'var(--red)'; $('jsonMsg').textContent = '❌ ' + e.message; return false; } }
  async function jsonSave() {
    if (!jsonValidate()) return; const n = $('jsonFile').value;
    if (!await confirmBox(FILES[n].path + ' — ' + t('jsonWarn'), true)) return;
    const raw = JSON.parse($('jsonArea').value); const data = unwrap(n, raw);
    if (await save({ [n]: data }, 'Admin: raw edit ' + FILES[n].path)) { toast('success', '✅ ' + FILES[n].path); renderEntities(); hooks.loaded.forEach(f => f()); }
  }
  function exportBackup() {
    const out = { exported_at: new Date().toISOString() }; Object.keys(FILES).forEach(k => out[k] = State.data[k]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); a.download = `yokohama-calcio-backup-${todayJST()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function importBackup(file) {
    try {
      const d = JSON.parse(await file.text()), changes = {};
      Object.keys(FILES).forEach(k => { if (k !== 'stats' && d[k] != null && typeof d[k] === typeof FILES[k].def) changes[k] = Array.isArray(FILES[k].def) ? (Array.isArray(d[k]) ? d[k] : unwrap(k, d[k])) : d[k]; });
      if (!Object.keys(changes).length) return toast('warn', 'JSON?');
      if (!await confirmBox(Object.keys(changes).map(k => FILES[k].path).join(', '), true, '⚠️ Import')) return;
      if (await save(changes, 'Admin: import backup')) { toast('success', '✅ Backup'); renderEntities(); hooks.loaded.forEach(f => f()); }
    } catch (e) { toast('error', 'JSON: ' + e.message); }
  }

  const actions = {
    'set-lang': el => setLanguage(el.dataset.lang), logout, 'toggle-dark': () => { document.body.classList.toggle('dark'); sessionStorage.setItem('yc_admin_dark', document.body.classList.contains('dark') ? '1' : '0'); $('darkIcon').className = document.body.classList.contains('dark') ? 'fas fa-sun' : 'fas fa-moon'; },
    'ent-edit': el => { const en = el.dataset.ent, e = ENT[en], k = el.dataset.k, obj = e.kind === 'map' ? State.data[e.file][k] : State.data[e.file].find(x => x.id === k); if (!obj) return; setVals(en, e.fill(obj, k)); $('edit_' + en).value = k; $('tab-' + en).scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    'ent-del': el => deleteEntity(el.dataset.ent, el.dataset.k), 'ent-reset': el => resetEntForm(el.dataset.ent),
    'ent-act': el => ACT[el.dataset.fn](el.dataset.k), 'ent-sort': el => { const s = State.sort[el.dataset.ent], i = +el.dataset.i; if (s.i === i) s.dir *= -1; else { s.i = i; s.dir = 1; } renderEntity(el.dataset.ent); },
    'json-load': jsonLoad, 'json-validate': jsonValidate, 'json-save': jsonSave, 'export-backup': exportBackup, 'import-backup': () => { $('importFile').value = ''; $('importFile').click(); },
    'recalc': async () => { if (AD.recalc) await AD.recalc(); },
    'switch-tab': async el => { if (AD.isDirty && AD.isDirty() && !await confirmBox(t('unsavedMsg'), false, '⚠️ ' + t('unsavedTitle'))) return; $$('.tab-content').forEach(x => x.classList.add('hidden')); $$('.tab-btn').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); }); $(el.dataset.tab).classList.remove('hidden'); el.classList.add('active'); el.setAttribute('aria-selected', 'true'); }
  };
  document.addEventListener('click', e => { const el = e.target.closest('[data-action]'); if (!el) return; const f = actions[el.dataset.action] || (window.AD && AD.actions[el.dataset.action]); if (f) f(el, e); });
  document.addEventListener('submit', e => { const f = e.target.closest('.ent-form'); if (f) { e.preventDefault(); saveEntity(f.dataset.ent); } });
  document.addEventListener('input', e => { if (e.target.classList.contains('ent-search')) { State.q[e.target.dataset.ent] = e.target.value; renderEntity(e.target.dataset.ent); } });
  $('modalConfirm').addEventListener('click', () => { const i = $('modalBody').querySelector('input,textarea'); closeModal(i ? i.value : true); });
  $('modalCancel').addEventListener('click', () => closeModal(null));
  $('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal(null); });
  document.addEventListener('keydown', e => { if (!$('modalOverlay').classList.contains('show')) return; if (e.key === 'Escape') closeModal(null); if (e.key === 'Enter' && document.activeElement.tagName === 'INPUT') { e.preventDefault(); $('modalConfirm').click(); } });
  $('importFile').addEventListener('change', e => e.target.files[0] && importBackup(e.target.files[0]));
  $('loginForm').addEventListener('submit', e => { e.preventDefault(); const v = $('inputToken').value.trim(); if (v) login(v); });

  window.AD = { State, FILES, ENT, $, $$, esc, cleanStr, isJa, todayJST, num, slug, t, addDict, applyI18n, hooks, toast, modal, confirmBox, promptBox, save, commit, actions, pname, nm, renderEntities, unwrap, isDirty: null, recalc: null };
  window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('yc_admin_dark') === '1') { document.body.classList.add('dark'); $('darkIcon').className = 'fas fa-sun'; }
    applyI18n(); renderEntities();
    jsonLoad();
    if (State.token) login(State.token);
  });
})();
