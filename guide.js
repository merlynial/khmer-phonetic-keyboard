/* =========================================================================
   Typing guide: every chart and example is generated from engine.js, so the
   guide can never disagree with what the keyboard actually types.
   ========================================================================= */
(function () {
  "use strict";
  if (typeof convert !== "function") return;
  const L = (en, km) => `<span data-l="en">${en}</span><span data-l="km">${km}</span>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const conv = (s) => convert(s, { autostack: true }).replace(/​/g, "");
  const keysHtml = (keys) => keys.map((k, i) => (i ? `<span class="alt">${esc(k)}</span>` : esc(k))).join(" · ");
  const group = (entries) => {
    const m = new Map();
    for (const [k, g] of entries) { if (!m.has(g)) m.set(g, []); m.get(g).push(k); }
    return [...m];
  };
  const cell = (g, keys, note, mark) =>
    `<div class="cell" role="listitem"><span class="g${mark ? " mark" : ""}" lang="km">${g}</span>` +
    `<span class="k">${keys}</span>${note ? `<span class="n">${note}</span>` : ""}</div>`;
  const fill = (name, html) => { const el = document.querySelector(`[data-chart="${name}"]`); if (el) el.innerHTML = html; };

  /* consonants */
  fill("cons", group(Object.entries(CONS)).map(([g, keys]) =>
    cell(g, keysHtml(keys), keys.some((k) => /[A-Z]/.test(k)) ? L("capital", "អក្សរធំ") : "")).join(""));

  /* vowels, each shown on ក */
  fill("vow", group(Object.entries(VOW)).map(([g, keys]) => {
    if (!g) return cell("ក", keysHtml(keys), L("adds nothing", "មិនបន្ថែមអ្វី"));
    return cell(esc(conv("k" + keys[0])), keysHtml(keys), `<span lang="km" style="font-family:'Siemreap Web',var(--font-sans);font-size:18px;line-height:1.5">◌${g}</span>`);
  }).join(""));

  /* independent vowels */
  fill("indep", group(Object.entries(INDEP)).map(([g, keys]) => cell(g, keysHtml(keys), "")).join(""));

  /* signs */
  const SIGN_NAMES = {
    "M": ["nikahit", "និគ្គហិត"], "H": ["reahmuk", "រះមុខ"], "'": ["bantoc", "បន្តក់"],
    "^": ["samyok sannya", "សំយោគសញ្ញា"], "~": ["toandakhiat", "ទណ្ឌឃាត"],
    "*": ["musikatoan", "មូសិកទន្ត"], "`": ["treisap", "ត្រីសព្ទ"], ".": ["break, not shown", "បំបែក មិនបង្ហាញ"],
  };
  fill("sign", Object.entries(SIGN).filter(([k]) => k.length === 1 && k !== " ").map(([k, g]) => {
    const n = SIGN_NAMES[k];
    return cell(g ? "◌" + g : "–", esc(k), n ? L(n[0], n[1]) : "", !!g);
  }).join(""));

  /* punctuation */
  const PUNCT_NAMES = {
    "//": ["khan, full stop", "ខណ្ឌ"], "///": ["bariyosan, end of text", "បរិយោសាន"],
    "**": ["lekto, repeat", "លេខទោ"], "::": ["colon", "ចំណុចពីរគូស"],
    "<<": ["opening quote", "សញ្ញាសម្រង់បើក"], ">>": ["closing quote", "សញ្ញាសម្រង់បិទ"],
  };
  fill("punct", Object.entries(SIGN).filter(([k]) => k.length > 1).map(([k, g]) => {
    const n = PUNCT_NAMES[k];
    return cell(g, esc(k), n ? L(n[0], n[1]) : "");
  }).join(""));

  /* digits */
  fill("digits", Object.entries(DIGITS).map(([k, g]) => cell(g, esc(k), "")).join(""));

  /* worked examples */
  document.querySelectorAll("[data-examples] li[data-in]").forEach((li) => {
    const input = li.getAttribute("data-in");
    li.innerHTML = `<span class="in">${esc(input)}</span><span class="to" aria-hidden="true">→</span>` +
      `<span class="out" lang="km">${esc(conv(input))}</span>` +
      `<span class="why">${L(esc(li.getAttribute("data-why-en") || ""), esc(li.getAttribute("data-why-km") || ""))}</span>`;
  });
})();
