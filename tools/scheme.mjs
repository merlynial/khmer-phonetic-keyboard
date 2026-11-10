/* Single source of truth for the romanization scheme.
 *
 * The scheme lives in engine.js, the plain script the web pages load (the
 * keyboard in app.html, the demo on the home page and the typing guide).
 * Rather than keep a second copy here (which would drift), this module
 * evaluates that same file, so the Keyman keyboard and the Android and iOS
 * schemes are generated from the exact maps and the exact convert() that the
 * web app runs.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, "..");

const START = "const COENG";

export function loadScheme(enginePath = join(REPO, "engine.js")) {
  const file = readFileSync(enginePath, "utf8");
  const a = file.indexOf(START);
  if (a < 0 || !file.includes("function convert(")) {
    throw new Error("could not locate the engine in " + enginePath +
      " — engine.js must define the maps (from `const COENG`) and convert()");
  }
  const src = file.slice(a);
  const exportNames = "COENG,CONS,INDEP,VOW,SIGN,DIGITS,MAP,IS_CONS,KEYS,convert";
  // eslint-disable-next-line no-new-func
  const engine = new Function(`${src}\nreturn {${exportNames}};`)();

  // The engine skips " " when matching (spaces pass through); drop it here too
  // so consumers never see a key that convert() would not honour.
  const keys = engine.KEYS.filter((k) => k !== " ");
  return { ...engine, KEYS: keys };
}
