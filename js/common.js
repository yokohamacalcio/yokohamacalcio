/* js/common.js — nucleo condiviso (header, footer, lingua, menu, CTA).
   USO in ogni pagina:
     <head>   <script src="js/common.js"></script>
     <body>   <script>YC.mountHeader('matches')</script>   ... contenuto ...
              <script>YC.mountFooter()</script>
     fine     <script> YC.register({ja:{},it:{},en:{}}); YC.boot({title:{ja:'',it:'',en:''}}); </script>
   Le pagine ascoltano l'evento 'yc:langchange' per ridisegnare le parti dinamiche. */
(function (global) {
  'use strict';
  const LANGS = ['ja', 'it', 'en'];
  const state = { lang: 'ja', dict: { ja: {}, it: {}, en: {} }, cfg: {} };

  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const read = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };

  /* ---------- traduzioni del layout condiviso ---------- */
  const SHARED = {
    ja: { 'nav.home': 'ホーム', 'nav.about_group': 'クラブ', 'nav.team_group': 'チーム・選手', 'nav.about': 'チーム紹介', 'nav.players': '選手紹介', 'nav.stats': '成績・スタッツ', 'nav.matches': '試合日程・結果', 'nav.training': '練習日程', 'nav.gallery': 'ギャラリー', 'nav.faq': 'よくある質問', 'nav.shop': 'ショップ', 'nav.sponsors': 'パートナー', 'nav.contact': 'お問い合わせ', 'btn.back_home': 'ホームに戻る', 'cta.trial': '体験参加を申し込む' },
    it: { 'nav.home': 'Home', 'nav.about_group': 'CLUB', 'nav.team_group': 'SQUADRA', 'nav.about': 'Chi Siamo', 'nav.players': 'Giocatori', 'nav.stats': 'Statistiche', 'nav.matches': 'Partite & Risultati', 'nav.training': 'Allenamenti', 'nav.gallery': 'Galleria', 'nav.faq': 'FAQ', 'nav.shop': 'Shop', 'nav.sponsors': 'Partner', 'nav.contact': 'Contatti', 'btn.back_home': 'Torna alla Home', 'cta.trial': 'Prenota una prova' },
    en: { 'nav.home': 'Home', 'nav.about_group': 'CLUB', 'nav.team_group': 'TEAM', 'nav.about': 'About Us', 'nav.players': 'Players', 'nav.stats': 'Stats', 'nav.matches': 'Matches & Results', 'nav.training': 'Training', 'nav.gallery': 'Gallery', 'nav.faq': 'FAQ', 'nav.shop': 'Shop', 'nav.sponsors': 'Partners', 'nav.contact': 'Contact Us', 'btn.back_home': 'Back to Home', 'cta.trial': 'Book a trial' }
  };
  const ARIA = {
    ja: { menu: 'メニュー', close: '閉じる', top: 'ページ上部へ', prev: '前へ', next: '次へ' },
    it: { menu: 'Menu', close: 'Chiudi', top: 'Torna in cima', prev: 'Precedente', next: 'Successiva' },
    en: { menu: 'Menu', close: 'Close', top: 'Back to top', prev: 'Previous', next: 'Next' }
  };

  /* ---------- lingua ---------- */
  function initialLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) { store('preferred_lang', q); return q; }
    const s = read('preferred_lang');
    return LANGS.includes(s) ? s : 'ja';
  }
  state.lang = initialLang();

  function register(d) { LANGS.forEach(l => Object.assign(state.dict[l], d[l] || {})); }
  register(SHARED);
  const lang = () => state.lang;
  const t = key => { const d = state.dict[state.lang]; return d[key] != null ? d[key] : (state.dict.ja[key] != null ? state.dict.ja[key] : key); };

  function applyI18n(root) {
    const d = state.dict[state.lang];
    (root || document).querySelectorAll('[data-i18n]').forEach(el => { const v = d[el.dataset.i18n]; if (v != null) el.innerHTML = v; });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => { const v = d[el.dataset.i18nPh]; if (v != null) el.setAttribute('placeholder', v); });
  }
  function localizeAria() {
    const a = ARIA[state.lang];
    const set = (sel, txt) => document.querySelectorAll(sel).forEach(el => el.setAttribute('aria-label', txt));
    set('.mobile-menu-toggle', a.menu);
    set('.mobile-nav-close, #lightboxClose, #heatmapClose, #privacyModalCloseBtn', a.close);
    set('#scrollToTopBtn', a.top); set('#lightboxPrev', a.prev); set('#lightboxNext', a.next);
  }
  function setLang(l) {
    if (!LANGS.includes(l)) l = 'ja';
    state.lang = l; store('preferred_lang', l);
    document.documentElement.lang = l;
    const title = state.cfg.title && state.cfg.title[l];
    if (title) {
      document.title = title;
      ['meta[property="og:title"]', 'meta[name="twitter:title"]'].forEach(s => { const m = document.querySelector(s); if (m) m.setAttribute('content', title); });
    }
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
    applyI18n(); localizeAria(); renderCta();
    document.dispatchEvent(new CustomEvent('yc:langchange', { detail: l }));
  }

  /* ---------- utilità ---------- */
  const cleanStr = s => String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '').trim();
  const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const todayJST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  async function fetchJson(file, fallback) {
    try {
      const r = await fetch(file + '?v=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (_) { return fallback; }
  }

  /* ---------- header + footer (fonte unica) ---------- */
  function headerHtml(active) {
    const on = k => (active === k ? ' active' : '');
    const grp = ks => (ks.includes(active) ? ' active' : '');
    return `<header class="header">
  <div class="top-bar"><div class="container top-bar-container">
    <div class="top-bar-social">
      <a href="https://x.com/yokohamacalcio" target="_blank" rel="noopener" aria-label="X"><i class="fab fa-x-twitter"></i></a>
      <a href="https://instagram.com/yokohamacalcio" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
      <a href="https://youtube.com/@yokohamacalcio?si=NBPkZ0qFxFVrOIof" target="_blank" rel="noopener" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
    </div>
    <div class="lang-switcher">
      <button class="lang-btn" data-lang="ja">JP</button><span class="lang-divider">|</span>
      <button class="lang-btn" data-lang="it">IT</button><span class="lang-divider">|</span>
      <button class="lang-btn" data-lang="en">EN</button>
    </div>
  </div></div>
  <div class="main-header-bar"><div class="container header-container">
    <div class="logo-title">
      <a href="index.html"><img src="./immagini/logo.png?v=2" alt="Yokohama Calcio" class="logo"></a>
      <a href="index.html" class="brand-name"><span>YOKOHAMA</span><span class="brand-sub">CALCIO</span></a>
    </div>
    <div class="desktop-nav-wrapper"><nav class="main-nav">
      <div class="nav-item dropdown">
        <span class="dropdown-toggle${grp(['about', 'faq'])}" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false"><span data-i18n="nav.about_group"></span> <i class="fas fa-chevron-down nav-arrow"></i></span>
        <div class="dropdown-menu">
          <a href="about.html" class="${on('about')}" data-i18n="nav.about"></a>
          <a href="index.html#gallery" data-i18n="nav.gallery"></a>
          <a href="faq.html" class="${on('faq')}" data-i18n="nav.faq"></a>
        </div>
      </div>
      <div class="nav-item dropdown">
        <span class="dropdown-toggle${grp(['players', 'stats'])}" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false"><span data-i18n="nav.team_group"></span> <i class="fas fa-chevron-down nav-arrow"></i></span>
        <div class="dropdown-menu">
          <a href="players.html" class="${on('players')}" data-i18n="nav.players"></a>
          <a href="stats.html" class="${on('stats')}" data-i18n="nav.stats"></a>
        </div>
      </div>
      <a href="matches.html" class="${on('matches')}" data-i18n="nav.matches"></a>
      <a href="contact.html?type=trial#training" class="${on('training')}" data-i18n="nav.training"></a>
      <a href="index.html#shop" data-i18n="nav.shop"></a>
      <a href="index.html#sponsors" data-i18n="nav.sponsors"></a>
      <a href="contact.html" class="nav-cta-btn" data-i18n="nav.contact"></a>
    </nav></div>
    <button class="mobile-menu-toggle" aria-label="Menu"><i class="fas fa-bars"></i></button>
  </div></div>
  <nav class="mobile-nav hidden"><div class="mobile-nav-content">
    <div class="mobile-nav-header">
      <div class="logo-title" style="margin:0"><span class="brand-name">YOKOHAMA <span class="brand-sub">CALCIO</span></span></div>
      <button class="mobile-nav-close" aria-label="Close"><i class="fas fa-times"></i></button>
    </div>
    <a href="index.html" class="mobile-link${on('home')}"><i class="fas fa-home menu-icon"></i> <span data-i18n="nav.home"></span></a>
    <a href="about.html" class="mobile-link${on('about')}"><i class="fas fa-flag menu-icon"></i> <span data-i18n="nav.about"></span></a>
    <div class="mobile-dropdown-group">
      <button class="mobile-dropdown-toggle"><div class="mobile-dropdown-toggle-left"><i class="fas fa-shield-alt menu-icon"></i><span data-i18n="nav.team_group"></span></div><i class="fas fa-chevron-down mobile-arrow" style="color:#87ceeb"></i></button>
      <div class="mobile-submenu hidden">
        <a href="players.html" class="mobile-link sub${on('players')}" data-i18n="nav.players"></a>
        <a href="stats.html" class="mobile-link sub${on('stats')}" data-i18n="nav.stats"></a>
        <a href="index.html#gallery" class="mobile-link sub" data-i18n="nav.gallery"></a>
      </div>
    </div>
    <a href="matches.html" class="mobile-link${on('matches')}"><i class="fas fa-calendar-alt menu-icon"></i> <span data-i18n="nav.matches"></span></a>
    <a href="contact.html?type=trial#training" class="mobile-link${on('training')}"><i class="fas fa-running menu-icon"></i> <span data-i18n="nav.training"></span></a>
    <a href="index.html#shop" class="mobile-link"><i class="fas fa-shopping-bag menu-icon"></i> <span data-i18n="nav.shop"></span></a>
    <a href="index.html#sponsors" class="mobile-link"><i class="fas fa-handshake menu-icon"></i> <span data-i18n="nav.sponsors"></span></a>
    <a href="faq.html" class="mobile-link${on('faq')}"><i class="fas fa-question-circle menu-icon"></i> <span data-i18n="nav.faq"></span></a>
    <div class="mobile-cta-wrapper"><a href="contact.html" class="mobile-cta-btn"><i class="fas fa-paper-plane"></i> <span data-i18n="nav.contact"></span></a></div>
  </div></nav>
</header>`;
  }
  const footerHtml = () => `<button id="scrollToTopBtn" aria-label="Back to top"><i class="fas fa-chevron-up"></i></button>
<footer class="footer"><p>&copy; <span id="currentYear"></span> Yokohama Calcio. All Rights Reserved.</p></footer>`;

  function insert(html) {
    const s = document.currentScript;
    if (s) s.insertAdjacentHTML('beforebegin', html); else document.body.insertAdjacentHTML('afterbegin', html);
  }
  const mountHeader = active => insert(headerHtml(active));
  const mountFooter = () => insert(footerHtml());

  /* ---------- menu, scroll-top, CTA ---------- */
  function initMenus() {
    const items = Array.from(document.querySelectorAll('.main-nav .nav-item.dropdown'));
    const setOpen = (item, open) => { item.classList.toggle('open', open); const tg = item.querySelector('.dropdown-toggle'); if (tg) tg.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    items.forEach(item => {
      const tg = item.querySelector('.dropdown-toggle');
      tg.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); items.forEach(d => { if (d !== item) setOpen(d, false); }); setOpen(item, !item.classList.contains('open')); });
      item.addEventListener('mouseleave', () => setOpen(item, false));
      tg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tg.click(); } if (e.key === 'Escape') setOpen(item, false); });
    });
    document.addEventListener('click', e => { if (!e.target.closest('.main-nav .nav-item.dropdown')) items.forEach(d => setOpen(d, false)); });

    const btn = document.querySelector('.mobile-menu-toggle'), nav = document.querySelector('.mobile-nav');
    if (!btn || !nav) return;
    const icon = btn.querySelector('i');
    const close = () => { nav.classList.add('hidden'); icon.classList.add('fa-bars'); icon.classList.remove('fa-times'); btn.setAttribute('aria-expanded', 'false'); };
    const open = () => { nav.classList.remove('hidden'); icon.classList.remove('fa-bars'); icon.classList.add('fa-times'); btn.setAttribute('aria-expanded', 'true'); };
    btn.addEventListener('click', e => { e.stopPropagation(); nav.classList.contains('hidden') ? open() : close(); });
    const st = nav.querySelector('.mobile-dropdown-toggle'), sub = nav.querySelector('.mobile-submenu');
    st.addEventListener('click', e => { e.stopPropagation(); sub.classList.toggle('hidden'); const a = st.querySelector('.mobile-arrow'); a.classList.toggle('fa-chevron-down'); a.classList.toggle('fa-chevron-up'); });
    nav.querySelectorAll('.mobile-link:not(.mobile-dropdown-toggle), .mobile-cta-btn').forEach(l => l.addEventListener('click', close));
    nav.querySelector('.mobile-nav-close').addEventListener('click', close);
    nav.addEventListener('click', e => { if (!e.target.closest('.mobile-nav-content')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !nav.classList.contains('hidden')) close(); });
  }
  function initScrollTop() {
    const b = document.getElementById('scrollToTopBtn'); if (!b) return;
    const check = () => b.classList.toggle('show', window.scrollY > 300);
    window.addEventListener('scroll', check, { passive: true }); check();
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  let ctaEl = null;
  function renderCta() { if (ctaEl) ctaEl.querySelector('span').textContent = t('cta.trial'); }
  function initCta() {
    if (/\/contact(\.html)?\/?$/.test(location.pathname)) return;
    ctaEl = document.createElement('a');
    ctaEl.className = 'floating-cta'; ctaEl.href = 'contact.html?type=trial#training';
    ctaEl.innerHTML = '<i class="fas fa-paper-plane" aria-hidden="true"></i><span></span>';
    document.body.appendChild(ctaEl);
    const c = document.getElementById('contact');
    if (c && 'IntersectionObserver' in window) new IntersectionObserver(es => ctaEl.classList.toggle('is-hidden', es[0].isIntersecting)).observe(c);
  }

  /** Da chiamare UNA volta a fine pagina, dopo register(). */
  function boot(cfg) {
    state.cfg = cfg || {};
    const run = () => {
      initMenus(); initScrollTop(); initCta();
      const y = document.getElementById('currentYear'); if (y) y.textContent = new Date().getFullYear();
      document.querySelectorAll('.lang-btn').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
      setLang(state.lang);
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run();
  }

  global.YC = { LANGS, lang, t, register, setLang, applyI18n, mountHeader, mountFooter, boot, cleanStr, escapeHtml, todayJST, fetchJson };
})(window);
