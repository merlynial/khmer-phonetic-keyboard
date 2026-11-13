/* =========================================================================
   khmerkeyboard.com · shared page behaviour
   Language switch (shared with the keyboard app through "khkb_lang"),
   light/dark theme, sticky header, mobile menu, table of contents, reveals.
   The <head> of every page sets data-lang / data-theme before first paint.
   ========================================================================= */
(function () {
  "use strict";
  var root = document.documentElement;
  var LANG_KEY = "khkb_lang", THEME_KEY = "kk_theme";
  root.classList.add("js");

  function store(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* private mode: the choice just isn't remembered */ }
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  /* ---- reveal on scroll (set up first: hidden content must never be stuck) */
  try {
    var reveals = document.querySelectorAll(".reveal");
    if (reveals.length && "IntersectionObserver" in window) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-in"); ro.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -6% 0px" });
      Array.prototype.forEach.call(reveals, function (el) { ro.observe(el); });
    } else {
      Array.prototype.forEach.call(reveals, function (el) { el.classList.add("is-in"); });
    }
  } catch (e) { each(".reveal", function (el) { el.classList.add("is-in"); }); }

  /* ---- language ---------------------------------------------------------- */
  function applyLang(l, announce) {
    if (l !== "en" && l !== "km") l = "km";
    root.setAttribute("data-lang", l);
    root.lang = l;
    var title = root.getAttribute("data-title-" + l);
    if (title) document.title = title;
    var desc = root.getAttribute("data-desc-" + l), meta = document.querySelector('meta[name="description"]');
    if (desc && meta) meta.setAttribute("content", desc);
    each("[data-set-lang]", function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-set-lang") === l)); });
    each("[data-ph-" + l + "]", function (el) { el.setAttribute("placeholder", el.getAttribute("data-ph-" + l)); });
    each("[data-aria-" + l + "]", function (el) { el.setAttribute("aria-label", el.getAttribute("data-aria-" + l)); });
    if (announce) document.dispatchEvent(new CustomEvent("site:lang", { detail: l }));
  }
  window.Site = {
    lang: function () { return root.getAttribute("data-lang") === "en" ? "en" : "km"; },
    setLang: function (l) { store(LANG_KEY, l); applyLang(l, true); },
    t: function (en, km) { return window.Site.lang() === "km" ? km : en; }
  };
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-set-lang]");
    if (b) window.Site.setLang(b.getAttribute("data-set-lang"));
  });
  applyLang(root.getAttribute("data-lang"), false);

  /* ---- theme ------------------------------------------------------------- */
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : { matches: false };
  function isDark() {
    var t = root.getAttribute("data-theme");
    return t ? t === "dark" : !!mq.matches;
  }
  function syncTheme() {
    var dark = isDark();
    each(".theme-btn", function (b) {
      b.setAttribute("aria-label", dark
        ? window.Site.t("Switch to light theme", "ប្ដូរទៅពណ៌ភ្លឺ")
        : window.Site.t("Switch to dark theme", "ប្ដូរទៅពណ៌ងងឹត"));
    });
    // The browser bar follows the system through the two media-scoped metas.
    // When the visitor picks a theme by hand, both take that theme's colour.
    var forced = root.getAttribute("data-theme");
    each('meta[name="theme-color"]', function (m) {
      var own = /dark/.test(m.getAttribute("media") || "") ? "dark" : "light";
      m.setAttribute("content", (forced || own) === "dark" ? "#15100D" : "#F3EDE4");
    });
  }
  document.addEventListener("click", function (e) {
    if (!(e.target.closest && e.target.closest(".theme-btn"))) return;
    var next = isDark() ? "light" : "dark";
    // A choice that matches the system is forgotten, so the site keeps
    // following the system from then on.
    if ((next === "dark") === !!mq.matches) { root.removeAttribute("data-theme"); store(THEME_KEY, null); }
    else { root.setAttribute("data-theme", next); store(THEME_KEY, next); }
    syncTheme();
    document.dispatchEvent(new CustomEvent("site:theme", { detail: isDark() ? "dark" : "light" }));
  });
  if (mq.addEventListener) mq.addEventListener("change", syncTheme);
  else if (mq.addListener) mq.addListener(syncTheme);
  document.addEventListener("site:lang", syncTheme);
  syncTheme();

  /* ---- header: hairline once scrolled, and the mobile menu ----------------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 6); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var menuBtn = header.querySelector(".menu-btn"), sheet = document.querySelector(".sheet");
    if (menuBtn && sheet) {
      var setOpen = function (open) {
        header.classList.toggle("is-open", open);
        menuBtn.setAttribute("aria-expanded", String(open));
        if (open) sheet.removeAttribute("inert"); else sheet.setAttribute("inert", "");
        document.body.style.overflow = open ? "hidden" : "";
      };
      setOpen(false);
      menuBtn.addEventListener("click", function () { setOpen(!header.classList.contains("is-open")); });
      sheet.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && header.classList.contains("is-open")) { setOpen(false); menuBtn.focus(); }
      });
      var wide = window.matchMedia("(min-width: 921px)");
      var close = function (m) { if (m.matches) setOpen(false); };
      if (wide.addEventListener) wide.addEventListener("change", close); else if (wide.addListener) wide.addListener(close);
    }
  }

  /* ---- table of contents: highlight the section being read ----------------- */
  var toc = document.querySelector(".toc");
  if (toc && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var sections = [];
    links.forEach(function (a) {
      var s = document.getElementById(a.getAttribute("href").slice(1));
      if (s) sections.push({ el: s, link: a });
    });
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
      for (var i = 0; i < sections.length; i++) {
        if (visible.has(sections[i].el)) {
          links.forEach(function (a) { a.classList.remove("is-active"); });
          sections[i].link.classList.add("is-active");
          break;
        }
      }
    }, { rootMargin: "-18% 0px -60% 0px" });
    sections.forEach(function (s) { io.observe(s.el); });
  }
})();
