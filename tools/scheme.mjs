/* Single source of truth for the romanization scheme.
 *
 * The scheme lives in index.html because that file is the shipping web app.
 * Rather than keep a second copy here (which would drift), this module lifts
 * the engine section straight out of index.html and evaluates it, so the
 * Keyman keyboard is generated from the exact maps and the exact convert()
 * that the PWA runs.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, "..");

const START = "const COENG";
const END = "/* =========================== UI WIRING";

export function loadScheme(htmlPath = join(REPO, "index.html")) {
  const html = readFileSync(htmlPath, "utf8");
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a < 0 || b < 0 || b < a) {
    throw new Error("could not locate the engine section in " + htmlPath +
      " — did the START/END markers in tools/scheme.mjs go stale?");
  }
  const src = html.slice(a, b);
  const exportNames = "COENG,CONS,INDEP,VOW,SIGN,DIGITS,MAP,IS_CONS,KEYS,convert";
  // eslint-disable-next-line no-new-func
  const engine = new Function(`${src}\nreturn {${exportNames}};`)();

  // The engine skips " " when matching (spaces pass through); drop it here too
  // so consumers never see a key that convert() would not honour.
  const keys = engine.KEYS.filter((k) => k !== " ");
  return { ...engine, KEYS: keys };
}
