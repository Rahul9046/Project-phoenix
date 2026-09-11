# Build review workflow

A repeatable way to have the current build reviewed by a model, without
screenshots, screen recordings, or writing a covering note each time.

```bash
npm run review:package
```

Then upload the one file it names:

```
artifacts/eraya-review-package.md
```

That is the whole workflow. The file ends with the review brief, so it can be
dropped into a conversation with nothing else typed.

## What it produces

| Path | What it is | Tracked? |
| --- | --- | --- |
| `artifacts/eraya-review-package.md` | The package. Upload this | no |
| `artifacts/review/manifest.json` | Surface fingerprint, used to diff the next run | no |
| `artifacts/review/checks.json` | Machine-readable check results | no |

`artifacts/` is git-ignored. The package is regenerated, never committed — a
stale one in version control would eventually be mistaken for the current build,
which is the failure this workflow exists to prevent. The generator and this
document are tracked.

## Two speeds

```bash
npm run review:package        # includes typecheck, lint, and a production build
npm run review:package:fast   # skips those, ~2 seconds
```

The full run takes a few minutes because it actually runs the checks rather than
asserting they pass. Use `:fast` while iterating; use the full command for a
review that will inform a decision.

Neither touches the production database, and neither runs `npm run security` or
`npm run payments:probe` — those hit the live project, so they stay opt-in and
are reported as such in the package.

## How it stays honest

**Derived, not restated.** Prices come from the seed migration, routes from the
filesystem, permissions from `app.json`, design tokens from the stylesheet
Tailwind compiles, the free/premium matrix from the entitlements seed. A value
hardcoded in the generator is a value that goes stale silently, and a package
that confidently describes last month's product is worse than none.

**Judgement is labelled.** Sections that cannot be derived — what a screen is
for, why a flow is incomplete, the observations list — are marked
_hand-maintained_ and live in one `narrative` object in
`scripts/review-package.mjs`. When the product changes materially, that object
is what needs editing. Everything else follows on its own.

**Nothing leaves unsanitised.** Every line passes through
`scripts/review/sanitise.mjs`, which redacts anything shaped like a key, JWT,
private key, connection string, email address, phone number or identity number.
The finished document is then re-scanned, and the command exits non-zero if
anything credential-shaped survived. Environment variable **names** are kept
deliberately — they are architecture; their values are not.

## Change tracking

Each run writes a fingerprint of the product's surfaces: web routes, mobile
screens, Android permissions, analytics events, plans and prices, database
tables, edge functions, enabled auth providers.

The next run diffs against it and reports what is **NEW**, **REMOVED** and
unchanged, so a reviewer can focus on deltas rather than re-reading the whole
product. Timestamps and generated files are deliberately excluded from the
fingerprint — they would produce a diff on every run and train everyone to
ignore the section.

## Screenshots

Not generated, deliberately. No E2E or browser-automation tooling exists in this
repository, and adding a headless browser stack purely for screenshots would
introduce a dependency that breaks on its own schedule — the opposite of what a
workflow meant to run after every build needs.

Section C lists every route and screen with its file path instead, which is what
a reviewer actually needs to reason about coverage. For visual review, the
deployed product is the truth, and `npm run demo:seed` populates clearly
fictional members (`@demo.eraya.invalid`) so signed-in screens can be seen
without involving a real person.

If screenshots become genuinely necessary, add Playwright deliberately as its
own piece of work — not as a hidden dependency of this one.

## When to run it

After any build worth a second opinion: a new screen, a copy pass, a change to
payments, permissions, schema or onboarding. Not after every commit — the
package is a review artefact, not a build artefact.

## Files

```
scripts/review-package.mjs      generator, markdown assembly, change tracking
scripts/review/collect.mjs      repository inspection — everything derived
scripts/review/sanitise.mjs     redaction and the post-write secret audit
```
