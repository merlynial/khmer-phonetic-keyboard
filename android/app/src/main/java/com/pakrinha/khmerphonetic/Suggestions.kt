package com.pakrinha.khmerphonetic

/**
 * The word suggestions that make this keyboard worth using: you type roughly how
 * a word sounds and it finds the Khmer, the way a Pinyin IME does.
 *
 * Two lexicons, searched in tiers, ported from dict.js:
 *
 *   curated.tsv  ~440 common words, each listed under every romanization the web
 *                app's reverse-transliterator derives for it. Those keys are
 *                precomputed by tools/build_android.mjs rather than regenerated
 *                here, so they cannot come out different from the browser's.
 *   words.txt    62,000 words from the Google Khmer pronunciation lexicon,
 *                stored as coarse sound-class skeletons and ordered by corpus
 *                frequency, so line number is rank.
 *
 * Tiers, lowest wins: personal(-1), curated exact(0), curated prefix(1),
 * curated vowel-skeleton(2, 3), lexicon skeleton exact(4), prefix(5).
 */
class Suggestions(
    curatedLines: Sequence<String>,
    lexiconLines: Sequence<String>,
    private val learned: Learning = Learning.NONE,
) {

    data class Candidate(val khmer: String, val gloss: String = "")

    private class Curated(val key: String, val vskel: String, val khmer: String, val gloss: String)

    private val curated = ArrayList<Curated>(16000)
    private val lexKhmer = ArrayList<String>(62000)
    private val lexSkel = ArrayList<String>(62000)

    /* Sorted views used to binary-search a prefix range instead of scanning.
     *
     * The first version walked all ~77,000 entries on every keystroke. On a
     * desktop JVM that is 0.6 ms and looks fine; on a phone it is tens of
     * milliseconds of main-thread work per letter, which both delays the word
     * bar and makes the keyboard miss taps. Each array below holds row indices
     * ordered by the string being searched, so a lookup touches only the
     * matching range. */
    private lateinit var curatedByKey: IntArray
    private lateinit var curatedByVskel: IntArray
    private lateinit var lexBySkel: IntArray

    init {
        for (line in curatedLines) {
            if (line.isBlank() || line.startsWith("#")) continue
            val p = line.split('\t')
            if (p.size >= 3) curated.add(Curated(p[0], p[1], p[2], if (p.size > 3) p[3] else ""))
        }
        for (line in lexiconLines) {
            if (line.isBlank() || line.startsWith("#")) continue
            val tab = line.indexOf('\t')
            if (tab > 0) {
                lexKhmer.add(line.substring(0, tab))
                lexSkel.add(line.substring(tab + 1).trim())
            }
        }
        curatedByKey = sortedIndices(curated.size) { curated[it].key }
        curatedByVskel = sortedIndices(curated.size) { curated[it].vskel }
        lexBySkel = sortedIndices(lexSkel.size) { lexSkel[it] }
    }

    val lexiconSize: Int get() = lexKhmer.size

    private inline fun sortedIndices(size: Int, crossinline key: (Int) -> String): IntArray =
        (0 until size).sortedBy(key).toIntArray()

    /** First position in [order] whose string is >= [target]. */
    private inline fun lowerBound(order: IntArray, target: String, crossinline key: (Int) -> String): Int {
        var lo = 0
        var hi = order.size
        while (lo < hi) {
            val mid = (lo + hi) ushr 1
            if (key(order[mid]) < target) lo = mid + 1 else hi = mid
        }
        return lo
    }

    /**
     * Visit every row whose string starts with [prefix], in sorted order.
     * [visit] returns false to stop early.
     */
    private inline fun forEachWithPrefix(
        order: IntArray,
        prefix: String,
        crossinline key: (Int) -> String,
        visit: (row: Int, value: String) -> Boolean,
    ) {
        var i = lowerBound(order, prefix, key)
        while (i < order.size) {
            val row = order[i]
            val value = key(row)
            if (!value.startsWith(prefix)) return
            if (!visit(row, value)) return
            i++
        }
    }

    /** What the user has picked before, so their words float up. */
    interface Learning {
        fun uses(khmer: String): Int
        fun personal(): Map<String, String>

        companion object {
            val NONE = object : Learning {
                override fun uses(khmer: String) = 0
                override fun personal(): Map<String, String> = emptyMap()
            }
        }
    }

    private class Hit(var tier: Int, var sub: Long, var gloss: String)

    fun suggest(rawQuery: String, limit: Int = 8): List<Candidate> {
        var q = rawQuery.lowercase().trim()
        if (q.isEmpty()) return emptyList()
        // Bound the work: a long paste should never make the keyboard hang.
        if (q.length > MAX_TOKEN) q = q.substring(q.length - MAX_TOKEN)

        val hits = LinkedHashMap<String, Hit>()
        fun add(khmer: String, tier: Int, sub: Long, gloss: String = "") {
            val existing = hits[khmer]
            if (existing == null) {
                hits[khmer] = Hit(tier, sub, gloss)
                return
            }
            if (tier < existing.tier || (tier == existing.tier && sub < existing.sub)) {
                existing.tier = tier
                existing.sub = sub
            }
            if (existing.gloss.isEmpty() && gloss.isNotEmpty()) existing.gloss = gloss
        }

        for ((spelling, khmer) in learned.personal()) {
            if (spelling == q) add(khmer, -1, 0, GLOSS_YOURS)
            else if (spelling.startsWith(q)) add(khmer, -1, (spelling.length - q.length).toLong(), GLOSS_YOURS)
        }

        val qv = vskel(q)
        val fuzzyOk = q.length >= 3

        // Spelled exactly, or the query is the start of a longer spelling.
        forEachWithPrefix(curatedByKey, q, { curated[it].key }) { row, key ->
            val c = curated[row]
            if (key == q) add(c.khmer, 0, 0, c.gloss)
            else add(c.khmer, 1, (key.length - q.length).toLong(), c.gloss)
            true
        }

        // Same consonants, vowels written differently.
        if (fuzzyOk) {
            forEachWithPrefix(curatedByVskel, qv, { curated[it].vskel }) { row, skel ->
                val c = curated[row]
                if (skel == qv) add(c.khmer, 2, 0, c.gloss)
                else add(c.khmer, 3, (skel.length - qv.length).toLong(), c.gloss)
                true
            }
        }

        // The 62k lexicon, matched on how the word sounds rather than how it is
        // spelled. `sub` keeps corpus rank as the tie-break, so common words win.
        if (fuzzyOk && lexKhmer.isNotEmpty()) {
            val qk = qskel(q)
            if (qk.length >= 2) {
                var visited = 0
                forEachWithPrefix(lexBySkel, qk, { lexSkel[it] }) { row, skel ->
                    if (skel == qk) add(lexKhmer[row], 4, row.toLong())
                    else add(lexKhmer[row], 5, (skel.length - qk.length) * 100_000L + row)
                    ++visited < MAX_LEXICON_VISITS
                }
            }
        }

        return hits.entries
            .map { (khmer, hit) ->
                val uses = learned.uses(khmer)
                val boost = if (uses >= 4) 2 else if (uses >= 1) 1 else 0
                Triple(khmer, hit, (hit.tier - boost).toLong() * 1_000_000_000_000L + hit.sub - uses)
            }
            .sortedBy { it.third }
            .take(limit)
            .map { Candidate(it.first, it.second.gloss) }
    }

    companion object {
        private const val MAX_TOKEN = 32
        // A guard against a one-letter skeleton matching half the lexicon. The
        // ranking still runs over everything visited, so raising this costs
        // time but never quality.
        private const val MAX_LEXICON_VISITS = 4000
        private const val GLOSS_YOURS = "yours"

        /** Collapse vowel runs, so "sousdey" and "suosdei" key alike. */
        fun vskel(s: String): String = s.replace(VOWEL_RUN, "8")

        private val VOWEL_RUN = Regex("[aeiouy]+")

        private val DIGRAPH = mapOf(
            "chh" to "C", "ch" to "C", "kh" to "K", "gh" to "K", "th" to "T",
            "dh" to "T", "dd" to "T", "ph" to "P", "bh" to "P", "ng" to "G",
            "nh" to "J", "ny" to "J", "gn" to "J",
        )
        private val SINGLE = mapOf(
            'k' to "K", 'g' to "K", 'c' to "C", 'j' to "C", 't' to "T", 'd' to "T",
            'b' to "P", 'p' to "P", 'f' to "P", 's' to "S", 'h' to "H", 'm' to "M",
            'n' to "N", 'l' to "L", 'x' to "S", 'z' to "S",
        )

        private fun isVowel(c: Char?) = c != null && c in "aeiou"

        /**
         * The same coarse sound-class skeleton the lexicon was built with:
         * consonant classes plus V for any vowel run, repeats collapsed. This is
         * what lets a sloppy spelling still land on the right word.
         */
        fun qskel(query: String): String {
            val q = query.lowercase().filter { it in 'a'..'z' }
            val out = StringBuilder()
            fun push(c: String) {
                if (c.isNotEmpty() && (out.isEmpty() || !out.endsWith(c))) out.append(c)
            }

            var i = 0
            while (i < q.length) {
                val tri = if (i + 3 <= q.length) q.substring(i, i + 3) else ""
                val di = if (i + 2 <= q.length) q.substring(i, i + 2) else ""
                val ch = q[i]
                val next = q.getOrNull(i + 1)
                val prev = q.getOrNull(i - 1)

                val triClass = DIGRAPH[tri]
                if (triClass != null) { push(triClass); i += 3; continue }
                val diClass = DIGRAPH[di]
                if (diClass != null) { push(diClass); i += 2; continue }

                if (isVowel(ch)) { push("V"); i++; continue }

                if (ch == 'w' || ch == 'v' || ch == 'y') {
                    // An onset is a consonant; a coda merges into the vowel.
                    if (isVowel(next)) push(if (ch == 'y') "Y" else "W") else push("V")
                    i++
                    continue
                }
                if (ch == 'r') {
                    // Khmer r is only pronounced before a vowel.
                    if (isVowel(next)) push("R")
                    i++
                    continue
                }
                if (ch == 's' && isVowel(prev) && !isVowel(next)) {
                    push("H")  // coda s sounds like h: monus = monuh
                    i++
                    continue
                }
                if (ch == 'q') { i++; continue }  // glottal stop, usually not typed

                push(SINGLE[ch] ?: "")
                i++
            }
            return out.toString()
        }
    }
}
