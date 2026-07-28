//
//  Proves the Swift engine types what the web app types, without needing Xcode.
//
//  The Xcode Command Line Tools ship a macOS Swift compiler but no iOS SDK, so
//  the app itself cannot be built here. The engine is pure Foundation, though,
//  so it compiles and runs on macOS — which means the part that actually decides
//  what Khmer appears can be verified now rather than taken on trust.
//
//  Run: npm run ios:verify
//

import Foundation

let repoRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()      // Tests
    .deletingLastPathComponent()      // ios
    .deletingLastPathComponent()      // repo

func load(_ relative: String) -> String {
    let url = repoRoot.appendingPathComponent(relative)
    guard let text = try? String(contentsOf: url, encoding: .utf8) else {
        FileHandle.standardError.write("missing \(relative) — run: npm run build:android\n".data(using: .utf8)!)
        exit(1)
    }
    return text
}

var failures = 0
func check(_ condition: Bool, _ message: @autoclosure () -> String) {
    if !condition {
        failures += 1
        if failures <= 10 { print("FAIL  \(message())") }
    }
}

// MARK: - conversion against the web engine

let golden = load("android/app/src/test/resources/golden.tsv")
var cases = 0
for line in golden.split(separator: "\n", omittingEmptySubsequences: true) {
    guard let tab = line.firstIndex(of: "\t") else { continue }
    let input = String(line[line.startIndex..<tab])
    let expected = String(line[line.index(after: tab)...])
    let actual = PhoneticEngine.convert(input)
    check(actual == expected, "\(input.debugDescription) -> \(actual.debugDescription), web says \(expected.debugDescription)")
    cases += 1
}
check(cases > 20_000, "golden.tsv looks short: \(cases) cases")
print("conversion: \(cases) cases from the web engine")

// MARK: - known spellings

check(PhoneticEngine.convert("suastei") == "សួស្តី", "suastei")
check(PhoneticEngine.convert("khnhom") == "ខ្ញុំ", "khnhom")
check(PhoneticEngine.convert("baadd") == "បាទ", "baadd")
check(PhoneticEngine.convert("ka.mpujaa") == "កម្ពុជា", "ka.mpujaa")
check(PhoneticEngine.convert("m*aong") == "ម៉ោង", "m*aong")
check(PhoneticEngine.convert("D") == "ឌ" && PhoneticEngine.convert("d") == "ដ", "capitals")
check(PhoneticEngine.convert("kk") == "ក្ក", "stacking")
check(PhoneticEngine.convert("k.k") == "កក", "syllable break")

// MARK: - suggestions against the shipped lexicons

let suggestions = Suggestions(
    curatedTSV: load("ios/Resources/curated.tsv"),
    lexiconTSV: load("ios/Resources/words.txt")
)
check(suggestions.lexiconSize > 50_000, "lexicon truncated: \(suggestions.lexiconSize)")

func top(_ q: String) -> [String] { suggestions.suggest(q).map(\.khmer) }

// The whole point of the fuzzy tier: people do not spell the canonical way.
for spelling in ["suastei", "suosdei", "sousdey", "sousdei"] {
    check(top(spelling).contains("សួស្តី"), "\(spelling) -> \(top(spelling))")
}
check(top("arkun").contains("អរគុណ"), "arkun -> \(top("arkun"))")
check(top("khnhom").first == "ខ្ញុំ", "khnhom -> \(top("khnhom"))")
check(top("kampuchea").contains("កម្ពុជា"), "kampuchea -> \(top("kampuchea"))")
check(top("srolanh").contains("ស្រឡាញ់"), "srolanh -> \(top("srolanh"))")
check(suggestions.suggest("").isEmpty, "empty query")

// The Swift skeletons must agree with the Kotlin and JS ones.
check(Suggestions.qskel("suosdei") == Suggestions.qskel("sousdey"), "qskel agreement")
check(Suggestions.vskel("ousdei") == "8sd8", "vskel: \(Suggestions.vskel("ousdei"))")

// MARK: - speed, because a keyboard extension has very little CPU

let queries = ["kh", "khn", "khnh", "khnho", "khnhom", "arkun", "sousdey"]
for _ in 0..<3 { for q in queries { _ = suggestions.suggest(q) } }
let started = Date()
let rounds = 20
for _ in 0..<rounds { for q in queries { _ = suggestions.suggest(q) } }
let perCall = Date().timeIntervalSince(started) * 1000 / Double(rounds * queries.count)
print(String(format: "suggest(): %.2f ms per call", perCall))
check(perCall < 40, String(format: "suggest() averaged %.1f ms, too slow for typing", perCall))

if failures > 0 {
    print("\nFAILED — \(failures) checks")
    exit(1)
}
print("ok — Swift engine matches the web engine")
