package com.pakrinha.khmerphonetic

/**
 * The key layout, mirroring the on-screen keyboard in the web app: a phone
 * QWERTY where each letter carries a small Khmer hint, plus a ?123 layer for
 * digits, the scheme's sign keys and Khmer punctuation.
 *
 * The hints are read out of PhoneticScheme rather than typed here, so they
 * follow the romanization automatically.
 */
object KeyboardLayout {

    sealed class Key {
        /** A key that feeds a character into the romanization buffer. */
        data class Char(val label: String, val hint: String? = null, val weight: Float = 1f) : Key()

        /** A key that emits its text directly, bypassing the romanization. */
        data class Literal(
            val label: String,
            val text: String,
            val hint: String? = null,
            val weight: Float = 1f,
        ) : Key()

        data class Action(val label: String, val action: Act, val weight: Float = 1f) : Key()

        /** Empty space, used to centre the nine-key home row. */
        data class Gap(val weight: Float) : Key()
    }

    enum class Act { SHIFT, BACKSPACE, SPACE, ENTER, LAYER_SYMBOLS, LAYER_LETTERS, SWITCH_IME }

    private const val LETTERS_1 = "qwertyuiop"
    private const val LETTERS_2 = "asdfghjkl"
    private const val LETTERS_3 = "zxcvbnm"

    /** The Khmer glyph shown under a letter, or under its shortest token. */
    fun hintFor(ch: String): String? {
        PhoneticScheme.MAP[ch]?.let { if (it.isNotEmpty()) return it }
        // "c" alone is not a token; show what "ch" produces, which is what the
        // user is reaching for when they press it.
        val candidate = PhoneticScheme.KEYS
            .filter { it.startsWith(ch) && it.length > ch.length && it[0].isLetter() }
            .minByOrNull { it.length }
        return candidate?.let { PhoneticScheme.MAP[it]?.ifEmpty { null } }
    }

    private fun row(letters: String, upper: Boolean): MutableList<Key> =
        letters.map { c ->
            val label = if (upper) c.uppercase() else c.toString()
            Key.Char(label, hintFor(label)) as Key
        }.toMutableList()

    fun letterRows(upper: Boolean): List<List<Key>> {
        val r1 = row(LETTERS_1, upper)
        val r2 = mutableListOf<Key>(Key.Gap(0.5f))
        r2.addAll(row(LETTERS_2, upper))
        r2.add(Key.Gap(0.5f))
        val r3 = mutableListOf<Key>(Key.Action("⇧", Act.SHIFT, 1.5f))
        r3.addAll(row(LETTERS_3, upper))
        r3.add(Key.Action("⌫", Act.BACKSPACE, 1.5f))
        return listOf(r1, r2, r3, bottomRow(Act.LAYER_SYMBOLS, "?123"))
    }

    private fun bottomRow(layerAction: Act, layerLabel: String): List<Key> = listOf(
        Key.Action(layerLabel, layerAction, 1.5f),
        Key.Action("🌐", Act.SWITCH_IME, 1f),
        Key.Char("'", PhoneticScheme.MAP["'"], 1f),
        Key.Action("space", Act.SPACE, 4f),
        Key.Char(".", null, 1f),
        Key.Action("⏎", Act.ENTER, 1.5f),
    )

    fun symbolRows(): List<List<Key>> {
        // Latin digits are what people actually need for prices, dates and phone
        // numbers; the Khmer digit rides along as a hint.
        val digits = "1234567890".mapIndexed { i, d ->
            Key.Literal(d.toString(), d.toString(), "០១២៣៤៥៦៧៨៩"[i].toString()) as Key
        }
        val signs = listOf("'", "*", "`", "^", "~").map { s ->
            Key.Char(s, PhoneticScheme.MAP[s]) as Key
        } + listOf("។", "៕", "ៗ").map { Key.Literal(it, it) as Key }

        val punctuation = listOf("៖", "«", "»").map { Key.Literal(it, it) as Key } +
            listOf("!", "?", ",", "-").map { Key.Literal(it, it) as Key } +
            listOf(Key.Action("⌫", Act.BACKSPACE, 1.5f) as Key)

        return listOf(digits, signs, punctuation, bottomRow(Act.LAYER_LETTERS, "ABC"))
    }
}
