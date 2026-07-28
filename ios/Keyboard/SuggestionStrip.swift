//
//  The word bar above the keys.
//
//  An empty strip is indistinguishable from a broken one, so while the lexicon
//  is still parsing it says so rather than sitting blank.
//

import UIKit

final class SuggestionStrip: UIScrollView {

    static let height: CGFloat = 48

    var onPick: ((Candidate) -> Void)?

    private let stack = UIStackView()
    private let status = UILabel()

    init() {
        super.init(frame: .zero)
        backgroundColor = Palette.background
        showsHorizontalScrollIndicator = false
        alwaysBounceHorizontal = false

        stack.axis = .horizontal
        stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        status.textColor = Palette.hint
        status.font = .systemFont(ofSize: 13)
        status.isHidden = true
        status.translatesAutoresizingMaskIntoConstraints = false
        addSubview(status)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: contentLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: contentLayoutGuide.trailingAnchor),
            stack.topAnchor.constraint(equalTo: contentLayoutGuide.topAnchor),
            stack.heightAnchor.constraint(equalTo: frameLayoutGuide.heightAnchor),

            status.leadingAnchor.constraint(equalTo: frameLayoutGuide.leadingAnchor, constant: 16),
            status.centerYAnchor.constraint(equalTo: frameLayoutGuide.centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    func show(_ candidates: [Candidate]) {
        status.isHidden = true
        clearChips()
        for candidate in candidates {
            stack.addArrangedSubview(chip(candidate))
        }
    }

    func showLoading() {
        clearChips()
        status.text = "Loading words…"
        status.isHidden = false
    }

    func clear() {
        clearChips()
        status.isHidden = true
    }

    private func clearChips() {
        for view in stack.arrangedSubviews {
            stack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
    }

    /// Generous horizontal padding: these are the primary target for picking a
    /// word, and a tight chip is hard to hit.
    private func chip(_ candidate: Candidate) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(candidate.khmer, for: .normal)
        button.titleLabel?.font = Fonts.khmer(size: 22)
        button.setTitleColor(Palette.text, for: .normal)
        button.contentEdgeInsets = UIEdgeInsets(top: 0, left: 18, bottom: 0, right: 18)
        button.addAction(
            UIAction { [weak self] _ in
                Click.tap()
                self?.onPick?(candidate)
            },
            for: .touchUpInside
        )
        return button
    }
}
