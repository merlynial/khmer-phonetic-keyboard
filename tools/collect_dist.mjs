/* Copy the built Keyman packages to dist/.
 *
 * dist/ is committed. GitHub Pages serves this repository, so a committed .kmp
 * is a working download link the moment it is pushed — no release step, no
 * build tooling on the phone that is about to install it.
 */
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./scheme.mjs";

const PACKAGES = [
  ["keyman/khmer_phonetic/build/khmer_phonetic.kmp", "khmer_phonetic.kmp"],
  [
    "keyman/pakrinha.km.khmerphonetic/build/pakrinha.km.khmerphonetic.model.kmp",
    "pakrinha.km.khmerphonetic.model.kmp",
  ],
];

const dist = join(REPO, "dist");
mkdirSync(dist, { recursive: true });

for (const [from, to] of PACKAGES) {
  const src = join(REPO, from);
  const dest = join(dist, to);
  copyFileSync(src, dest);
  const kb = (statSync(dest).size / 1024).toFixed(0);
  console.log(`dist/${to}  (${kb} KB)`);
}
