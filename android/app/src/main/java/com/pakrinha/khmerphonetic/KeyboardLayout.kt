package com.pakrinha.khmerphonetic

/**
 * Which keys exist, how wide they are, and what they say.
 *
 * The Khmer hint under each letter is read out of [PhoneticScheme] rather than
 * typed here, so it follows the romanization automatically.
 *
 * Long-press alternates matter more than usual for this scheme: `D` `N` `L` `T`
 * are different consonants from `d` `n` `l` `t`, and reaching them through Shift
 * on every word is miserable. Holding the key gets the capital directly.
 */
object KeyboardLayout {

    sealed class Key {
        abstract val weight: Float

        /** Feeds a character into the romanization buffer. */
        data class Char(
            val label: String,
            val hint: String? = null,
            override val weight: Float = 1f,
            /** Typed into the buffer on long-press. */
            val altChar: String? = null,
            /** Emitted directly on long-press, bypassing the buffer. */
            val altLiteral: String? = null,
        ) : Key()

        /** Emits its text directly, bypassing the romanization. */
        data class Literal(
            val label: String,
            val text: String,
            val hint: String? = null,
            override val weight: Float = 1f,
            val altLiteral: String? = null,
        ) : Key()

        data class Action(
            val label: String,
            val action: Act,
            override val weight: Float = 1f,
        ) : Key()

        /** Empty space, used to centre the nine-key home row. */
        data class Gap(override val weight: Float) : Key()
    }

    enum class Act { SHIFT, BACKSPACE, SPACE, ENTER, LAYER_SYMBOLS, LAYER_LETTERS, SWITCH_IME }

    private const val LETTERS_1 = "qwertyuiop"
    private const val LETTERS_2 = "asdfghjkl"
    private const val LETTERS_3 = "zxcvbnm"

    /** Letters whose capital is a distinct Khmer consonant or sign. */
    private val CAPITALS = mapOf(
        'd' to "D", 'n' to "N", 'l' to "L", 't' to "T", 'm' to "M", 'h' to "H",
    )

    /** The Khmer glyph shown on a letter key, or the one its shortest token makes. */
    fun hintFor(ch: String): String? {
        PhoneticScheme.MAP[ch]?.let { if (it.isNotEmpty()) return it }
        // "c" alone is not a token; show what "ch" produces, which is what the
        // user is reaching for when they press it.
        val candidate = PhoneticScheme.KEYS
            .filter { it.startsWith(ch) && it.length > ch.length && it[0].isLetter() }
            .minByOrNull { it.length }
        return candidate?.let { PhoneticScheme.MAP[it]?.ifEmpty { null } }
    }

    private fun letterKey(ch: kotlin.Char, upper: Boolean): Key {
        val label = if (upper) ch.uppercase() else ch.toString()
        return Key.Char(
            label = label,
            hint = hintFor(label),
            altChar = if (upper) null else CAPITALS[ch],
        )
    }

    fun letterRows(upper: Boolean): List<List<Key>> {
        val r1 = LETTERS_1.map { letterKey(it, upper) }
        val r2 = buildList {
            add(Key.Gap(0.5f))
            LETTERS_2.forEach { add(letterKey(it, upper)) }
            add(Key.Gap(0.5f))
        }
        val r3 = buildList {
            add(Key.Action("⇧", Act.SHIFT, 1.5f))
            LETTERS_3.forEach { add(letterKey(it, upper)) }
            add(Key.Action("⌫", Act.BACKSPACE, 1.5f))
        }
        return listOf(r1, r2, r3, bottomRow(Act.LAYER_SYMBOLS, "?123"))
    }

    /**
     * The bottom row carries real punctuation, which the first version did not.
     *
     * ។ is the Khmer full stop and ends most sentences, so it earns a key.
     * The scheme's "." is a syllable break that deliberately writes nothing —
     * it stops two consonants stacking, as in ka.mpujaa — which reads as a dead
     * key unless it is labelled as a break. A Latin full stop is on its
     * long-press, and on the ?123 layer.
     */
    private fun bottomRow(layerAction: Act, layerLabel: String): List<Key> = listOf(
        Key.Action(layerLabel, layerAction, 1.5f),
        Key.Action("🌐", Act.SWITCH_IME, 1f),
        Key.Literal("។", "។", null, 1f, altLiteral = "៕"),
        Key.Action("space", Act.SPACE, 4f),
        Key.Char(".", "break", 1f, altLiteral = "."),
        Key.Action("⏎", Act.ENTER, 1.5f),
    )

    fun symbolRows(): List<List<Key>> {
        // Latin digits are what prices, dates and phone numbers need; the Khmer
        // digit is the long-press.
        val digits = "1234567890".map { d ->
            val khmer = "០១២៣៤៥៦៧៨៩"[d - '0'].toString()
            Key.Literal(d.toString(), d.toString(), khmer, altLiteral = khmer) as Key
        }

        val signs = listOf("'", "*", "`", "^", "~").map { s ->
            Key.Char(s, PhoneticScheme.MAP[s]) as Key
        } + listOf("។", "៕", "ៗ").map { Key.Literal(it, it) as Key }

        val punctuation = listOf("៖", "«", "»", ".", ",", "!", "?").map {
            Key.Literal(it, it) as Key
        } + listOf(Key.Action("⌫", Act.BACKSPACE, 1.5f) as Key)

        return listOf(digits, signs, punctuation, bottomRow(Act.LAYER_LETTERS, "ABC"))
    }
}
