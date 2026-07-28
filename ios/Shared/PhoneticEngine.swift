//
//  Romanized Latin in, Khmer Unicode out.
//
//  The port of convert() from index.html: a greedy longest-match walk over the
//  romanization keys carrying one bit of state — whether the last unit emitted
//  was a consonant — which is what decides auto-stacking. Two consonants with no
//  vowel between them join with coeng (U+17D2), so "khnhom" becomes ខ្ញុំ.
//
//  EngineTests replays tens of thousands of strings the web engine converted, so
//  the phone cannot quietly disagree with the browser.
//

import Foundation

enum PhoneticEngine {

    /// Keys pre-split into arrays once: `hasPrefix` on every key for every
    /// character is the hot path, and a keyboard extension has little headroom.
    private static let keysByLength: [[Character]] = PhoneticScheme.keys.map(Array.init)

    static func convert(
        _ text: String,
        autostack: Bool = true,
        khmerDigits: Bool = false
    ) -> String {
        let chars = Array(text)
        var out = ""
        out.reserveCapacity(text.count * 2)
        var prevCons = false
        var i = 0

        while i < chars.count {
            if khmerDigits, let digit = PhoneticScheme.khmerDigits[chars[i]] {
                out.append(digit)
                prevCons = false
                i += 1
                continue
            }

            guard let matchIndex = longestKeyIndex(in: chars, at: i) else {
                // Not part of the scheme — spaces, unmapped Latin, punctuation.
                out.append(chars[i])
                prevCons = false
                i += 1
                continue
            }

            let key = PhoneticScheme.keys[matchIndex]
            let glyph = PhoneticScheme.map[key] ?? ""

            if PhoneticScheme.isCons.contains(key) {
                if prevCons && autostack && !glyph.isEmpty {
                    out += PhoneticScheme.coeng
                    out += glyph
                } else {
                    out += glyph
                }
                prevCons = true
            } else {
                // A vowel or sign closes the consonant; so does the "." break,
                // which maps to an empty string.
                out += glyph
                prevCons = false
            }
            i += keysByLength[matchIndex].count
        }
        return out
    }

    /// Index of the longest key matching at `at`. `keys` is ordered longest
    /// first, so the first hit is the greedy match.
    private static func longestKeyIndex(in chars: [Character], at: Int) -> Int? {
        for (index, key) in keysByLength.enumerated() {
            let end = at + key.count
            if end > chars.count { continue }
            var matched = true
            for offset in 0..<key.count where chars[at + offset] != key[offset] {
                matched = false
                break
            }
            if matched { return index }
        }
        return nil
    }
}
