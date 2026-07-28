//
//  Remembers the words you pick, so they rise to the top next time, and the
//  spellings you invent, so your own romanizations start working.
//
//  Stored in the extension's own UserDefaults, not an App Group. That is
//  deliberate: an App Group needs an entitlement a free Apple account cannot
//  issue, and reading one would require the user to grant "Allow Full Access".
//  The cost is that the container app cannot see what the keyboard learned.
//

import Foundation

final class UserDefaultsLearning: Learning {

    private let defaults = UserDefaults.standard
    private var usesByWord: [String: Int]
    private var personalSpellings: [String: String]

    init() {
        usesByWord = defaults.dictionary(forKey: Keys.uses) as? [String: Int] ?? [:]
        personalSpellings = defaults.dictionary(forKey: Keys.personal) as? [String: String] ?? [:]
    }

    func uses(_ khmer: String) -> Int { usesByWord[khmer] ?? 0 }

    var personal: [String: String] { personalSpellings }

    /// Called when a suggestion is accepted for a given romanization.
    func record(khmer: String, spelling: String) {
        usesByWord[khmer, default: 0] += 1

        let cleaned = spelling.lowercased().trimmingCharacters(in: .whitespaces)
        if !cleaned.isEmpty, cleaned.count <= maxSpelling, personalSpellings.count < maxEntries {
            personalSpellings[cleaned] = khmer
        }
        defaults.set(usesByWord, forKey: Keys.uses)
        defaults.set(personalSpellings, forKey: Keys.personal)
    }

    func reset() {
        usesByWord = [:]
        personalSpellings = [:]
        defaults.removeObject(forKey: Keys.uses)
        defaults.removeObject(forKey: Keys.personal)
    }

    private let maxSpelling = 60
    private let maxEntries = 20_000

    private enum Keys {
        static let uses = "khmerPhonetic.uses"
        static let personal = "khmerPhonetic.personal"
    }
}
