/* Generate the documentation that ships inside the keyboard package.
 *
 * welcome.htm is what Keyman shows the moment the package is installed, on the
 * phone, in the app. It is the only place a new user will look for the
 * romanization, so it holds the full table — generated from the scheme maps so
 * it cannot describe a keyboard we did not ship.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScheme, REPO } from "./scheme.mjs";

const DEST = join(REPO, "keyman", "khmer_phonetic", "source");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Group the map into rows of "roman → khmer" cells. */
function table(pairs, cols = 4) {
  const cells = pairs.map(
    ([rom, kh]) => `<td><code>${esc(rom)}</code></td><td class="kh">${esc(kh) || "&nbsp;"}</td>`
  );
  const rows = [];
  for (let i = 0; i < cells.length; i += cols) {
    rows.push("<tr>" + cells.slice(i, i + cols).join("") + "</tr>");
  }
  return `<table>${rows.join("")}</table>`;
}

const CSS = `
body { font: 16px/1.55 -apple-system, "Segoe UI", Roboto, sans-serif;
       margin: 0 auto; padding: 20px; max-width: 44em; color: #1a1a1a; }
h1 { font-size: 1.5rem; margin: 0 0 .2em; }
h2 { font-size: 1.05rem; margin: 1.8em 0 .5em; text-transform: uppercase;
     letter-spacing: .06em; color: #666; font-weight: 600; }
p { margin: .6em 0; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; background: #f2f2f4;
       padding: 1px 5px; border-radius: 4px; font-size: .92em; }
table { border-collapse: collapse; width: 100%; margin: .4em 0 1em; }
td { padding: 5px 8px; border-bottom: 1px solid #ececef; white-space: nowrap; }
td.kh { font-family: "Khmer OS Siemreap", Siemreap, "Khmer OS", sans-serif;
        font-size: 1.25em; padding-right: 18px; }
.ex { font-family: "Khmer OS Siemreap", Siemreap, sans-serif; font-size: 1.2em; }
.note { background: #f7f7f9; border-left: 3px solid #d8d8de; padding: .7em 1em;
        margin: 1em 0; }
@media (prefers-color-scheme: dark) {
  body { background: #16161a; color: #e8e8ea; }
  h2 { color: #9a9aa4; }
  code { background: #26262c; }
  td { border-bottom-color: #2a2a31; }
  .note { background: #1e1e24; border-left-color: #3a3a44; }
}`;

const page = (title, body) =>
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;

export function buildDocs(scheme) {
  const { CONS, VOW, SIGN, INDEP } = scheme;

  const cons = Object.entries(CONS);
  const vow = Object.entries(VOW).filter(([r]) => r !== "a");
  const indep = Object.entries(INDEP);
  const signs = Object.entries(SIGN).filter(([r, k]) => r !== " " && r !== "." && k);

  const examples = [
    ["suastei", "សួស្តី", "hello"],
    ["arkun", "អរគុណ", "thank you"],
    ["khnhom", "ខ្ញុំ", "I / me"],
    ["baadd", "បាទ", "yes (m.)"],
    ["ka.mpujaa", "កម្ពុជា", "Cambodia"],
    ["m*aong", "ម៉ោង", "hour"],
  ].map(([r, k, g]) => `<tr><td><code>${r}</code></td><td class="kh">${k}</td><td>${g}</td></tr>`).join("");

  const welcome = page(
    "Khmer Phonetic",
    `<h1>Khmer Phonetic</h1>
<p>Type Khmer by sound. Write the word the way it sounds in Latin letters and it
becomes Khmer as you type — no need to learn key positions.</p>

<h2>Try these</h2>
<table>${examples}</table>

<h2>Three rules worth knowing</h2>
<div class="note">
<p><b>Consonants stack automatically.</b> Two consonants typed with no vowel
between them join with coeng: <code>khnhom</code> gives <span class="ex">ខ្ញុំ</span>.
Type <code>.</code> to break a cluster: <code>ka.mpujaa</code> gives
<span class="ex">កម្ពុជា</span>.</p>
<p><b>Capitals matter.</b> <code>d</code> is <span class="ex">ដ</span> but
<code>D</code> is <span class="ex">ឌ</span>; <code>n</code> is
<span class="ex">ន</span> but <code>N</code> is <span class="ex">ណ</span>. On a
phone, hold the key to reach the capital.</p>
<p><b><code>a</code> is the built-in vowel.</b> It writes nothing on its own — it
just ends the consonant, so <code>ka</code> is <span class="ex">ក</span>.</p>
</div>

<h2>Consonants</h2>
${table(cons)}

<h2>Vowels</h2>
${table(vow)}

<h2>Independent vowels</h2>
${table(indep)}

<h2>Signs and punctuation</h2>
${table(signs)}

<h2>Word suggestions</h2>
<p>On Android and iPhone, install the <b>Khmer Phonetic Dictionary</b> package as
well to get a suggestion bar above the keyboard, drawn from a 20,000 word
frequency list.</p>

<p>Full documentation and the web version:
<a href="https://merlynial.github.io/khmer-phonetic-keyboard/">merlynial.github.io/khmer-phonetic-keyboard</a></p>`
  );

  const readme = page(
    "Khmer Phonetic",
    `<h1>Khmer Phonetic</h1>
<p>A phonetic Khmer keyboard: romanized input converts to Khmer as you type.
<code>suastei</code> gives <span class="ex">សួស្តី</span>, <code>khnhom</code>
gives <span class="ex">ខ្ញុំ</span>.</p>
<p>Consonants stack automatically with coeng; <code>.</code> breaks a cluster;
capital letters reach the second-series consonants (<code>D</code>
<span class="ex">ឌ</span>, <code>N</code> <span class="ex">ណ</span>,
<code>L</code> <span class="ex">ឡ</span>).</p>
<p>The full romanization table is in the welcome page shown after installation,
and at
<a href="https://merlynial.github.io/khmer-phonetic-keyboard/">merlynial.github.io/khmer-phonetic-keyboard</a>.</p>
<p>Source: <a href="https://github.com/merlynial/khmer-phonetic-keyboard">github.com/merlynial/khmer-phonetic-keyboard</a> — MIT licence.
Word frequencies derive from the Google Khmer pronunciation lexicon (CC-BY-4.0).</p>`
  );

  return { welcome, readme };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scheme = loadScheme();
  const { welcome, readme } = buildDocs(scheme);
  writeFileSync(join(DEST, "welcome.htm"), welcome, "utf8");
  writeFileSync(join(DEST, "readme.htm"), readme, "utf8");
  console.log(`wrote ${join(DEST, "welcome.htm")} (${welcome.length} bytes)`);
  console.log(`wrote ${join(DEST, "readme.htm")} (${readme.length} bytes)`);
}
