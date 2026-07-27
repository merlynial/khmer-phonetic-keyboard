package com.pakrinha.khmerphonetic

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View

/**
 * The keys, drawn on a canvas and touched directly.
 *
 * The first version made every key a TextView that fired on ACTION_DOWN. That
 * is why the keyboard felt unusable: the letter was committed the instant your
 * finger landed, so a tap a few pixels into the neighbouring key typed the
 * wrong letter, silently, with no way to correct it — and the engine then
 * converted that wrong letter perfectly, which is how "hard to hit" turns into
 * "wrong Khmer comes out".
 *
 * This version behaves like a real keyboard:
 *
 *   - the key commits on *release*, not on touch
 *   - sliding your finger moves the selection, so a bad landing is recoverable
 *   - a preview bubble shows which key is currently selected
 *   - holding a key gets its alternate (the capitals, Khmer digits, a full stop)
 *   - every press gives the standard keyboard haptic
 *
 * Drawing directly also removes the per-keystroke view churn of rebuilding
 * thirty-odd TextViews on every Shift.
 */
@SuppressLint("ViewConstructor")
class KeyPadView(
    context: Context,
    private val khmerFont: Typeface?,
    private val listener: Listener,
) : View(context) {

    interface Listener {
        fun onCharacter(text: String)
        fun onLiteral(text: String)
        fun onAction(action: KeyboardLayout.Act)
    }

    private class Placed(val key: KeyboardLayout.Key, val bounds: RectF)

    private var rows: List<List<KeyboardLayout.Key>> = emptyList()
    private var placed = emptyList<Placed>()
    private var pressed: Placed? = null
    private var longPressFired = false
    private var firedOnDown = false

    private var shifted = false
    private var symbols = false

    private val handler = Handler(Looper.getMainLooper())
    private val preview = KeyPreview(context, khmerFont)

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1f
        color = Color.argb(22, 255, 255, 255)
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        color = context.getColor(R.color.kb_text)
    }
    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        color = context.getColor(R.color.kb_khmer_hint)
        typeface = khmerFont
    }
    private val altPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.RIGHT
        color = context.getColor(R.color.kb_hint)
        typeface = khmerFont
    }

    private val keyColor = context.getColor(R.color.kb_key)
    private val functionColor = context.getColor(R.color.kb_key_function)
    private val pressedColor = context.getColor(R.color.kb_key_pressed)
    private val accentColor = context.getColor(R.color.kb_accent)

    init {
        isHapticFeedbackEnabled = true
        rows = KeyboardLayout.letterRows(false)
    }

    /* ------------------------------------------------------------ measurement */

    override fun onMeasure(widthSpec: Int, heightSpec: Int) {
        val width = MeasureSpec.getSize(widthSpec)
        setMeasuredDimension(width, (rows.size * ROW_HEIGHT_DP * density).toInt())
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val gap = KEY_GAP_DP * density
        val rowHeight = ROW_HEIGHT_DP * density
        val usable = (width - paddingLeft - paddingRight).toFloat()
        val list = ArrayList<Placed>()

        rows.forEachIndexed { index, row ->
            val totalWeight = row.sumOf { it.weight.toDouble() }.toFloat()
            var x = paddingLeft.toFloat()
            val top = index * rowHeight
            for (key in row) {
                val w = usable * key.weight / totalWeight
                if (key !is KeyboardLayout.Key.Gap) {
                    list.add(
                        Placed(
                            key,
                            RectF(x + gap, top + gap, x + w - gap, top + rowHeight - gap),
                        )
                    )
                }
                x += w
            }
        }
        placed = list
    }

    /* --------------------------------------------------------------- drawing */

    override fun onDraw(canvas: Canvas) {
        val radius = CORNER_DP * density
        for (p in placed) {
            val key = p.key
            val isFunction = key is KeyboardLayout.Key.Action &&
                key.action != KeyboardLayout.Act.SPACE
            val shiftActive = key is KeyboardLayout.Key.Action &&
                key.action == KeyboardLayout.Act.SHIFT && shifted

            fill.color = when {
                p === pressed -> pressedColor
                shiftActive -> accentColor
                isFunction -> functionColor
                else -> keyColor
            }
            canvas.drawRoundRect(p.bounds, radius, radius, fill)
            canvas.drawRoundRect(p.bounds, radius, radius, stroke)

            val label = labelOf(key)
            val hint = hintOf(key)
            val cx = p.bounds.centerX()

            labelPaint.textSize = (if (isFunction) FUNCTION_TEXT_SP else LABEL_TEXT_SP) * density
            labelPaint.typeface = if (isKhmer(label)) khmerFont else Typeface.DEFAULT

            if (hint == null) {
                canvas.drawText(label, cx, p.bounds.centerY() - (labelPaint.ascent() + labelPaint.descent()) / 2, labelPaint)
            } else {
                // Label sits high, Khmer hint underneath — the same arrangement
                // as the web app's on-screen keyboard.
                canvas.drawText(label, cx, p.bounds.centerY() - 2 * density, labelPaint)
                hintPaint.textSize = HINT_TEXT_SP * density
                hintPaint.typeface = if (isKhmer(hint)) khmerFont else Typeface.DEFAULT
                canvas.drawText(hint, cx, p.bounds.centerY() + HINT_TEXT_SP * density + 2 * density, hintPaint)
            }

            // A small mark in the corner so long-press alternates are findable.
            alternateOf(key)?.let {
                altPaint.textSize = ALT_TEXT_SP * density
                canvas.drawText(it, p.bounds.right - 5 * density, p.bounds.top + ALT_TEXT_SP * density + 3 * density, altPaint)
            }
        }
    }

    private fun labelOf(key: KeyboardLayout.Key): String = when (key) {
        is KeyboardLayout.Key.Char -> key.label
        is KeyboardLayout.Key.Literal -> key.label
        is KeyboardLayout.Key.Action -> key.label
        is KeyboardLayout.Key.Gap -> ""
    }

    private fun hintOf(key: KeyboardLayout.Key): String? = when (key) {
        is KeyboardLayout.Key.Char -> key.hint
        is KeyboardLayout.Key.Literal -> key.hint
        else -> null
    }

    private fun alternateOf(key: KeyboardLayout.Key): String? = when (key) {
        is KeyboardLayout.Key.Char -> key.altChar ?: key.altLiteral
        is KeyboardLayout.Key.Literal -> key.altLiteral
        else -> null
    }

    private fun isKhmer(text: String) = text.any { it.code in 0x1780..0x17FF }

    /* ----------------------------------------------------------------- touch */

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                select(hitTest(event.x, event.y), haptic = true)
                // Backspace is the one key that must act immediately and repeat
                // while held; waiting for release would make deleting painful.
                if (isBackspaceHeld()) {
                    firedOnDown = true
                    listener.onAction(KeyboardLayout.Act.BACKSPACE)
                    scheduleBackspaceRepeat()
                } else {
                    firedOnDown = false
                    scheduleLongPress()
                }
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                val under = hitTest(event.x, event.y)
                if (under !== pressed) {
                    // Slide to correct a bad landing: nothing is typed until you
                    // lift, so the selection can move as much as it likes.
                    select(under, haptic = false)
                    handler.removeCallbacksAndMessages(null)
                    if (under != null) scheduleLongPress()
                }
                return true
            }

            MotionEvent.ACTION_UP -> {
                handler.removeCallbacksAndMessages(null)
                val key = pressed?.key
                if (!longPressFired && !firedOnDown && key != null) fire(key)
                clearPress()
                performClick()
                return true
            }

            MotionEvent.ACTION_CANCEL -> {
                handler.removeCallbacksAndMessages(null)
                clearPress()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    private fun hitTest(x: Float, y: Float): Placed? {
        placed.firstOrNull { it.bounds.contains(x, y) }?.let { return it }
        // Fingers land in the gaps between keys constantly; snap to the nearest
        // key in the same row rather than swallowing the press.
        return placed.minByOrNull { p ->
            val dx = when {
                x < p.bounds.left -> p.bounds.left - x
                x > p.bounds.right -> x - p.bounds.right
                else -> 0f
            }
            val dy = when {
                y < p.bounds.top -> p.bounds.top - y
                y > p.bounds.bottom -> y - p.bounds.bottom
                else -> 0f
            }
            dx + dy * 4  // vertical misses are much worse than horizontal ones
        }?.takeIf { p ->
            y >= p.bounds.top - SNAP_DP * density && y <= p.bounds.bottom + SNAP_DP * density
        }
    }

    private fun select(target: Placed?, haptic: Boolean) {
        pressed = target
        longPressFired = false
        invalidate()
        if (target == null) {
            preview.hide()
            return
        }
        if (haptic) performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        if (showsPreview(target.key)) preview.show(this, target.bounds, labelOf(target.key), hintOf(target.key))
        else preview.hide()
    }

    private fun clearPress() {
        pressed = null
        longPressFired = false
        preview.hide()
        invalidate()
    }

    /** Space, Shift and friends are wide and obvious; a bubble over them is noise. */
    private fun showsPreview(key: KeyboardLayout.Key) =
        key is KeyboardLayout.Key.Char || key is KeyboardLayout.Key.Literal

    private fun scheduleBackspaceRepeat() {
        val repeat = object : Runnable {
            override fun run() {
                if (!isBackspaceHeld()) return
                listener.onAction(KeyboardLayout.Act.BACKSPACE)
                handler.postDelayed(this, REPEAT_INTERVAL_MS)
            }
        }
        handler.postDelayed(repeat, REPEAT_DELAY_MS)
    }

    private fun scheduleLongPress() {
        val target = pressed ?: return
        val alternate = alternateOf(target.key) ?: return
        handler.postDelayed({
            if (pressed === target) {
                longPressFired = true
                performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                when (val key = target.key) {
                    is KeyboardLayout.Key.Char ->
                        if (key.altChar != null) listener.onCharacter(key.altChar)
                        else listener.onLiteral(alternate)

                    else -> listener.onLiteral(alternate)
                }
                preview.hide()
            }
        }, LONG_PRESS_MS)
    }

    private fun fire(key: KeyboardLayout.Key) {
        when (key) {
            is KeyboardLayout.Key.Char -> {
                listener.onCharacter(key.label)
                if (shifted) {
                    shifted = false          // one-shot shift, like the web app
                    rows = KeyboardLayout.letterRows(false)
                    requestLayout()
                }
            }

            is KeyboardLayout.Key.Literal -> listener.onLiteral(key.text)

            is KeyboardLayout.Key.Action -> when (key.action) {
                KeyboardLayout.Act.SHIFT -> setLayer(!shifted, symbols)
                KeyboardLayout.Act.LAYER_SYMBOLS -> setLayer(false, true)
                KeyboardLayout.Act.LAYER_LETTERS -> setLayer(false, false)
                else -> listener.onAction(key.action)
            }

            is KeyboardLayout.Key.Gap -> Unit
        }
    }

    private fun setLayer(shift: Boolean, symbol: Boolean) {
        shifted = shift
        symbols = symbol
        rows = if (symbols) KeyboardLayout.symbolRows() else KeyboardLayout.letterRows(shifted)
        requestLayout()
        invalidate()
    }

    /** Back to the plain letter layer, for a fresh input field. */
    fun resetLayers() {
        if (shifted || symbols) setLayer(shift = false, symbol = false)
    }

    /** Backspace repeats while held; the service drives the repeat. */
    fun isBackspaceHeld(): Boolean =
        (pressed?.key as? KeyboardLayout.Key.Action)?.action == KeyboardLayout.Act.BACKSPACE

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        handler.removeCallbacksAndMessages(null)
        preview.hide()
    }

    private val density: Float get() = resources.displayMetrics.density

    companion object {
        // Taller than the first attempt: 52dp rows with 3dp gaps left keys that
        // were hard to hit accurately.
        const val ROW_HEIGHT_DP = 58f
        private const val KEY_GAP_DP = 3.5f
        private const val CORNER_DP = 9f
        private const val LABEL_TEXT_SP = 19f
        private const val FUNCTION_TEXT_SP = 15f
        private const val HINT_TEXT_SP = 12f
        private const val ALT_TEXT_SP = 9f
        private const val SNAP_DP = 14f
        private const val LONG_PRESS_MS = 380L
        private const val REPEAT_DELAY_MS = 420L
        private const val REPEAT_INTERVAL_MS = 55L
    }
}
