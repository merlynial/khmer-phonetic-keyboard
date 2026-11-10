/* =========================================================================
   Spelling X-ray: shows how the engine reads a spelling, piece by piece.
   Used on the home page and the typing guide. Needs engine.js first.
   Markup: [data-xray] containing .xray-input, [data-tokens], [data-result]
   and optional [data-try] buttons.
   ========================================================================= */
(function () {
  "use strict";
  if (typeof convert !== "function") return;
  const L = (en, km) => `<span data-l="en">${en}</span><span data-l="km">${km}</span>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isMarkStart = (s) => { const c = s.charCodeAt(0); return (c >= 0x17B6 && c <= 0x17D3) || c === 0x17DD; };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const TYPE = {
    cons: ["consonant", "ព្យញ្ជនៈ"], sub: ["subscript", "ជើង"], vowel: ["vowel", "ស្រៈ"],
    inherent: ["no vowel added", "គ្មានស្រៈបន្ថែម"], indep: ["independent vowel", "ស្រៈពេញតួ"],
    sign: ["sign", "សញ្ញា"], brk: ["break", "បំបែក"], space: ["space", "ដកឃ្លា"], other: ["kept as is", "រក្សាដដែល"],
  };

  // Mirrors convert() in engine.js (with auto-stacking on), keeping each step.
  function segments(text) {
    const out = [];
    let prevCons = false, i = 0;
    while (i < text.length) {
      let m = null;
      for (const key of KEYS_AT.get(text[i]) || []) { if (text.startsWith(key, i)) { m = key; break; } }
      if (m) {
        const g = MAP[m];
        if (IS_CONS.has(m)) {
          out.push({ l: m, g: prevCons ? COENG + g : g, t: prevCons ? "sub" : "cons" });
          prevCons = true;
        } else {
          let t = "sign";
          if (has(VOW, m)) t = g ? "vowel" : "inherent";
          else if (has(INDEP, m)) t = "indep";
          else if (m === ".") t = "brk";
          out.push({ l: m, g, t });
          prevCons = false;
        }
        i += m.length;
      } else {
        out.push({ l: text[i], g: text[i], t: text[i] === " " ? "space" : "other" });
        prevCons = false;
        i++;
      }
    }
    return out;
  }

  document.querySelectorAll("[data-xray]").forEach((root) => {
    const input = root.querySelector(".xray-input");
    const tokensEl = root.querySelector("[data-tokens]");
    const resultEl = root.querySelector("[data-result]");
    const tries = root.querySelectorAll("[data-try]");
    if (!input || !tokensEl || !resultEl) return;

    function draw() {
      const text = input.value;
      tokensEl.innerHTML = segments(text).map((s) => {
        let shown = s.g, mark = false;
        if (s.t === "inherent" || s.t === "brk") shown = "–";
        else if (s.t === "space") shown = "";
        else if (shown && isMarkStart(shown)) { shown = "◌" + shown; mark = true; }
        const label = TYPE[s.t];
        return `<div class="tok ${s.t}"><span class="tok-l">${s.t === "space" ? "␣" : esc(s.l)}</span><span class="tok-line"></span>` +
          `<span class="tok-k${mark ? " is-mark" : ""}" lang="km">${esc(shown) || "&nbsp;"}</span>` +
          `<span class="tok-t">${L(label[0], label[1])}</span></div>`;
      }).join("");
      resultEl.textContent = convert(text, { autostack: true }).replace(/​/g, "") || "–";
      tries.forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === text)));
    }
    input.addEventListener("input", draw);
    tries.forEach((b) => b.addEventListener("click", () => { input.value = b.textContent; draw(); input.focus(); }));
    draw();
  });
})();
