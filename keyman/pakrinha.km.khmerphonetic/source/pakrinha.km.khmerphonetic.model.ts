/*
  Khmer Phonetic Dictionary 1.0

  Word predictions for the Khmer Phonetic keyboard, shown in the suggestion bar
  on Android and iOS. The wordlist is generated from ../../../words.txt — the
  Google Khmer pronunciation lexicon ranked against the Khmer Wikipedia dump
  blended with CC-100 — by tools/build_wordlist.mjs.

  Two settings below are deliberate and worth explaining:

  wordBreaker
    Left as 'default'. Keyman's default breaker knows Khmer is written without
    spaces between words and breaks at every syllable, so a suggestion is
    offered from the first syllable onward. The alternative,
    overrideScriptDefaults: 'break-words-at-spaces', would complete whole words
    more cleanly but only for people who type a space after every word, which
    Khmer orthography does not do.

  punctuation.insertAfterWord
    Empty, because Khmer runs words together. Accepting a suggestion must not
    push a space in behind it — the same choice the web app makes when a
    candidate is committed.
*/

const source: LexicalModelSource = {
  format: 'trie-1.0',
  wordBreaker: 'default',
  languageUsesCasing: false,
  punctuation: {
    insertAfterWord: '',
    quotesForKeepSuggestion: { open: '«', close: '»' },
  },
  sources: ['wordlist.tsv'],
};
export default source;
