package com.pakrinha.khmerphonetic

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.PopupWindow
import android.widget.TextView

/**
 * The bubble that pops above the key your finger is on.
 *
 * Without it there is no way to tell you have landed on the wrong letter until
 * the wrong Khmer is already in the text — which was the single worst thing
 * about the first version of this keyboard.
 */
class KeyPreview(context: Context, khmerFont: Typeface?) {

    private val density = context.resources.displayMetrics.density

    private val label = TextView(context).apply {
        gravity = Gravity.CENTER
        setTextColor(context.getColor(R.color.kb_text))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f)
        typeface = khmerFont
        setPadding(dp(10), dp(6), dp(10), dp(8))
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(10).toFloat()
            setColor(context.getColor(R.color.kb_key_pressed))
            setStroke(dp(1), Color.argb(40, 255, 255, 255))
        }
    }

    private val window = PopupWindow(label, WRAP_CONTENT, WRAP_CONTENT).apply {
        isTouchable = false          // never steal the touch that is in progress
        isClippingEnabled = false    // may extend above the keyboard window
        animationStyle = 0
    }

    fun show(anchor: View, keyBounds: android.graphics.RectF, text: String, hint: String?) {
        label.text = if (hint != null && hint != "break") "$text  $hint" else text
        label.measure(0, 0)

        val x = keyBounds.centerX().toInt() - label.measuredWidth / 2
        // Sit the bubble just above the key, where the finger is not covering it.
        val y = keyBounds.top.toInt() - label.measuredHeight - dp(6)

        if (window.isShowing) {
            window.update(x, y + anchorOffset(anchor), label.measuredWidth, label.measuredHeight)
        } else {
            window.showAtLocation(anchor, Gravity.NO_GRAVITY, x, y + anchorOffset(anchor))
        }
    }

    fun hide() {
        if (window.isShowing) window.dismiss()
    }

    private fun anchorOffset(anchor: View): Int {
        val location = IntArray(2)
        anchor.getLocationInWindow(location)
        return location[1]
    }

    private fun dp(value: Int) = (value * density).toInt()
}
