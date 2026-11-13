# Khmer Phonetic Keyboard · ក្ដារចុចខ្មែរ វាយតាមសូរ

**Type Khmer by its sound.** Write the pronunciation in English letters and pick
the Khmer word from live suggestions — exactly like a Chinese Pinyin keyboard,
but for Khmer.

**➡️ Website: <https://khmerkeyboard.com/> · the keyboard itself: <https://khmerkeyboard.com/app.html>**

**➡️ Install it as a real keyboard on Android, iPhone or Windows:
<https://khmerkeyboard.com/install.html>**

```
khnhom  ⎵   srolanh  ⎵   kampuchea  ⎵     →     ខ្ញុំស្រឡាញ់កម្ពុជា
```

## Features

- **Pinyin-style suggestions** — type a word's sound and candidates pop up
  in a floating bar right at your cursor (modeled on the macOS Pinyin IME):
  `Space`/`Enter` picks the highlighted word, `←`/`→` moves the highlight,
  `1-9` or a tap picks directly. Spelling is very forgiving — `sousdey`,
  `suosdei`, and `suastei` all find សួស្តី; `orkun`/`arkun`/`awkun` find អរគុណ.
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
- **Voice typing** — press the microphone and speak Khmer. You choose who
  listens, the first time you press it, and it is never chosen for you:
  - *On this device.* A Khmer speech model runs in the browser, so your voice
    never leaves the machine and it works offline. It needs a computer with a
    recent Chrome or Edge (WebGPU) and a one-time 1.1 GB download.
  - *Online, through Google.* The browser's own speech recognition: nothing to
    download, and it works in Chrome on Android too. Your voice is sent to
    Google while the microphone is on.

  It does not work on iPhone or iPad, where speech recognition has no Khmer.
- **Works offline** — it's a PWA; add it to your Home Screen and it behaves
  like an app. No install, no tracking, no server: everything runs in your
  browser. Online voice typing is the one exception, and only if you choose it.

## As a system keyboard

Type Khmer by sound in Telegram, Messenger, Word, or anywhere else — not only on
this page. Three builds, because no single one reaches every platform:

| | What it is | Sound matching |
|---|---|---|
| **[Android app](android/README.md)** — `dist/khmer-phonetic.apk` | A standalone keyboard app. Nothing else to install. | Yes — the same fuzzy matching as the web app |
| **[iOS app](ios/README.md)** — `KhmerPhonetic.ipa` from the [latest release](https://github.com/merlynial/khmer-phonetic-keyboard/releases/latest) | A native keyboard extension for iPhone and iPad, sideloaded with [SideStore](https://sidestore.io) and signed by your own Apple ID. | Yes — the same fuzzy matching as the web app |
| **[Keyman package](keyman/README.md)** — `dist/*.kmp` | Runs inside [Keyman](https://keyman.com). Covers the desktops: **Windows, macOS, Linux**. | No — spellings convert exactly as typed |

See [install.html](install.html) for per-platform steps.

All three are generated from the maps in `engine.js` and checked against the web
app on every build: the Keyman build types tens of thousands of strings through
the *compiled* keyboard that ships in the package, the Android build replays
29,142 conversions through the Kotlin port, and the iOS build runs the same
comparison against the Swift port. Any disagreement fails the build.

Every phone gets a real app of its own, with the sound matching intact. Keyman is
the desktop answer only — a Windows input method is TSF/COM and has to be compiled
on Windows, and one `.kmp` covers all three desktops instead.

Two caveats on iOS: a free Apple ID signs a sideloaded app for **seven days** at a
time (SideStore re-signs on the device over Wi-Fi, so it renews itself), and the
keyboard has been built and verified but **not yet run on a physical device**.

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

The full chart is in the [typing guide](https://khmerkeyboard.com/guide.html), and built into the keyboard page.

## Development

Static site — no build step:

```sh
python3 -m http.server 4599
# open http://localhost:4599
```

- `engine.js` — the phonetic conversion engine and its maps: the source of
  truth for the romanization. The Keyman keyboard and the Android and iOS
  schemes are generated from this file, and the web pages load it as is
- `dict.js` — word dictionary + reverse-romanizer that auto-generates the
  fuzzy lookup keys (add a word: one line in `DICT`)
- `app.html` + `app.css` — the keyboard itself
- `index.html` + `home.js` — the home page and its live demo
- `guide.html` + `guide.js` — the typing guide, generated from `engine.js`
- `install.html` — download and install page for the system keyboards
- `site.css` + `site.js` — the shared design: header, footer, light and dark
  themes, and the Khmer / English switch (remembered as `khkb_lang`, the
  same setting the keyboard uses)
- `voice.js` — voice typing: the online engine (the browser's speech
  recognition) and what the two engines share. The buttons, the first-use
  choice and the text handling are in `app.html`
- `voice-local.mjs`, `voice-worker.mjs`, `voice-core.mjs`, `voice-worklet.js` —
  the on-device engine, loaded only when someone chooses it: the microphone
  and the cutting into phrases, the speech model in a worker (ONNX Runtime on
  WebGPU), the arithmetic both need, and the audio-thread tap. The model's
  address and checksums are in `voice-local.mjs`
- `vendor/onnxruntime-web-1.31.1/` — the script half of ONNX Runtime Web
- `xray.js` — the "how a spelling is read" widget on the home page and guide
- `sw.js` — offline cache; bump `CACHE` on every release
- `fonts/` — Kantumruy (site text) and Siemreap (typed Khmer), both OFL
- `CNAME` — the custom domain for GitHub Pages
- `_config.yml` — keeps the app sources and project notes off the public
  site; anything new that is not part of the website belongs in its `exclude`
- `robots.txt` + `sitemap.xml` — for search engines; a new page goes in the
  sitemap

- `android/` — the Android keyboard app (Kotlin)
- `keyman/` — the Keyman keyboard and dictionary packages

The keyboards do have a build step:

```sh
npm install
npm run build            # regenerate sources, compile both .kmp packages into dist/
npm test                 # rule table vs. the web engine, and the voice-typing tests
npm run test:packages    # the compiled Keyman keyboard vs. the web engine
npm run build:android    # regenerate the Kotlin scheme and app assets
npm run android:test     # the Kotlin engine vs. the web engine
npm run android:apk      # debug APK into dist/
```

## License

MIT for the keyboard itself.

Bundled works keep their own licences:

- **Siemreap** (`fonts/`, and inside the Android, iOS and Keyman builds) —
  © 2010 Danh Hong, [khmertype.blogspot.com](https://khmertype.blogspot.com),
  under the SIL Open Font License 1.1. Full text in [OFL.txt](OFL.txt).
  Reserved Font Name: Siemreap.
- **Kantumruy** (`fonts/`) — © 2013 Sovichet Tep, with Latin from Lato
  © 2010-2011 Łukasz Dziedzic, under the SIL Open Font License 1.1 (same
  [OFL.txt](OFL.txt)). Reserved Font Name: Kantumruy.
- **The logo's ក** is drawn from the Suwannaphum outline by Danh Hong,
  Apache License 2.0.
- **Khmer pronunciation lexicon** (`words.txt`) — from the Google Khmer
  pronunciation lexicon, CC-BY-4.0.
- **ONNX Runtime Web** (`vendor/onnxruntime-web-1.31.1/`) — © Microsoft
  Corporation, MIT ([LICENSE](vendor/onnxruntime-web-1.31.1/LICENSE)). Its
  WebAssembly half is fetched from jsDelivr when on-device voice typing is
  first used.

Not bundled, but downloaded from Hugging Face by anyone who chooses on-device
voice typing: **Qwen3-ASR 0.6B** by the Qwen team at Alibaba Cloud, fine-tuned
for Khmer by Seanghay Yath
([seanghay/Qwen3-ASR-0.6B-Khmer](https://huggingface.co/seanghay/Qwen3-ASR-0.6B-Khmer))
on the Khmer speech dataset of DDD-Cambodia (CC-BY-SA-4.0), in the 8-bit ONNX
export made for browsers by KamVox
([uddompang/qwen3-asr-0.6b-khmer-onnx](https://huggingface.co/uddompang/qwen3-asr-0.6b-khmer-onnx)).
All three are under the Apache License 2.0.
