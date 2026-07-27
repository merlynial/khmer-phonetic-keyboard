# Khmer Phonetic for Android

A standalone keyboard app. Install the APK, enable it in Android's settings, and
type Khmer by sound in any app — no other software involved.

Download: [`dist/khmer-phonetic.apk`](../dist/khmer-phonetic.apk), or the
install page at
<https://merlynial.github.io/khmer-phonetic-keyboard/install.html>.

## What it does

- Converts as you type. Latin letters accumulate in a buffer and the whole thing
  is shown as Android *composing text*, so k-h-n-h-o-m walks through
  ក, ខ, ខ្ន, ខ្ញ, ខ្ញុ, ខ្ញុំ in the field itself.
- Suggests words from the sound, not the spelling — the fuzzy matching the
  Keyman build could not carry over. `sousdey`, `suosdei` and `suastei` all
  reach សួស្តី.
- Learns. Words you pick rank higher next time, and the spelling you used
  becomes one of your own keys. All of it stays in the app's own storage.
- Tapping a suggestion inserts the word with **no** trailing space, because
  Khmer runs words together. The space key adds one when you want it.

## Layout

| Source | What it is |
| --- | --- |
| `KhmerPhoneticService.kt` | The `InputMethodService` — composing text, commit rules, backspace |
| `KeyboardView.kt` | The keys and suggestion strip, built in code |
| `KeyboardLayout.kt` | Which keys exist, and their Khmer hints |
| `PhoneticEngine.kt` | The romanization, ported from `index.html` |
| `Suggestions.kt` | Tiered lookup over the curated and 62k-word lexicons |
| `SharedPreferencesLearning.kt` | Usage counts and personal spellings |
| `PhoneticScheme.kt` | **Generated** — the maps, from `index.html` |

Assets (`curated.tsv`, `words.txt`, `bigrams.txt`, the font) are generated or
copied by `tools/build_android.mjs`. Do not edit them by hand.

## Build

Needs a JDK 21 and the Android SDK. Neither Android Studio nor a Google account
is required.

```bash
npm run build:android    # regenerate PhoneticScheme.kt and the assets
npm run android:test     # the engine against the web app, 29,142 cases
npm run android:apk      # debug APK into dist/
```

`android/local.properties` must point at your SDK:

```
sdk.dir=/Users/you/Library/Android/sdk
```

## Why the engine is generated

`PhoneticScheme.kt` is written by `tools/build_android.mjs` from the maps in
`index.html`, and `curated.tsv` is dict.js's own index, precomputed. That means
the reverse-transliterator that derives romanization keys never had to be ported
to Kotlin — so its output cannot come out different from the browser's.

What *is* hand-ported is the conversion loop and the sound-skeleton matcher.
`EngineTest` guards them: it replays 29,142 strings that the web engine
converted — every romanization key, every ordered pair of keys, and 20,000
random strings — and fails on any disagreement.

## How touch works, and why

The first version made every key a `TextView` that fired on `ACTION_DOWN`. It
was unusable: the letter committed the instant a finger landed, so a tap a few
pixels into the neighbouring key typed the wrong letter, silently — and the
engine then converted that wrong letter perfectly. "Keys are hard to hit" and
"wrong Khmer comes out" were the same bug seen from two ends.

`KeyPadView` draws the keys on a canvas and handles touch itself:

- keys commit on **release**, not on touch, so a bad landing can be slid off
- the selection follows the finger; a preview bubble shows where it is
- holding a key gives its alternate — the capitals `D N L T M H`, Khmer digits,
  a Latin full stop
- taps that land between keys snap to the nearest one in the row
- every press gives the standard keyboard haptic

`Suggestions` binary-searches sorted indices rather than scanning all 77,000
entries per keystroke: 0.6 ms → 0.04 ms on the JVM, and no main-thread stall on
a phone.

## Not done yet

- **Phrase mode.** The web app segments a long romanized run into several words
  (`segmentPhrase`); here, suggestions are per word.
- **Next-word prediction.** `bigrams.txt` ships in the APK but nothing reads it.
- **Backup and restore** of learned words.
- **A long-press popup.** Holding a key types its alternate directly rather than
  showing a chooser, so only one alternate per key is reachable.

## Signing

The APK is debug-signed, which is fine for installing it yourself but not for
Google Play. A Play release needs its own keystore and an
`applicationId` you control.
