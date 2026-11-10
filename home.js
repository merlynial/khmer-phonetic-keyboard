/* =========================================================================
   khmerkeyboard.com · home page
   The phone demo, the converging spellings and the consonant grid; the
   spelling X-ray lives in xray.js. Everything here runs the real engine:
   engine.js is loaded before this file, and dict.js (the suggestion
   dictionary) is loaded once the page is up, so first paint never waits.
   ========================================================================= */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const T = (en, km) => (window.Site ? window.Site.t(en, km) : en);
  const L = (en, km) => `<span data-l="en">${en}</span><span data-l="km">${km}</span>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HAS_ENGINE = typeof convert === "function";

  /* ---- dictionary: load after first paint ----------------------------- */
  let dictPromise = null;
  function loadDict() {
    if (!dictPromise) {
      dictPromise = new Promise((resolve) => {
        if (window.KHDICT) { resolve(window.KHDICT); return; }
        const s = document.createElement("script");
        s.src = "dict.js";
        s.async = true;
        s.onload = () => resolve(window.KHDICT || null);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      });
    }
    return dictPromise;
  }
  const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  if (document.readyState === "complete") whenIdle(loadDict);
  else window.addEventListener("load", () => whenIdle(loadDict), { once: true });

  /* =====================================================================
     1. Phone demo
     ===================================================================== */
  const phone = $("#demo");
  if (phone && HAS_ENGINE) (function demo() {
    const thread = $("[data-thread]", phone);
    const field = $("[data-field]", phone);
    const candsEl = $("[data-cands]", phone);
    const kbEl = $("[data-kb]", phone);
    const sendBtn = $("[data-send]", phone);
    const note = $("[data-note]");

    const S = { committed: "", comp: "", items: [], sel: 0, nav: false, last: null, mode: "idle", shift: false };
    let userMode = false;

    /* -- keyboard ------------------------------------------------------- */
    const ROWS = [[..."qwertyuiop"], [..."asdfghjkl"], ["SHIFT", ..."zxcvbnm", "BKSP"], ["KHAN", "SPACE", "ENTER"]];
    const ICON = {
      SHIFT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4 4 12h4.5v7h7v-7H20Z"/></svg>',
      BKSP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M8.5 5H20v14H8.5L3 12Z"/><path d="m11.5 9.5 5 5m0-5-5 5"/></svg>',
      ENTER: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M19 6v5a3 3 0 0 1-3 3H5"/><path d="m9 10-4 4 4 4"/></svg>',
    };
    const hint = (ch) => { const g = MAP[ch]; return g && g !== " " ? g : ""; };
    function buildKeyboard() {
      kbEl.innerHTML = ROWS.map((row, r) => `<div class="ph-row${r === 1 ? " mid" : ""}">` + row.map((k) => {
        if (k === "SHIFT" || k === "BKSP" || k === "ENTER")
          return `<button type="button" class="ph-key fn wide" data-k="${k}" tabindex="-1">${ICON[k]}</button>`;
        if (k === "KHAN") return `<button type="button" class="ph-key fn khan" data-k="KHAN" tabindex="-1">។</button>`;
        if (k === "SPACE") return `<button type="button" class="ph-key space" data-k="SPACE" tabindex="-1">${L("space", "ដកឃ្លា")}</button>`;
        return `<button type="button" class="ph-key" data-k="${k}" tabindex="-1"><span>${k}</span><small>${hint(k)}</small></button>`;
      }).join("") + "</div>").join("");
    }
    function renderShift() {
      kbEl.querySelectorAll(".ph-key[data-k]").forEach((b) => {
        const k = b.dataset.k;
        if (k.length !== 1) { if (k === "SHIFT") b.classList.toggle("is-on", S.shift); return; }
        const ch = S.shift ? k.toUpperCase() : k;
        b.firstElementChild.textContent = ch;
        b.lastElementChild.textContent = hint(ch);
      });
    }
    function flash(k) {
      const b = kbEl.querySelector(`[data-k="${k}"]`);
      if (!b) return;
      b.classList.add("is-down");
      clearTimeout(b._t);
      b._t = setTimeout(() => b.classList.remove("is-down"), 120);
    }

    /* -- composing ------------------------------------------------------ */
    function refresh() {
      const D = window.KHDICT;
      if (S.comp) {
        let list = D ? D.suggest(S.comp).slice(0, 6).map((it) => ({ kh: it.kh, segs: it.segs })) : [];
        const raw = convert(S.comp, { autostack: true });
        if (raw && raw !== S.comp && !(list[0] && list[0].kh === raw)) list.push({ kh: raw, raw: true });
        S.items = list; S.sel = 0; S.nav = false; S.mode = "comp";
      } else if (S.last && D) {
        S.items = D.predictNext(S.last).slice(0, 6).map((kh) => ({ kh, pred: true }));
        S.sel = -1; S.mode = S.items.length ? "pred" : "idle";
      } else {
        S.items = []; S.sel = -1; S.mode = "idle";
      }
      render();
    }
    function render() {
      let html;
      if (!S.committed && !S.comp) html = `<span class="ph-placeholder">${T("Message", "សារ")}</span>`;
      else html = `<span lang="km">${esc(S.committed)}</span>` +
        (S.comp ? `<span class="ph-comp">${esc(S.comp)}</span>` : "");
      field.innerHTML = html + '<span class="ph-caret" aria-hidden="true"></span>';
      candsEl.innerHTML = S.items.map((it, i) =>
        `<button type="button" class="ph-cand${i === S.sel ? " is-sel" : ""}${it.raw ? " is-raw" : ""}${it.pred ? " is-pred" : ""}"` +
        ` role="option" aria-selected="${i === S.sel}" data-i="${i}" tabindex="-1" lang="km">${esc(it.kh)}</button>`).join("");
      const sel = candsEl.children[Math.max(S.sel, 0)];
      if (sel && S.sel > 0) candsEl.scrollLeft = Math.max(0, sel.offsetLeft - candsEl.clientWidth / 2);
      else candsEl.scrollLeft = 0;
      sendBtn.disabled = !(S.committed.trim() || S.comp);
    }
    function typeChar(ch) {
      if (S.comp.length >= 24) return;
      S.comp += ch;
      refresh();
    }
    function commit(it) {
      if (!it) return;
      S.committed += it.kh;
      S.last = it.segs ? it.segs[it.segs.length - 1] : it.kh;
      S.comp = "";
      refresh();
    }
    function commitRaw() { commit({ kh: convert(S.comp, { autostack: true }) }); }
    function space() {
      if (S.comp) {
        // Same rule as the keyboard: a one-letter token or a letter-by-letter
        // reading is not taken by Space unless you picked it with the arrows.
        const it = S.items[S.sel];
        if (!it || ((it.raw || S.comp.length < 2) && !S.nav)) commitRaw();
        else commit(it);
        return;
      }
      S.committed += " ";
      S.last = null;
      refresh();
    }
    function backspace() {
      if (S.comp) { S.comp = S.comp.slice(0, -1); refresh(); return; }
      if (!S.committed) return;
      let cut = 1;
      if (window.Intl && Intl.Segmenter) {
        let lastSeg = "";
        for (const g of new Intl.Segmenter("km", { granularity: "grapheme" }).segment(S.committed)) lastSeg = g.segment;
        cut = lastSeg.length || 1;
      }
      S.committed = S.committed.slice(0, -cut);
      S.last = null;
      refresh();
    }
    function punct(p) {
      if (S.comp) commitRaw();
      S.committed += p;
      S.last = null;
      refresh();
    }
    function pick(i) {
      const it = S.items[i];
      if (!it) return;
      if (it.pred) { S.committed += it.kh; S.last = it.kh; refresh(); return; }
      commit(it);
    }
    function enter() {
      if (S.comp) { const it = S.items[S.sel]; if (it && !it.raw) commit(it); else commitRaw(); return; }
      send();
    }
    function bubble(kind, text) {
      const b = document.createElement("div");
      b.className = "bubble " + kind;
      b.lang = "km";
      b.textContent = text;
      thread.appendChild(b);
      while (thread.children.length > 7) thread.firstElementChild.remove();
      return b;
    }
    function send() {
      if (S.comp) commitRaw();
      const text = S.committed.trim();
      if (!text) return;
      bubble("out", text);
      S.committed = ""; S.last = null;
      refresh();
    }
    function press(k) {
      flash(k);
      if (k === "SHIFT") { S.shift = !S.shift; renderShift(); return; }
      if (k === "BKSP") { backspace(); return; }
      if (k === "SPACE") { space(); return; }
      if (k === "ENTER") { enter(); return; }
      if (k === "KHAN") { punct("។"); return; }
      typeChar(S.shift ? k.toUpperCase() : k);
      if (S.shift) { S.shift = false; renderShift(); }
    }

    /* -- you take over -------------------------------------------------- */
    function setNote() {
      if (!note) return;
      note.innerHTML = userMode
        ? L("Your turn. Type a word in Latin letters; <kbd>Space</kbd> picks the highlighted word, <kbd>Enter</kbd> sends. <button type=\"button\" data-replay>Watch the demo again</button>",
            "ដល់វេនអ្នកហើយ។ វាយពាក្យជាអក្សរឡាតាំង ចុច <kbd>Space</kbd> ដើម្បីជ្រើសពាក្យដែលបានរំលេច និង <kbd>Enter</kbd> ដើម្បីផ្ញើ។ <button type=\"button\" data-replay>មើលការបង្ហាញម្ដងទៀត</button>")
        : L("A live demo running the real keyboard engine. <button type=\"button\" data-takeover>Type in it yourself</button>: try <code>soksabay</code>, then Space.",
            "ការបង្ហាញផ្ទាល់ ដោយប្រើម៉ាស៊ីនវាយពិតប្រាកដ។ <button type=\"button\" data-takeover>សាកវាយដោយខ្លួនឯង</button>៖ វាយ <code>soksabay</code> រួចចុច Space។");
    }
    function takeover() {
      if (userMode) return;
      userMode = true;
      autoToken++;                                  // stops the autoplay loop
      thread.querySelectorAll(".typing").forEach((n) => n.remove());
      S.committed = ""; S.comp = ""; S.last = null; S.shift = false;
      renderShift();
      refresh();
      setNote();
    }
    function replay() {
      userMode = false;
      setNote();
      thread.innerHTML = "";
      S.committed = ""; S.comp = ""; S.last = null;
      refresh();
      runAuto();
    }

    kbEl.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".ph-key");
      if (!b) return;
      e.preventDefault();
      takeover();
      if (document.activeElement !== phone) phone.focus({ preventScroll: true });
      press(b.dataset.k);
    });
    candsEl.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".ph-cand");
      if (!b) return;
      e.preventDefault();
      takeover();
      pick(+b.dataset.i);
    });
    sendBtn.addEventListener("click", () => { takeover(); send(); phone.focus({ preventScroll: true }); });
    phone.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".ph-key, .ph-cand, .ph-send")) return;
      takeover();
    });
    phone.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k.length === 1 && /[a-zA-Z'*`^~]/.test(k)) {
        e.preventDefault(); takeover(); flash(k.toLowerCase()); typeChar(k); return;
      }
      if (k === " ") { e.preventDefault(); takeover(); flash("SPACE"); space(); return; }
      if (k === "Enter") { e.preventDefault(); takeover(); flash("ENTER"); enter(); return; }
      if (k === "Backspace") { e.preventDefault(); takeover(); flash("BKSP"); backspace(); return; }
      if (k === "Escape" && S.comp) { e.preventDefault(); S.comp = ""; refresh(); return; }
      if (S.mode === "comp" && S.items.length) {
        if (k >= "1" && k <= "9") {
          const i = +k - 1;
          if (i < S.items.length) { e.preventDefault(); commit(S.items[i]); }
          return;
        }
        if (k === "ArrowRight" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowUp") {
          e.preventDefault();
          const step = k === "ArrowRight" || k === "ArrowDown" ? 1 : -1;
          S.sel = (S.sel + step + S.items.length) % S.items.length; S.nav = true;
          render();
          return;
        }
      }
      if (k === "." || k === "?" || k === "!" || k === ",") { e.preventDefault(); takeover(); punct(k === "." ? "។" : k); }
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-takeover]")) { takeover(); phone.focus({ preventScroll: true }); }
      else if (e.target.closest("[data-replay]")) replay();
    });
    document.addEventListener("site:lang", render);

    /* -- autoplay ------------------------------------------------------- */
    const SCRIPT = [
      { in: "សុខសប្បាយទេកូន?" },
      { type: "soksabay" }, { space: 1 }, { space: 1 },
      { type: "orkun" }, { space: 1 },
      { type: "mak" }, { space: 1 },
      { send: 1 }, { wait: 1300 },
      { in: "ញ៉ាំបាយហើយឬនៅ?" },
      { type: "nham" }, { space: 1 },
      { type: "haey" }, { space: 1 },
      { send: 1 }, { wait: 3400 },
      { reset: 1 },
    ];
    let autoToken = 0, onScreen = true, wake = null;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => {
        onScreen = es[0].isIntersecting;
        if (onScreen && wake) { wake(); wake = null; }
      }, { threshold: 0.35 }).observe(phone);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden && wake) { wake(); wake = null; } });
    const visible = () => (onScreen && !document.hidden) ? Promise.resolve() : new Promise((r) => { wake = r; });

    async function runAuto() {
      const me = ++autoToken;
      const alive = () => me === autoToken && !userMode;
      while (alive()) {
        for (const step of SCRIPT) {
          await visible();
          if (!alive()) return;
          if (step.in) {
            const dots = document.createElement("div");
            dots.className = "bubble in typing";
            dots.setAttribute("aria-hidden", "true");
            dots.innerHTML = "<i></i><i></i><i></i>";
            thread.appendChild(dots);
            await sleep(1000);
            dots.remove();
            if (!alive()) return;
            bubble("in", step.in);
            await sleep(700);
          } else if (step.type) {
            for (const ch of step.type) {
              if (!alive()) return;
              flash(ch); typeChar(ch);
              await sleep(80 + Math.random() * 75);
            }
            await sleep(560);
          } else if (step.space) {
            flash("SPACE"); space();
            await sleep(420);
          } else if (step.send) {
            flash("ENTER"); send();
            await sleep(500);
          } else if (step.wait) {
            await sleep(step.wait);
          } else if (step.reset) {
            thread.innerHTML = "";
            await sleep(500);
          }
        }
      }
    }

    buildKeyboard();
    refresh();
    if (!reduceMotion) {
      loadDict().then(() => {
        if (userMode) return;
        thread.innerHTML = "";
        runAuto();
      });
    } else {
      loadDict().then(() => { if (!userMode) refresh(); });
    }
  })();

  /* =====================================================================
     2. Spell it your way: several spellings, one word
     ===================================================================== */
  const conv = $("[data-converge]");
  if (conv) (function converge() {
    const SETS = [
      { kh: "សួស្តី", gl: "hello", v: ["sousdey", "suosdei", "suastei", "sosdey", "susdey"] },
      { kh: "អរគុណ", gl: "thank you", v: ["orkun", "arkun", "awkun", "akun", "orkoun"] },
      { kh: "ខ្ញុំ", gl: "I, me", v: ["khnhom", "knhom", "khnyom", "knyom", "khnom"] },
      { kh: "កម្ពុជា", gl: "Cambodia", v: ["kampuchea", "kampujea", "kampuchia", "kumpuchea", "kampuja"] },
    ];
    const listEl = $("[data-variants]", conv), targetEl = $("[data-target]", conv), glossEl = $("[data-gloss]", conv);
    const linesEl = $("[data-lines]", conv), tabsEl = $("[data-tabs]");
    let cur = 0, cycling = !reduceMotion, timer = null, onScreen = false;

    tabsEl.innerHTML = SETS.map((s, i) => `<button type="button" lang="km" aria-pressed="${i === 0}" data-set="${i}">${s.kh}</button>`).join("");

    function drawLines() {
      if (getComputedStyle(linesEl).display === "none") return;
      const box = conv.getBoundingClientRect();
      const t = targetEl.getBoundingClientRect();
      const x2 = t.left - box.left - 10, y2 = t.top - box.top + t.height / 2;
      const d = [...listEl.children].map((li) => {
        const r = li.getBoundingClientRect();
        const x1 = r.right - box.left + 4, y1 = r.top - box.top + r.height / 2;
        const mx = x1 + (x2 - x1) * 0.55;
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} C${mx.toFixed(1)} ${y1.toFixed(1)} ${mx.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
      });
      linesEl.setAttribute("viewBox", `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
      linesEl.innerHTML = d.join("");
    }
    function fill(i) {
      const s = SETS[i];
      let v = s.v;
      if (window.KHDICT) {                       // keep only spellings that really lead there
        const ok = v.filter((w) => { const top = window.KHDICT.suggest(w)[0]; return top && top.kh === s.kh; });
        if (ok.length >= 3) v = ok;
      }
      listEl.innerHTML = v.map((w) => `<li>${esc(w)}</li>`).join("");
      targetEl.textContent = s.kh;
      glossEl.textContent = s.gl;
      tabsEl.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      drawLines();
    }
    function show(i) {
      cur = i;
      if (reduceMotion) { fill(i); return; }
      conv.classList.add("is-swapping");
      setTimeout(() => { fill(i); conv.classList.remove("is-swapping"); }, 320);
    }
    function schedule() {
      clearTimeout(timer);
      if (!cycling) return;
      timer = setTimeout(() => {
        if (onScreen && !document.hidden) show((cur + 1) % SETS.length);
        schedule();
      }, 4200);
    }
    tabsEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-set]");
      if (!b) return;
      cycling = false; clearTimeout(timer);
      show(+b.dataset.set);
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { threshold: 0.4 }).observe(conv);
    }
    if ("ResizeObserver" in window) new ResizeObserver(() => drawLines()).observe(conv);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLines);
    loadDict().then(() => fill(cur));
    fill(0);
    schedule();
  })();

  /* =====================================================================
     3. The 33 consonants, straight from the engine's map
     ===================================================================== */
  const grid = $("[data-letters]");
  if (grid && HAS_ENGINE) {
    const byGlyph = new Map();
    for (const [k, g] of Object.entries(CONS)) {
      if (!byGlyph.has(g)) byGlyph.set(g, []);
      byGlyph.get(g).push(k);
    }
    grid.innerHTML = [...byGlyph].map(([g, keys]) => {
      const cap = keys.some((k) => /[A-Z]/.test(k));
      const shown = keys.map((k, i) => (i ? `<span class="alt">${esc(k)}</span>` : esc(k))).join(" · ");
      return `<div class="letter" role="listitem"><span class="g" lang="km">${g}</span>` +
        `<span class="k">${shown}</span><span class="n">${cap ? L("capital", "អក្សរធំ") : ""}</span></div>`;
    }).join("");
  }
})();
