package com.pakrinha.khmerphonetic

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.BeforeClass
import org.junit.Test
import java.io.File

/**
 * The suggestions are the reason to use this keyboard rather than a positional
 * one: you spell a word roughly as it sounds and the right Khmer comes back.
 *
 * These run against the real assets that ship in the APK, so a broken or
 * truncated lexicon fails here rather than on the phone.
 */
class SuggestionsTest {

    companion object {
        private lateinit var suggestions: Suggestions

        @BeforeClass
        @JvmStatic
        fun load() {
            val assets = File("src/main/assets")
            assertTrue(
                "assets missing — run: npm run build:android",
                File(assets, "curated.tsv").exists() && File(assets, "words.txt").exists(),
            )
            suggestions = File(assets, "curated.tsv").bufferedReader().use { curated ->
                File(assets, "words.txt").bufferedReader().use { lexicon ->
                    Suggestions(curated.lineSequence(), lexicon.lineSequence())
                }
            }
        }
    }

    private fun top(query: String, n: Int = 8) =
        suggestions.suggest(query).take(n).map { it.khmer }

    @Test
    fun `the big lexicon actually loaded`() {
        assertTrue("lexicon looks truncated: ${suggestions.lexiconSize}", suggestions.lexiconSize > 50_000)
    }

    @Test
    fun `loose spellings still find the word`() {
        // The complaint that drove the fuzzy tier in the web app: people do not
        // spell the canonical way, and the keyboard has to cope.
        for (spelling in listOf("suastei", "suosdei", "sousdey", "sousdei")) {
            assertTrue(
                "\"$spelling\" did not offer សួស្តី, got ${top(spelling)}",
                "សួស្តី" in top(spelling),
            )
        }
    }

    @Test
    fun `common words are offered`() {
        assertTrue("arkun -> ${top("arkun")}", "អរគុណ" in top("arkun"))
        assertTrue("khnhom -> ${top("khnhom")}", "ខ្ញុំ" in top("khnhom"))
        assertTrue("kampuchea -> ${top("kampuchea")}", "កម្ពុជា" in top("kampuchea"))
        assertTrue("srolanh -> ${top("srolanh")}", "ស្រឡាញ់" in top("srolanh"))
    }

    @Test
    fun `an exact curated key ranks first`() {
        assertEquals("ខ្ញុំ", top("khnhom").first())
    }

    @Test
    fun `picking a word teaches the keyboard that spelling`() {
        val learning = object : Suggestions.Learning {
            private val personal = mutableMapOf("bongp" to "បង")
            override fun uses(khmer: String) = if (khmer == "បង") 9 else 0
            override fun personal(): Map<String, String> = personal
        }
        val withMemory = File("src/main/assets/curated.tsv").bufferedReader().use { curated ->
            File("src/main/assets/words.txt").bufferedReader().use { lexicon ->
                Suggestions(curated.lineSequence(), lexicon.lineSequence(), learning)
            }
        }
        assertEquals("បង", withMemory.suggest("bongp").first().khmer)
    }

    @Test
    fun `an empty or junk query is harmless`() {
        assertTrue(suggestions.suggest("").isEmpty())
        assertTrue(suggestions.suggest("   ").isEmpty())
        // A long paste must not hang the keyboard.
        val huge = "kh".repeat(5000)
        val started = System.currentTimeMillis()
        suggestions.suggest(huge)
        val took = System.currentTimeMillis() - started
        assertTrue("a 10k-character query took ${took}ms", took < 2000)
    }

    @Test
    fun `suggesting is fast enough to run on every keystroke`() {
        val queries = listOf("kh", "khn", "khnh", "khnho", "khnhom", "arkun", "sousdey")
        repeat(3) { for (q in queries) suggestions.suggest(q) }  // warm up
        val started = System.nanoTime()
        val rounds = 20
        repeat(rounds) { for (q in queries) suggestions.suggest(q) }
        val perCall = (System.nanoTime() - started) / 1_000_000.0 / (rounds * queries.size)
        println("suggest(): %.2f ms per call".format(perCall))
        assertTrue("suggest() averaged %.1f ms, too slow for typing".format(perCall), perCall < 40)
    }
}
