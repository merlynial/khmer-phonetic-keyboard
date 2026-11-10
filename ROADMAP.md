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
- PWA, offline, public at https://khmerkeyboard.com/

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

## Done — the desktops, via Keyman
Typing Khmer-by-sound inside any app on Windows, macOS and Linux, without
writing a native IME for each of them.

- `keyman/khmer_phonetic/` — the keyboard: the romanization compiled into a
  72-state Keyman rule machine, a touch layout, a bundled Khmer font
- `keyman/pakrinha.km.khmerphonetic/` — 20,000-word dictionary package
- Both are generated from `engine.js` and `words.txt`, and CI fails if they
  drift. `tests/compiled.mjs` types tens of thousands of strings through the
  compiled keyboard that ships in the package.
- Install page: `install.html`

What this route does not carry over: the fuzzy sound matching. The Keyman
keyboard converts spellings deterministically, so `sousdey` does not find
សួស្តី there — the dictionary only completes words already started.

This was once the answer for phones too. It no longer is: Android and iOS each
have a native app that keeps the sound matching, so Keyman is documented as the
desktop route only. The package still installs on a phone if someone wants it —
nothing was removed from the build — but nothing points them there.

## Done — native Android app (`android/`)
A standalone `InputMethodService` app, so Android needs nothing but the APK, and
the fuzzy sound matching the Keyman route drops is back.

- `PhoneticScheme.kt` generated from `engine.js`; `curated.tsv` is dict.js's own
  index precomputed, so `romVariants` never had to be ported
- `Suggestions.kt` ports the qskel matcher and the tiering over both lexicons
- Learning: usage counts and personal spellings in app storage
- `EngineTest` replays 29,142 web-engine conversions through the Kotlin port
- `dist/khmer-phonetic.apk`, debug-signed

Still open there: phrase mode (`segmentPhrase`), next-word prediction (bigrams
ship in the APK but nothing reads them), backup/restore, long-press capitals.

## Done — native iOS app (`ios/`)
A keyboard extension plus a host app, with the same engine, the same 62k lexicon
and the same fuzzy matching as the web and Android builds.

- `PhoneticScheme.swift` generated from `engine.js`, verified against the web
  engine by `npm run ios:verify` in CI
- CI builds an unsigned `.ipa` on GitHub's macOS runners; signing happens on the
  device with the user's own Apple ID via SideStore, so the repo needs no Apple
  account and holds no secrets

Still open there: it has never been run on a physical device — only built and
verified. The seven-day free-signing expiry is Apple's, not this project's.

## Not attempted — native Windows
A Windows input method is TSF/COM and must be compiled on Windows. Keyman covers
it, and is the sensible answer unless Windows becomes a daily driver.

## Smaller improvements (any session)
- Trigram / backoff prediction; predict after punctuation and at sentence start
- Long-press backspace repeat; haptics on mobile
- Khmer UI labels (his users may not read English)
- Word-frequency rebuild script automation (GitHub Action, monthly wiki dump)
