/* Generate the iOS app's engine data from the web app.
 *
 * Same contract as tools/build_android.mjs: index.html and dict.js are the
 * source of truth, and anything Swift needs is generated rather than retyped.
 *
 *   PhoneticScheme.swift  the romanization maps, as Swift
 *   Resources/            curated.tsv, words.txt and the Khmer font, copied into
 *                         the keyboard extension's own bundle
 *
 * The extension reads its lexicon from its own bundle rather than a shared App
 * Group container, so the keyboard works without "Allow Full Access" and
 * without an entitlement that a free Apple account cannot issue.
 */
import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadScheme, REPO } from "./scheme.mjs";
import { buildWordlist } from "./build_wordlist.mjs";

const IOS = join(REPO, "ios");
const SHARED = join(IOS, "Shared");
const RESOURCES = join(IOS, "Resources");

const sq = (s) => JSON.stringify(s); // Swift and JSON agree on these escapes

function schemeSwift(scheme) {
  const { CONS, INDEP, VOW, SIGN, COENG, KEYS } = scheme;
  const entries = (obj) =>
    Object.entries(obj)
      .filter(([k]) => k !== " ")
      .map(([k, v]) => `        ${sq(k)}: ${sq(v)},`)
      .join("\n");

  return `//
//  GENERATED FILE - do not edit by hand.
//    regenerate with:  npm run build:ios
//    source of truth:  the romanization maps in index.html
//
//  Lifted verbatim from the web app so the phone types what the browser types.
//  PhoneticEngine is the port of the loop that walks these; EngineTests checks
//  the two against each other.
//

import Foundation

enum PhoneticScheme {

    static let coeng = ${sq(COENG)}

    /// Consonants. These are the tokens that stack with coeng when adjacent.
    static let cons: [String: String] = [
${entries(CONS)}
    ]

    /// Independent vowels, all typed with a leading apostrophe.
    static let indep: [String: String] = [
${entries(INDEP)}
    ]

    /// Dependent vowels. "a" is the inherent vowel and emits nothing.
    static let vow: [String: String] = [
${entries(VOW)}
    ]

    /// Signs and punctuation.
    static let sign: [String: String] = [
${entries(SIGN)}
    ]

    static let map: [String: String] = cons.merging(indep) { a, _ in a }
        .merging(vow) { a, _ in a }
        .merging(sign) { a, _ in a }

    /// Which tokens are consonants, for the auto-stacking decision.
    static let isCons: Set<String> = Set(cons.keys)

    /// Longest first: the tokenizer is greedy.
    static let keys: [String] = [
${KEYS.map((k) => `        ${sq(k)},`).join("\n")}
    ]

    static let khmerDigits: [Character: Character] = [
${"0123456789".split("").map((d, i) => `        "${d}": "${"០១២៣៤៥៦៧៨៩"[i]}",`).join("\n")}
    ]
}
`;
}

mkdirSync(SHARED, { recursive: true });
mkdirSync(RESOURCES, { recursive: true });

const scheme = loadScheme();
writeFileSync(join(SHARED, "PhoneticScheme.swift"), schemeSwift(scheme), "utf8");
console.log(`wrote Shared/PhoneticScheme.swift  (${scheme.KEYS.length} keys)`);

// The curated index and the lexicon are identical to the Android build's, so
// reuse those files rather than regenerating and risking a difference.
const androidAssets = join(REPO, "android", "app", "src", "main", "assets");
for (const f of ["curated.tsv", "words.txt", "Siemreap-Regular.ttf"]) {
  copyFileSync(join(androidAssets, f), join(RESOURCES, f));
  console.log(`copied Resources/${f}`);
}

// A keyboard extension is memory-capped far below a normal app, so record how
// big the lexicon actually is; if this grows the extension will start being
// killed on older devices.
const words = buildWordlist(Number.MAX_SAFE_INTEGER);
console.log(`lexicon: ${words.length.toLocaleString()} words`);
