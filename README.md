# Khmer Phonetic Keyboard · ក្តារចុចផ្លាស់សំឡេង

**Type Khmer by its sound.** Write the pronunciation in English letters and pick
the Khmer word from live suggestions — exactly like a Chinese Pinyin keyboard,
but for Khmer.

**➡️ Use it here: <https://merlynial.github.io/khmer-phonetic-keyboard/>**

```
khnhom  ⎵   srolanh  ⎵   kampuchea  ⎵     →     ខ្ញុំស្រឡាញ់កម្ពុជា
```

## Features

- **Pinyin-style suggestions** — type a word's sound (`orkun`, `suosdei`,
  `khnhom`…) and pick the word with a tap, the number keys `1-9`, or `Space`.
  Spelling is forgiving: `orkun`, `arkun`, and `awkun` all find អរគុណ.
- **On-screen QWERTY keyboard** — phone-style layout with one-shot Shift,
  a `?123` layer for Khmer punctuation (។ ៕ ៗ ៖ « ») and sign keys
  (់ ៉ ៊ ័ ៍), and tiny Khmer hints under each letter.
- **Full phonetic engine** — anything not in the dictionary still converts
  letter-by-letter with automatic subscript stacking (coeng ្), so you can
  type any Khmer word, not just common ones.
- **Works offline** — it's a PWA; add it to your Home Screen and it behaves
  like an app. No install, no tracking, no server: everything runs in your
  browser.

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

- `index.html` — UI + phonetic conversion engine
- `dict.js` — word dictionary + reverse-romanizer that auto-generates the
  fuzzy lookup keys (add a word: one line in `DICT`)
- `sw.js` — offline cache

## License

MIT
