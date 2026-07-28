//
//  Which keys exist, how wide they are, and what they say.
//
//  The Khmer hint under each letter is read out of PhoneticScheme rather than
//  typed here, so it follows the romanization automatically.
//
//  Long-press alternates matter more than usual for this scheme: D N L T are
//  different consonants from d n l t, and reaching them through Shift on every
//  word is miserable. Holding the key gets the capital directly.
//

import Foundation

enum KeyAction {
    case shift, backspace, space, enter, layerSymbols, layerLetters, nextKeyboard
}

enum Key {
    /// Feeds a character into the romanization buffer.
    case character(label: String, hint: String?, weight: CGFloat, altChar: String?, altLiteral: String?)
    /// Emits its text directly, bypassing the romanization.
    case literal(label: String, text: String, hint: String?, weight: CGFloat, altLiteral: String?)
    case action(label: String, action: KeyAction, weight: CGFloat)
    /// Empty space, used to centre the nine-key home row.
    case gap(weight: CGFloat)

    var weight: CGFloat {
        switch self {
        case let .character(_, _, w, _, _): return w
        case let .literal(_, _, _, w, _): return w
        case let .action(_, _, w): return w
        case let .gap(w): return w
        }
    }

    var label: String {
        switch self {
        case let .character(l, _, _, _, _): return l
        case let .literal(l, _, _, _, _): return l
        case let .action(l, _, _): return l
        case .gap: return ""
        }
    }

    var hint: String? {
        switch self {
        case let .character(_, h, _, _, _): return h
        case let .literal(_, _, h, _, _): return h
        default: return nil
        }
    }

    /// What a long press produces, shown small in the key's corner.
    var alternate: String? {
        switch self {
        case let .character(_, _, _, altChar, altLiteral): return altChar ?? altLiteral
        case let .literal(_, _, _, _, altLiteral): return altLiteral
        default: return nil
        }
    }
}

enum KeyboardLayout {

    private static let row1 = "qwertyuiop"
    private static let row2 = "asdfghjkl"
    private static let row3 = "zxcvbnm"

    /// Letters whose capital is a distinct Khmer consonant or sign.
    private static let capitals: [Character: String] = [
        "d": "D", "n": "N", "l": "L", "t": "T", "m": "M", "h": "H",
    ]

    /// The Khmer glyph on a letter key, or the one its shortest token makes.
    static func hint(for ch: String) -> String? {
        if let direct = PhoneticScheme.map[ch], !direct.isEmpty { return direct }
        // "c" alone is not a token; show what "ch" produces, which is what the
        // user is reaching for when they press it.
        let candidate = PhoneticScheme.keys
            .filter { $0.hasPrefix(ch) && $0.count > ch.count && ($0.first?.isLetter ?? false) }
            .min { $0.count < $1.count }
        guard let candidate, let glyph = PhoneticScheme.map[candidate], !glyph.isEmpty else { return nil }
        return glyph
    }

    private static func letterKey(_ ch: Character, upper: Bool) -> Key {
        let label = upper ? ch.uppercased() : String(ch)
        return .character(
            label: label,
            hint: hint(for: label),
            weight: 1,
            altChar: upper ? nil : capitals[ch],
            altLiteral: nil
        )
    }

    static func letterRows(upper: Bool) -> [[Key]] {
        let r1 = row1.map { letterKey($0, upper: upper) }
        var r2: [Key] = [.gap(weight: 0.5)]
        r2 += row2.map { letterKey($0, upper: upper) }
        r2.append(.gap(weight: 0.5))
        var r3: [Key] = [.action(label: "⇧", action: .shift, weight: 1.5)]
        r3 += row3.map { letterKey($0, upper: upper) }
        r3.append(.action(label: "⌫", action: .backspace, weight: 1.5))
        return [r1, r2, r3, bottomRow(.layerSymbols, "?123")]
    }

    /// The bottom row carries real punctuation.
    ///
    /// ។ is the Khmer full stop and ends most sentences, so it earns a key. The
    /// scheme's "." is a syllable break that deliberately writes nothing — it
    /// stops two consonants stacking, as in ka.mpujaa — which reads as a dead
    /// key unless it is labelled as a break. A Latin full stop is its long-press.
    private static func bottomRow(_ layer: KeyAction, _ layerLabel: String) -> [Key] {
        [
            .action(label: layerLabel, action: layer, weight: 1.5),
            .action(label: "🌐", action: .nextKeyboard, weight: 1),
            .literal(label: "។", text: "។", hint: nil, weight: 1, altLiteral: "៕"),
            .action(label: "space", action: .space, weight: 4),
            .character(label: ".", hint: "break", weight: 1, altChar: nil, altLiteral: "."),
            .action(label: "⏎", action: .enter, weight: 1.5),
        ]
    }

    static func symbolRows() -> [[Key]] {
        // Latin digits are what prices, dates and phone numbers need; the Khmer
        // digit is the long-press.
        let khmerDigits = Array("០១២៣៤៥៦៧៨៩")
        let digits: [Key] = Array("1234567890").map { d in
            let khmer = String(khmerDigits[Int(String(d))!])
            return .literal(label: String(d), text: String(d), hint: khmer, weight: 1, altLiteral: khmer)
        }

        var signs: [Key] = ["'", "*", "`", "^", "~"].map {
            .character(label: $0, hint: PhoneticScheme.map[$0], weight: 1, altChar: nil, altLiteral: nil)
        }
        signs += ["។", "៕", "ៗ"].map { .literal(label: $0, text: $0, hint: nil, weight: 1, altLiteral: nil) }

        var punctuation: [Key] = ["៖", "«", "»", ".", ",", "!", "?"].map {
            .literal(label: $0, text: $0, hint: nil, weight: 1, altLiteral: nil)
        }
        punctuation.append(.action(label: "⌫", action: .backspace, weight: 1.5))

        return [digits, signs, punctuation, bottomRow(.layerLetters, "ABC")]
    }
}
