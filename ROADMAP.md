# Roadmap — toward an everyday Khmer phonetic keyboard

Where the project stands (v5) and what comes next, in priority order.

## Done (v1–v5)
- Phonetic engine (custom romanization, auto coeng stacking)
- Pinyin-style IME UX: floating candidate bar at the caret + Gboard-style
  strip above the on-screen QWERTY, Space/Enter/1-9/arrows/tap
- 62k-word lexicon (Google Khmer pronunciation lexicon, CC-BY-4.0) matched by
  sound-class skeleton, frequency-ranked by segmented Khmer Wikipedia
- Learning from use: per-word usage boost, personal words ("yours"),
  personal phrase pairs — all localStorage-only
- Next-word prediction: 10.4k-word bigram model from Khmer Wikipedia,
  blended with the user's own phrases
- PWA, offline, public at https://merlynial.github.io/khmer-phonetic-keyboard/

## Next session A — social-media romanized Khmer ("Khmerlish")
Goal: match the way people actually romanize on Facebook/Telegram, and add
colloquial vocabulary that Wikipedia never contains.
1. Collect romanized↔Khmer pairs. No public dataset exists (checked HF).
   Sources to mine, in order of practicality:
   - Pakrinha's own chat exports (Telegram export → JSON) — private, real,
     zero scraping issues; processed locally only.
   - Khmer song-lyric sites that show both romanized + Khmer lines.
   - Research corpora: khPOS, SleukRith, NIPTICT sets (formal, less useful).
2. Build an eval set (~300 real pairs) and score the current `qskel` matcher;
   tune equivalence classes against misses (numbers-as-letters, dropped
   finals, "aw/or/o" habits, doubled letters).
3. Expand the colloquial layer of the curated dictionary from what the eval
   set shows is missing (particles, slang, brand/place names).
4. Better frequencies: re-rank with a conversational corpus (CC-100 km /
   OSCAR km subset) blended with Wikipedia.

## Done — real system keyboard, every platform (Keyman)
Typing Khmer-by-sound inside any app now works on Android, iPhone, iPad,
Windows, macOS and Linux, without writing a native IME per platform.

- `keyman/khmer_phonetic/` — the keyboard: the romanization compiled into a
  72-state Keyman rule machine, a phone touch layout, a bundled Khmer font
- `keyman/pakrinha.km.khmerphonetic/` — 20,000-word dictionary for the
  suggestion bar on phones and tablets
- Both are generated from `index.html` and `words.txt`, and CI fails if they
  drift. `tests/compiled.mjs` types tens of thousands of strings through the
  compiled keyboard that ships in the package.
- Install page: `install.html`

What this route does not carry over: the fuzzy sound matching. The Keyman
keyboard converts spellings deterministically, so `sousdey` no longer finds
សួស្តី the way the web app does — the dictionary only completes words already
started. Closing that gap needs the Khmerlish work in session A, or a native
IME.

## Later — native IME, if the Keyman route proves limiting
1. Kotlin `InputMethodService` project, new repo `khmer-ime`.
2. Port the engine: qskel matcher + words.txt/bigrams.txt as packaged assets.
3. Keyboard view: QWERTY + suggestion strip (reuse this app's layout logic).
4. Personal learning in app storage; import/export.
5. iOS custom keyboard extension (same assets, Swift) — needs a paid Apple
   developer account to distribute.

## Smaller improvements (any session)
- Trigram / backoff prediction; predict after punctuation and at sentence start
- Long-press backspace repeat; haptics on mobile
- Khmer UI labels (his users may not read English)
- Word-frequency rebuild script automation (GitHub Action, monthly wiki dump)
