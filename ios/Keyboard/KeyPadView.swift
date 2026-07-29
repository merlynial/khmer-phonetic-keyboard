//
//  The keys, drawn and touched directly.
//
//  Same touch model as the Android app, and for the same reason: firing a key
//  the moment a finger lands makes a keyboard feel broken, because a tap a few
//  points into the neighbouring key types the wrong letter silently — and the
//  engine then converts that wrong letter perfectly.
//
//    - keys commit on release, not on touch
//    - the selection follows the finger, so a bad landing is recoverable
//    - a preview bubble shows which key is selected
//    - holding a key gives its alternate (capitals, Khmer digits, a full stop)
//

import UIKit

protocol KeyPadDelegate: AnyObject {
    func keyPad(_ pad: KeyPadView, didType text: String)
    func keyPad(_ pad: KeyPadView, didEmit literal: String)
    func keyPad(_ pad: KeyPadView, didTrigger action: KeyAction)
}

final class KeyPadView: UIView {

    weak var delegate: KeyPadDelegate?

    /// iPad needs taller rows. A 54pt row is right on a phone but leaves a 13"
    /// iPad with squat, wide keys and a keyboard a fifth the height of the
    /// screen — it looks broken next to the system keyboard.
    static var rowHeight: CGFloat { isPad ? 76 : 54 }

    private static var isPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }

    /// Type scales with the keys, or the labels swim in the middle of them.
    private static var textScale: CGFloat { isPad ? 1.35 : 1 }

    private struct Placed {
        let key: Key
        let frame: CGRect
    }

    private var rows: [[Key]] = KeyboardLayout.letterRows(upper: false)
    private var placed: [Placed] = []
    private var pressedIndex: Int?
    private var longPressFired = false
    private var firedOnDown = false

    private var shifted = false
    private var symbols = false

    private var longPressTimer: Timer?
    private var repeatTimer: Timer?
    private let preview = KeyPreview()

    private let labelFont: UIFont
    private let functionFont: UIFont
    private let hintFont: UIFont
    private let altFont: UIFont

    override init(frame: CGRect) {
        let scale = Self.textScale
        labelFont = .systemFont(ofSize: 19 * scale, weight: .regular)
        functionFont = .systemFont(ofSize: 15 * scale, weight: .regular)
        hintFont = Fonts.khmer(size: 12 * scale)
        altFont = Fonts.khmer(size: 9 * scale)
        super.init(frame: frame)
        backgroundColor = Palette.background
        isMultipleTouchEnabled = false
        contentMode = .redraw
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    var preferredHeight: CGFloat { CGFloat(rows.count) * Self.rowHeight }

    // MARK: - layout

    override func layoutSubviews() {
        super.layoutSubviews()
        let gap: CGFloat = 3.5
        var list: [Placed] = []
        for (index, row) in rows.enumerated() {
            let totalWeight = row.reduce(CGFloat.zero) { $0 + $1.weight }
            var x: CGFloat = 0
            let top = CGFloat(index) * Self.rowHeight
            for key in row {
                let w = bounds.width * key.weight / totalWeight
                if case .gap = key {} else {
                    list.append(
                        Placed(
                            key: key,
                            frame: CGRect(x: x + gap, y: top + gap,
                                          width: w - gap * 2, height: Self.rowHeight - gap * 2)
                        )
                    )
                }
                x += w
            }
        }
        placed = list
        setNeedsDisplay()
    }

    // MARK: - drawing

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }

        for (index, p) in placed.enumerated() {
            let isFunction: Bool
            var isShiftActive = false
            if case let .action(_, action, _) = p.key {
                isFunction = action != .space
                isShiftActive = action == .shift && shifted
            } else {
                isFunction = false
            }

            let fill: UIColor
            if index == pressedIndex { fill = Palette.keyPressed }
            else if isShiftActive { fill = Palette.accent }
            else if isFunction { fill = Palette.keyFunction }
            else { fill = Palette.key }

            let path = UIBezierPath(roundedRect: p.frame, cornerRadius: 9)
            context.setFillColor(fill.cgColor)
            path.fill()
            context.setStrokeColor(UIColor(white: 1, alpha: 0.09).cgColor)
            path.lineWidth = 1
            path.stroke()

            let label = p.key.label
            let hint = p.key.hint
            let font = isFunction ? functionFont : (isKhmer(label) ? Fonts.khmer(size: 19 * Self.textScale) : labelFont)

            if let hint {
                draw(label, in: p.frame, dy: -7 * Self.textScale, font: font, color: Palette.text)
                draw(hint, in: p.frame, dy: 11 * Self.textScale,
                     font: isKhmer(hint) ? hintFont : .systemFont(ofSize: 11 * Self.textScale),
                     color: Palette.khmerHint)
            } else {
                draw(label, in: p.frame, dy: 0, font: font, color: Palette.text)
            }

            if let alternate = p.key.alternate {
                let attributes: [NSAttributedString.Key: Any] = [
                    .font: isKhmer(alternate) ? altFont : UIFont.systemFont(ofSize: 9 * Self.textScale),
                    .foregroundColor: Palette.hint,
                ]
                let size = (alternate as NSString).size(withAttributes: attributes)
                (alternate as NSString).draw(
                    at: CGPoint(x: p.frame.maxX - size.width - 5, y: p.frame.minY + 3),
                    withAttributes: attributes
                )
            }
        }
    }

    private func draw(_ text: String, in frame: CGRect, dy: CGFloat, font: UIFont, color: UIColor) {
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        let size = (text as NSString).size(withAttributes: attributes)
        let origin = CGPoint(
            x: frame.midX - size.width / 2,
            y: frame.midY - size.height / 2 + dy
        )
        (text as NSString).draw(at: origin, withAttributes: attributes)
    }

    private func isKhmer(_ text: String) -> Bool {
        text.unicodeScalars.contains { (0x1780...0x17FF).contains(Int($0.value)) }
    }

    // MARK: - touch

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self) else { return }
        select(hitTest(point), haptic: true)

        // Backspace is the one key that must act immediately and repeat while
        // held; waiting for release would make deleting painful.
        if isBackspacePressed {
            firedOnDown = true
            delegate?.keyPad(self, didTrigger: .backspace)
            startRepeat()
        } else {
            firedOnDown = false
            scheduleLongPress()
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self) else { return }
        let under = hitTest(point)
        guard under != pressedIndex else { return }
        // Slide to correct a bad landing: nothing is typed until you lift.
        cancelTimers()
        select(under, haptic: false)
        if under != nil && !isBackspacePressed { scheduleLongPress() }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        cancelTimers()
        if !longPressFired, !firedOnDown, let index = pressedIndex {
            fire(placed[index].key)
        }
        clearPress()
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        cancelTimers()
        clearPress()
    }

    private var isBackspacePressed: Bool {
        guard let index = pressedIndex, case let .action(_, action, _) = placed[index].key else { return false }
        return action == .backspace
    }

    /// Fingers land in the gaps between keys constantly; snap to the nearest key
    /// in the row rather than swallowing the press.
    private func hitTest(_ point: CGPoint) -> Int? {
        if let exact = placed.firstIndex(where: { $0.frame.contains(point) }) { return exact }
        var best: Int?
        var bestDistance = CGFloat.greatestFiniteMagnitude
        for (index, p) in placed.enumerated() {
            let dx = max(p.frame.minX - point.x, 0, point.x - p.frame.maxX)
            let dy = max(p.frame.minY - point.y, 0, point.y - p.frame.maxY)
            guard dy < 14 else { continue }  // vertical misses are much worse
            let distance = dx + dy * 4
            if distance < bestDistance {
                bestDistance = distance
                best = index
            }
        }
        return best
    }

    private func select(_ index: Int?, haptic: Bool) {
        pressedIndex = index
        longPressFired = false
        setNeedsDisplay()
        guard let index else {
            preview.hide()
            return
        }
        if haptic { Click.tap() }
        let p = placed[index]
        switch p.key {
        case .character, .literal:
            preview.show(over: p.frame, in: self, label: p.key.label, hint: p.key.hint)
        default:
            preview.hide()
        }
    }

    private func clearPress() {
        pressedIndex = nil
        longPressFired = false
        firedOnDown = false
        preview.hide()
        setNeedsDisplay()
    }

    private func cancelTimers() {
        longPressTimer?.invalidate()
        longPressTimer = nil
        repeatTimer?.invalidate()
        repeatTimer = nil
    }

    private func startRepeat() {
        repeatTimer = Timer.scheduledTimer(withTimeInterval: 0.42, repeats: false) { [weak self] _ in
            guard let self, self.isBackspacePressed else { return }
            self.repeatTimer = Timer.scheduledTimer(withTimeInterval: 0.055, repeats: true) { [weak self] timer in
                guard let self, self.isBackspacePressed else { timer.invalidate(); return }
                self.delegate?.keyPad(self, didTrigger: .backspace)
            }
        }
    }

    private func scheduleLongPress() {
        guard let index = pressedIndex, placed[index].key.alternate != nil else { return }
        longPressTimer = Timer.scheduledTimer(withTimeInterval: 0.38, repeats: false) { [weak self] _ in
            guard let self, self.pressedIndex == index else { return }
            self.longPressFired = true
            Click.longPress()
            switch self.placed[index].key {
            case let .character(_, _, _, altChar, altLiteral):
                if let altChar { self.delegate?.keyPad(self, didType: altChar) }
                else if let altLiteral { self.delegate?.keyPad(self, didEmit: altLiteral) }
            case let .literal(_, _, _, _, altLiteral):
                if let altLiteral { self.delegate?.keyPad(self, didEmit: altLiteral) }
            default:
                break
            }
            self.preview.hide()
        }
    }

    private func fire(_ key: Key) {
        switch key {
        case let .character(label, _, _, _, _):
            delegate?.keyPad(self, didType: label)
            if shifted {
                shifted = false           // one-shot shift, like the web app
                setLayer(shift: false, symbol: symbols)
            }
        case let .literal(_, text, _, _, _):
            delegate?.keyPad(self, didEmit: text)
        case let .action(_, action, _):
            switch action {
            case .shift: setLayer(shift: !shifted, symbol: symbols)
            case .layerSymbols: setLayer(shift: false, symbol: true)
            case .layerLetters: setLayer(shift: false, symbol: false)
            default: delegate?.keyPad(self, didTrigger: action)
            }
        case .gap:
            break
        }
    }

    private func setLayer(shift: Bool, symbol: Bool) {
        shifted = shift
        symbols = symbol
        rows = symbols ? KeyboardLayout.symbolRows() : KeyboardLayout.letterRows(upper: shifted)
        setNeedsLayout()
        setNeedsDisplay()
    }

    /// Back to the plain letter layer, for a fresh input field.
    func resetLayers() {
        if shifted || symbols { setLayer(shift: false, symbol: false) }
    }

    deinit { cancelTimers() }
}
