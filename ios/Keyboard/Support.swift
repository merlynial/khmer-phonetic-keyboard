//
//  Shared odds and ends for the keyboard: colours, the Khmer font, and the key
//  preview bubble.
//

import UIKit

/// Carried over from the web app so the two look like the same product.
enum Palette {
    static let background = UIColor(red: 0.067, green: 0.086, blue: 0.122, alpha: 1)
    static let key = UIColor(red: 0.137, green: 0.169, blue: 0.220, alpha: 1)
    static let keyPressed = UIColor(red: 0.227, green: 0.278, blue: 0.380, alpha: 1)
    static let keyFunction = UIColor(red: 0.102, green: 0.129, blue: 0.173, alpha: 1)
    static let text = UIColor(red: 0.910, green: 0.929, blue: 0.957, alpha: 1)
    static let hint = UIColor(red: 0.486, green: 0.541, blue: 0.627, alpha: 1)
    static let khmerHint = UIColor(red: 1.0, green: 0.824, blue: 0.498, alpha: 1)
    static let accent = UIColor(red: 0.231, green: 0.510, blue: 0.965, alpha: 1)
}

/// Key feedback.
///
/// `UIImpactFeedbackGenerator` is silently ignored inside a keyboard extension
/// unless the user grants "Allow Full Access", which this keyboard deliberately
/// does not ask for. `playInputClick()` is the sanctioned route: it needs no
/// entitlement and honours the user's own keyboard-click setting. Both are
/// called, so anyone who does grant full access gets haptics too.
enum Click {
    static func tap() {
        UIDevice.current.playInputClick()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    static func longPress() {
        UIDevice.current.playInputClick()
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
}

/// The bubble that pops above the key your finger is on. Without it there is no
/// way to tell you have landed on the wrong letter until the wrong Khmer is
/// already in the text.
final class KeyPreview {

    private lazy var label: UILabel = {
        let label = UILabel()
        label.textAlignment = .center
        label.textColor = Palette.text
        label.backgroundColor = Palette.keyPressed
        label.layer.cornerRadius = 10
        label.layer.masksToBounds = true
        label.layer.borderWidth = 1
        label.layer.borderColor = UIColor(white: 1, alpha: 0.16).cgColor
        label.isHidden = true
        return label
    }()

    func show(over keyFrame: CGRect, in parent: UIView, label text: String, hint: String?) {
        if label.superview !== parent { parent.addSubview(label) }
        label.font = Fonts.khmer(size: 24)
        label.text = (hint != nil && hint != "break") ? "\(text)  \(hint!)" : text

        let size = label.intrinsicContentSize
        let width = max(size.width + 22, keyFrame.width)
        let height = size.height + 14
        label.frame = CGRect(
            x: keyFrame.midX - width / 2,
            y: keyFrame.minY - height - 6,
            width: width,
            height: height
        )
        label.isHidden = false
        parent.bringSubviewToFront(label)
    }

    func hide() {
        label.isHidden = true
    }
}
