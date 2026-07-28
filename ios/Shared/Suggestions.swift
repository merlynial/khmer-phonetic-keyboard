//
//  The word suggestions that make this keyboard worth using: you spell a word
//  roughly as it sounds and the right Khmer comes back, the way a Pinyin IME
//  works.
//
//  Two lexicons, searched in tiers, ported from dict.js:
//
//    curated.tsv  ~440 common words, each listed under every romanization the
//                 web app's reverse-transliterator derives for it. Those keys
//                 are precomputed by tools/build_android.mjs, so the
//                 transliterator itself never had to be ported and its output
//                 cannot come out different from the browser's.
//    words.txt    62,000 words from the Google Khmer pronunciation lexicon,
//                 stored as coarse sound-class skeletons and ordered by corpus
//                 frequency, so line number is rank.
//
//  Tiers, lowest wins: personal(-1), curated exact(0), curated prefix(1),
//  curated vowel-skeleton(2, 3), lexicon skeleton exact(4), prefix(5).
//
//  Lookups binary-search sorted indices rather than scanning. A keyboard
//  extension gets a fraction of a normal app's CPU and memory, and scanning
//  77,000 entries per keystroke on the main thread both delays the word bar and
//  makes the keyboard miss taps.
//

import Foundation

struct Candidate: Equatable {
    let khmer: String
    let gloss: String

    init(_ khmer: String, gloss: String = "") {
        self.khmer = khmer
        self.gloss = gloss
    }
}

/// What the user has picked before, so their words float up.
protocol Learning {
    func uses(_ khmer: String) -> Int
    var personal: [String: String] { get }
}

struct NoLearning: Learning {
    func uses(_ khmer: String) -> Int { 0 }
    var personal: [String: String] { [:] }
}

final class Suggestions {

    private struct Curated {
        let key: String
        let vskel: String
        let khmer: String
        let gloss: String
    }

    private var curated: [Curated] = []
    private var lexKhmer: [String] = []
    private var lexSkel: [String] = []

    private var curatedByKey: [Int] = []
    private var curatedByVskel: [Int] = []
    private var lexBySkel: [Int] = []

    private let learned: Learning

    var lexiconSize: Int { lexKhmer.count }

    init(curatedTSV: String, lexiconTSV: String, learned: Learning = NoLearning()) {
        self.learned = learned

        curated.reserveCapacity(16_000)
        for line in curatedTSV.split(separator: "\n", omittingEmptySubsequences: true) {
            if line.hasPrefix("#") { continue }
            let parts = line.split(separator: "\t", omittingEmptySubsequences: false)
            if parts.count >= 3 {
                curated.append(
                    Curated(
                        key: String(parts[0]),
                        vskel: String(parts[1]),
                        khmer: String(parts[2]),
                        gloss: parts.count > 3 ? String(parts[3]) : ""
                    )
                )
            }
        }

        lexKhmer.reserveCapacity(62_000)
        lexSkel.reserveCapacity(62_000)
        for line in lexiconTSV.split(separator: "\n", omittingEmptySubsequences: true) {
            if line.hasPrefix("#") { continue }
            guard let tab = line.firstIndex(of: "\t") else { continue }
            lexKhmer.append(String(line[line.startIndex..<tab]))
            lexSkel.append(String(line[line.index(after: tab)...]).trimmingCharacters(in: .whitespaces))
        }

        curatedByKey = Self.sortedIndices(curated.count) { self.curated[$0].key }
        curatedByVskel = Self.sortedIndices(curated.count) { self.curated[$0].vskel }
        lexBySkel = Self.sortedIndices(lexSkel.count) { self.lexSkel[$0] }
    }

    private static func sortedIndices(_ count: Int, _ key: (Int) -> String) -> [Int] {
        Array(0..<count).sorted { key($0) < key($1) }
    }

    /// First position in `order` whose string is >= `target`.
    private func lowerBound(_ order: [Int], _ target: String, _ key: (Int) -> String) -> Int {
        var lo = 0
        var hi = order.count
        while lo < hi {
            let mid = (lo + hi) / 2
            if key(order[mid]) < target { lo = mid + 1 } else { hi = mid }
        }
        return lo
    }

    /// Visit every row whose string starts with `prefix`. `visit` returns false to stop.
    private func forEachWithPrefix(
        _ order: [Int],
        _ prefix: String,
        _ key: (Int) -> String,
        _ visit: (Int, String) -> Bool
    ) {
        var i = lowerBound(order, prefix, key)
        while i < order.count {
            let row = order[i]
            let value = key(row)
            if !value.hasPrefix(prefix) { return }
            if !visit(row, value) { return }
            i += 1
        }
    }

    private struct Hit {
        var tier: Int
        var sub: Int
        var gloss: String
    }

    func suggest(_ rawQuery: String, limit: Int = 8) -> [Candidate] {
        var q = rawQuery.lowercased().trimmingCharacters(in: .whitespaces)
        if q.isEmpty { return [] }
        // Bound the work: a long paste should never hang the keyboard.
        if q.count > Self.maxToken { q = String(q.suffix(Self.maxToken)) }

        var hits: [String: Hit] = [:]
        func add(_ khmer: String, _ tier: Int, _ sub: Int, _ gloss: String = "") {
            if var existing = hits[khmer] {
                if tier < existing.tier || (tier == existing.tier && sub < existing.sub) {
                    existing.tier = tier
                    existing.sub = sub
                }
                if existing.gloss.isEmpty && !gloss.isEmpty { existing.gloss = gloss }
                hits[khmer] = existing
            } else {
                hits[khmer] = Hit(tier: tier, sub: sub, gloss: gloss)
            }
        }

        for (spelling, khmer) in learned.personal {
            if spelling == q {
                add(khmer, -1, 0, Self.glossYours)
            } else if spelling.hasPrefix(q) {
                add(khmer, -1, spelling.count - q.count, Self.glossYours)
            }
        }

        let qv = Self.vskel(q)
        let fuzzyOK = q.count >= 3

        // Spelled exactly, or the query is the start of a longer spelling.
        forEachWithPrefix(curatedByKey, q, { self.curated[$0].key }) { row, key in
            let c = self.curated[row]
            if key == q { add(c.khmer, 0, 0, c.gloss) }
            else { add(c.khmer, 1, key.count - q.count, c.gloss) }
            return true
        }

        // Same consonants, vowels written differently.
        if fuzzyOK {
            forEachWithPrefix(curatedByVskel, qv, { self.curated[$0].vskel }) { row, skel in
                let c = self.curated[row]
                if skel == qv { add(c.khmer, 2, 0, c.gloss) }
                else { add(c.khmer, 3, skel.count - qv.count, c.gloss) }
                return true
            }
        }

        // The 62k lexicon, matched on how the word sounds rather than how it is
        // spelled. `sub` keeps corpus rank as the tie-break, so common words win.
        if fuzzyOK && !lexKhmer.isEmpty {
            let qk = Self.qskel(q)
            if qk.count >= 2 {
                var visited = 0
                forEachWithPrefix(lexBySkel, qk, { self.lexSkel[$0] }) { row, skel in
                    if skel == qk { add(self.lexKhmer[row], 4, row) }
                    else { add(self.lexKhmer[row], 5, (skel.count - qk.count) * 100_000 + row) }
                    visited += 1
                    return visited < Self.maxLexiconVisits
                }
            }
        }

        return hits
            .map { khmer, hit -> (String, Hit, Int) in
                let uses = learned.uses(khmer)
                let boost = uses >= 4 ? 2 : (uses >= 1 ? 1 : 0)
                return (khmer, hit, (hit.tier - boost) * 1_000_000_000 + hit.sub - uses)
            }
            .sorted { $0.2 < $1.2 }
            .prefix(limit)
            .map { Candidate($0.0, gloss: $0.1.gloss) }
    }

    // MARK: - Sound skeletons

    private static let maxToken = 32
    /// A guard against a short skeleton matching half the lexicon. Ranking still
    /// runs over everything visited, so raising this costs time, never quality.
    private static let maxLexiconVisits = 4000
    private static let glossYours = "yours"

    /// Collapse vowel runs, so "sousdey" and "suosdei" key alike.
    static func vskel(_ s: String) -> String {
        var out = ""
        var inRun = false
        for ch in s {
            if "aeiouy".contains(ch) {
                if !inRun { out.append("8"); inRun = true }
            } else {
                out.append(ch)
                inRun = false
            }
        }
        return out
    }

    private static let digraphs: [String: String] = [
        "chh": "C", "ch": "C", "kh": "K", "gh": "K", "th": "T",
        "dh": "T", "dd": "T", "ph": "P", "bh": "P", "ng": "G",
        "nh": "J", "ny": "J", "gn": "J",
    ]
    private static let singles: [Character: String] = [
        "k": "K", "g": "K", "c": "C", "j": "C", "t": "T", "d": "T",
        "b": "P", "p": "P", "f": "P", "s": "S", "h": "H", "m": "M",
        "n": "N", "l": "L", "x": "S", "z": "S",
    ]

    private static func isVowel(_ c: Character?) -> Bool {
        guard let c else { return false }
        return "aeiou".contains(c)
    }

    /// The same coarse sound-class skeleton the lexicon was built with:
    /// consonant classes plus V for any vowel run, repeats collapsed. This is
    /// what lets a sloppy spelling still land on the right word.
    static func qskel(_ query: String) -> String {
        let q = Array(query.lowercased().filter { $0.isASCII && $0.isLetter })
        var out: [String] = []
        func push(_ c: String) {
            if !c.isEmpty && out.last != c { out.append(c) }
        }

        var i = 0
        while i < q.count {
            let ch = q[i]
            let next: Character? = i + 1 < q.count ? q[i + 1] : nil
            let prev: Character? = i > 0 ? q[i - 1] : nil

            if i + 3 <= q.count, let cls = digraphs[String(q[i..<(i + 3)])] {
                push(cls); i += 3; continue
            }
            if i + 2 <= q.count, let cls = digraphs[String(q[i..<(i + 2)])] {
                push(cls); i += 2; continue
            }
            if isVowel(ch) { push("V"); i += 1; continue }

            if ch == "w" || ch == "v" || ch == "y" {
                // An onset is a consonant; a coda merges into the vowel.
                push(isVowel(next) ? (ch == "y" ? "Y" : "W") : "V")
                i += 1
                continue
            }
            if ch == "r" {
                // Khmer r is only pronounced before a vowel.
                if isVowel(next) { push("R") }
                i += 1
                continue
            }
            if ch == "s", isVowel(prev), !isVowel(next) {
                push("H")  // coda s sounds like h: monus = monuh
                i += 1
                continue
            }
            if ch == "q" { i += 1; continue }  // glottal stop, usually not typed

            push(singles[ch] ?? "")
            i += 1
        }
        return out.joined()
    }
}
