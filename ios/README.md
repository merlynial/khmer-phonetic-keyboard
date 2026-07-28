# Khmer Phonetic for iPhone and iPad

A native keyboard extension. Same romanization, same 62,000-word lexicon, and
the same sound matching as the web app and the Android app — `sousdey` still
finds សួស្តី.

**You have to build this yourself.** I could not, and neither can anyone without
a Mac running Xcode: Apple has no route for handing someone an iOS keyboard as a
file. What follows is everything needed to get it onto your own phone.

## What you need

| | |
| --- | --- |
| **Xcode** | Free, from the Mac App Store, ~15 GB. Not installed on this machine. |
| **An Apple ID** | A free one works. See the signing note below. |
| **XcodeGen** | `brew install xcodegen` — generates the `.xcodeproj` |

## Build it

```bash
npm run build:ios          # regenerate PhoneticScheme.swift and the lexicons
cd ios && xcodegen generate
open KhmerPhonetic.xcodeproj
```

In Xcode: select the **KhmerPhonetic** scheme, pick your iPhone as the
destination, set your team under Signing & Capabilities on **both** targets
(app and keyboard), and press Run.

Then on the phone: Settings → General → Keyboard → Keyboards → Add New
Keyboard → Khmer Phonetic. Hold the globe key in any app to switch to it.

## Signing, and the seven-day problem

- **Free Apple ID.** Works, but the app stops launching after **7 days** and has
  to be rebuilt and reinstalled from Xcode. Fine for trying it; wearing for
  daily use.
- **Apple Developer Program, $99/yr.** Signs for a year, and is the only way to
  put it on anyone else's phone or on the App Store.

There is no third option. Sideloading tools like AltStore still re-sign with a
free Apple ID and hit the same seven-day expiry.

## What is verified, and what is not

`npm run ios:verify` compiles the engine with the Command Line Tools' Swift
compiler and replays **29,142 conversions** the web engine produced, plus the
suggestion checks — `suastei`, `suosdei`, `sousdey` and `sousdei` must all reach
សួស្តី. It runs on macOS, so no Xcode is needed, and it passes.

What that does **not** cover is everything touching UIKit: the keys, the touch
handling, the layout, the suggestion strip. None of it has been compiled against
the iOS SDK or run on a device, because neither is available here. Expect to fix
something the first time it builds.

## Notes on the iOS design

**No composing text.** Android hands an IME `setComposingText`, an underlined
region it can rewrite as a word takes shape. iOS gives a custom keyboard only
`insertText` and `deleteBackward`. So `KeyboardViewController` remembers exactly
what it last inserted, deletes that many characters, and inserts the new
conversion. `lastOutput.count` counts grapheme clusters, which is the unit
`deleteBackward()` removes, so a Khmer cluster like ខ្ញុំ deletes as one piece.
If another keyboard or the cursor edits the field underneath us, `textDidChange`
drops the record rather than deleting someone else's text.

**No full access.** `RequestsOpenAccess` is `false`. The lexicons live in the
extension's own bundle rather than an App Group — an App Group needs an
entitlement a free Apple account cannot issue, and reading one would force the
user through Apple's alarming "Allow Full Access" prompt. The cost is that the
container app cannot see what the keyboard has learned.

**Feedback.** `UIImpactFeedbackGenerator` is ignored in a keyboard extension
without full access, so key feedback goes through `playInputClick()`, which needs
no entitlement and respects the user's own keyboard-click setting.

**Memory.** Keyboard extensions are killed well below an app's memory limit. The
lexicon is ~62,000 words held as two string arrays plus sorted index arrays. It
should fit, but it is the first thing to shrink if the keyboard starts dying on
older devices.

## Not done

- Phrase mode and next-word prediction, as on Android.
- A long-press popup — holding a key types its alternate directly, so only one
  alternate per key is reachable.
- Landscape tuning, iPad-specific layout, and dark/light adaptation: the
  keyboard is dark in both.
