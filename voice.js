/* =========================================================================
   khmerkeyboard.com · voice typing (used by app.html)

   Speak Khmer, get Khmer text. Two engines can do the listening:

     online  the browser's own speech recognition. In Chrome that is Google's
             service, so the audio leaves the device while the microphone is
             on. Nothing to download.
     local   a speech model that runs on this device (voice-local.mjs, loaded
             only once someone chooses it). Private and offline, after one
             large download.

   This file holds the online engine and what the two share. It never touches
   the page: app.html owns the buttons, the first-use choice and the text box,
   and is told what happens through plain callbacks:

     state(name)   "starting" | "loading" | "listening" | "working"
     text(all)     everything heard so far in this dictation, best guess
     progress(p)   local engine only: { done, total } bytes of the download
     end(why)      it is over; why is "" or an error code (STRINGS.verr_*)
   ========================================================================= */
(function () {
  "use strict";
  const KM = "km-KH";
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const UA = navigator.userAgent || "";

  /* Android's recogniser hears one sentence per session whatever it is asked
     for, and in "continuous" mode it marks every partial result final, which
     makes the text repeat. So one sentence at a time there, on purpose. */
  const ANDROID = /Android/i.test(UA);

  /* Safari, and every browser on an iPhone or iPad, recognise speech with
     Apple's engine, which has no Khmer. */
  const APPLE_ENGINE = /iP(hone|ad|od)/.test(UA)
    || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1)
    || (/Safari\//.test(UA) && !/Chrom(e|ium)\/|Edg\/|OPR\/|Android/.test(UA));
  const PHONE = ANDROID || /iP(hone|ad|od)/.test(UA)
    || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);

  const IDLE_MS = 8000;         // the microphone turns itself off after this much silence

  /* What a recogniser returns, made ready for the text box.
     Android's offensive-word filter hides ក្ដ behind asterisks, and with it
     the start of ordinary words: ក្ដៅ (hot), ក្ដារ (board), ក្ដី, ក្ដាម. */
  function tidy(s) {
    return String(s).replace(/ក\*\*/g, "ក្ដ").replace(/\s+/g, " ").replace(/^ /, "");
  }

  /* ---- online: the browser's recogniser -------------------------------- */
  const ERR = {
    "not-allowed": "denied", "service-not-allowed": "denied", "audio-capture": "nomic",
    "network": "network", "language-not-supported": "nokhmer",
  };

  async function onlineSupport() {
    if (!SR) return { ok: false, why: "noapi" };
    if (APPLE_ENGINE) return { ok: false, why: "nokhmer" };
    if (typeof SR.available === "function") {
      try {
        const a = await SR.available({ langs: [KM], processLocally: false });
        if (a === "unavailable") return { ok: false, why: "nokhmer" };
      } catch (e) { /* an older browser: it will say so when it starts */ }
    }
    return { ok: true };
  }

  function startOnline(h) {
    if (navigator.onLine === false) { h.end("offline"); return null; }
    let rec = null, active = false, idle = 0, again = 0;
    let done = "";                // sentences from sessions that have ended
    let fin = "", inter = "";     // the session in progress: settled, and still changing
    let err = "", dead = false;
    let stopped = "";             // "user": they pressed stop · "idle": it went quiet
    let began = 0, lastHeard = Date.now();

    // nothing from the recogniser for a while: the microphone goes off by itself
    const quiet = () => { clearTimeout(idle); idle = setTimeout(() => halt("idle"), IDLE_MS); };
    function finish(why) {
      if (dead) return;
      dead = true; clearTimeout(idle); clearTimeout(again);
      h.text(tidy(done));
      h.end(why);
    }
    // finish the sentence in progress, then end
    function halt(how) {
      if (dead || stopped) return;
      stopped = how; clearTimeout(idle); clearTimeout(again);
      if (!active) { finish(!done && how === "idle" ? "nospeech" : ""); return; }
      try { rec.stop(); } catch (e) { finish(""); }
    }
    function begin() {
      fin = inter = err = "";
      rec = new SR();
      rec.lang = KM; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.continuous = !ANDROID;
      rec.onstart = () => { if (!dead) { h.state("listening"); quiet(); } };
      rec.onresult = (e) => {
        if (dead) return;
        let f = "", n = "";
        for (let i = 0; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) f += t; else n += t;
        }
        quiet();
        // Android sends empty partial results between real ones: they must
        // not wipe a sentence that is already on the page
        if (!(f + n) && (fin + inter)) return;
        fin = f; inter = n;
        h.text(tidy(done + fin + inter));
      };
      // Android stops hearing once a sentence ends, until its text has come back
      rec.onspeechend = () => { if (!dead && !rec.continuous) h.state("working"); };
      rec.onerror = (e) => { err = e.error || "failed"; };
      rec.onend = () => {
        active = false;
        if (dead) return;
        const heard = fin + inter;
        done += heard;            // what was heard stays, settled or not
        fin = inter = "";
        if (heard) lastHeard = Date.now();
        const fatal = !!err && err !== "no-speech" && err !== "aborted";
        /* On Android one session is one sentence, and anywhere a session can
           end having caught nothing (a tap, a cough). Keep listening through
           both until it has really been quiet. */
        if (!stopped && !fatal && Date.now() - lastHeard < IDLE_MS) {
          // a session that died at once is not restarted in a tight loop
          again = setTimeout(() => { try { begin(); } catch (e) { finish("failed"); } },
            Date.now() - began < 600 ? 500 : 0);
          return;
        }
        // an error after it went quiet by itself is not worth a message
        finish(fatal && stopped !== "idle" ? (ERR[err] || "failed")
          : !done && stopped !== "user" ? "nospeech" : "");
      };
      began = Date.now();
      rec.start();
      active = true;
    }

    h.state("starting");
    try { begin(); } catch (e) { finish("failed"); return null; }
    return {
      stop() { halt("user"); },
      // end now and drop whatever has not arrived yet
      abort() {
        if (dead) return;
        dead = true; clearTimeout(idle); clearTimeout(again);
        try { rec.abort(); } catch (e) { /* already over */ }
        h.end("");
      },
    };
  }

  /* ---- local: a model on this device (voice-local.mjs) -------------------- */
  let localModule = null;
  function loadLocal() {
    if (!localModule) {
      localModule = import("./voice-local.mjs").then((m) => m.default);
      localModule.catch(() => { localModule = null; });   // offline now: try again next time
    }
    return localModule;
  }

  /* Quick checks that need no download. The model is about 1.1 GB and runs on
     the graphics chip, so it is for computers, not phones. It has been run in
     Chrome; Edge is the same engine. Other browsers are not offered a 1.1 GB
     download that has never been seen to work in them. */
  async function localSupport() {
    if (PHONE) return { ok: false, why: "phone" };
    if (!/Chrom(e|ium)\//.test(UA) || !navigator.gpu || !window.AudioWorkletNode || !window.WebAssembly
        || !(navigator.storage && navigator.storage.getDirectory)) return { ok: false, why: "nogpu" };
    if (navigator.deviceMemory && navigator.deviceMemory < 8) return { ok: false, why: "lowmem" };
    try {
      if (!(await navigator.gpu.requestAdapter())) return { ok: false, why: "nogpu" };
    } catch (e) { return { ok: false, why: "nogpu" }; }
    let ready = false;
    try { ready = await (await loadLocal()).ready(); } catch (e) { /* not known while offline */ }
    return { ok: true, ready };
  }

  function startLocal(h) {
    let inner = null, cancelled = false;
    h.state("starting");
    loadLocal().then((L) => {
      if (cancelled) return;
      inner = L.start(h);
      if (!inner) cancelled = true;       // it has already reported why
    }).catch(() => { if (!cancelled) { cancelled = true; h.end("failed"); } });
    const drop = (how) => () => {
      if (inner) inner[how]();
      else if (!cancelled) { cancelled = true; h.end(""); }
    };
    return { stop: drop("stop"), abort: drop("abort") };
  }

  window.KHVOICE = {
    /* which engines this browser can run: { online:{ok,why}, local:{ok,why,ready} } */
    support() {
      return Promise.all([onlineSupport(), localSupport()])
        .then(([online, local]) => ({ online, local }));
    },
    /* begin a dictation; returns { stop(), abort() }, or null if it could not begin */
    start(engine, h) { return engine === "local" ? startLocal(h) : startOnline(h); },
    tidy,
  };
})();
