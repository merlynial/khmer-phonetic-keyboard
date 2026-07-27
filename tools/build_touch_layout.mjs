/* Generate keyman/khmer_phonetic.keyman-touch-layout — the on-screen keyboard
 * Keyman draws on Android and iOS.
 *
 * It mirrors the PWA's on-screen QWERTY: same three letter rows, same ?123
 * layer of scheme signs and Khmer punctuation. Two differences the touch layout
 * format lets us make, and the PWA cannot:
 *
 *   - the little Khmer hint under each letter becomes a Keyman `hint`, and it is
 *     derived from the scheme maps rather than a hand-kept table, so it cannot
 *     go stale
 *   - the case-sensitive letters (d/D, n/N, l/L, t/T, m/M, h/H) get longpress
 *     subkeys, because reaching for Shift mid-word on a phone is miserable
 *
 * ASCII scheme characters are emitted as real virtual keys with an explicit
 * modifier layer rather than U_xxxx codepoints, so they go through the rule
 * engine on every platform.
 */

/** The Khmer glyph to show as a hint on a Latin letter key. */
function hintFor(ch, scheme) {
  const { MAP, KEYS } = scheme;
  if (MAP[ch]) return MAP[ch] || null;
  // no single-letter key (c, for instance): fall back to the shortest key that
  // starts with this letter, which is the token the user is reaching for
  const cands = KEYS.filter((k) => k.startsWith(ch) && /^[a-z]/.test(k)).sort((a, b) => a.length - b.length);
  return cands.length ? MAP[cands[0]] || null : null;
}

const LETTERS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  "zxcvbnm".split(""),
];

/** Letters whose capital is a distinct Khmer consonant or sign in the scheme. */
const CAPS = { d: "D", n: "N", l: "L", t: "T", m: "M", h: "H" };

const VK = {
  "'": { id: "K_QUOTE" },
  "*": { id: "K_8", layer: "shift" },
  "`": { id: "K_BKQUOTE" },
  "^": { id: "K_6", layer: "shift" },
  "~": { id: "K_BKQUOTE", layer: "shift" },
  ".": { id: "K_PERIOD" },
  "/": { id: "K_SLASH" },
  ":": { id: "K_COLON", layer: "shift" },
  "<": { id: "K_COMMA", layer: "shift" },
  ">": { id: "K_PERIOD", layer: "shift" },
  "!": { id: "K_1", layer: "shift" },
  "?": { id: "K_SLASH", layer: "shift" },
  ",": { id: "K_COMMA" },
  "-": { id: "K_HYPHEN" },
};

const U = (ch) => "U_" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
const KH_DIGITS = "០១២៣៤៥៦៧៨៩";

function signKey(ch, scheme, width) {
  const vk = VK[ch];
  const k = vk ? { id: vk.id, text: ch } : { id: U(ch), text: ch };
  if (vk?.layer) k.layer = vk.layer;
  const hint = scheme.MAP[ch];
  if (hint) k.hint = hint;
  if (width) k.width = String(width);
  return k;
}

export function buildTouchLayout(scheme, { font = "Siemreap" } = {}) {
  const letterRows = (upper) =>
    LETTERS.map((row, i) => {
      const keys = row.map((ch) => {
        const c = upper ? ch.toUpperCase() : ch;
        const k = { id: "K_" + ch.toUpperCase(), text: c };
        const hint = hintFor(c, scheme);
        if (hint) k.hint = hint;
        if (!upper && CAPS[ch]) {
          // longpress reaches the capital without leaving the letter row
          k.sk = [{ id: "K_" + ch.toUpperCase(), text: CAPS[ch], layer: "shift" }];
        }
        return k;
      });
      if (i === 1) keys[0].pad = "50"; // centre the nine-key home row
      if (i === 2) {
        keys.unshift({
          id: "K_SHIFT",
          text: "*Shift*",
          width: "150",
          sp: upper ? "2" : "1",
          nextlayer: upper ? "default" : "shift",
        });
        keys.push({ id: "K_BKSP", text: "*BkSp*", width: "150", sp: "1" });
      }
      return { id: i + 1, key: keys };
    });

  // K_LOPT is the globe key: Keyman requires it on every layer, and it is how
  // the user switches back to their other keyboards from inside Keyman.
  const globe = { id: "K_LOPT", text: "*Menu*", width: "110", sp: "1" };

  const bottomRow = (id) => ({
    id,
    key: [
      { id: "K_NUMLOCK", text: "?123", width: "150", sp: "1", nextlayer: "numeric" },
      globe,
      signKey("'", scheme, 100),
      { id: "K_SPACE", text: "", width: "380" },
      signKey(".", scheme, 100),
      { id: "K_ENTER", text: "*Enter*", width: "150", sp: "1" },
    ],
  });

  const numericLayer = {
    id: "numeric",
    row: [
      {
        id: 1,
        key: "1234567890".split("").map((d, i) => ({
          id: "K_" + d,
          text: d,
          hint: KH_DIGITS[i],
          sk: [{ id: U(KH_DIGITS[i]), text: KH_DIGITS[i] }],
        })),
      },
      { id: 2, key: ["'", "*", "`", "^", "~", "។", "៕", "ៗ"].map((c) => signKey(c, scheme)) },
      {
        id: 3,
        key: [
          ...["៖", "«", "»", "!", "?", ",", "-"].map((c) => signKey(c, scheme)),
          { id: "K_BKSP", text: "*BkSp*", width: "150", sp: "1" },
        ],
      },
      {
        id: 4,
        key: [
          { id: "K_NUMLOCK", text: "ABC", width: "150", sp: "1", nextlayer: "default" },
          globe,
          { id: "K_SPACE", text: "", width: "480" },
          signKey("។", scheme, 100),
          { id: "K_ENTER", text: "*Enter*", width: "150", sp: "1" },
        ],
      },
    ],
  };

  const platform = () => ({
    font,
    layer: [
      { id: "default", row: [...letterRows(false), bottomRow(4)] },
      { id: "shift", row: [...letterRows(true), bottomRow(4)] },
      numericLayer,
    ],
  });

  return { phone: platform(), tablet: platform() };
}
