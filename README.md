# Khmer Phonetic Keyboard · ក្តារចុចផ្លាស់សំឡេង

**Type Khmer by its sound.** Write the pronunciation in English letters and pick
the Khmer word from live suggestions — exactly like a Chinese Pinyin keyboard,
but for Khmer.

**➡️ Use it in your browser: <https://merlynial.github.io/khmer-phonetic-keyboard/>**

**➡️ Install it as a real keyboard on Android, iPhone or Windows:
<https://merlynial.github.io/khmer-phonetic-keyboard/install.html>**

```
khnhom  ⎵   srolanh  ⎵   kampuchea  ⎵     →     ខ្ញុំស្រឡាញ់កម្ពុជា
```

## Features

- **Pinyin-style suggestions** — type a word's sound and candidates pop up
  in a floating bar right at your cursor (modeled on the macOS Pinyin IME):
  `Space`/`Enter` picks the highlighted word, `←`/`→` moves the highlight,
  `1-9` or a tap picks directly. Spelling is very forgiving — `sousdey`,
  `suosdei`, and `susadey` all find សួស្តី; `orkun`/`arkun`/`awkun` find អរគុណ.
- **On-screen QWERTY keyboard** — phone-style layout with one-shot Shift,
  a `?123` layer for Khmer punctuation (។ ៕ ៗ ៖ « ») and sign keys
  (់ ៉ ៊ ័ ៍), and tiny Khmer hints under each letter.
- **62,000-word lexicon matched by sound** — words come from the open Google
  Khmer pronunciation lexicon (CC-BY-4.0) and are matched on how they *sound*,
  not how they're spelled, ranked by real-text frequency (Khmer Wikipedia).
- **Learns from you** — words you pick rank higher next time; words you type
  that aren't in the dictionary are saved as your personal words (all stored
  only in your browser).
- **Full phonetic engine** — anything not in the dictionary still converts
  letter-by-letter with automatic subscript stacking (coeng ្), so you can
  type any Khmer word, not just common ones.
- **Works offline** — it's a PWA; add it to your Home Screen and it behaves
  like an app. No install, no tracking, no server: everything runs in your
  browser.

## As a system keyboard

Type Khmer by sound in Telegram, Messenger, Word, or anywhere else — not only on
this page. Two builds, because no single one reaches every platform:

| | What it is | Sound matching |
|---|---|---|
| **[Android app](android/README.md)** — `dist/khmer-phonetic.apk` | A standalone keyboard app. Nothing else to install. | Yes — the same fuzzy matching as the web app |
| **[Keyman package](keyman/README.md)** — `dist/*.kmp` | Runs inside [Keyman](https://keyman.com). Reaches **iPhone, iPad, Windows, macOS, Linux** and Android. | No — spellings convert exactly as typed |

See [install.html](install.html) for per-platform steps.

Both are generated from the maps in `index.html` and checked against the web app
on every build: the Keyman build types tens of thousands of strings through the
*compiled* keyboard that ships in the package, and the Android build replays
29,142 conversions through the Kotlin port. Any disagreement fails the build.

There is no native iPhone or Windows app: an iOS keyboard extension needs Xcode
and an Apple developer account, and a Windows input method must be compiled on
Windows. Keyman is what covers those two.

## How to type

| You type | You get | Note |
|---|---|---|
| `khnhom` + Space | ខ្ញុំ | dictionary suggestion |
| `k` `kh` `ng` `ch` … | ក ខ ង ច | consonants by sound |
| `aa` `e` `ai` `ao` `am` … | ា េ ៃ ោ ាំ | vowels after a consonant |
| `D` `N` `L` (capitals) | ឌ ណ ឡ | second-series letters |
| `skl` (no vowel between) | ស្ក្ល | auto subscript stacking |
| `'` `*` `` ` `` `^` `~` | ់ ៉ ៊ ័ ៍ | signs |
| `//` `**` `::` | ។ ៗ ៖ | punctuation |

The full cheat-sheet is built into the page.

## Development

Static site — no build step:

```sh
python3 -m http.server 4599
# open http://localhost:4599
```

- `index.html` — UI + phonetic conversion engine (the source of truth for the
  romanization: the Keyman keyboard is generated from the maps in this file)
- `dict.js` — word dictionary + reverse-romanizer that auto-generates the
  fuzzy lookup keys (add a word: one line in `DICT`)
- `sw.js` — offline cache
- `install.html` — download and install page for the system keyboard

- `android/` — the Android keyboard app (Kotlin)
- `keyman/` — the Keyman keyboard and dictionary packages

The keyboards do have a build step:

```sh
npm install
npm run build            # regenerate sources, compile both .kmp packages into dist/
npm test                 # rule table vs. the web engine
npm run test:packages    # the compiled Keyman keyboard vs. the web engine
npm run build:android    # regenerate the Kotlin scheme and app assets
npm run android:test     # the Kotlin engine vs. the web engine
npm run android:apk      # debug APK into dist/
```

## License

MIT for the keyboard itself.

Two bundled works keep their own licences:

- **Siemreap** (`fonts/`, and inside the Android, iOS and Keyman builds) —
  © 2010 Danh Hong, [khmertype.blogspot.com](https://khmertype.blogspot.com),
  under the SIL Open Font License 1.1. Full text in [OFL.txt](OFL.txt).
  Reserved Font Name: Siemreap.
- **Khmer pronunciation lexicon** (`words.txt`) — from the Google Khmer
  pronunciation lexicon, CC-BY-4.0.
