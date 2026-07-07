#!/usr/bin/env python3
"""Build words.txt for the Khmer phonetic keyboard.

Input : g_lex.tsv   (Google language-resources Khmer pronunciation lexicon, CC-BY-4.0)
        kmwiki.xml.bz2 (Khmer Wikipedia dump, for word frequencies)
Output: words.txt   lines of "<khmer>\t<sound skeleton>", ordered by corpus frequency
                    (unseen words after, ordered by length).

Skeleton alphabet: K C T P S H M N J G L R W Y V
 - every phoneme maps to a coarse sound class; vowel runs collapse to V
 - w/j after a vowel merge into the vowel (diphthong coda), before a vowel
   they are consonants — the same rule the JS applies to what the user types.
"""
import bz2, re, sys
from collections import Counter

CONS = {
    'k':'K','kh':'K','g':'K',
    'c':'C','ch':'C',
    't':'T','th':'T','ɗ':'T',
    'p':'P','ph':'P','ɓ':'P','f':'P',
    's':'S','z':'S',
    'h':'H','m':'M','n':'N','ɲ':'J','ŋ':'G',
    'l':'L','r':'R',
    'w':'W','j':'Y',
    'ʔ':'',           # glottal stop: users rarely type it
}
VOWELS = {'a','aa','ae','ao','aə','e','ea','ee','i','ie','ii','iə','o','oa','oo',
          'u','uu','uə','ɑ','ɑɑ','ɔ','ɔɔ','ə','əə','ɛ','ɛə','ɛɛ','ɨ','ɨə','ɨɨ'}

def skel_from_phonemes(phon):
    toks = [t for t in phon.split() if t != '.']
    out = []
    for i, t in enumerate(toks):
        prv = toks[i-1] if i > 0 else None
        nxt = toks[i+1] if i+1 < len(toks) else None
        if t in VOWELS:
            if not out or out[-1] != 'V': out.append('V')
        elif t in ('w','j'):
            if nxt in VOWELS:                      # onset -> consonant
                out.append(CONS[t])
            else:                                  # coda -> part of the vowel
                if not out or out[-1] != 'V': out.append('V')
        else:
            c = CONS.get(t)
            if c is None: return None              # unknown phoneme -> skip entry
            # coda s sounds like h in Khmer (មនុស្ស = monuh): merge S->H there
            if c == 'S' and prv in VOWELS and nxt not in VOWELS: c = 'H'
            if c and (not out or out[-1] != c): out.append(c)
    return ''.join(out)

KHMER_WORD = re.compile(r'^[ក-៝​]+$')
KH_DIGIT   = re.compile(r'[០-៩]')

def load_lexicon(path):
    entries = {}                                   # kh -> [skel, ...] (max 2)
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('#') or '\t' not in line: continue
            parts = line.rstrip('\n').split('\t')
            w, p = parts[0], parts[1]
            w = w.replace('​', '')
            if not w or not KHMER_WORD.match(w) or KH_DIGIT.search(w): continue
            if len(w) > 25: continue
            sk = skel_from_phonemes(p)
            if not sk: continue
            lst = entries.setdefault(w, [])
            if sk not in lst and len(lst) < 2: lst.append(sk)
    return entries

def wiki_pass(path, vocab, core=None):
    """Greedy longest-match segmentation of Khmer runs in the wiki dump.
    Returns unigram counts; when `core` is given, also bigram counts
    restricted to consecutive core-word pairs within the same run."""
    maxlen = max(len(w) for w in vocab)
    counts, pairs = Counter(), Counter()
    khmer_run = re.compile(r'[ក-៝]+')
    with bz2.open(path, 'rt', encoding='utf-8', errors='ignore') as f:
        chunk = []
        for line in f:
            chunk.append(line)
            if '</text>' in line or len(chunk) > 20000:
                block = ''.join(chunk); chunk = []
                for m in khmer_run.finditer(block):
                    run = m.group()
                    i, L = 0, len(run)
                    prev = None
                    while i < L:
                        for j in range(min(L, i+maxlen), i, -1):
                            w = run[i:j]
                            if w in vocab:
                                counts[w] += 1
                                if core is not None:
                                    if prev is not None and w in core and prev in core:
                                        pairs[(prev, w)] += 1
                                    prev = w
                                i = j; break
                        else:
                            i += 1; prev = None
    return counts, pairs

def cc100_pass(path, vocab, core=None, max_bytes=250_000_000):
    """Same segmentation over the CC-100 web corpus (conversational Khmer).
    Streams the .xz and stops after max_bytes of decompressed text."""
    import lzma
    maxlen = max(len(w) for w in vocab)
    counts, pairs = Counter(), Counter()
    khmer_run = re.compile(r'[ក-៝]+')
    read = 0
    with lzma.open(path, 'rt', encoding='utf-8', errors='ignore') as f:
        for line in f:
            read += len(line)
            if read > max_bytes: break
            for m in khmer_run.finditer(line):
                run = m.group()
                i, L = 0, len(run)
                prev = None
                while i < L:
                    for j in range(min(L, i+maxlen), i, -1):
                        w = run[i:j]
                        if w in vocab:
                            counts[w] += 1
                            if core is not None:
                                if prev is not None and w in core and prev in core:
                                    pairs[(prev, w)] += 1
                                prev = w
                            i = j; break
                    else:
                        i += 1; prev = None
    return counts, pairs

def main():
    lex = load_lexicon('g_lex.tsv')
    print(f'lexicon entries: {len(lex)}', file=sys.stderr)
    vocab = set(lex)
    freq, _ = wiki_pass('kmwiki.xml.bz2', vocab)
    try:
        cc, _ = cc100_pass('km_cc100.txt.xz', vocab)
        print(f'cc100 words seen: {len(cc)}', file=sys.stderr)
        for w, n in cc.items(): freq[w] += n     # conversational + encyclopedic
    except FileNotFoundError:
        print('cc100 corpus not found — wiki-only frequencies', file=sys.stderr)
    print(f'words seen in corpus: {len(freq)}', file=sys.stderr)
    seen   = sorted((w for w in lex if freq.get(w, 0) >= 2),
                    key=lambda w: -freq[w])
    unseen = sorted((w for w in lex if freq.get(w, 0) < 2),
                    key=lambda w: (len(w), w))
    with open('words.txt', 'w', encoding='utf-8') as out:
        for w in seen + unseen:
            for sk in lex[w]:
                out.write(f'{w}\t{sk}\n')
    print(f'wrote {len(seen)} ranked + {len(unseen)} unranked words', file=sys.stderr)

    # second pass: next-word bigrams among the 12k most frequent words
    core = set(seen[:12000])
    _, pairs = wiki_pass('kmwiki.xml.bz2', vocab, core=core)
    try:
        _, ccp = cc100_pass('km_cc100.txt.xz', vocab, core=core)
        for k, n in ccp.items(): pairs[k] += n
    except FileNotFoundError:
        pass
    print(f'bigram pairs counted: {len(pairs)}', file=sys.stderr)
    succ = {}
    for (a, b), n in pairs.items():
        if n >= 3: succ.setdefault(a, []).append((n, b))
    with open('bigrams.txt', 'w', encoding='utf-8') as out:
        for a, lst in succ.items():
            lst.sort(reverse=True)
            out.write(a + '\t' + ' '.join(b for _, b in lst[:6]) + '\n')
    print(f'wrote next-word lists for {len(succ)} words', file=sys.stderr)

if __name__ == '__main__':
    main()
