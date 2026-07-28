# Khmer Phonetic for iPhone and iPad

A native keyboard extension. Same romanization, same 62,000-word lexicon, and
the same sound matching as the web app and the Android app — `sousdey` still
finds សួស្តី.

## Installing it — no Mac, no Xcode

CI builds an **unsigned `.ipa`** on every push, on GitHub's macOS runners.
Signing happens on your device with your own Apple ID, so nothing here needs an
Apple account, a paid membership, or a secret in this repo.

1. Grab `KhmerPhonetic.ipa` from the latest green run of the
   [ios app workflow](../../../actions/workflows/ios.yml), or from a release.
2. Install [SideStore](https://sidestore.io) on the iPhone.
3. Open the `.ipa` in SideStore. It signs with your Apple ID and installs.
4. Settings → General → Keyboard → Keyboards → Add New Keyboard → Khmer
   Phonetic. Hold the globe key in any app to switch to it.

**The seven-day expiry still applies**, and there is no way around it here:
Apple's alternative app marketplaces, where apps install permanently, are
restricted to the EU, Japan and Brazil. Outside those, a free Apple ID signs for
seven days.

What SideStore changes is who does the work. It re-signs **on the device over
Wi-Fi**, so the renewal is a background refresh rather than a weekly session at a
Mac. A paid Apple Developer account ($99/yr) extends signing to a year and is the
only way to put this on anyone else's phone.

The app plus its keyboard extension consume 2 of the 10 App IDs a free Apple
account gets, so there is room to spare.

## Building it locally instead

Only needed if you want to change it. Requires Xcode.

```bash
npm run build:ios          # regenerate PhoneticScheme.swift and the lexicons
brew install xcodegen
cd ios && xcodegen generate
open KhmerPhonetic.xcodeproj
```

Select the **KhmerPhonetic** scheme, pick your iPhone, set your team under
Signing & Capabilities on **both** targets, and Run.

## What is verified, and what is not

**The engine.** `npm run ios:verify` compiles it with the Command Line Tools'
Swift compiler and replays **29,142 conversions** the web engine produced, plus
the suggestion checks — `suastei`, `suosdei`, `sousdey` and `sousdei` must all
reach សួស្តី. It runs on macOS with no Xcode, and CI runs it too.

**That it compiles and packages.** CI builds the whole thing against the iOS SDK
and then asserts the two ways a green build can still be useless: a missing
keyboard extension, and an extension shipped without its lexicon. The second
assertion earned its keep immediately — XcodeGen accepts a `resources:` target
key and silently ignores it, so the first working build produced a keyboard with
no dictionary.

**Not verified: that it behaves.** Nothing has been run on a device or a
simulator. Layout, touch handling, the delete-and-reinsert conversion, and how it
interacts with real apps are all unexercised. Compiling is not working.

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
