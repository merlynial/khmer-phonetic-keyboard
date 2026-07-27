/* Generate the Keyman lexical model wordlist from words.txt.
 *
 * words.txt is "khmer<TAB>sound skeleton", ordered by frequency — the ranking
 * that tools/build_words.py produces from the Khmer Wikipedia dump blended with
 * CC-100. Keyman wants "word<TAB>count", so the rank is turned back into a
 * weight with a Zipf curve, which is the distribution word frequencies actually
 * follow and preserves the ordering the ranking earned.
 *
 * Only the ranked head of words.txt is used. The tail is the rare half of the
 * Google lexicon, where a made-up weight would be a lie and the words are
 * unlikely to help a prediction bar.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./scheme.mjs";

const TOP = 20000;
const ZIPF_C = 1_000_000;

export function buildWordlist(limit = TOP) {
  const lines = readFileSync(join(REPO, "words.txt"), "utf8").split("\n");
  const rows = [];
  for (const line of lines) {
    if (!line.trim() || line.startsWith("#")) continue;
    const word = line.split("\t")[0].trim();
    // Skip punctuation-only entries: the model predicts words, and Keyman
    // inserts punctuation from the keyboard, not the suggestion bar.
    if (!word || !/[ក-ឳ]/.test(word)) continue;
    rows.push(word);
    if (rows.length >= limit) break;
  }
  return rows.map((word, i) => ({ word, count: Math.max(1, Math.round(ZIPF_C / (i + 1))) }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = buildWordlist();
  const out = [
    "# Khmer frequency wordlist for the Keyman lexical model.",
    "# GENERATED — regenerate with: npm run build:wordlist",
    "# Source: ../../words.txt (Google Khmer pronunciation lexicon, CC-BY-4.0,",
    "# ranked against the Khmer Wikipedia dump blended with CC-100 km).",
    "# Columns: word<TAB>frequency weight (Zipf curve over the frequency rank).",
    ...rows.map((r) => `${r.word}\t${r.count}`),
  ].join("\n") + "\n";

  const path = join(REPO, "keyman", "pakrinha.km.khmerphonetic", "source", "wordlist.tsv");
  writeFileSync(path, out, "utf8");
  console.log(`wrote ${path}\n  ${rows.length.toLocaleString()} words, weights ${rows[0].count} … ${rows[rows.length - 1].count}`);
}
