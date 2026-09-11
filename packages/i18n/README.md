# @eraya/i18n

Eraya's words, in six languages, shared by the website and the app.

| Locale | Name | Script |
| --- | --- | --- |
| `en` | English | Latin |
| `hi` | हिन्दी | Devanagari |
| `bn` | বাংলা | Bengali |
| `mr` | मराठी | Devanagari |
| `te` | తెలుగు | Telugu |
| `ta` | தமிழ் | Tamil |

Default: `en`. Fallback: `en`.

## Interface language, not spoken languages

These are the languages **Eraya speaks to a member in**. They are not the
"languages I speak" on a profile, which is discovery data used to introduce
people who can actually talk to each other, and which includes languages this
interface has never been translated into.

Changing the interface to Bengali changes nothing another member sees and
nothing about who anyone is introduced to. The two live in different places on
purpose: `profiles.ui_locale` for this, `profile_languages` for that.

## Adding or changing a string

Add it to `src/locales/en.ts` first. Every other locale is annotated
`Translations`, which is `typeof en`, so the moment English has a key the other
five fail to compile until they have it too — a missing translation is a build
error, not something a member discovers.

Then run:

```
npm run i18n:check
```

which reports every difference at once (`tsc` stops at the first), plus the
things types cannot see: an empty value, a value left in English, or a
`{placeholder}` that was translated along with the sentence and no longer
matches what the code passes in. That last one is silent at runtime — the brace
simply survives into the sentence somebody reads.

## Using it

```ts
t("account.language.title")
t("onboarding.complete.titleNamed", { name })
```

Keys are typed as a union of the dotted paths in English, so a typo does not
compile and renaming a key breaks every call site at once rather than quietly
rendering nothing.

**Web.** `getT()` in a server component, `useT()` in a client one. The locale is
resolved on the server before anything renders — profile, then cookie, then
`Accept-Language`, then English — so there is no flash of English for somebody
who does not read it.

**Mobile.** `useT()` from `features/i18n/LocaleProvider`. The locale is state,
so changing it re-renders the screens already on the stack.

## Tone

Warm, calm, grown-up. Eraya's members are adults beginning again after a
divorce, a separation or a death, and often over 40. That rules out the clipped
slang of dating apps at one end and the heavy official register at the other:
"आप", "আপনি", "तुम्ही", "మీరు", "நீங்கள்", short sentences, ordinary words.

English is not transliterated unless the term is genuinely a product or brand
name. **"Eraya" stays "Eraya" in every language** — transliterating it would
make Eraya look like a different product in each one.

## Fonts

Manrope is Eraya's typeface and covers Latin only. It has no Devanagari,
Bengali, Telugu or Tamil glyphs.

Nothing is bought or bundled. Every platform Eraya runs on already ships fonts
for all four scripts — Nirmala UI on Windows, the Sangam family on Apple
platforms, Noto on Android and most Linux — so `FONT_STACKS` puts Manrope first
and the system families behind it. A browser falls back glyph by glyph, which
means "Eraya", an email address or a price inside a Hindi sentence is still set
in Eraya's own typeface and only the Indic glyphs come from the system.

React Native does not do that. It draws missing glyphs as empty boxes rather
than falling back within a named family, so `apps/mobile/src/ui/Text.tsx` drops
the Manrope family for non-Latin scripts and asks for the weight directly.

## What is not here yet

The marketing site and the membership panel are still English, in
`features/marketing/content.ts` and `features/account/content.ts`. Both describe
things deliberately out of scope for the localization pass — the public landing
page and pricing — and both are the last of the old content modules. When they
are translated, those files go and there is one place words live.
