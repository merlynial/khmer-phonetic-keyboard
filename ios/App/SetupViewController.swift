//
//  The app you open from the Home Screen: how to turn the keyboard on, a box to
//  try it in, and the romanization cheat-sheet.
//
//  iOS will not let an app enable its own keyboard, so the best any keyboard can
//  do is send you to the right Settings page.
//

import UIKit

final class SetupViewController: UIViewController {

    private let tryField = UITextView()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "Khmer Phonetic"

        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 24, left: 20, bottom: 40, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor),
        ])

        stack.addArrangedSubview(heading("Khmer Phonetic", size: 28))
        stack.addArrangedSubview(khmerBody("វាយខ្មែរតាមសំឡេង · Type Khmer by sound"))

        stack.addArrangedSubview(heading("1. Turn the keyboard on", size: 18))
        stack.addArrangedSubview(body(
            "Settings → General → Keyboard → Keyboards → Add New Keyboard, "
            + "then pick Khmer Phonetic."
        ))
        stack.addArrangedSubview(button("Open Settings") {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        })

        stack.addArrangedSubview(heading("2. Switch to it", size: 18))
        stack.addArrangedSubview(body(
            "Hold the globe key in any app and choose Khmer Phonetic. "
            + "You do not need to allow full access — the keyboard never leaves your device."
        ))

        stack.addArrangedSubview(heading("3. Try it", size: 18))
        tryField.font = Fonts.khmer(size: 22)
        tryField.layer.borderColor = UIColor.separator.cgColor
        tryField.layer.borderWidth = 1
        tryField.layer.cornerRadius = 8
        tryField.heightAnchor.constraint(equalToConstant: 110).isActive = true
        stack.addArrangedSubview(tryField)

        stack.addArrangedSubview(heading("How to type", size: 18))
        stack.addArrangedSubview(khmerBody(Self.cheatSheet))
    }

    // MARK: - small views

    private func heading(_ text: String, size: CGFloat) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: size, weight: .semibold)
        label.numberOfLines = 0
        return label
    }

    private func body(_ text: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: 15)
        label.numberOfLines = 0
        return label
    }

    private func khmerBody(_ text: String) -> UILabel {
        let label = body(text)
        label.font = Fonts.khmer(size: 16)
        return label
    }

    private func button(_ title: String, action: @escaping () -> Void) -> UIButton {
        var config = UIButton.Configuration.tinted()
        config.title = title
        let button = UIButton(configuration: config, primaryAction: UIAction { _ in action() })
        button.setContentHuggingPriority(.required, for: .horizontal)
        return button
    }

    private static let cheatSheet = """
        Write the word the way it sounds.
          khnhom → ខ្ញុំ      arkun → អរគុណ      suastei → សួស្តី

        Consonants typed together with no vowel between them stack \
        automatically: skl → ស្ក្ល. The "break" key stops a cluster, \
        so ka.mpujaa → កម្ពុជា.

        Capitals reach the second-series letters — hold the key rather than \
        using Shift:
          d → ដ but D → ឌ      n → ន but N → ណ      l → ល but L → ឡ

        Signs are on the ?123 layer: ' → ់   * → ៉   ` → ៊   ^ → ័   ~ → ៍

        Tap a suggestion to insert the whole word. No space is added, because \
        Khmer runs words together; the space key adds one.
        """
}
