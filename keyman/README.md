# Keyman packages — the system keyboard

The web app types Khmer into its own box. These two packages type Khmer into
**any** app, on Android, iPhone, iPad, Windows, macOS and Linux, by way of
[Keyman](https://keyman.com) — SIL's free, open-source keyboarding platform.

Install instructions for each platform: [install.html](../install.html), live at
<https://merlynial.github.io/khmer-phonetic-keyboard/install.html>.

| Package | What it is |
| --- | --- |
| `khmer_phonetic/` | The keyboard: the romanization rules, the on-screen layout for phones, and a bundled Khmer font |
| `pakrinha.km.khmerphonetic/` | The dictionary: 20,000 Khmer words for the suggestion bar on phones and tablets |

Keyman does not allow one package to hold both a keyboard and a lexical model,
so they ship as two `.kmp` files. The keyboard package names the dictionary as a
related package.

## Everything here is generated

Nothing in `source/` should be edited by hand except the `.kps` package files and
the `.model.ts`. The rest is built from the web app, which is the single source
of truth for the romanization:

```bash
npm run build
```

| Generated file | From | By |
| --- | --- | --- |
| `khmer_phonetic/source/khmer_phonetic.kmn` | the `CONS`/`VOW`/`SIGN`/`INDEP` maps in `../index.html` | `tools/build_keyman.mjs` |
| `khmer_phonetic/source/khmer_phonetic.keyman-touch-layout` | the same maps | `tools/build_touch_layout.mjs` |
| `khmer_phonetic/source/welcome.htm`, `readme.htm` | the same maps | `tools/build_docs.mjs` |
| `pakrinha.km.khmerphonetic/source/wordlist.tsv` | `../words.txt` | `tools/build_wordlist.mjs` |

CI fails if the committed files differ from what a rebuild produces, so the
keyboard cannot quietly drift from the web app.

## How the romanization survives the translation

The web engine converts a whole string in one greedy longest-match pass, holding
a `prevCons` flag to decide coeng stacking. Keyman fires rules one keystroke at a
time and cannot see the next letter, so `chh` arrives as `c`, then `h`, then `h`.

`tools/build_keyman.mjs` bridges that by compiling the tokenizer into a state
machine — 72 states, 2,808 transitions — where each state is a pending
romanization plus the stacking flag, carried in the context as a Keyman deadkey.
Every keystroke rewrites the tentative rendering of the pending buffer, so the
text on screen after each letter is exactly what the web app would have produced
had you stopped typing there.

Two test suites hold that claim up:

```bash
npm test                # the generated rule table vs. the web engine
npm run test:packages   # the COMPILED keyboard vs. the web engine
```

The second one matters more. It loads the real `khmer_phonetic.js` — the file
that ships inside the `.kmp` and runs on the phone — behind a small shim of the
five host functions a KeymanWeb keyboard calls, and types tens of thousands of
strings through it. It tests what kmc produced, not what this repo intended.

## Building without Keyman Developer

Keyman Developer is Windows-only, but its compiler `kmc` is an npm package and
runs anywhere:

```bash
npm install
npm run build
```

One caveat: npm strips `.gitignore` from published tarballs, which leaves kmc's
project templates incomplete and makes `kmc generate` fail. Only `generate` is
affected — `build` is fine. The CI workflow patches it in three lines.

## Limitations worth knowing

- **No fuzzy sound matching.** The web app guesses at loose spellings and offers
  candidates from the sound (`sousdey` still finds សួស្តី). The Keyman keyboard
  converts deterministically, so spellings must follow the scheme. The
  dictionary compensates by completing words once you have started them.
- **Predictions are syllable-anchored.** Khmer is written without spaces between
  words, so Keyman's word breaker splits at every syllable. Suggestions appear
  from the first syllable but do not accumulate across a whole word.
- **Suggestions are mobile-only.** Keyman shows the prediction bar on Android and
  iOS; on Windows the keyboard types Khmer with no suggestion bar.
