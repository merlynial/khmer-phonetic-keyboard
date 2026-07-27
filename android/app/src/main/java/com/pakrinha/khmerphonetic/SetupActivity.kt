package com.pakrinha.khmerphonetic

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * The app you open from the launcher: three steps to get the keyboard working,
 * a box to try it in, and the romanization cheat-sheet.
 *
 * Android will not let an app enable its own keyboard, so the best any IME can
 * do is take you to the right settings screen — hence the two buttons.
 */
class SetupActivity : Activity() {

    private lateinit var enabledNote: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val khmerFont = runCatching {
            Typeface.createFromAsset(assets, "Siemreap-Regular.ttf")
        }.getOrNull()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(32), dp(24), dp(40))
        }

        root.addView(heading(getString(R.string.setup_title), 26f))
        root.addView(body(getString(R.string.setup_tagline)).apply { typeface = khmerFont })

        enabledNote = body("").apply {
            setPadding(0, dp(18), 0, 0)
            setTextColor(Color.parseColor("#1B7F3B"))
        }
        root.addView(enabledNote)

        root.addView(heading(getString(R.string.step_enable_title), 17f))
        root.addView(body(getString(R.string.step_enable_body)))
        root.addView(button(getString(R.string.step_enable_button)) {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        })

        root.addView(heading(getString(R.string.step_select_title), 17f))
        root.addView(body(getString(R.string.step_select_body)))
        root.addView(button(getString(R.string.step_select_button)) {
            (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                .showInputMethodPicker()
        })

        root.addView(heading(getString(R.string.step_try_title), 17f))
        root.addView(body(getString(R.string.step_try_body)))
        root.addView(
            EditText(this).apply {
                hint = getString(R.string.try_hint)
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
                minLines = 3
                gravity = Gravity.TOP or Gravity.START
                typeface = khmerFont
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            },
            LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) },
        )

        root.addView(heading(getString(R.string.how_title), 17f))
        root.addView(body(CHEAT_SHEET).apply { typeface = khmerFont })

        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() {
        super.onResume()
        enabledNote.text = if (isKeyboardEnabled()) "✓ Khmer Phonetic is enabled." else ""
    }

    private fun isKeyboardEnabled(): Boolean {
        val manager = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        return manager.enabledInputMethodList.any { it.packageName == packageName }
    }

    /* ------------------------------------------------------------ small views */

    private fun heading(text: String, size: Float) = TextView(this).apply {
        this.text = text
        setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
        setTypeface(null, Typeface.BOLD)
        setPadding(0, dp(26), 0, dp(4))
    }

    private fun body(text: String) = TextView(this).apply {
        this.text = text
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        setLineSpacing(dp(4).toFloat(), 1f)
    }

    private fun button(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT)
            .apply { topMargin = dp(10) }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private companion object {
        val CHEAT_SHEET = """
            Write the word the way it sounds.
              khnhom → ខ្ញុំ      arkun → អរគុណ      suastei → សួស្តី

            Consonants typed together with no vowel between them stack
            automatically: skl → ស្ក្ល. Type "." to break a cluster,
            so ka.mpujaa → កម្ពុជា.

            Capitals reach the second-series letters:
              d → ដ but D → ឌ      n → ន but N → ណ      l → ល but L → ឡ

            Signs live on the ?123 layer: ' → ់   * → ៉   ` → ៊   ^ → ័   ~ → ៍

            Tap a suggestion to insert the whole word — no space is added,
            because Khmer runs words together. The space key adds one.
        """.trimIndent()
    }
}
