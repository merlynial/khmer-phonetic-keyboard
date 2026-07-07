# Keyman spike — one keyboard for every platform

[Keyman](https://keyman.com) (SIL, open source) deploys one keyboard definition +
one predictive **lexical model** to Android, iOS, Windows, macOS, Linux and web.
This directory holds the pieces derived from this project's data.

## What's here
- `wordlist.tsv` — top 20,000 Khmer words with frequency weights, generated from
  `../words.txt` (rebuild with the snippet in the repo history or regenerate after
  `tools/build_words.py` runs).

## Next steps (Keyman Developer required)
1. Install [Keyman Developer](https://keyman.com/developer/) (Windows) or use
   `@keymanapp/kmc` (npm) on any OS.
2. Create a lexical model project `km.pakrinha.khmer_phonetic` and point its
   source at `wordlist.tsv` (`format: 'trie-1.0'`, `wordBreaker: 'default'`).
3. Create a **touch layout keyboard** (KMN/LDML) implementing the romanization:
   the simple deterministic mappings (k→ក, kh→ខ, aa→ា, …) port directly as
   rules; the fuzzy sound-matching of the web app does not port — the lexical
   model's predictions compensate partially.
4. Test in Keyman's web tester, then submit to the Keyman keyboards repository
   for distribution in the Keyman apps on all platforms.

## Honest assessment
- ✅ cheapest route to *every* platform, proven for Khmer keyboards already
- ⚠️ suggestion quality will be below the web app (no skeleton fuzzy match)
- ⚠️ keyboard rules (KMN) must be written by hand — roughly a day of work
