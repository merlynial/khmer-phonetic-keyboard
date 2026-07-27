package com.pakrinha.khmerphonetic

import android.content.Context
import android.inputmethodservice.InputMethodService
import android.os.Build
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager

/**
 * The input method itself — this is what makes Khmer Phonetic appear in
 * Android's keyboard list and type into other apps.
 *
 * How typing works: Latin letters accumulate in a romanization buffer, and after
 * every keystroke the whole buffer is converted and shown as *composing* text.
 * Composing text is the underlined, still-editable region Android gives IMEs, so
 * the Khmer updates in place as the word takes shape — type k-h-n-h-o-m and the
 * field shows ក, ខ, ខ្ន, ខ្ញ, ខ្ញុ, ខ្ញុំ in turn.
 *
 * Committing:
 *   tapping a suggestion  commits the Khmer with no space, because Khmer runs
 *                         words together
 *   space                 commits what is on screen and adds a space
 *   punctuation, enter    commit first, then send the character
 */
class KhmerPhoneticService : InputMethodService(), KeyboardView.Listener {

    private var keyboard: KeyboardView? = null

    /** Null until the lexicons finish loading; written off the main thread. */
    @Volatile
    private var suggestions: Suggestions? = null
    private lateinit var learning: SharedPreferencesLearning

    /** The romanization typed so far and not yet committed. */
    private val buffer = StringBuilder()

    override fun onCreate() {
        super.onCreate()
        learning = SharedPreferencesLearning(getSharedPreferences(PREFS, Context.MODE_PRIVATE))
        // ~77,000 lines of lexicon. Parsing that on the main thread would stall
        // the keyboard the first time it opens, so load it in the background;
        // typing and conversion work immediately, suggestions appear a moment
        // later.
        Thread {
            // An uncaught exception on a background thread takes the whole
            // process down with it. A missing or corrupt lexicon should cost the
            // suggestion bar, not the ability to type.
            runCatching {
                // Both sequences are consumed inside the constructor, so they can
                // be read and closed within these use blocks.
                assets.open("curated.tsv").bufferedReader().use { curated ->
                    assets.open("words.txt").bufferedReader().use { lexicon ->
                        Suggestions(curated.lineSequence(), lexicon.lineSequence(), learning)
                    }
                }
            }.onSuccess { suggestions = it }
                .onFailure { Log.e(TAG, "could not load the lexicons; typing still works", it) }
        }.apply { name = "khmer-lexicon-load"; priority = Thread.MIN_PRIORITY }.start()
    }

    override fun onCreateInputView(): View {
        val view = KeyboardView(this, this)
        keyboard = view
        return view
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        buffer.setLength(0)
        keyboard?.resetLayers()
        keyboard?.clearSuggestions()
    }

    override fun onFinishInput() {
        super.onFinishInput()
        commitComposing()
    }

    /* ---------------------------------------------------------- key handling */

    override fun onCharacter(text: String) {
        buffer.append(text)
        refresh()
    }

    override fun onLiteral(text: String) {
        commitComposing()
        currentInputConnection?.commitText(text, 1)
        refresh()
    }

    override fun onAction(action: KeyboardLayout.Act) {
        when (action) {
            KeyboardLayout.Act.BACKSPACE -> backspace()

            KeyboardLayout.Act.SPACE -> {
                commitComposing()
                currentInputConnection?.commitText(" ", 1)
                refresh()
            }

            KeyboardLayout.Act.ENTER -> {
                commitComposing()
                val info = currentInputEditorInfo
                val editorAction = info?.imeOptions?.and(EditorInfo.IME_MASK_ACTION)
                if (editorAction != null && editorAction != EditorInfo.IME_ACTION_NONE &&
                    info.imeOptions.and(EditorInfo.IME_FLAG_NO_ENTER_ACTION) == 0
                ) {
                    currentInputConnection?.performEditorAction(editorAction)
                } else {
                    sendKey(KeyEvent.KEYCODE_ENTER)
                }
                refresh()
            }

            KeyboardLayout.Act.SWITCH_IME -> switchAwayFromThisKeyboard()

            else -> Unit
        }
    }

    override fun onSuggestionPicked(candidate: Suggestions.Candidate) {
        // No trailing space: Khmer joins words.
        currentInputConnection?.commitText(candidate.khmer, 1)
        learning.record(candidate.khmer, buffer.toString())
        buffer.setLength(0)
        refresh()
    }

    /* -------------------------------------------------------------- internals */

    private fun backspace() {
        if (buffer.isNotEmpty()) {
            buffer.setLength(buffer.length - 1)
            refresh()
            return
        }
        // Nothing pending: delete from the field itself.
        val selected = currentInputConnection?.getSelectedText(0)
        if (selected.isNullOrEmpty()) {
            currentInputConnection?.deleteSurroundingText(1, 0)
        } else {
            currentInputConnection?.commitText("", 1)
        }
    }

    /** Push the current buffer's conversion into the field as composing text. */
    private fun refresh() {
        val connection = currentInputConnection ?: return
        if (buffer.isEmpty()) {
            connection.finishComposingText()
            keyboard?.clearSuggestions()
            return
        }
        connection.setComposingText(PhoneticEngine.convert(buffer.toString()), 1)
        keyboard?.showSuggestions(suggestions?.suggest(buffer.toString()).orEmpty())
    }

    /** Freeze whatever is composing and forget the buffer. */
    private fun commitComposing() {
        if (buffer.isEmpty()) return
        currentInputConnection?.finishComposingText()
        buffer.setLength(0)
        keyboard?.clearSuggestions()
    }

    private fun sendKey(keyCode: Int) {
        val connection = currentInputConnection ?: return
        val now = System.currentTimeMillis()
        connection.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0))
        connection.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0))
    }

    private fun switchAwayFromThisKeyboard() {
        // switchToNextInputMethod on the service only exists from API 28; below
        // that, and whenever there is no next keyboard, fall back to the picker.
        val switched = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            runCatching { switchToNextInputMethod(false) }.getOrDefault(false)
        if (!switched) {
            val manager = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            @Suppress("DEPRECATION")
            manager.showInputMethodPicker()
        }
    }

    private companion object {
        const val PREFS = "khmer_phonetic_learning"
        const val TAG = "KhmerPhonetic"
    }
}
