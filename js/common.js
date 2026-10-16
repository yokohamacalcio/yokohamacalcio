/* common.js — funzioni condivise del sito Yokohama Calcio
   Va caricato PRIMA dello script inline di ogni pagina:
   <script src="common.js"></script>
   Poi, in ogni pagina:
     let currentLang = YC.getInitialLang();     // legge ?lang=xx e localStorage
     ... alla fine di setLanguage(lang):  YC.emitLang(lang);
     ... in DOMContentLoaded:            YC.init();
*/
(function (global) {
  'use strict';

  const LANGS = ['ja', 'it', 'en'];
  const state = { lang: 'ja' };

  /* ---------- storage sicuro ---------- */
  function store(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

  /* ---------- lingua ---------- */
  function getInitialLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) { store('preferred_lang', q); state.lang = q; return q; }
    const s = read('preferred_lang');
    state.lang = LANGS.includes(s) ? s : 'ja';
    return state.lang;
  }
  function lang() { return state.lang; }

  const ARIA = {
    ja: { menu: 'メニュー', close: '閉じる', top: 'ページ上部へ', prev: '前へ', next: '次へ' },
    it: { menu: 'Menu', close: 'Chiudi', top: 'Torna in cima', prev: 'Precedente', next: 'Successiva' },
    en: { menu: 'Menu', close: 'Close', top: 'Back to top', prev: 'Previous', next: 'Next' }
  };
  function localizeAria(l) {
    const d = ARIA[l] || ARIA.ja;
    const set = (sel, txt) => document.querySelectorAll(sel).forEach(el => el.setAttribute('aria-label', txt));
    set('.mobile-menu-toggle', d.menu);
    set('.mobile-nav-close, #lightboxClose, #heatmapClose, #privacyModalCloseBtn', d.close);
    set('#scrollToTopBtn', d.top);
    set('#lightboxPrev', d.prev);
    set('#lightboxNext', d.next);
  }

  /** Da chiamare alla fine di setLanguage(lang) di ogni pagina. */
  function emitLang(l) {
    if (!LANGS.includes(l)) return;
    state.lang = l;
    store('preferred_lang', l);
    document.documentElement.lang = l;
    localizeAria(l);
    renderCta();
    document.dispatchEvent(new CustomEvent('yc:langchange', { detail: l }));
  }

  /* ---------- utilità ---------- */
  function cleanStr(s) { return String(s || '').toLowerCase().replace(/[\s\u3000]+/g, '').trim(); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  /** Data di oggi in Giappone (YYYY-MM-DD), indipendente dal fuso del browser. */
  function todayJST() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  async function fetchJson(file, fallback) {
    try {
      const r = await fetch(file + '?v=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (_) { return fallback; }
  }

  /* ---------- menu desktop + mobile ---------- */
  function initMenus() {
    const items = Array.from(document.querySelectorAll('.main-nav .nav-item.dropdown'));
    const setOpen = (item, open) => {
      item.classList.toggle('open', open);
      const t = item.querySelector('.dropdown-toggle');
      if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    items.forEach(item => {
      const toggle = item.querySelector('.dropdown-toggle');
      if (!toggle) return;
      toggle.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        items.forEach(d => { if (d !== item) setOpen(d, false); });
        setOpen(item, !item.classList.contains('open'));
      });
      item.addEventListener('mouseleave', () => setOpen(item, false));
      toggle.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); }
        if (e.key === 'Escape') setOpen(item, false);
      });
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.main-nav .nav-item.dropdown')) items.forEach(d => setOpen(d, false));
    });
    document.querySelectorAll('.main-nav .dropdown-menu a').forEach(a =>
      a.addEventListener('click', () => items.forEach(d => setOpen(d, false))));

    const btn = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.mobile-nav');
    if (!btn || !nav) return;
    const icon = btn.querySelector('i');
    const close = () => {
      nav.classList.add('hidden');
      if (icon) { icon.classList.add('fa-bars'); icon.classList.remove('fa-times'); }
      btn.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      nav.classList.remove('hidden');
      if (icon) { icon.classList.remove('fa-bars'); icon.classList.add('fa-times'); }
      btn.setAttribute('aria-expanded', 'true');
    };
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', e => { e.stopPropagation(); nav.classList.contains('hidden') ? open() : close(); });

    const subToggle = nav.querySelector('.mobile-dropdown-toggle');
    const sub = nav.querySelector('.mobile-submenu');
    if (subToggle && sub) {
      subToggle.addEventListener('click', e => {
        e.stopPropagation();
        sub.classList.toggle('hidden');
        const a = subToggle.querySelector('.mobile-arrow');
        if (a) { a.classList.toggle('fa-chevron-down'); a.classList.toggle('fa-chevron-up'); }
      });
    }
    nav.querySelectorAll('.mobile-link, .mobile-cta-btn').forEach(l => l.addEventListener('click', close));
    const x = nav.querySelector('.mobile-nav-close');
    if (x) x.addEventListener('click', close);
    nav.addEventListener('click', e => { if (!e.target.closest('.mobile-nav-content')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !nav.classList.contains('hidden')) close(); });
  }

  /* ---------- scroll-to-top + anno footer ---------- */
  function initScrollTop() {
    const b = document.getElementById('scrollToTopBtn');
    if (!b) return;
    const check = () => b.classList.toggle('show', window.scrollY > 300);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('load', check);
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    check();
  }
  function initYear() {
    const y = document.getElementById('currentYear');
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- pulsante fisso "prenota una prova" (solo mobile via CSS) ---------- */
  const CTA = { ja: '体験参加を申し込む', it: 'Prenota una prova', en: 'Book a trial' };
  let ctaEl = null;
  function renderCta() { if (ctaEl) ctaEl.querySelector('span').textContent = CTA[state.lang] || CTA.ja; }

  function initCta() {
    if (/\/contact(\.html)?\/?$/.test(location.pathname)) return;
    ctaEl = document.createElement('a');
    ctaEl.className = 'floating-cta is-hidden';
    ctaEl.href = 'contact.html?type=trial';
    ctaEl.innerHTML = '<i class="fas fa-paper-plane" aria-hidden="true"></i><span></span>';
    document.body.appendChild(ctaEl);
    renderCta();

    let inContact = false;
    let inFooter = false;

    const check = () => {
      // Nasconde (.is-hidden) se siamo nei primi 300px di scroll, oppure se siamo nei contatti o vicino al footer
      const shouldHide = (window.scrollY <= 300) || inContact || inFooter;
      ctaEl.classList.toggle('is-hidden', shouldHide);
    };

    const contact = document.getElementById('contact');
    if (contact && 'IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        inContact = es[0].isIntersecting;
        check();
      }).observe(contact);
    }

    const footer = document.querySelector('footer, .footer');
    if (footer && 'IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        inFooter = es[0].isIntersecting;
        check();
      }, { rootMargin: '0px 0px 80px 0px' }).observe(footer);
    }

    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('load', check);
    check();
  }

  /** Inizializza tutto ciò che è identico su ogni pagina. */
  function init() {
    initMenus();
    initScrollTop();
    initYear();
    initCta();
    localizeAria(state.lang);
  }

  global.YC = { LANGS, getInitialLang, lang, emitLang, init, initMenus, localizeAria, cleanStr, escapeHtml, todayJST, fetchJson };
})(window);
