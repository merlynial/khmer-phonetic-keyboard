//
//  The Khmer face, used by both targets — the keyboard draws its hints with it
//  and the setup screen shows examples in it. It lives in Shared for that
//  reason; keeping it in the keyboard target left the app unable to compile.
//
//  Each target carries its own copy of the .ttf, because `Bundle.main` inside an
//  app extension is the extension's bundle, not the containing app's.
//

import UIKit

enum Fonts {

    /// Registering can fail — the font may be missing from a target's
    /// resources — in which case the system Khmer face is a fine fallback.
    private static let registered: Bool = {
        guard let url = Bundle.main.url(forResource: "Siemreap-Regular", withExtension: "ttf") else {
            return false
        }
        return CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    }()

    static func khmer(size: CGFloat) -> UIFont {
        _ = registered
        return UIFont(name: "Siemreap", size: size) ?? .systemFont(ofSize: size)
    }
}
