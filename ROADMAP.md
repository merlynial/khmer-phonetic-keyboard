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

## Next session B — real system keyboard (Android IME)
Goal: type Khmer-by-sound inside any app (Telegram, Word, browser).
1. Kotlin `InputMethodService` project, new repo `khmer-ime`.
2. Port the engine: qskel matcher + words.txt/bigrams.txt as packaged assets
   (the data files are already exactly what the IME needs).
3. Keyboard view: QWERTY + suggestion strip (reuse this app's layout logic).
4. Personal learning in app storage; import/export.
5. Later: iOS custom keyboard extension (same assets, Swift).

## Smaller improvements (any session)
- Trigram / backoff prediction; predict after punctuation and at sentence start
- Long-press backspace repeat; haptics on mobile
- Khmer UI labels (his users may not read English)
- Word-frequency rebuild script automation (GitHub Action, monthly wiki dump)
