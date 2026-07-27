package com.pakrinha.khmerphonetic

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Typeface
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowInsets
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The whole keyboard: a suggestion strip above the keys.
 *
 * The keys themselves live in [KeyPadView], which draws and handles touch
 * directly. This class only owns the strip and the window insets.
 */
@SuppressLint("ViewConstructor")
class KeyboardView(
    context: Context,
    private val listener: Listener,
) : LinearLayout(context) {

    interface Listener : KeyPadView.Listener {
        fun onSuggestionPicked(candidate: Suggestions.Candidate)
    }

    private val khmerFont: Typeface? = runCatching {
        Typeface.createFromAsset(context.assets, "Siemreap-Regular.ttf")
    }.getOrNull()

    private val strip = LinearLayout(context).apply {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }

    private val status = TextView(context).apply {
        setTextColor(context.getColor(R.color.kb_hint))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(16), 0, dp(16), 0)
        visibility = GONE
    }

    private val keyPad = KeyPadView(context, khmerFont, listener)

    init {
        orientation = VERTICAL
        setBackgroundColor(context.getColor(R.color.kb_background))

        val scroller = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            addView(
                LinearLayout(context).apply {
                    orientation = HORIZONTAL
                    addView(strip, LayoutParams(WRAP_CONTENT, MATCH_PARENT))
                    addView(status, LayoutParams(WRAP_CONTENT, MATCH_PARENT))
                },
                LayoutParams(WRAP_CONTENT, MATCH_PARENT),
            )
        }
        addView(scroller, LayoutParams(MATCH_PARENT, dp(SUGGESTION_STRIP_DP)))
        addView(keyPad, LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    /* ------------------------------------------------------------ suggestions */

    fun showSuggestions(candidates: List<Suggestions.Candidate>) {
        status.visibility = GONE
        strip.removeAllViews()
        for (candidate in candidates) {
            strip.addView(chip(candidate), LayoutParams(WRAP_CONTENT, MATCH_PARENT))
        }
    }

    /**
     * Shown while the 62,000-word lexicon is still parsing. An empty strip is
     * indistinguishable from a broken one, so say what is happening.
     */
    fun showLoading() {
        strip.removeAllViews()
        status.text = context.getString(R.string.loading_words)
        status.visibility = VISIBLE
    }

    fun clearSuggestions() {
        strip.removeAllViews()
        status.visibility = GONE
    }

    private fun chip(candidate: Suggestions.Candidate) = TextView(context).apply {
        text = candidate.khmer
        typeface = khmerFont
        setTextColor(context.getColor(R.color.kb_suggestion_text))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        gravity = Gravity.CENTER
        // Generous horizontal padding: these are the primary touch target for
        // picking a word, and they were too tight to hit reliably.
        setPadding(dp(20), 0, dp(20), 0)
        isClickable = true
        setOnClickListener {
            performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
            listener.onSuggestionPicked(candidate)
        }
    }

    /* ----------------------------------------------------------------- layout */

    /**
     * Keep the bottom row clear of the navigation bar. With gesture navigation
     * the system's touch strip overlays the screen bottom and wins; without this
     * the entire last row is swallowed by it.
     */
    override fun onApplyWindowInsets(insets: WindowInsets): WindowInsets {
        val bottom = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            insets.getInsets(WindowInsets.Type.navigationBars()).bottom
        } else {
            @Suppress("DEPRECATION")
            insets.systemWindowInsetBottom
        }
        setPadding(0, 0, 0, bottom)
        return super.onApplyWindowInsets(insets)
    }

    fun resetLayers() = keyPad.resetLayers()

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val SUGGESTION_STRIP_DP = 52
    }
}
