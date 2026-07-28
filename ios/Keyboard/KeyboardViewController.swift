//
//  The keyboard extension itself.
//
//  One thing works very differently from Android. Android gives an IME
//  `setComposingText`, an underlined region it can rewrite freely as a word
//  takes shape. iOS gives a custom keyboard only `insertText` and
//  `deleteBackward`, so live conversion has to be emulated: remember exactly
//  what was inserted last, delete it, insert the new conversion.
//
//  Deleting it is the subtle part. One `deleteBackward()` per Swift `Character`
//  is wrong: Swift counts ខ្ញុំ as a single extended grapheme cluster while the
//  text system deletes a smaller unit, so the call strips the vowel and leaves
//  the consonant. See `deleteBack`, which measures rather than assumes.
//
//  Committing simply forgets the buffer and leaves the text where it is.
//

import UIKit

final class KeyboardViewController: UIInputViewController {

    private var keyPad: KeyPadView!
    private var strip: SuggestionStrip!
    private var heightConstraint: NSLayoutConstraint?

    /// The romanization typed so far and not yet committed.
    private var buffer = ""
    /// Exactly what we last inserted into the document, so it can be replaced.
    private var lastOutput = ""

    private var suggestions: Suggestions?
    private var learning: UserDefaultsLearning!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Palette.background

        learning = UserDefaultsLearning()

        strip = SuggestionStrip()
        strip.onPick = { [weak self] candidate in self?.pick(candidate) }
        strip.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(strip)

        keyPad = KeyPadView()
        keyPad.delegate = self
        keyPad.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(keyPad)

        NSLayoutConstraint.activate([
            strip.topAnchor.constraint(equalTo: view.topAnchor),
            strip.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            strip.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            strip.heightAnchor.constraint(equalToConstant: SuggestionStrip.height),

            keyPad.topAnchor.constraint(equalTo: strip.bottomAnchor),
            keyPad.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            keyPad.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            keyPad.heightAnchor.constraint(equalToConstant: KeyPadView.rowHeight * 4),
        ])

        let height = SuggestionStrip.height + KeyPadView.rowHeight * 4
        heightConstraint = view.heightAnchor.constraint(equalToConstant: height)
        heightConstraint?.priority = .required - 1
        heightConstraint?.isActive = true

        strip.showLoading()
        loadLexicons()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        reset()
    }

    override func textDidChange(_ textInput: UITextInput?) {
        // The cursor may have moved, or another keyboard may have edited the
        // field. Either way our record of what we inserted is no longer safe to
        // delete, so drop it rather than eat someone else's text.
        if buffer.isEmpty { lastOutput = "" }
    }

    /// ~77,000 lines of lexicon. A keyboard extension is expected to appear
    /// instantly, so parse off the main thread; typing and conversion work
    /// immediately and suggestions arrive a moment later.
    private func loadLexicons() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard
                let curatedURL = Bundle.main.url(forResource: "curated", withExtension: "tsv"),
                let lexiconURL = Bundle.main.url(forResource: "words", withExtension: "txt"),
                let curated = try? String(contentsOf: curatedURL, encoding: .utf8),
                let lexicon = try? String(contentsOf: lexiconURL, encoding: .utf8)
            else {
                DispatchQueue.main.async { self?.strip.clear() }
                return
            }
            guard let self else { return }
            let loaded = Suggestions(curatedTSV: curated, lexiconTSV: lexicon, learned: self.learning)
            DispatchQueue.main.async {
                self.suggestions = loaded
                self.refresh()
            }
        }
    }

    // MARK: - editing

    private func reset() {
        buffer = ""
        lastOutput = ""
        keyPad?.resetLayers()
        strip?.clear()
    }

    /// Replace what we previously inserted with the buffer's conversion.
    private func refresh() {
        let proxy = textDocumentProxy
        let next = buffer.isEmpty ? "" : PhoneticEngine.convert(buffer)

        if next != lastOutput {
            deleteBack(lastOutput)
            if !next.isEmpty { proxy.insertText(next) }
            lastOutput = next
        }

        guard !buffer.isEmpty else {
            strip.clear()
            return
        }
        if let suggestions {
            strip.show(suggestions.suggest(buffer))
        } else {
            strip.showLoading()
        }
    }

    /// Remove exactly `text` from behind the cursor.
    ///
    /// Calling `deleteBackward()` once per Swift `Character` does **not** work.
    /// Swift counts ខ្ញុំ as one extended grapheme cluster; the text system
    /// deletes a smaller unit, so one call removes the vowel and leaves the
    /// consonant behind. Typing khnhom that way produced ខខខ្ញុំ — a stray base
    /// consonant for every rewrite.
    ///
    /// So measure instead of assuming: delete until the context before the
    /// cursor has actually shrunk by the required number of characters. The cap
    /// stops a host that reports a frozen context from spinning.
    private func deleteBack(_ text: String) {
        guard !text.isEmpty else { return }
        let proxy = textDocumentProxy
        let before = (proxy.documentContextBeforeInput ?? "").count
        let target = max(before - text.count, 0)

        var attempts = 0
        while attempts < Self.maxDeletes {
            proxy.deleteBackward()
            attempts += 1
            let now = (proxy.documentContextBeforeInput ?? "").count
            if now <= target { return }
        }
    }

    /// Freeze what is on screen and forget the buffer.
    private func commit() {
        buffer = ""
        lastOutput = ""
        strip.clear()
    }

    private func pick(_ candidate: Candidate) {
        let proxy = textDocumentProxy
        deleteBack(lastOutput)
        // No trailing space: Khmer runs words together.
        proxy.insertText(candidate.khmer)
        learning.record(khmer: candidate.khmer, spelling: buffer)
        commit()
    }

    /// Safety cap on deleteBack's loop, in case a host reports a context that
    /// never shrinks. Comfortably above the longest conversion a buffer produces.
    private static let maxDeletes = 24
}

/// Required for `playInputClick()` to make any sound at all.
extension KeyboardViewController: UIInputViewAudioFeedback {
    var enableInputClicksWhenVisible: Bool { true }
}

extension KeyboardViewController: KeyPadDelegate {

    func keyPad(_ pad: KeyPadView, didType text: String) {
        buffer += text
        refresh()
    }

    func keyPad(_ pad: KeyPadView, didEmit literal: String) {
        commit()
        textDocumentProxy.insertText(literal)
    }

    func keyPad(_ pad: KeyPadView, didTrigger action: KeyAction) {
        switch action {
        case .backspace:
            if buffer.isEmpty {
                textDocumentProxy.deleteBackward()
            } else {
                buffer.removeLast()
                refresh()
            }

        case .space:
            commit()
            textDocumentProxy.insertText(" ")

        case .enter:
            commit()
            textDocumentProxy.insertText("\n")

        case .nextKeyboard:
            advanceToNextInputMode()

        default:
            break
        }
    }
}
