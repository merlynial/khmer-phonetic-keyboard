package com.pakrinha.khmerphonetic

/**
 * Romanized Latin in, Khmer Unicode out.
 *
 * This is the port of convert() from index.html: a greedy longest-match walk
 * over the romanization keys, carrying one bit of state — whether the last unit
 * emitted was a consonant — which is what decides auto-stacking. Two consonants
 * with no vowel between them join with coeng (U+17D2), so "khnhom" becomes ខ្ញុំ.
 *
 * EngineTest replays tens of thousands of strings from the web engine through
 * this, so the phone cannot quietly disagree with the browser.
 */
object PhoneticEngine {

    fun convert(text: String, autostack: Boolean = true, khmerDigits: Boolean = false): String {
        val out = StringBuilder(text.length)
        var prevCons = false
        var i = 0

        while (i < text.length) {
            if (khmerDigits) {
                val digit = PhoneticScheme.DIGITS[text[i]]
                if (digit != null) {
                    out.append(digit)
                    prevCons = false
                    i++
                    continue
                }
            }

            val match = longestKeyAt(text, i)
            if (match == null) {
                // Not part of the scheme — spaces, unmapped Latin, punctuation.
                out.append(text[i])
                prevCons = false
                i++
                continue
            }

            val glyph = PhoneticScheme.MAP[match] ?: ""
            if (match in PhoneticScheme.IS_CONS) {
                if (prevCons && autostack && glyph.isNotEmpty()) {
                    out.append(PhoneticScheme.COENG).append(glyph)
                } else {
                    out.append(glyph)
                }
                prevCons = true
            } else {
                // A vowel or sign closes the consonant; so does the "." break,
                // which maps to an empty string.
                out.append(glyph)
                prevCons = false
            }
            i += match.length
        }
        return out.toString()
    }

    private fun longestKeyAt(text: String, at: Int): String? {
        // KEYS is ordered longest-first, so the first hit is the greedy match.
        for (key in PhoneticScheme.KEYS) {
            if (text.startsWith(key, at)) return key
        }
        return null
    }
}
