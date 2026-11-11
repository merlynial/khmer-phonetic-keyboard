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
  const L = (en, km) => `<span data-l="en">${en}</span><span data-l="km">${km}</span>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  /* Web Animations for the moving parts: compositor-only (transform, opacity). */
  const anim = (el, frames, opts) =>
    reduceMotion || !el.animate ? null : el.animate(frames, Object.assign({ duration: 280, easing: EASE }, opts));
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
     A chat with Mom. It plays a short conversation on its own, and the
     moment a visitor touches a key, clicks the phone or simply starts
     typing, it hands over: the visitor types, Mom answers.
     Nothing is rebuilt per keystroke. The field, the suggestion bar and the
     keyboard are built once and updated in place, so the highlight can
     glide between words and bubbles can slide instead of jumping.
     ===================================================================== */
  const phone = $("#demo");
  if (phone && HAS_ENGINE) (function demo() {
    const thread = $("[data-thread]", phone);
    const field = $("[data-field]", phone);
    const candsEl = $("[data-cands]", phone);
    const kbEl = $("[data-kb]", phone);
    const sendBtn = $("[data-send]", phone);
    const presence = $("[data-presence]", phone);
    const tip = $("[data-tip]", phone);
    const note = $("[data-note]");

    const S = { committed: "", comp: "", items: [], sel: -1, nav: false, last: null, mode: "idle", shift: false };
    let userMode = false;

    /* -- the text field ------------------------------------------------- */
    field.innerHTML =
      '<span class="ph-text" lang="km"></span><span class="ph-comp"></span>' +
      '<span class="ph-caret" aria-hidden="true"></span>' +
      `<span class="ph-placeholder">${L("Message", "សរសេរសារ…")}</span>`;
    const textEl = field.children[0], compEl = field.children[1], caretEl = field.children[2];

    /* `added` is appended instead of re-rendering, so a word that was just
       committed keeps its ink-settling animation when Space follows it. */
    function renderField(added, ink) {
      if (added != null) {
        if (ink) {
          const s = document.createElement("span");
          s.className = "ph-new";
          s.textContent = added;
          textEl.appendChild(s);
        } else textEl.append(added);
      } else if (textEl.textContent !== S.committed) {
        textEl.textContent = S.committed;
      }
      compEl.textContent = S.comp;
      field.classList.toggle("is-empty", !S.committed && !S.comp);
      const blink = caretEl.getAnimations ? caretEl.getAnimations()[0] : null;
      if (blink) blink.currentTime = 0;             // caret stays solid while typing
      sendBtn.disabled = !(S.committed.trim() || S.comp);
    }

    /* -- the suggestion bar --------------------------------------------- */
    const pill = document.createElement("span");
    pill.className = "ph-pill";
    pill.setAttribute("aria-hidden", "true");
    const hintEl = document.createElement("span");
    hintEl.className = "ph-cands-hint";
    hintEl.innerHTML = L("Type a sound, like <b>soksabay</b>", "សាកវាយ <b>soksabay</b>");
    hintEl.hidden = true;
    candsEl.append(pill, hintEl);
    const candBtns = [];
    let pillOn = false;

    function renderCands() {
      const items = S.items;
      for (let i = candBtns.length; i < items.length; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ph-cand";
        b.tabIndex = -1;
        b.lang = "km";
        b.dataset.i = String(i);
        b.setAttribute("role", "option");
        b.hidden = true;
        candsEl.appendChild(b);
        candBtns.push(b);
      }
      candBtns.forEach((b, i) => {
        const it = items[i];
        if (!it) { if (!b.hidden) { b.hidden = true; b.textContent = ""; } return; }
        const fresh = b.hidden || b.textContent !== it.kh;
        b.hidden = false;
        if (fresh) {
          b.textContent = it.kh;
          anim(b, [{ opacity: 0.25 }, { opacity: 1 }], { duration: 170, easing: "ease-out" });
        }
        b.classList.toggle("is-sel", i === S.sel);
        b.classList.toggle("is-raw", !!it.raw);
        b.classList.toggle("is-pred", !!it.pred);
        b.setAttribute("aria-selected", String(i === S.sel));
      });
      hintEl.hidden = items.length > 0 || !userMode;
      movePill();
    }

    function movePill() {
      const b = candBtns[S.sel];
      if (S.sel < 0 || !b || b.hidden) {
        pill.classList.remove("is-on");
        pillOn = false;
        return;
      }
      const x = b.offsetLeft, w = b.offsetWidth;
      if (!pillOn) pill.style.transition = "none";   // appear in place, don't slide in from a stale spot
      pill.style.transform = `translateX(${x}px)`;
      pill.style.width = `${w}px`;
      if (!pillOn) { void pill.offsetWidth; pill.style.transition = ""; pillOn = true; }
      pill.classList.add("is-on");
      const view = candsEl.clientWidth, left = candsEl.scrollLeft;
      const behavior = reduceMotion ? "auto" : "smooth";
      if (x < left + 6 || x + w > left + view - 6) candsEl.scrollTo({ left: Math.max(0, x + w / 2 - view / 2), behavior });
      else if (S.sel === 0 && left > 0) candsEl.scrollTo({ left: 0, behavior });
    }

    /* -- the keyboard ---------------------------------------------------- */
    const ROWS = [[..."qwertyuiop"], [..."asdfghjkl"], ["SHIFT", ..."zxcvbnm", "BKSP"], ["KHAN", "SPACE", "ENTER"]];
    const ICON = {
      SHIFT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4 4 12h4.5v7h7v-7H20Z"/></svg>',
      BKSP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M8.5 5H20v14H8.5L3 12Z"/><path d="m11.5 9.5 5 5m0-5-5 5"/></svg>',
      ENTER: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><path d="M19 6v5a3 3 0 0 1-3 3H5"/><path d="m9 10-4 4 4 4"/></svg>',
    };
    const hint = (ch) => { const g = MAP[ch]; return g && g !== " " ? g : ""; };
    kbEl.innerHTML = ROWS.map((row, r) => `<div class="ph-row${r === 1 ? " mid" : ""}">` + row.map((k) => {
      if (k === "SHIFT" || k === "BKSP" || k === "ENTER")
        return `<button type="button" class="ph-key fn wide" data-k="${k}" tabindex="-1">${ICON[k]}</button>`;
      if (k === "KHAN") return '<button type="button" class="ph-key fn khan" data-k="KHAN" tabindex="-1" lang="km">។</button>';
      if (k === "SPACE") return `<button type="button" class="ph-key space" data-k="SPACE" tabindex="-1">${L("space", "ដកឃ្លា")}</button>`;
      return `<button type="button" class="ph-key" data-k="${k}" tabindex="-1"><span>${k}</span><small lang="km">${hint(k)}</small></button>`;
    }).join("") + "</div>").join("");
    const pop = document.createElement("div");
    pop.className = "ph-pop";
    pop.setAttribute("aria-hidden", "true");
    kbEl.appendChild(pop);
    const keyEl = (k) => kbEl.querySelector(`.ph-key[data-k="${k}"]`);

    function renderShift() {
      kbEl.querySelectorAll(".ph-key[data-k]").forEach((b) => {
        const k = b.dataset.k;
        if (k.length !== 1) { if (k === "SHIFT") b.classList.toggle("is-on", S.shift); return; }
        const ch = S.shift ? k.toUpperCase() : k;
        b.firstElementChild.textContent = ch;
        b.lastElementChild.textContent = hint(ch);
      });
    }
    /* The key balloon, as on a phone: letter keys only. */
    function showPop(b, label) {
      const w = b.offsetWidth + 16, kbw = kbEl.clientWidth;
      const cx = Math.min(Math.max(b.offsetLeft + b.offsetWidth / 2, w / 2 + 2), kbw - w / 2 - 2);
      pop.textContent = label || b.firstElementChild.textContent;
      pop.style.setProperty("--pw", `${w}px`);
      pop.style.left = `${cx}px`;
      pop.style.top = `${b.offsetTop}px`;
      pop.classList.add("is-on");
      pop._key = b;
    }
    const hidePop = (b) => { if (!b || pop._key === b) pop.classList.remove("is-on"); };
    function keyDown(b, label) {
      b.classList.add("is-down");
      if (b.dataset.k.length === 1) showPop(b, label);
    }
    function keyUp(b) { b.classList.remove("is-down"); hidePop(b); }
    function flash(k, label) {                    // a press the visitor didn't make with the pointer
      const b = keyEl(k);
      if (!b) return;
      keyDown(b, label);
      clearTimeout(b._t);
      b._t = setTimeout(() => keyUp(b), 115);
    }

    /* -- composing ------------------------------------------------------- */
    function refresh(added, ink) {
      const D = window.KHDICT;
      if (S.comp) {
        const list = D ? D.suggest(S.comp).slice(0, 6).map((it) => ({ kh: it.kh, segs: it.segs })) : [];
        const raw = convert(S.comp, { autostack: true });
        if (raw && raw !== S.comp && !list.some((x) => x.kh === raw)) list.push({ kh: raw, raw: true });
        S.items = list; S.sel = list.length ? 0 : -1; S.nav = false; S.mode = "comp";
      } else if (S.last && D) {
        S.items = D.predictNext(S.last).slice(0, 6).map((kh) => ({ kh, pred: true }));
        S.sel = -1; S.mode = S.items.length ? "pred" : "idle";
      } else {
        S.items = []; S.sel = -1; S.mode = "idle";
      }
      renderField(added, ink);
      renderCands();
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
      refresh(it.kh, true);
    }
    const commitRaw = () => commit({ kh: convert(S.comp, { autostack: true }) });
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
      refresh(" ");
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
      refresh(p);
    }
    function pick(i) {
      const it = S.items[i];
      if (!it) return;
      if (it.pred) { S.committed += it.kh; S.last = it.kh; refresh(it.kh, true); return; }
      commit(it);
    }
    function enter() {
      if (S.comp) { const it = S.items[S.sel]; if (it && !it.raw) commit(it); else commitRaw(); return; }
      send();
    }
    function press(k) {
      if (k === "SHIFT") { S.shift = !S.shift; renderShift(); return; }
      if (k === "BKSP") { backspace(); return; }
      if (k === "SPACE") { space(); return; }
      if (k === "ENTER") { enter(); return; }
      if (k === "KHAN") { punct("។"); return; }
      typeChar(S.shift ? k.toUpperCase() : k);
      if (S.shift) { S.shift = false; renderShift(); }
    }
    async function tapCand(i) {
      const b = candBtns[i];
      if (!b) return;
      b.classList.add("is-tap");
      await sleep(150);
      b.classList.remove("is-tap");
      pick(i);
    }

    /* -- the conversation ------------------------------------------------ */
    /* New bubbles slide in and the ones above glide up (FLIP), instead of
       the whole thread jumping a line at a time. */
    function addBubble(kind, text, replace) {
      const kids = [...thread.children];
      const tops = kids.map((k) => k.getBoundingClientRect().top);
      const b = document.createElement("div");
      b.className = "bubble " + kind;
      b.lang = "km";
      b.textContent = text;
      if (replace && replace.parentNode === thread) replace.replaceWith(b);
      else thread.appendChild(b);
      if (!reduceMotion) {
        kids.forEach((k, i) => {
          if (!k.isConnected) return;
          const dy = tops[i] - k.getBoundingClientRect().top;
          if (Math.abs(dy) > 0.5) anim(k, [{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 360 });
        });
        anim(b, [{ opacity: 0, transform: "translateY(14px) scale(.96)" }, { opacity: 1, transform: "none" }],
          { duration: 360, easing: "cubic-bezier(.2,.9,.3,1.05)" });
      }
      const limit = thread.getBoundingClientRect().top - 60;      // drop what has scrolled out of sight
      [...thread.children].forEach((k) => { if (k !== b && k.getBoundingClientRect().bottom < limit) k.remove(); });
      return b;
    }
    let typingEl = null;
    function setPresence(typing) {
      presence.innerHTML = typing ? L("typing…", "កំពុងវាយ…") : L("online", "សកម្មឥឡូវនេះ");
      presence.classList.toggle("is-typing", typing);
    }
    function showTyping() {
      if (!typingEl) {
        typingEl = addBubble("in typing", "");
        typingEl.setAttribute("aria-hidden", "true");
        typingEl.innerHTML = "<i></i><i></i><i></i>";
      }
      setPresence(true);
      return typingEl;
    }
    function removeTyping() {
      if (typingEl) { typingEl.remove(); typingEl = null; }
      setPresence(false);
    }
    /* Mom types for a moment, then her message replaces the dots. */
    async function momSays(text, alive) {
      const dots = showTyping();
      await sleep(Math.min(1800, 700 + text.length * 40));
      if (!alive()) return;
      typingEl = null;
      addBubble("in", text, dots);
      setPresence(false);
    }
    function pressSend() {
      sendBtn.classList.add("is-down");
      setTimeout(() => sendBtn.classList.remove("is-down"), 140);
      send();
    }
    function send() {
      if (S.comp) commitRaw();
      const text = S.committed.trim();
      if (!text) return;
      addBubble("out", text);
      S.committed = ""; S.last = null;
      refresh();
      if (userMode) reply(text);
    }

    /* Mom's side when the visitor is typing: a few everyday answers, picked
       by what the message is about. */
    const REPLIES = [
      [/សុខសប្បាយទេ|សុខទេ/, "ម៉ាក់សុខសប្បាយ។ ចុះកូនវិញ?"],
      [/សួស្ដី|សួស្តី|ជម្រាបសួរ|ជំរាបសួរ/, "សួស្ដីកូន។"],
      [/អរគុណ/, "មិនអីទេកូន។"],
      [/ស្រឡាញ់|ស្រលាញ់/, "ម៉ាក់ក៏ស្រឡាញ់កូនដែរ។"],
      [/នឹក/, "ម៉ាក់ក៏នឹកកូនដែរ។"],
      [/ញ៉ាំ|បាយ|ឃ្លាន|ហូប/, "ញ៉ាំឱ្យបានច្រើនៗណាកូន។"],
      [/រៀន|សាលា|ប្រឡង/, "ខំរៀនណាកូន។"],
      [/ធ្វើការ|ការងារ/, "កុំធ្វើការហួសពេកណាកូន។"],
      [/ផ្ទះ|ត្រឡប់|មកលេង|ទៅលេង/, "មកដល់ ប្រាប់ម៉ាក់ផងណា។"],
      [/សុខសប្បាយ/, "ល្អហើយកូន។"],
    ];
    const FALLBACK = ["អើ កូន។", "ល្អហើយកូន។", "ម៉ាក់យល់ហើយ។"];
    let replyN = 0, fallbackN = 0;
    function reply(text) {
      const me = ++replyN;
      const hit = REPLIES.find(([re]) => re.test(text));
      const answer = hit ? hit[1] : FALLBACK[fallbackN++ % FALLBACK.length];
      setTimeout(() => {
        if (me !== replyN || !userMode) return;            // a newer message gets the answer
        momSays(answer, () => me === replyN && userMode);
      }, 600);
    }

    /* -- the visitor takes over ----------------------------------------- */
    function setNote() {
      if (!note) return;
      note.innerHTML = userMode
        ? L("Your turn. <kbd>Space</kbd> picks the highlighted word, <kbd>Enter</kbd> sends, and Mom answers. <button type=\"button\" data-replay>Watch the demo again</button>",
            "ដល់វេនអ្នកហើយ។ ចុច <kbd>Space</kbd> ដើម្បីរើសពាក្យដែលរំលេច ចុច <kbd>Enter</kbd> ដើម្បីផ្ញើ ហើយម៉ាក់នឹងឆ្លើយតប។ <button type=\"button\" data-replay>មើលការបង្ហាញម្ដងទៀត</button>")
        : L("This is the real keyboard, running live. Tap the keys, or just start typing: try <code>soksabay</code>, then Space.",
            "នេះជាក្ដារចុចពិត កំពុងដំណើរការផ្ទាល់។ ប៉ះគ្រាប់ចុច ឬចាប់ផ្ដើមវាយភ្លាម៖ សាកវាយ <code>soksabay</code> រួចចុច Space។");
    }
    function showTip(on) { if (tip) tip.classList.toggle("is-on", on && !userMode); }
    /* A tap shouldn't ring the phone with a focus outline; keyboard focus still shows it. */
    function focusPhone(fromPointer) {
      if (document.activeElement !== phone)
        phone.focus(fromPointer ? { preventScroll: true, focusVisible: false } : { preventScroll: true });
    }
    function takeover() {
      if (userMode) return;
      userMode = true;
      autoToken++;                                   // stops the autoplay loop
      replyN++;
      removeTyping();
      showTip(false);
      S.committed = ""; S.comp = ""; S.last = null; S.shift = false; S.nav = false;
      renderShift();
      refresh();
      setNote();
      thread.setAttribute("aria-live", "polite");
    }
    async function replay() {
      userMode = false;
      replyN++;
      thread.removeAttribute("aria-live");
      setNote();
      S.committed = ""; S.comp = ""; S.last = null;
      refresh();
      await clearThread();
      runAuto();
    }

    /* pointer: keys, suggestions, send, anywhere else on the phone */
    let repeatT = null;
    kbEl.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".ph-key");
      if (!b) return;
      e.preventDefault();
      takeover();
      focusPhone(true);
      keyDown(b);
      try { b.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ }
      press(b.dataset.k);
      if (b.dataset.k === "BKSP") {                  // hold to keep deleting
        clearTimeout(repeatT);
        repeatT = setTimeout(function again() { press("BKSP"); repeatT = setTimeout(again, 70); }, 420);
      }
    });
    const release = (e) => {
      clearTimeout(repeatT);
      const b = e.target.closest && e.target.closest(".ph-key");
      if (b) keyUp(b);
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => kbEl.addEventListener(t, release));
    candsEl.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".ph-cand");
      if (!b) return;
      e.preventDefault();
      takeover();
      focusPhone(true);
      tapCand(+b.dataset.i);
    });
    sendBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      takeover();
      focusPhone(true);
      pressSend();
    });
    phone.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".ph-key, .ph-cand, .ph-send")) return;
      takeover();
      focusPhone(true);
    });
    phone.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") showTip(true); });
    phone.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") showTip(false); });

    /* keyboard: when the phone has focus, and also when nothing else does
       and the phone is on screen, so a visitor can simply start typing */
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k.length === 1 && /[a-zA-Z'*`^~]/.test(k)) {
        e.preventDefault(); takeover(); flash(k.toLowerCase(), k); typeChar(k); return;
      }
      if (k === " ") { e.preventDefault(); takeover(); flash("SPACE"); space(); return; }
      if (k === "Enter") { e.preventDefault(); takeover(); flash("ENTER"); enter(); return; }
      if (k === "Backspace") { e.preventDefault(); takeover(); flash("BKSP"); backspace(); return; }
      if (k === "Escape") {
        if (S.comp) { e.preventDefault(); S.comp = ""; refresh(); } else phone.blur();
        return;
      }
      if (S.items.length && k >= "1" && k <= "9") {
        const i = +k - 1;
        if (i < S.items.length) { e.preventDefault(); takeover(); tapCand(i); }
        return;
      }
      if (S.mode === "comp" && S.items.length && /^Arrow(Left|Right|Up|Down)$/.test(k)) {
        e.preventDefault();
        const step = k === "ArrowRight" || k === "ArrowDown" ? 1 : -1;
        S.sel = (S.sel + step + S.items.length) % S.items.length;
        S.nav = true;
        renderCands();
        return;
      }
      if (k === "." || k === "?" || k === "!" || k === ",") {
        e.preventDefault(); takeover();
        if (k === ".") flash("KHAN");
        punct(k === "." ? "។" : k);
      }
    }
    phone.addEventListener("keydown", onKey);
    let ratio = 0;
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.target === phone || phone.contains(document.activeElement)) return;
      const a = document.activeElement;
      if (a && a !== document.body && a !== document.documentElement) return;   // typing somewhere else
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || !/[a-zA-Z]/.test(e.key)) return;
      if (ratio < 0.4) return;
      focusPhone();
      onKey(e);
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-takeover]")) { takeover(); focusPhone(true); }
      else if (e.target.closest("[data-replay]")) replay();
    });
    document.addEventListener("site:lang", () => movePill());

    /* -- autoplay -------------------------------------------------------- */
    const SCRIPT = [
      { mom: "សុខសប្បាយទេកូន?" },
      { type: "soksabay" }, { key: "SPACE" }, { key: "SPACE" },
      { type: "orkun" }, { key: "SPACE" },
      { type: "mak" }, { key: "SPACE" },
      { send: 1 }, { wait: 1000 },
      { mom: "ញ៉ាំបាយហើយឬនៅ?" },
      { type: "nham" }, { key: "SPACE" },
      { pick: "បាយ", or: "bay" },                    // the next-word prediction, tapped
      { type: "haey" }, { key: "SPACE" },
      { key: "KHAN" },
      { send: 1 }, { wait: 900 },
      { mom: "ល្អហើយ។ ញ៉ាំឱ្យបានច្រើនៗណាកូន។" },
      { tip: 1 }, { wait: 3000 },
      { clear: 1 },
    ];
    let autoToken = 0, wake = null;
    const playing = () => ratio >= 0.35 && !document.hidden;
    const ready = () => (playing() ? Promise.resolve() : new Promise((r) => { wake = r; }));
    const poke = () => { if (wake && playing()) { const w = wake; wake = null; w(); } };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { ratio = es[0].intersectionRatio; poke(); },
        { threshold: [0, 0.2, 0.35, 0.4, 0.6, 0.8, 1] }).observe(phone);
    } else ratio = 1;
    document.addEventListener("visibilitychange", poke);

    async function typeWord(word, alive) {
      for (const ch of word) {
        if (!alive()) return;
        flash(ch); press(ch);
        await sleep(70 + Math.random() * 70 + (Math.random() < 0.12 ? 150 : 0));
      }
      await sleep(400);
    }
    async function clearThread() {
      const a = anim(thread, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      await sleep(320);
      thread.innerHTML = "";
      typingEl = null;
      setPresence(false);
      if (a) a.cancel();
      await sleep(260);
    }
    async function runAuto() {
      const me = ++autoToken;
      const alive = () => me === autoToken && !userMode;
      while (alive()) {
        for (const step of SCRIPT) {
          await ready();
          if (!alive()) return;
          if (step.mom) { await momSays(step.mom, alive); await sleep(600); }
          else if (step.type) await typeWord(step.type, alive);
          else if (step.key) { flash(step.key); press(step.key); await sleep(360); }
          else if (step.pick) {
            const i = S.items.findIndex((x) => x.kh === step.pick);
            if (i >= 0) { await sleep(250); await tapCand(i); await sleep(380); }
            else { await typeWord(step.or, alive); flash("SPACE"); press("SPACE"); await sleep(360); }
          } else if (step.send) { pressSend(); await sleep(480); }
          else if (step.tip) { showTip(true); setTimeout(() => { if (!phone.matches(":hover")) showTip(false); }, 2800); }
          else if (step.wait) await sleep(step.wait);
          else if (step.clear) await clearThread();
          if (!alive()) return;
        }
      }
    }

    setPresence(false);
    renderShift();
    refresh();
    loadDict().then(async () => {
      if (userMode) { refresh(); return; }
      if (reduceMotion) { refresh(); return; }     // keep the still conversation; typing works
      await clearThread();
      if (!userMode) runAuto();
    });
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
