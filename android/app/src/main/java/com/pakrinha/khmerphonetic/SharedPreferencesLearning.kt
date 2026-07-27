package com.pakrinha.khmerphonetic

import android.content.SharedPreferences

/**
 * Remembers the words you pick, so they rise to the top next time, and the
 * spellings you invent, so your own romanizations start working.
 *
 * Everything stays on the device — same promise the web app makes.
 */
class SharedPreferencesLearning(
    private val prefs: SharedPreferences,
) : Suggestions.Learning {

    private val uses = HashMap<String, Int>()
    private val personal = HashMap<String, String>()

    init {
        prefs.getString(KEY_USES, "")?.split(RECORD)?.forEach { entry ->
            val parts = entry.split(FIELD)
            if (parts.size == 2) parts[1].toIntOrNull()?.let { uses[parts[0]] = it }
        }
        prefs.getString(KEY_PERSONAL, "")?.split(RECORD)?.forEach { entry ->
            val parts = entry.split(FIELD)
            if (parts.size == 2 && parts[0].isNotEmpty()) personal[parts[0]] = parts[1]
        }
    }

    override fun uses(khmer: String): Int = uses[khmer] ?: 0

    override fun personal(): Map<String, String> = personal

    /** Called when a suggestion is accepted for a given romanization. */
    fun record(khmer: String, spelling: String) {
        uses[khmer] = (uses[khmer] ?: 0) + 1
        val cleaned = spelling.lowercase().trim()
        if (cleaned.isNotEmpty() && cleaned.length <= MAX_SPELLING && personal.size < MAX_ENTRIES) {
            personal[cleaned] = khmer
        }
        persist()
    }

    fun reset() {
        uses.clear()
        personal.clear()
        prefs.edit().remove(KEY_USES).remove(KEY_PERSONAL).apply()
    }

    private fun persist() {
        prefs.edit()
            .putString(KEY_USES, uses.entries.joinToString(RECORD) { "${it.key}$FIELD${it.value}" })
            .putString(KEY_PERSONAL, personal.entries.joinToString(RECORD) { "${it.key}$FIELD${it.value}" })
            .apply()
    }

    private companion object {
        // ASCII record/unit separators: neither occurs in Khmer text or in a
        // romanization, so they are safe delimiters for a flat prefs string.
        const val RECORD = "\u001E"
        const val FIELD = "\u001F"
        const val KEY_USES = "uses"
        const val KEY_PERSONAL = "personal"
        const val MAX_SPELLING = 60
        const val MAX_ENTRIES = 20_000
    }
}
