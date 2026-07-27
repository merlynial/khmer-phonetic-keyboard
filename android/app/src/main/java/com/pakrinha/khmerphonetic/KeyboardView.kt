package com.pakrinha.khmerphonetic

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The keyboard the user actually touches: a suggestion strip above a phone
 * QWERTY, built in code from [KeyboardLayout] so the Khmer hints stay tied to
 * the romanization.
 *
 * Keys fire on press rather than release, the way system keyboards do, and
 * backspace repeats when held.
 */
@SuppressLint("ViewConstructor")
class KeyboardView(
    context: Context,
    private val listener: Listener,
) : LinearLayout(context) {

    interface Listener {
        fun onCharacter(text: String)
        fun onLiteral(text: String)
        fun onAction(action: KeyboardLayout.Act)
        fun onSuggestionPicked(candidate: Suggestions.Candidate)
    }

    private val khmerFont: Typeface? = runCatching {
        Typeface.createFromAsset(context.assets, "Siemreap-Regular.ttf")
    }.getOrNull()

    private val suggestionStrip = LinearLayout(context).apply {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }
    private val keyArea = LinearLayout(context).apply { orientation = VERTICAL }

    private var shifted = false
    private var symbols = false
    private val repeatHandler = Handler(Looper.getMainLooper())

    init {
        orientation = VERTICAL
        setBackgroundColor(context.getColor(R.color.kb_background))

        val scroller = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            addView(
                suggestionStrip,
                LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.MATCH_PARENT),
            )
        }
        addView(scroller, LayoutParams(LayoutParams.MATCH_PARENT, dp(46)))
        addView(keyArea, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

        drawKeys()
    }

    /* ------------------------------------------------------------ suggestions */

    fun showSuggestions(candidates: List<Suggestions.Candidate>) {
        suggestionStrip.removeAllViews()
        for (candidate in candidates) {
            val chip = TextView(context).apply {
                text = candidate.khmer
                typeface = khmerFont
                setTextColor(context.getColor(R.color.kb_suggestion_text))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                gravity = Gravity.CENTER
                setPadding(dp(16), 0, dp(16), 0)
                isClickable = true
                setOnClickListener { listener.onSuggestionPicked(candidate) }
            }
            suggestionStrip.addView(
                chip,
                LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.MATCH_PARENT),
            )
        }
    }

    fun clearSuggestions() = suggestionStrip.removeAllViews()

    /* ------------------------------------------------------------------- keys */

    private fun drawKeys() {
        keyArea.removeAllViews()
        val rows = if (symbols) KeyboardLayout.symbolRows() else KeyboardLayout.letterRows(shifted)
        for (row in rows) {
            val rowView = LinearLayout(context).apply { orientation = HORIZONTAL }
            for (key in row) rowView.addView(buildKey(key))
            keyArea.addView(
                rowView,
                LayoutParams(LayoutParams.MATCH_PARENT, dp(52)).apply {
                    topMargin = dp(3)
                    bottomMargin = dp(3)
                },
            )
        }
    }

    private fun buildKey(key: KeyboardLayout.Key): View {
        val weight = when (key) {
            is KeyboardLayout.Key.Char -> key.weight
            is KeyboardLayout.Key.Literal -> key.weight
            is KeyboardLayout.Key.Action -> key.weight
            is KeyboardLayout.Key.Gap -> key.weight
        }
        val params = LayoutParams(0, LayoutParams.MATCH_PARENT, weight).apply {
            leftMargin = dp(3)
            rightMargin = dp(3)
        }

        if (key is KeyboardLayout.Key.Gap) {
            return View(context).apply { layoutParams = params }
        }

        val isFunction = key is KeyboardLayout.Key.Action &&
            key.action != KeyboardLayout.Act.SPACE
        val label: String
        val hint: String?
        when (key) {
            is KeyboardLayout.Key.Char -> { label = key.label; hint = key.hint }
            is KeyboardLayout.Key.Literal -> { label = key.label; hint = key.hint }
            is KeyboardLayout.Key.Action -> { label = key.label; hint = null }
            else -> { label = ""; hint = null }
        }

        val shiftActive = key is KeyboardLayout.Key.Action &&
            key.action == KeyboardLayout.Act.SHIFT && shifted

        val view = TextView(context).apply {
            layoutParams = params
            gravity = Gravity.CENTER
            typeface = khmerFont
            setTextColor(context.getColor(R.color.kb_text))
            background = keyBackground(
                if (shiftActive) R.color.kb_accent
                else if (isFunction) R.color.kb_key_function
                else R.color.kb_key
            )
            text = if (hint != null) {
                buildString { append(label); append('\n'); append(hint) }
            } else {
                label
            }
            if (hint != null) {
                setLineSpacing(0f, 0.85f)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            } else {
                setTextSize(TypedValue.COMPLEX_UNIT_SP, if (isFunction) 15f else 18f)
            }
        }

        // Fire on touch-down; repeat backspace while held.
        view.setOnTouchListener { v, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    v.background = keyBackground(R.color.kb_key_pressed)
                    fire(key)
                    if (key is KeyboardLayout.Key.Action &&
                        key.action == KeyboardLayout.Act.BACKSPACE
                    ) {
                        startRepeat(key)
                    }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    repeatHandler.removeCallbacksAndMessages(null)
                    v.background = keyBackground(
                        if (isFunction) R.color.kb_key_function else R.color.kb_key
                    )
                    v.performClick()
                    true
                }

                else -> false
            }
        }
        return view
    }

    private fun startRepeat(key: KeyboardLayout.Key) {
        val repeat = object : Runnable {
            override fun run() {
                fire(key)
                repeatHandler.postDelayed(this, REPEAT_INTERVAL_MS)
            }
        }
        repeatHandler.postDelayed(repeat, REPEAT_DELAY_MS)
    }

    private fun fire(key: KeyboardLayout.Key) {
        when (key) {
            is KeyboardLayout.Key.Char -> {
                listener.onCharacter(key.label)
                if (shifted) {
                    // One-shot shift, like the web app.
                    shifted = false
                    drawKeys()
                }
            }

            is KeyboardLayout.Key.Literal -> listener.onLiteral(key.text)

            is KeyboardLayout.Key.Action -> when (key.action) {
                KeyboardLayout.Act.SHIFT -> { shifted = !shifted; drawKeys() }
                KeyboardLayout.Act.LAYER_SYMBOLS -> { symbols = true; drawKeys() }
                KeyboardLayout.Act.LAYER_LETTERS -> { symbols = false; drawKeys() }
                else -> listener.onAction(key.action)
            }

            is KeyboardLayout.Key.Gap -> Unit
        }
    }

    /** Reset to the plain letter layer, for a fresh input field. */
    fun resetLayers() {
        if (shifted || symbols) {
            shifted = false
            symbols = false
            drawKeys()
        }
    }

    /* ----------------------------------------------------------------- helpers */

    private fun keyBackground(colorRes: Int) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(8).toFloat()
        setColor(context.getColor(colorRes))
        setStroke(1, Color.argb(20, 255, 255, 255))
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val REPEAT_DELAY_MS = 420L
        private const val REPEAT_INTERVAL_MS = 55L
    }
}
