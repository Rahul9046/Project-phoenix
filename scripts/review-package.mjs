/**
 * Generates the Eraya build review package.
 *
 *   npm run review:package
 *
 * One Markdown file, written to be uploaded to a reviewing model without a
 * covering note. Everything measurable is read from the repository at run time;
 * everything judged is marked as such. See docs/BUILD_REVIEW_WORKFLOW.md.
 *
 * Two rules shape this file.
 *
 * Derived over restated. A hardcoded price or route list goes stale silently,
 * and a review package that confidently describes last month's product is worse
 * than none. Where prose is unavoidable it sits in `narrative` below, flagged as
 * hand-maintained, so nobody reads judgement as measurement.
 *
 * Nothing reaches the file unsanitised. The package leaves the building, so the
 * last thing every line passes through is `redact()`, and the finished document
 * is re-scanned afterwards. No production data is read at any point.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import * as collect from "./review/collect.mjs";
import { auditForSecrets, redact } from "./review/sanitise.mjs";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "artifacts");
const REVIEW_DIR = join(OUT_DIR, "review");
const OUT_FILE = join(OUT_DIR, "eraya-review-package.md");
const MANIFEST = join(REVIEW_DIR, "manifest.json");

const skipChecks = process.argv.includes("--skip-checks");

/* ------------------------------------------------------------------------ */
/* Hand-maintained narrative.                                                */
/*                                                                           */
/* Only what cannot be derived: intent, and the status of things the code     */
/* cannot describe about itself. Every entry carries a file reference so a    */
/* reviewer can check the claim rather than take it.                          */
/* ------------------------------------------------------------------------ */
const narrative = {
  whatItIs:
    "A relationship platform for divorced, separated and widowed adults in India. " +
    "Not a dating app and not a matrimony site: no swiping, no matches, no biodata, no caste or community filters.",

  implemented: [
    ["Email sign-in by six-digit code", "apps/web/src/app/(auth)/auth/**, apps/mobile/app/auth.tsx"],
    ["Google and Facebook OAuth", "supabase/config.toml [auth.external.*]"],
    ["Onboarding: name, birthday, gender, relationship, seeking, city, languages, photo", "apps/mobile/app/onboarding/**, apps/web/src/app/(auth)/onboarding/**"],
    ["Discovery, member profiles, expressing interest, connections, messaging", "apps/*/…/discovery, connections, messages"],
    ["Premium purchase end to end via Razorpay, verified server-side", "supabase/functions/payments-*"],
    ["Entitlements read by named capability from the database", "apps/web/src/features/membership/entitlements.ts"],
    ["Account deletion — app path only (`delete_my_account()` RPC plus a Storage API sweep), proven against production by `npm run security:probe`. The web path was broken in production until 2026-09-22 and is fixed but unproven; see the next table", "apps/mobile/src/features/account/delete.ts, supabase/migrations/*delete_my_account*"],
    ["Reporting a member from a conversation or a profile, with a structured reason, which blocks them in the same transaction", "apps/web/src/features/members/MemberSafety.tsx, apps/mobile/src/features/connections/SafetyActions.tsx, supabase/migrations/*report_and_block*"],
    ["Blocking", "apps/mobile/app/you/blocked.tsx, supabase/migrations/*connection_tables*"],
    ["Privacy Policy, Terms and Community & Safety Guidelines, shared by both clients, with acceptance recorded per member against a version", "packages/legal, supabase/migrations/*legal_acceptance*"],
  ],

  mockedOrIncomplete: [
    ["Phone verification works on the web and is proven in production: a real Indian number was verified on eraya.app through the MSG91 widget with hCaptcha enabled. The app is a separate path — it uses the OTP API and still needs a DLT-approved SMS template before it will send anything, and has not been run end to end. As of 2026-09-22 it is **optional on both clients**: a member may verify at onboarding, decline and finish anyway, or verify later from Account → Verification, and declining sends nothing to MSG91 and writes no verification state of any kind", "supabase/functions/phone-otp-* (app), phone-widget-* (web, done)", "app only"],
    ["Account deletion from the web failed in production and the account survived. The Worker `eraya-web` carried no secrets and no environment bindings at all, so `getServiceRoleKey()` threw, the server action rejected before `deleteUser` was reached, and the member was shown a generic try-again message. Configuration, not code — no code change fixed it. `SUPABASE_SECRET_KEY` was set on 2026-09-22 and the live version now lists it, so the cause is gone; nobody has yet deleted an account through eraya.app to prove the path end to end. The database side was never in doubt (every migration applied; cascades verified in production against throwaway accounts carrying interests, a connection, messages, blocks, reports, moderation rows and a subscription)", "apps/web/src/features/account/actions.ts, apps/web/src/lib/supabase/env.ts, apps/web/wrangler.jsonc", "fix applied, unverified"],
    ["Web phone verification reported every failure as an outage. `describeAuthError` renders by error *kind*, and every phone refusal except a cooldown carries the kind `generic`, so a number already registered to another account, a daily cap and a dead widget all read as \"Something went wrong on our side. Please try again.\" A cooldown was worse than generic: it mapped to `rate_limited`, whose copy is about email links and spam folders. Found 2026-09-22 when a second account could not verify a number the first had taken. Shipped 2026-09-22 in `924719c`: the screens render the sentence written for the status, and `phone-widget-begin` (v2) returns `number_taken` rather than masking it, so a number already in use now says so outright. Both halves are live and production was confirmed serving the new copy by fetching its own JS bundle; nobody has yet walked the flow by hand", "apps/web/src/features/auth/describeAuthError.ts, phone-verification.ts, supabase/functions/phone-widget-begin", "shipped, unwalked"],
    ["The web code screen showed copy from the mocked era: \"Checking codes by SMS is not switched on yet, so any six digits will do for now.\" It was shown to every member on eraya.app while MSG91 was sending real codes and real codes were being required — the screen told people the opposite of what the system was doing. No flag or environment guard was involved; the string was simply never revisited when verification went live. The same screen had no way to ask for another code, so anybody whose SMS did not arrive could only go back. Both shipped 2026-09-22 in `1b14f72`: the screen names the number it sent to, masked to the last two digits, and carries a resend control on a sixty-second countdown that the server's own `retryAfter` corrects when the two disagree. Production was confirmed serving the new copy and the countdown by fetching its own JS bundle. The mock sentence is still *in* that bundle and cannot be reached from it — the string stays for the app, which has no other way to say that its SMS path is genuinely off, and no web code references it. The copy and the countdown were then walked by hand on eraya.app and are correct; pressing the button is not — see the next row", "apps/web/src/features/auth/screens/OTPScreen.tsx, packages/i18n/src/locales/*", "shipped"],
    ["Pressing \"Resend code\" fails in production. MSG91's widget renders its captcha into an element the page must provide, and `#msg91-captcha` exists only on the phone screen — the code screen never renders it, so the one operation that sends a new message has nowhere to validate a captcha and fails. Eraya's own side is not at fault and was ruled out from the audit trail rather than assumed: `phone_otp_resent` is recorded at 08:22:56 with no `phone_otp_send_failed` after it, 66 seconds past the previous send, so `phone-widget-begin` answered `allowed` and opened the request row. What confirms the shape is that `verifyOtp` works from that same screen — the widget, its script and its session all survive the navigation intact, and only the operation needing a captcha fails. Fixed in `6e8ea80`, which is committed locally and has reached nothing: the container is rendered on the code screen on the same terms as the phone screen, and the widget is initialised when the screen opens rather than inside the click, because a challenge appearing in the same breath as the send is one nobody has solved yet. That restores a captcha to a path that was silently missing one rather than relaxing anything. A fix shipped 2026-09-22 (`6e8ea80`, PR #60 → develop, #61 → main) and **did not work**, which is the more useful half of the entry. It rendered the container on the code screen; a container is inert unless MSG91 is asked to draw in it, and it is only asked during `initSendOTP`. `ensureWidget` returns early once `initialised` is set, so on the code screen the widget is never re-initialised, nothing is ever drawn into the new element, and the hCaptcha built on the phone screen was destroyed when that route unmounted. The box exists and is permanently empty. Re-tested on production at 09:00 against the deployed fix and refused identically; the server was exonerated a second time from the same audit trail (`phone_otp_resent` at 09:00:30, no `phone_otp_send_failed`, 81 seconds after the send). A second fix shipped (`da4dd36`) moving the element into the `(auth)` layout, which does not remount between the two screens. The lifetime problem is solved and stayed solved. It also broke phone verification outright, which is the more important entry below", "apps/web/src/features/auth/screens/OTPScreen.tsx, msg91-widget.ts", "superseded"],
    ["**Nobody could verify a phone number on the web**, for about twenty minutes on 2026-09-22. The captcha was not visible on the phone screen, so the first send could not be completed and sign-up stopped there — a worse fault than the resend bug the change was fixing. The cause was placement, not lifecycle: `AuthLayout` opens with `min-h-dvh` and fills the viewport by design, so the container appended after it in `(auth)/layout.tsx` began exactly one screen below the top of the page, outside the centred column. It was present, valid and initialised before MSG91 ran — production HTML confirmed exactly one such element — and simply off-screen. The container had been doing two jobs and only one survived being hoisted: a target MSG91 can draw into, and a place in the reading order where a person meets the challenge before pressing Continue. Fixed in `4a48aab` (PR #64 → develop, #65 → main): the element is `sticky bottom-0`, centred to the form's column width, and paints nothing while it is empty. It is deployed, and unlike the two fixes before it, it was proved rather than inferred — a stand-in was injected into the live container on eraya.app and its `getBoundingClientRect()` measured against the viewport, because nothing this repository can run sees an element one screen too low. What is still unproven is the bug the sequence began with: nobody has solved a real captcha and completed a resend since, so whether `retryOtp` delivers a second SMS remains open", "apps/web/src/app/(auth)/layout.tsx, features/auth/components/AuthLayout.tsx", "shipped, unwalked"],
    ["Razorpay is in TEST mode — no real money moves", "mode is read from the key prefix, supabase/functions/_shared/razorpay.ts", "test-only"],
    ["Privacy Policy, Terms and Community & Safety Guidelines are written and published, but no lawyer has read them and they are English-only while the product speaks six languages", "packages/legal, docs/07-open-questions.md", "needs legal review"],
    ["No profile review, photo review or automated moderation exists. Reports are read and acted on by a founder, by hand", "apps/web/src/app/admin/reports", "manual only"],
    ["International cards are refused by the Razorpay account (international_transaction_not_allowed)", "commercial setting, not code", "blocked"],
    ["Product is deployed but noindex — invisible to search until launch", "apps/web/next.config.ts, apps/web/src/app/layout.tsx", "deliberate"],
  ],

  /* Trust claims are the ones most worth auditing, so they are called out. */
  trustNotes: [
    "No trust mark is shown for anything Eraya has not actually checked. 'Phone verified' was withheld from member profiles for as long as verification was mocked, and returned on 2026-09-22 on a narrower footing than the one it left on: `member_card.phone_verified` is built by `phone_is_verified()`, which requires `phone_verified_via = 'msg91'`, so the accounts the stand-in marked — the demo members among them — do not qualify and cannot start qualifying by somebody widening a query. Absence says nothing: verification is optional, so no profile carries 'phone unverified' and no empty slot is left where a mark would be. Neither mark says 'verified profile' or 'verified member' — Eraya has checked a mailbox and sometimes a handset, not a person. The asymmetry between clients is real and accepted: the app cannot verify anybody until its SMS template is approved, so a mark is available to web members and not yet to app members. What it means is identical on both — an SMS was answered — which is the property that matters; the alternative, withholding a true mark from everybody until the slower client catches up, withholds information a reader is entitled to in order to keep a symmetry nobody asked for.",
    "Copy is constrained to claims defensible on launch day: no member counts, no testimonials, no '100% verified'.",
  ],

  journeys: [
    ["New user registration", "Email address → six-digit code → the phone step, which may be verified or declined → onboarding. No password exists anywhere in the product.", "Nothing verifies identity beyond control of the mailbox. Email stays compulsory because it *is* the account: it is the sign-in method, and an unreachable mailbox is an unrecoverable account. A phone is an attribute of an account that already exists, so refusing it costs nobody anything."],
    ["Email authentication", "Supabase OTP; the email carries a code, never a link, because a PKCE link cannot be opened on a different device from the one that requested it.", "Deliverability depends on Resend; sender is no-reply@eraya.app."],
    ["Phone verification", "**Optional since 2026-09-22, on both clients.** The step is offered first, and a member may verify, decline and carry on, or come back to it from Account → Verification at any time. Declining writes `onboarding_stage = 'phone_verified'` and nothing else — no number, no timestamp, no status — so a member who skipped is indistinguishable from one who was never asked, and causes zero MSG91 sends. Verifying late uses the same screen, the same widget, the same captcha and the same `begin_phone_otp` limits as verifying at signup; there is no second path. Web: MSG91's OTP widget runs in the browser and returns an access token, which `phone-widget-verify` exchanges with MSG91 server-side; the number comes from MSG91's answer and must match the request this account opened. App: the OTP API through `phone-otp-request` / `phone-otp-verify`, because MSG91's widget is a browser SDK and its native SDKs need a config plugin that does not exist.", "**Web: verified in production** on eraya.app with a real Indian number, MSG91 CAPTCHA Validation on and hCaptcha as the provider. **App: not run end to end** — it needs a DLT-approved SMS template first, and that is no longer a dead end: an app member who cannot get a code declines the step and finishes. Nothing was faked to achieve that — the app still asks MSG91 for a real code and still fails truthfully when MSG91 will not send one. No code is ever stored, and the fixed development code is refused unless SUPABASE_URL is a local stack. The code screen names the number it sent to, masked to the last two digits, and offers a resend on a sixty-second countdown that is a label on `begin_phone_otp`'s cooldown rather than a limit of its own — see section B. The captcha is one sticky element owned by the `(auth)` layout, so a single solved challenge serves both screens; arriving at that arrangement cost three deploys in one afternoon, the second of which blocked web verification outright — also section B."],
    ["Onboarding", "Twelve screens on mobile, seven routes on the web, asking the same questions. Photo is optional on both; a profile without one is complete.", "Both clients now write the same fields — see the parity table in section C."],
    ["Discovery", "A considered few rather than an endless feed. Filters are free-tier.", "Empty, loading and error states exist on both clients."],
    ["Expressing interest / connection", "Interest is one-way until reciprocated; a connection opens messaging.", "Who has expressed interest in you is a premium capability."],
    ["Messaging", "Only between connected members.", "No moderation, no reporting inside a thread."],
    ["Premium purchase", "Server creates and prices the order; client opens /checkout in a browser; signature verified server-side; settle_payment is idempotent.", "Verified end to end in test mode."],
    ["Premium expiry", "Premium is a date, not a boolean — active only while current_period_end > now().", "No renewal reminder exists."],
    ["Blocking", "Blocks are enforced in the database, not the UI.", "No notification to either party."],
    ["Reporting", "A member chooses exactly one of eight reasons — harassment, inappropriate content, fake profile, scam, spam, threats, under 18, something else — and may add details, which are required only for \"something else\" because that category says nothing by itself. `report_and_block_member` writes the report and the block in one transaction, so a report can never be filed without the block that goes with it. The row lands in a queue at /admin/reports that a founder reads.", "Both clients offer the same list in the same order from `packages/i18n`, translated into all six languages. The reason is stored as an enum value and the words separately, so reports can be counted and triaged. A moderator can dismiss a report or suspend the member. Suspension is reversible and removes them from discovery, interest and messaging. No SLA is promised anywhere in the copy."],
    ["Account deletion", "Two paths. The app calls `delete_my_account()`, which takes the id from the session and deletes the auth user so everything else cascades. The web server action holds the service role and calls the admin API directly. Either way the caller must clear the `profile-photos` bucket through the Storage API first, because SQL cannot: Supabase refuses `delete from storage.objects` whatever role attempts it (42501), so no trigger, cascade or constraint can reach the files. Audit rows keep history with a null actor.", "**The web path failed in production until 2026-09-22** — the Worker held no service-role key, so the action threw before deleting anything and the account survived. The key is now set and the cause is gone, but no account has been deleted through the web since (section B). The app path works. Storage is the clients' responsibility by necessity, which means any other route to deletion — the Supabase dashboard, the admin API, `npm run demo:remove` — deletes the account and leaves the photographs in the bucket."],
  ],

  observations: [
    ["launch blocker", "The three legal documents are written and published (section N3), but none has been reviewed by a lawyer and no postal address is disclosed anywhere. Indian consumer and payment rules require an address before live payments, and a home address is not an option — so this is a business decision rather than a code one.", "packages/legal, docs/07-open-questions.md"],
    ["resolved, unverified", "A member could not delete their account from the web in production: the deployed Worker carried no secrets of any kind, so the one server action needing the service role threw and the account survived while the member was told to try again. The secret was set on 2026-09-22 and verified on the live version; deletion has not been re-tested end to end, so treat it as fixed rather than proven. Two things are worth keeping from it. Deletion is the promise with the least room for a caveat and the three legal documents say it works. And it went unnoticed because `deleteAccount` is the only runtime consumer of a server-side secret in the whole app — a missing secret broke exactly one feature and nothing failed alongside it.", "apps/web/src/features/account/actions.ts, apps/web/wrangler.jsonc"],
    ["technical debt", "`scripts/security-probe.mjs` tests account deletion through the `delete_my_account()` RPC only. The web server action deletes by a different route — the admin API under the service role — and is not covered, which is why the probe stayed green while the web path was broken in production. A probe that exercises one of two paths reads as if it exercised both.", "scripts/security-probe.mjs"],
    ["trust", "Web phone verification is proven in production, with hCaptcha in front of MSG91's send. The app cannot verify anybody until its DLT-approved SMS template exists. That used to mean somebody signing up on the app reached a step that could not complete and stopped there, which is the fault that made the step optional on 2026-09-22 rather than the other way round: a compulsory step that depends on a third party's approval is an onboarding that the third party can close. It is now a question that can be answered either way on both clients, and the app's inability to send is a refusal the member can walk past instead of a wall.", "supabase/functions/phone-otp-* (app)"],
    ["trust", "Making a verification optional is a decision about what is being claimed, not a relaxation of a control. Nothing was weakened to do it: the captcha, the cooldown, the per-user and per-number daily caps, the account-wide ceiling, the attempt limit and the one-verified-number-per-account unique index are all untouched and all still enforced in SQL, and the later-verification entry point is a link to the same screen rather than a second implementation of any of them. What changed is who is asked to pass them and when. The part worth a reviewer's attention is the state: 'skipped' is *not* recorded anywhere, deliberately. It is the absence of `phone_verified_at`, which is also the state of somebody who has not reached the step, and adding a `phone_skipped_at` to tell those apart would create a second source of truth that can disagree with the first and a new thing a client could write about itself. The two facts the product needs — has this member been asked, and has this number been checked — are `onboarding_stage` and `phone_is_verified()`, and neither can be mistaken for the other.", "supabase/migrations/*optional_phone_verification*, apps/web/src/features/auth/flow.ts, apps/mobile/src/features/auth/routing.ts"],
    ["technical debt", "Error taxonomy, not copy. The web describes auth failures by *kind*, and the kinds are coarser than the statuses the phone endpoints answer with — eight distinct outcomes from `begin_phone_otp` arrived as one sentence, three of which the member could have acted on. The message tables holding the right sentences existed and were simply never read; mobile, which reads them, was correct throughout. Worth a reviewer's attention as a shape rather than an incident: any flow whose server speaks a richer vocabulary than the client's error type will lose the difference silently, and nothing fails loudly when it does.", "apps/web/src/features/auth/describeAuthError.ts"],
    ["trust", "A verified phone number belongs to exactly one account, enforced in `begin_phone_otp`, and as of 2026-09-22 the web says so in plain words rather than hiding it behind an outage message. That reverses a deliberate choice: the status was previously masked so the screen could not be used to ask whether a stranger has an account. The enumeration cost is real and now accepted — the caller must be signed in, but the check runs *before* the cooldown and daily caps, so refusals are unlimited and unmetered. If that trade is reconsidered, move the check below the caps rather than restoring the vague wording, which cost the honest member and not the curious one.", "supabase/functions/phone-widget-begin, supabase/migrations/*real_phone_verification*"],
    ["product", "The funnel is instrumented end to end and proved by `npm run analytics:probe`. Events are recorded by the database on the write itself, so the clients cannot drift or double-count and no event can carry anything personal.", "supabase/migrations/*funnel*"],
    ["safety", "Reports are read at /admin/reports, guarded by an allowlist of addresses held in `ops_config` and checked inside every admin function as well as on the page. The queue is manual and unstaffed outside founder hours — trust copy must still not imply a review SLA.", "apps/web/src/features/admin"],
    ["safety", "The sixty-second resend cooldown does not currently fire on the web. `begin_phone_otp` measures it as `max(sent_at)` over the member's requests, and `phone-widget-begin` deliberately leaves each row `requested` with `sent_at` null — truthfully, because the browser widget sends the message and the server never learns that it did. Both of 2026-09-22's rows confirm `sent_at` is null. So the branch is unreachable on that path and the countdown drawn on the code screen is, for now, the only thing spacing out resends, which is the opposite of what it was built to be. The per-user and per-number daily caps are unaffected — they count `requested_at` — so the ceiling holds and only the spacing is missing. Found while diagnosing the resend failure; it is not its cause, and it errs toward permissive rather than broken, which is why nothing surfaced it.", "supabase/migrations/*real_phone_verification*, supabase/functions/phone-widget-begin"],
    ["technical debt", "A provider's reason for failing is discarded at the point it would be most useful. `sendPhoneCode` wraps the widget call in a catch that throws Eraya's own sentence and keeps nothing — no console line, no event, no reason column — so a structural fault in our own page and an outage at MSG91 reach a member, and a maintainer, as the same sentence. That is right for the member and wrong for everybody else: diagnosing the resend failure needed the database audit trail to prove where it did *not* happen, because the place it did happen says nothing at all. The message shown should stay as it is; what is missing is a record kept beside it. This has now cost more than inconvenience: the first fix for the resend failure was deployed on a diagnosis inferred from which operations worked elsewhere, was wrong in its second half, and could not be falsified until somebody pressed the button in production again. An error a maintainer cannot read is an error that gets guessed at, and the guess costs a release.", "apps/web/src/features/auth/phone-verification.ts"],
    ["launch blocker", "Three deploys in one afternoon tried to fix one resend button, and the third stopped anybody verifying a phone number at all. Each diagnosis was sound about the code and each was checked only against things that can be checked without a browser — types, lints, a build, a probe, the shape of the DOM in the served HTML. None of those can see a captcha that is one viewport too low, and nothing in the repository can: there are no tests, no staging environment, and the one flow in the product that cannot be exercised locally without spending a real SMS is exactly this one. The sequence is not a run of bad luck but the predictable cost of that combination, and it is worth weighing before launch, when the people hitting it will not be the founder. Whatever is done about the tests and the environment, a change to this flow should be opened in a browser before it is merged.", "apps/web/src/features/auth, docs/07-open-questions.md"],
    ["technical debt", "Replacing the mock left its scaffolding standing, and nothing noticed for weeks. When MSG91 went live on the web, three things written for exactly that moment stayed as they were: `maskPhone` in `types.ts`, carrying the comment \"for the 'we sent a code to…' line\", was never called by anything; `resendVerificationCode` existed on the auth provider with no caller and without passing the resend flag it needed; and the code screen kept rendering the mocked-era sentence telling members any six digits would do. Each was individually invisible — unused code does not fail, and copy does not typecheck. The general shape is worth a reviewer's attention more than the instances: a mock swapped out behind an interface leaves no failing signal for the parts of the real implementation nobody wired up, so the switch needs a checklist rather than a green build.", "apps/web/src/features/auth/types.ts, AuthSessionProvider.tsx, screens/OTPScreen.tsx"],
    ["technical debt", "One locale key, two clients, opposite truths. `auth.otp.ledePrefix` says SMS checking is not switched on — false on the web since MSG91 went live, still true in the app, which waits on a DLT-approved template. The string is shared through `packages/i18n`, so correcting it for the web would have lied to the app and deleting it broke the app's typecheck outright. It is kept for the app and the web now reads its own key. Any copy describing what the product *can currently do*, rather than what it is, needs to be per-client or per-state, because the two clients are not at the same stage and will not be until the template arrives.", "packages/i18n/src/locales/*, apps/mobile/app/onboarding/confirm-phone.tsx"],
    ["technical debt", "There is no staging environment. There is one Supabase project, and local development points at it, so `npm run dev` on a laptop is a client of production: the database, the auth users, the storage bucket and the edge functions are the live ones. Nothing here is careless — the rules live in Postgres and refuse before anything is spent, which is why testing a refused phone verification costs no SMS and touches no profile — but it does mean routine local testing appends real rows to `auth_events`, and that the only rehearsal available for a server change is production itself. It also splits a change like the phone fix in two: the client half can be tried locally against the deployed functions, the server half cannot be tried anywhere until it ships.", "apps/web/.env.local, supabase/config.toml"],
    ["technical debt", "There is no test suite in any workspace. Every check is a type check, a linter or a probe script.", "package.json"],
    ["product", "International cards are refused. NRIs are a plausible part of this audience and currently cannot pay at all.", "Razorpay account setting"],
    ["UX", "Mobile copy is inline in screens; the web keeps all copy in content.ts. Revising wording on mobile means touching layout files.", "apps/mobile/app/**"],
  ],
};

/* ------------------------------------------------------------------------ */
/* Markdown helpers                                                          */
/* ------------------------------------------------------------------------ */

const lines = [];
const w = (s = "") => lines.push(s);
const h1 = (s) => w(`# ${s}\n`);
const h2 = (s) => w(`\n## ${s}\n`);
const h3 = (s) => w(`\n### ${s}\n`);
const bullet = (s) => w(`- ${s}`);

function table(headers, rows) {
  if (!rows.length) return w("_None found._");
  w(`| ${headers.join(" | ")} |`);
  w(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) w(`| ${row.map((c) => String(c ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
}

const rupees = (paise) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/* ------------------------------------------------------------------------ */
/* Gather                                                                    */
/* ------------------------------------------------------------------------ */

console.log("Collecting repository state…");
const meta = collect.buildMetadata();
const web = collect.webRoutes();
const mobile = collect.mobileRoutes();
const copy = collect.copyInventory();
const tokens = collect.designTokens();
const brand = collect.brandUsage();
const perms = collect.permissions();
const auth = collect.authConfig();
const planData = collect.plans();
const entitlements = collect.entitlementMatrix();
const payments = collect.paymentSurface();
const events = collect.analyticsEvents();
const backend = collect.backendSurface();
const mod = collect.moderation();
const states = collect.stateHandling();
const parity = collect.onboardingParity();
const i18n = collect.localization();
const db = collect.schema();
const age = collect.ageEligibility();
const legal = collect.legalSurface();
const envNames = collect.environmentVariableNames();
const debt = collect.technicalDebt();

console.log(skipChecks ? "Skipping checks (--skip-checks)…" : "Running existing checks (this takes a few minutes)…");
const checks = collect.runChecks({ skip: skipChecks });

/* ------------------------------------------------------------------------ */
/* Change tracking                                                           */
/* ------------------------------------------------------------------------ */

const manifest = {
  commit: meta.commit,
  generatedAt: meta.generatedAt,
  surfaces: {
    webRoutes: web.map((r) => r.route).sort(),
    mobileScreens: mobile.map((r) => r.screen).sort(),
    androidPermissions: [...perms.android].sort(),
    analyticsEvents: events.recorded,
    plans: planData.rows.map((p) => `${p.code}:${p.pricePaise}`).sort(),
    tables: db.tables,
    edgeFunctions: backend.edgeFunctions.sort(),
    authProviders: auth.providers.filter((p) => p.enabled).map((p) => p.provider).sort(),
  },
};

let previous = null;
try {
  previous = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch {
  /* first run */
}

function diffSurface(key) {
  const now = manifest.surfaces[key] ?? [];
  if (!previous) return null;
  const before = previous.surfaces?.[key] ?? [];
  const added = now.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !now.includes(x));
  return { added, removed, unchanged: now.length - added.length };
}

/* ------------------------------------------------------------------------ */
/* Document                                                                  */
/* ------------------------------------------------------------------------ */

h1("ERAYA BUILD REVIEW PACKAGE");
w(
  `> Generated by \`npm run review:package\` from the repository at commit \`${meta.commitShort}\`. ` +
    `Everything measurable here was read from the repo at generation time; sections marked _hand-maintained_ are judgement. ` +
    `No production data was read and no secret values are included.`,
);

/* --- A ------------------------------------------------------------------ */
h2("A. Build metadata");
table(
  ["Field", "Value"],
  [
    ["Generated", meta.generatedAt],
    ["Branch", meta.branch],
    ["Commit", `${meta.commitShort} (${meta.commitDate})`],
    ["Working tree", meta.dirty ? `**dirty** — ${meta.dirtyFiles.length} changed path(s)` : "clean"],
    ["Web", `Next.js ${meta.web.next}, React ${meta.web.react}, Tailwind ${meta.web.tailwind}`],
    ["Mobile", `Expo ${meta.mobile.expo}, React Native ${meta.mobile.reactNative}, expo-router ${meta.mobile.expoRouter}`],
    ["App version", `${meta.mobile.appVersion} (${meta.mobile.androidPackage}, scheme \`${meta.mobile.scheme}\`)`],
    ["Web host", `${meta.deployment.host} — worker \`${meta.deployment.workerName}\``],
    ["Deploy pipeline", `${meta.deployment.pipeline} on push to \`${meta.deployment.trigger}\``],
    ["Search indexing", meta.deployment.indexingAllowedInPipeline ? "**ENABLED**" : "disabled (NEXT_PUBLIC_ALLOW_INDEXING unset)"],
  ],
);
if (meta.dirty) {
  w("\n**Uncommitted changes present** — this package may not describe any committed state:");
  meta.dirtyFiles.slice(0, 20).forEach((f) => bullet(`\`${f}\``));
}
h3("Recent commits");
table(["SHA", "Date", "Subject"], meta.recentCommits.map((c) => [c.sha, c.date, c.subject]));

h3("Environment differences");
w("Variable **names** only — values are never read into this document.");
table(
  ["Scope", "Variables"],
  [
    ["Web", envNames.web.join(", ") || "—"],
    ["Mobile", envNames.mobile.join(", ") || "—"],
    ["CI secrets", envNames.ciSecrets.join(", ") || "—"],
  ],
);
bullet(`Auth \`site_url\`: \`${auth.siteUrl}\``);
bullet(`Redirect allowlist: ${auth.redirectUrls.map((u) => `\`${u}\``).join(", ")}`);
bullet(
  "Local development uses `localhost`; EAS `preview`/`production` builds read `EXPO_PUBLIC_SITE_URL` from EAS, not from `.env.local`.",
);

/* --- B ------------------------------------------------------------------ */
h2("B. Product summary");
w(`_Hand-maintained._ ${narrative.whatItIs}`);
h3("Implemented");
narrative.implemented.forEach(([what, where]) => bullet(`${what} — \`${where}\``));
h3("Incomplete, mocked, or blocked");
table(
  ["Status", "What", "Where"],
  narrative.mockedOrIncomplete.map(([what, where, status]) => [`**${status}**`, what, `\`${where}\``]),
);
h3("Trust posture");
narrative.trustNotes.forEach(bullet);

/* --- C ------------------------------------------------------------------ */
h2("C. Screen inventory");
h3(`Web — ${web.length} routes`);
table(
  ["Route", "Group", "Auth", "Kind", "noindex", "File"],
  web.map((r) => [
    `\`${r.route}\``,
    r.group,
    r.authed ? "signed-in" : "public",
    r.kind + (r.dynamic ? " (dynamic)" : ""),
    r.noindex ? "yes" : "—",
    `\`${r.file.replace("apps/web/src/app", "…/app")}\``,
  ]),
);
h3(`Mobile — ${mobile.length} screens`);
table(
  ["Screen", "Area", "File"],
  mobile.map((r) => [
    `\`${r.screen}\``,
    r.tab ? "tab" : r.onboarding ? "onboarding" : r.dynamic ? "detail" : "stack",
    `\`${r.file.replace("apps/mobile/app", "…/app")}\``,
  ]),
);
h3("Web/mobile differences");
const webOnboarding = web.filter((r) => r.route.startsWith("/onboarding")).map((r) => r.route.split("/")[2]);
const mobileOnboarding = mobile.filter((r) => r.onboarding).map((r) => r.screen.split("/")[1]);
bullet(`Web onboarding steps: ${webOnboarding.join(", ") || "—"}`);
bullet(`Mobile onboarding steps: ${mobileOnboarding.join(", ") || "—"}`);
bullet(
  `Only on mobile: ${mobileOnboarding.filter((s) => !webOnboarding.includes(s)).join(", ") || "—"} — **a reviewer should check whether this divergence is intended.**`,
);
bullet("Mobile has a five-tab bottom navigation; the web uses a signed-in shell with a header. Messaging exists on both.");

h3("Onboarding parity, by field");
w(
  "Compared by the columns each client writes, not by the screens. Two apps can ask the same thing on a different number of screens and still store the same profile; " +
    "asking for different things is what makes a profile mean something different depending on where it was created.\n",
);
table(
  ["Field", "Web", "Mobile"],
  parity.fields.map((f) => [
    `\`${f.field}\``,
    f.web ? "asked" : "**not asked**",
    f.mobile ? "asked" : "**not asked**",
  ]),
);

if (parity.onlyMobile.length || parity.onlyWeb.length) {
  w(
    `\nStill divergent — only on mobile: ${parity.onlyMobile.map((f) => `\`${f}\``).join(", ") || "—"}; ` +
      `only on the web: ${parity.onlyWeb.map((f) => `\`${f}\``).join(", ") || "—"}.`,
  );
} else {
  w("\nBoth clients now write the same set of fields.");
}
w(
  `\n_Screens are not the measure: the web asks across ${parity.webSteps} routes and the app across ${parity.mobileSteps}. ` +
    "A field can still be written by one client's save layer and unreachable in its own UI, which is what this table cannot see. " +
    "Both clients now reach every field above from a screen: the web routes include `/onboarding/seeking` and `/onboarding/photo`, " +
    "and its city step offers the typed town the app has always offered._",
);

/* --- D ------------------------------------------------------------------ */
h2("D. Navigation map");
w("```");
w("LOGGED OUT");
w("  / (landing)  →  /signup | /login");
w("                    ↓");
w("            /auth/email  →  /auth/otp        (six-digit code)");
w("                    ↓");
w("            onboarding: " + (webOnboarding.join(" → ") || "—"));
w("                    ↓");
w("SIGNED IN");
w("  /home  ·  /discovery → /discovery/[id]  ·  /connections → /connections/[id]");
w("  /account → settings | privacy | membership");
w("  /pricing → checkout → Razorpay → eraya://payment (mobile) | /account/membership (web)");
w("");
w("MOBILE TABS: " + mobile.filter((m) => m.tab).map((m) => m.screen.split("/").pop()).join(" · "));
w("DEEP LINKS : " + `${meta.mobile.scheme}://auth (OAuth return) · ${meta.mobile.scheme}://payment (checkout return)`);
w("```");
bullet("Payment redirect: the mobile app opens the **web** `/checkout` in the system browser, which hands back to `eraya://payment`. Card details never touch the app.");
bullet("Auth redirect: OAuth returns to `/auth/callback`; email codes resolve at `/auth/confirm`. Both are on the allowlist above; anything not listed fails as an error rather than a session.");

/* --- E ------------------------------------------------------------------ */
h2("E. User journeys");
w("_Hand-maintained, with file references in section B._");
table(
  ["Journey", "Current behaviour", "Gap / limitation"],
  narrative.journeys.map(([name, behaviour, gap]) => [`**${name}**`, behaviour, gap]),
);

/* --- F ------------------------------------------------------------------ */
h2("F. Copy inventory");
w(
  `Web copy is centralised in ${copy.files.length} \`content.ts\` modules (nothing user-facing is written inside a component). ` +
    `**Mobile has no equivalent** — its strings are inline across ${copy.mobileScreenFiles} screen files, so revising wording there means editing layout.`,
);
const grouped = new Map();
for (const s of copy.strings) {
  const key = s.file.replace("apps/web/src/features/", "").replace("/content.ts", "");
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(s.text);
}
for (const [feature, strings] of grouped) {
  h3(feature);
  strings.slice(0, 22).forEach((t) => bullet(`"${t}"`));
  if (strings.length > 22) w(`\n_…and ${strings.length - 22} more in \`${feature}/content.ts\`._`);
}
h3("Copy worth a second look");
bullet("Any string implying verification: the web path is proven but the app cannot verify anybody until its SMS template is approved, so wording must not imply a checked number for every member.");
bullet("Payment failure copy must not assert 'you have not been charged' unless the server established it.");
bullet("Mobile strings are inline and therefore drift from the web's wording without anything catching it.");

/* --- F2 ----------------------------------------------------------------- */
h2("F2. Localization");

if (!i18n.present) {
  w("_No shared localization package found. The product is English only._");
} else {
  table(
    ["Locale", "Name", "Keys", "Matches English"],
    i18n.locales.map((l) => [
      `\`${l.code}\``,
      l.name,
      String(l.keys),
      l.code === i18n.defaultLocale
        ? "— (source)"
        : l.keys === i18n.keyCount
          ? "yes"
          : "**NO**",
    ]),
  );

  const behind = i18n.parity.filter((p) => !p.matches);

  /*
   * The line that matters. A locale behind on keys still renders -- every
   * missing string falls back to English -- so a half-translated app looks
   * finished to anybody who reads English, which is everybody reviewing it.
   */
  if (behind.length) {
    w(
      `\n> **${behind.length} locale(s) do not have every key:** ` +
        `${behind.map((p) => `\`${p.code}\` (${p.keys}/${i18n.keyCount})`).join(", ")}. ` +
        "The missing strings fall back to English rather than failing, so this is invisible unless you read the language.",
    );
  } else {
    w(
      `\n**${i18n.keyCount} keys, and every locale has all of them.** ` +
        "Enforced twice: each locale is typed as `typeof en`, so a gap is a build error, and " +
        "`npm run i18n:check` names every difference at once along with empty values and mismatched `{placeholders}`.\n",
    );
  }

  table(
    ["Decision", "Answer"],
    [
      ["Default locale", `\`${i18n.defaultLocale}\``],
      ["Fallback when a key is missing", `\`${i18n.fallbackLocale}\` — never the raw key`],
      ["Where the preference is stored", i18n.storedOn],
      ["Web architecture", i18n.webResolvedOn],
      ["Mobile architecture", i18n.mobileResolvedOn],
      ["Changed on the web at", "Account → Settings → Language"],
      ["Changed on mobile at", "You → Language"],
      [
        "Locale-prefixed URLs",
        i18n.localeRoutes
          ? "**present** — routes carry a locale segment"
          : "none — language is a preference, not a URL",
      ],
    ],
  );

  w(
    "\n_Interface language, not spoken languages._ `profiles.ui_locale` decides which translation of Eraya's own words " +
      "a member reads. `profile_languages` is the separate, unchanged profile field that other members see and that " +
      "discovery uses to introduce people who can talk to each other. Switching the interface to Bengali changes neither.",
  );
}

/* --- G ------------------------------------------------------------------ */
h2("G. Design system");
h3(`Web tokens — \`apps/web/src/app/globals.css\` (${tokens.web.length})`);
table(["Token", "Value"], tokens.web.map((t) => [`\`${t.name}\``, `\`${t.value}\``]));
h3(`Mobile tokens — \`apps/mobile/src/theme/tokens.ts\` (${tokens.mobile.length})`);
table(["Token", "Value"], tokens.mobile.slice(0, 40).map((t) => [`\`${t.name}\``, `\`${t.value}\``]));
h3("Colour literals outside the token files");
if (!tokens.colourLiteralsOutsideTokens.length) {
  w("None. Every colour comes from a token.");
} else {
  w("The design system's rule is that no colour literal appears outside the token files. These break it:");
  table(
    ["File", "Literals"],
    tokens.colourLiteralsOutsideTokens.map((o) => [`\`${o.file}\``, o.literals.join(", ")]),
  );
}
bullet("Light only, deliberately — the cream palette *is* the brand and a dark inversion reads as a different product.");

/* --- H ------------------------------------------------------------------ */
h2("H. Brand usage");
table(
  ["Aspect", "State"],
  [
    ["Approved assets", `${brand.assets.length} SVGs in \`assets/brand/\``],
    ["Geometry module", `\`${brand.markModule}\``],
    ["Matches approved artwork", brand.geometryMatchesApprovedAsset ? "**yes** — paths byte-identical to `eraya-approved-favicon.svg`" : "**NO — mark geometry has diverged from the asset pack**"],
    ["App icon", `\`${brand.appIcon ?? "—"}\``],
    ["Splash", brand.splash ? `\`${brand.splash.image}\` on \`${brand.splash.backgroundColor}\`` : "—"],
    ["Consumers", `${brand.consumers.length} files render the mark or wordmark`],
  ],
);
brand.consumers.slice(0, 12).forEach((f) => bullet(`\`${f}\``));

/* --- I ------------------------------------------------------------------ */
h2("I. Mobile permissions");
const permRows = perms.android.map((p) => {
  const key = p.split(".").pop().toLowerCase();
  const used =
    key.includes("audio") ? perms.evidence.microphone
    : key.includes("camera") ? perms.evidence.camera
    : key.includes("media") || key.includes("storage") ? perms.evidence.photos
    : key.includes("location") ? perms.evidence.location
    : key.includes("contacts") ? perms.evidence.contacts
    : null;
  return [
    `\`${p}\``,
    used === null ? "unknown" : used ? "yes" : "**no usage found in source**",
    used === false ? "**FLAG — remove unless a feature needs it**" : "—",
  ];
});
table(["Android permission", "Referenced in source?", "Assessment"], permRows);
h3("iOS usage strings");
table(["Key", "Present"], Object.keys(perms.ios).map((k) => [`\`${k}\``, "yes"]));
bullet(`Expo plugins requesting capabilities: ${perms.plugins.filter((p) => /image-picker|camera|location|notification|contacts|media/.test(p)).join(", ") || "expo-image-picker only"}`);
h3("Detected capability usage");
table(
  ["Capability", "Referenced in source"],
  Object.entries(perms.evidence).map(([k, v]) => [k, v ? "yes" : "no"]),
);
w(
  "\n**A permission declared but unreferenced is a trust cost for nothing** — especially the microphone, on a product for people deciding whether to meet a stranger.",
);

/* --- J ------------------------------------------------------------------ */
h2("J. Authentication");
table(
  ["Aspect", "State"],
  [
    ["Providers", auth.providers.map((p) => `${p.provider}: ${p.enabled ? "enabled" : "off"}`).join(", ")],
    ["Email", "six-digit OTP code — no password exists anywhere in the product"],
    ["Phone", auth.phoneAuthEnabled ? "Supabase phone auth ON" : "Supabase phone auth **off** — numbers are an attribute of an account, never a way to sign in"],
    [
      "Phone verification",
      `${auth.phoneWidgetOnWeb ? "MSG91 OTP widget on web (access token verified server-side)" : "**not wired on web**"}; ` +
        `${auth.phoneOtpApiOnMobile ? "MSG91 OTP API in the app" : "**not wired in the app**"} — app path not yet run end to end (needs a DLT-approved SMS template)`,
    ],
    [
      "Fixed development code",
      auth.otpDevCodeLocalOnly
        ? "refused unless `SUPABASE_URL` is a local stack, so a deployed project cannot accept it"
        : "**reachable on a deployed project** — `OTP_DEV_CODE` is not gated to local development",
    ],
    ["Email templates in VCS", auth.emailTemplates.join(", ") || "none"],
    ["Transactional sender", `\`${auth.smtpSender}\``],
    ["Session", "Supabase SSR cookies on web; `expo-secure-store` on mobile"],
    ["Redirect allowlist", `${auth.redirectUrls.length} entries — anything unlisted fails as an error, not a session`],
  ],
);
bullet("`src/proxy.ts` refreshes the session on every rendered request. It is an optimistic check, **not** the authorisation boundary — Row Level Security is.");
bullet(
  "**Flag:** the web path is verified in production (real number on eraya.app, hCaptcha enabled). The app path is not — it needs a DLT-approved SMS template before it can send. Until both work, no copy or badge may imply a checked number.",
);

/* --- K ------------------------------------------------------------------ */
h2("K. Payments and membership");
table(
  ["Plan", "Period", "Price", "Intro", "Recurring"],
  planData.rows.map((p) => [
    `${p.name} (\`${p.code}\`)`,
    `${p.periodMonths} month(s)`,
    rupees(p.pricePaise),
    p.introPricePaise ? `${rupees(p.introPricePaise)} for ${p.introPeriodMonths} month(s), once per member ever` : "—",
    p.isRecurring ? "yes" : "**no — prepaid, nothing auto-renews**",
  ]),
);
w(`\n_Prices read from \`${planData.source}\`, with later migrations replayed over it — not from the live database._`);
if (planData.corrections.length) {
  w("\nCorrections applied after the seed:");
  planData.corrections.forEach((c) =>
    bullet(`\`${c.file}\` — set \`is_recurring = ${c.value}\`${c.code ? ` for \`${c.code}\`` : " for every plan"}`),
  );
}
w(
  `\n**Product invariant: ${planData.allPrepaid ? "every plan is prepaid — nothing auto-renews." : "⚠ AT LEAST ONE PLAN IS MARKED RECURRING."}** ` +
    "There is no Razorpay subscription, mandate or standing instruction anywhere in the codebase; a term ends when it ends " +
    "and the member decides whether to buy another.",
);
table(
  ["Aspect", "State"],
  [
    ["Provider", "Razorpay"],
    ["Mode", `**TEST** — decided by ${payments.modeDecidedBy}, so a flag cannot disagree with the key in use`],
    ["Pricing authority", payments.serverPriced ? "server — the client knows a plan code and nothing about money" : "**unclear**"],
    ["Edge functions", payments.edgeFunctions.join(", ")],
    ["Webhook", `\`${payments.webhookPath}\` — JWT verification off, Razorpay signs instead`],
    ["Checkout page", `\`${payments.checkoutPage}\``],
    ["Idempotency", "`settle_payment` — callback, webhook and reconciliation race safely"],
    ["Stacking", "a new period starts when the current one ends; time already paid for is kept"],
    ["Expiry", "Premium is a date, not a boolean — `current_period_end > now()`"],
  ],
);
bullet("**App-store billing:** Apple and Google generally require their own billing for digital goods consumed in an app. Unresolved; mobile purchasing goes through one module, so answering it later touches neither schema nor web checkout.");
bullet("**International cards are refused** by the account (`international_transaction_not_allowed`). A commercial setting, not a bug.");

/* --- L ------------------------------------------------------------------ */
h2("L. Free vs Premium");
const fmtCap = (v) => (v === "true" ? "yes" : v === "false" ? "—" : v === undefined ? "—" : `\`${v}\``);
table(
  ["Capability", "Free", "Premium", "What it means", "Client fallback agrees"],
  entitlements.rows.map((e) => [
    `\`${e.capability}\``,
    fmtCap(e.free),
    fmtCap(e.premium),
    e.description,
    e.fallback === undefined
      ? "—"
      : e.fallback === e.free
        ? "yes"
        : `**NO — client says \`${e.fallback}\`**`,
  ]),
);
w(`\n_Read from \`${entitlements.source}\`._`);
w(
  "\nCapabilities are **data**, read from the `entitlements` table by name — adding a premium feature is an insert, not a " +
    "refactor of every component with an opinion about tiers. The last column compares the seeded free values against the " +
    "client's hardcoded fallback, which applies only if the table is unreachable: the safe failure is to withhold paid " +
    "features, never to hand them out.",
);
w(
  "\n`revertLimit` is finite on **both** tiers. Premium is \"more reverts\", never \"unlimited\" — a promise the product has " +
    "deliberately not made.",
);
bullet("**Never compare a tier in a component** — read a named capability. Enforced by convention in `CLAUDE.md`.");

/* --- M ------------------------------------------------------------------ */
h2("M. Data and privacy");
table(
  ["Data", "Where", "Notes"],
  [
    ["Name, birthday, gender, relationship status, city, languages", "`profiles`", "collected during onboarding"],
    ["Photos", "Supabase Storage `profile-photos`", "optional; **not reached by foreign-key cascade — must be swept separately on deletion**"],
    ["Email", "`auth.users`", "identity"],
    ["Phone number", "`profiles` / phone verification tables", "written only by an edge function holding the service role; web path proven in production, app path pending its SMS template"],
    ["Payment metadata", "`payments`", "order and payment ids, amount, status — no card data ever"],
    ["Analytics", "`product_events`", "no client-readable rows"],
    ["Audit", "`auth_events`, `payment_events`", "actor set to null on account deletion — history kept, person unlinked"],
  ],
);
bullet("Account deletion cascades from `auth.users` through `profiles` to languages, subscriptions, blocks, connections, messages and reports. Verified in production against throwaway accounts, not only read from the migrations.");
bullet("Razorpay receives no name, address or contact details — only an order note tying a payment to a member and plan.");
bullet("The member's objects in `profile-photos` are **not** reached by any cascade, trigger or constraint: Supabase refuses `delete from storage.objects` whatever role attempts it, so the files can only be removed through the Storage API by whichever client is doing the deleting. Both clients do. Every other route to deletion — the dashboard, the admin API, `npm run demo:remove` — leaves the photographs behind.");
bullet("**Deleting an account from the web did not work in production until 2026-09-22** (section B), and everything above survived the attempt. The missing Worker secret is now set; the path has not been exercised since.");

/* --- N ------------------------------------------------------------------ */
h2("N. Moderation and safety");
table(
  ["Capability", "State"],
  [
    ["Block", "**implemented** — enforced in the database, not the UI"],
    ["Report", "**implemented** — written by members, read at the routes below"],
    [
      "Moderation queue",
      mod.adminPages.length
        ? `**implemented** — ${mod.adminPages.map((r) => `\`${r}\``).join(", ")}`
        : "**does not exist**",
    ],
    ["Moderator actions", mod.adminFunctions.map((f) => `\`${f}\``).join(", ") || "none"],
    ["Suspension", mod.suspensionSupported ? "**implemented** — reversible, `profiles.suspended_at`" : "**does not exist**"],
    ["Audit trail", mod.auditTable === "none" ? "**none**" : `\`${mod.auditTable}\``],
    ["Who may moderate", mod.guard],
    ["Allowlist location", `\`${mod.allowlistKey}\``],
    ["Profile review before going live", "**does not exist**"],
    ["Photo review", "**does not exist**"],
    ["Automated moderation", "**does not exist**"],
    ["Support address", "`support@eraya.app` — live"],
  ],
);

/*
 * The two ways this can quietly stop being true. A page that forgets the guard
 * looks identical in a route listing to one that has it, and an admin function
 * that trusts the page rather than checking for itself is a bypass waiting for
 * the first caller that is not the page.
 */
if (mod.unguardedPages.length) {
  w(
    `\n> **${mod.unguardedPages.length} admin page(s) do not call \`requireModerator()\`:** ` +
      `${mod.unguardedPages.map((f) => `\`${f}\``).join(", ")}.`,
  );
}
if (mod.functionsNotSelfChecking.length) {
  w(
    `\n> **${mod.functionsNotSelfChecking.length} admin function(s) do not check \`is_moderator()\` in their own body:** ` +
      `${mod.functionsNotSelfChecking.map((f) => `\`${f}\``).join(", ")}. ` +
      "A page guard is not a boundary — anything that can sign in can call an RPC by name.",
  );
}
if (!mod.unguardedPages.length && !mod.functionsNotSelfChecking.length && mod.adminPages.length) {
  w(
    "\nEvery admin page calls `requireModerator()` and every admin function re-checks `is_moderator()` in its own body. " +
      "The page guard answers 404 rather than 403, so the route does not confirm its own existence to somebody probing. " +
      "`npm run moderation:probe` proves the boundary against the live API as an ordinary member, not as the service role.",
  );
}

w(
  "\n**This is still the section most likely to contradict marketing copy.** " +
    "The queue is read by a founder by hand, with no staffing and no SLA — trust language must not imply review that is faster or more certain than that.",
);

/* --- N2 ----------------------------------------------------------------- */
h2("N2. Age eligibility");
w(
  `**Minimum account age: ${age.minimumAge ?? "unknown"}.** ` +
    "The same age for everyone — Eraya applies no different minimum by gender. " +
    "A member must already have reached that birthday: the rule is a whole-date comparison, never `currentYear - birthYear`, " +
    "which would treat a seventeen-year-old as an adult for most of the year.",
);
w(
  `\nThe rule is defined once, in \`${age.sharedRule ?? "— missing —"}\`, and imported by both clients. ` +
    "Three enforcement points, so bypassing the interface does not bypass the rule:",
);
table(
  ["Enforced at", "Where", "Blocks before write", "Input cannot offer it", "Message is localised"],
  [
    [
      "Web",
      `\`${age.web.file}\``,
      age.web.blocksSubmit ? "yes" : "**no**",
      age.web.picker ? "yes (`max`)" : "**no**",
      age.web.localisedMessage ? "yes" : "**no**",
    ],
    [
      "Mobile",
      `\`${age.mobile.file}\``,
      age.mobile.blocksSubmit ? "yes" : "**no**",
      age.mobile.picker ? "yes (`maximumDate`)" : "**no**",
      age.mobile.localisedMessage ? "yes" : "**no**",
    ],
    [
      "Database",
      `\`${age.database.file ?? "— none —"}\``,
      age.database.expression ? "yes (check constraint)" : "**no**",
      "n/a",
      "n/a",
    ],
  ],
);
w(
  `\nThe database is the boundary that holds when the others are skipped — a direct API call never reaches a client check. ` +
    `\`${age.database.constraint}\` is:\n`,
);
w("```sql");
w(age.database.expression ?? "-- constraint not found in migrations");
w("```");
w(
  "\nRead against the Indian calendar date rather than UTC, so the constraint and the two pickers draw the line on the same day. " +
    "Under `current_date` they disagreed for the five and a half hours after local midnight, which refused people on the morning of their eighteenth birthday.",
);

/* --- N3 ----------------------------------------------------------------- */
h2("N3. Legal documents");
w(
  `Three documents, written as data in \`packages/legal\` and rendered by both clients, so the website and the app cannot describe the same clause differently. ` +
    `Version \`${legal.version ?? "— none —"}\`, in effect from ${legal.effective ?? "— unset —"}.`,
);
table(
  ["Document", "Sections", "Web route", "App screen"],
  legal.documents.map((d) => [
    d.name,
    d.sections > 0 ? `${d.sections}` : "**0 — empty**",
    d.webRoute ? `\`${d.webRoute}\`` : "**missing**",
    d.mobileScreen ? `\`${d.mobileScreen}\`` : "**missing**",
  ]),
);

h3("Where they are surfaced");
table(
  ["Place", "Present", "File"],
  legal.surfaces.map((s) => [s.where, s.present ? "yes" : "**no**", `\`${s.file}\``]),
);

h3("Acceptance");
w(
  "There is no consent checkbox anywhere, and no pre-ticked control. Continuing from the sign-in screen is the act of agreement, and the notice there links both documents so they can be read before an account exists.",
);
bullet(
  `Recorded on \`profiles.legal_version_accepted\` and \`legal_accepted_at\`, written when onboarding completes — website ${legal.acceptance.web ? "yes" : "**no**"}, app ${legal.acceptance.mobile ? "yes" : "**no**"}.`,
);
bullet(
  legal.acceptance.migration
    ? `Migration: \`${legal.acceptance.migration}\`.`
    : "**No migration found for acceptance.**",
);
bullet(
  "Existing accounts are left null rather than backfilled. A backfilled version would manufacture the very evidence the column exists to record.",
);

h3("Languages");
w(
  "The three documents are **English only**, and every screen that shows one says so in the reader's own language. " +
    "The rest of the product speaks six. A machine translation of a privacy policy is indistinguishable from a reviewed one to the person relying on it, so the canonical English governs until a translation has been read by somebody qualified. " +
    "This is why the documents are not in `@eraya/i18n`: key parity there would demand six copies, five of them invented.",
);

h3("Indexing");
w(
  legal.signedInAreaNoindex
    ? "The signed-in area declares `noindex` in its own layout rather than inheriting the site-wide switch, so member profiles at `/discovery/[id]` stay out of search engines on the day `NEXT_PUBLIC_ALLOW_INDEXING` is turned on for the marketing pages."
    : "**The signed-in area does not declare `noindex` of its own**, so enabling site-wide indexing would expose member profiles.",
);

/* --- O ------------------------------------------------------------------ */
h2("O. Accessibility");
w("_Static inspection only. Contrast and screen-reader behaviour were **not** verified at runtime for this package._");
const a11y = [
  ["Semantic landmarks and skip link", "implemented (web)"],
  ["One `<h1>` per page", "convention documented"],
  ["Labelled form controls, `aria-invalid`, `role=\"alert\"`", "implemented (web)"],
  ["Visible focus rings", "defined once in `globals.css`"],
  ["44px+ tap targets", "convention documented"],
  ["`prefers-reduced-motion`", "honoured on the web"],
  ["Image alt text", "mark is `aria-hidden`; wordmark carries the name"],
  ["Screen-reader pass", "**not done**"],
  ["200% zoom testing", "**not done**"],
  ["Dynamic type / font scaling on mobile", "**not verified**"],
];
table(["Item", "State"], a11y);

/* --- P ------------------------------------------------------------------ */
h2("P. Error, loading and empty states");
table(
  ["State", "Handling"],
  [
    ["Payment paid", "`Premium is active`"],
    ["Payment processing", "`Confirming your payment` — never claims no charge"],
    ["Payment cancelled", "`Payment cancelled` — only when the sheet was dismissed"],
    ["Payment failed", "declined; copy does not name the bank or assert no charge"],
    ["Payment unconfirmed", "`unconfirmed` — our fault, kept apart from a decline and excluded from `payment_failed` analytics"],
    ["Checkout unreachable", "`unavailable`"],
    ["Auth failure", "handled at `/auth/*`"],
    ["OTP failure", "handled in the code screens"],
  ],
);

/*
 * Measured rather than asserted. The previous version of this section claimed
 * the list screens' empty states "needed review", for screens that had had them
 * all along -- which sends a reviewer looking for work that does not exist.
 */
w("\n**Per screen.** Web loading and error come from Next's `loading.tsx` / `error.tsx` conventions; mobile holds the branch in the screen.\n");
table(
  ["App", "Screen", "Empty", "Loading", "Error / retry"],
  states.rows.map((r) => [
    r.app,
    r.screen,
    r.empty ? "yes" : "—",
    r.loading ? "yes" : "—",
    r.error ? "yes" : "**no**",
  ]),
);

w(
  states.webErrorBoundaries.length
    ? `\nWeb error boundaries: ${states.webErrorBoundaries.map((f) => `\`${f}\``).join(", ")}.`
    : "\n> **The web app has no `error.tsx` or `global-error.tsx` anywhere.** Any throw in a server component replaces the product with Next's default error page.",
);

w(
  "\n_A screen with no error branch is not neutral: every one of these fetches returns an empty list when it fails, " +
    "so the member is told there is nobody to introduce when in fact the request never arrived. " +
    "Empty and broken are different sentences and the product must not confuse them._",
);

/* --- Q ------------------------------------------------------------------ */
h2("Q. Analytics");
table(
  ["Event", "Recorded by", "Accepted by the table"],
  events.recorded.map((e) => [
    `\`${e}\``,
    events.server.includes(e) ? "the database, on the write itself" : "a client",
    events.allowed.includes(e) ? "yes" : "**NO — silently discarded**",
  ]),
);

/*
 * The line that matters. `product_events` constrains `event` to a known list
 * and the recording function swallows every exception, so a name that is not on
 * the list produces no error, no log and no row. A funnel broken that way reads
 * exactly like a product nobody is using, which is the wrong conclusion and the
 * easier one to reach.
 */
if (events.unrecordable.length) {
  w(
    `\n> **${events.unrecordable.length} event(s) are being thrown away right now:** ` +
      `${events.unrecordable.map((e) => `\`${e}\``).join(", ")}. ` +
      "They are recorded by the code but rejected by the `product_events_known_event` constraint, " +
      "and the recording function swallows the error — so nothing anywhere reports this. " +
      "Adding an event is two changes: the instrumentation, and the allowlist.",
  );
} else {
  w(
    `\n**${events.recorded.length} events, and every one of them is on the allowlist.** ` +
      `${events.server.length} are recorded by the database on the write itself, which is why the two clients ` +
      "cannot drift or double-count, and why no event can carry anything personal — the recording function takes " +
      "an event name and payment fields, and reads the actor from the session. " +
      "`npm run analytics:probe` proves each one by performing the transition and looking for the row.",
  );
}

if (events.unused.length) {
  w(
    `\n_On the allowlist but recorded by nothing: ${events.unused.map((e) => `\`${e}\``).join(", ")}._`,
  );
}

/* --- R ------------------------------------------------------------------ */
h2("R. Backend surface");
table(
  ["Kind", "Items"],
  [
    ["Edge functions", backend.edgeFunctions.map((f) => `\`${f}\``).join(", ")],
    ["Route handlers", backend.routeHandlers.map((f) => `\`${f.replace("apps/web/src/app", "…")}\``).join(", ") || "—"],
    ["Server actions", backend.serverActions.map((f) => `\`${f}\``).join(", ") || "—"],
    ["RPCs called by clients", backend.rpcsCalled.map((r) => `\`${r}\``).join(", ")],
  ],
);
h3("Security assumptions");
bullet("Row Level Security is the authorisation boundary. Middleware and UI checks are conveniences.");
bullet("`subscriptions` has no client insert/update/delete policy — membership is written only by what takes the money, under the service role.");
bullet("Functions revoke EXECUTE from `public` and `anon` then grant to `authenticated`; `revoke ... from anon` alone would do nothing because `anon` inherits from PUBLIC. `npm run security` checks this.");
bullet("CORS on edge functions is `*` deliberately: the mobile app calls them with no browser origin, and they are protected by JWT verification rather than by origin.");

/* --- S ------------------------------------------------------------------ */
h2("S. Database schema");
w(`${db.migrationCount} migrations. ${db.tables.length} tables, ${db.rlsEnabled.length} with RLS enabled, ${db.functions.length} functions.`);
h3("Tables");
w(db.tables.map((t) => `\`${t}\``).join(" · "));
h3("Row Level Security");
const noRls = db.tables.filter((t) => !db.rlsEnabled.includes(t));
table(
  ["Table", "RLS", "Policies"],
  db.tables.map((t) => [
    `\`${t}\``,
    db.rlsEnabled.includes(t) ? "enabled" : "**NOT ENABLED**",
    (db.policies[t] ?? []).length ? String((db.policies[t] ?? []).length) : "**none**",
  ]),
);
if (noRls.length) {
  w(`\n**Tables without an RLS statement:** ${noRls.map((t) => `\`${t}\``).join(", ")} — worth confirming each is deliberate.`);
} else {
  w("\nEvery table has RLS enabled.");
}
w(
  "\nPolicy count matters as much as the flag: RLS enabled with no policy denies everything, which is safe but usually " +
    "means the table is reached only through `SECURITY DEFINER` functions. Both are legitimate here — the functions are the " +
    "boundary for anything a member should not query directly.",
);
h3("Recent migrations");
db.latest.forEach((m) => bullet(`\`${m}\``));

/* --- T ------------------------------------------------------------------ */
h2("T. Known gaps and technical debt");
h3("Pre-launch blockers (from `docs/07-open-questions.md`)");
debt.preLaunchBlockers.forEach((b) => bullet(b));
h3("Code markers");
if (!debt.codeMarkers.length) {
  w("No `TODO`, `FIXME` or `HACK` comments in first-party source. Known gaps live in `docs/07-open-questions.md` instead, which is the convention here.");
} else {
  table(["File", "Line", "Marker"], debt.codeMarkers.map((m) => [`\`${m.file}\``, m.line, m.text]));
}

/* --- U ------------------------------------------------------------------ */
h2("U. Changes since the last review package");
if (!previous) {
  w("**First package.** No previous manifest to compare against — `artifacts/review/manifest.json` has been written for next time.");
} else {
  w(`Comparing against commit \`${String(previous.commit).slice(0, 7)}\` generated ${previous.generatedAt}.`);
  const labels = {
    webRoutes: "Web routes",
    mobileScreens: "Mobile screens",
    androidPermissions: "Android permissions",
    analyticsEvents: "Analytics events",
    plans: "Plans and prices",
    tables: "Database tables",
    edgeFunctions: "Edge functions",
    authProviders: "Enabled auth providers",
  };
  const rows = [];
  for (const key of Object.keys(labels)) {
    const d = diffSurface(key);
    if (!d) continue;
    rows.push([
      labels[key],
      d.added.length ? `**NEW:** ${d.added.join(", ")}` : "—",
      d.removed.length ? `**REMOVED:** ${d.removed.join(", ")}` : "—",
      `${d.unchanged} unchanged`,
    ]);
  }
  table(["Surface", "Added", "Removed", "Status"], rows);
  w("\n_Focus this review on the deltas above rather than re-reading the whole product._");
}

/* --- V ------------------------------------------------------------------ */
h2("V. Screenshots");
w(
  "**Not generated.** No E2E or browser-automation tooling exists in this repository, and introducing a headless browser " +
    "stack purely for screenshots would add a fragile dependency that breaks on its own schedule — the opposite of what a " +
    "repeatable review workflow needs.",
);
w(
  "\nThe screen inventory in section C is the substitute: every route, its file, and whether it is public or signed-in. " +
    "If visual review is needed, the running product is at the deployed URL and `npm run demo:seed` populates clearly " +
    "fictional members (`@demo.eraya.invalid`) for a realistic signed-in view without touching real people.",
);

/* --- W ------------------------------------------------------------------ */
h2("W. Automated checks");
table(
  ["Check", "Result", "Detail"],
  checks.map((c) => [
    c.name,
    c.status === "pass" ? "✅ pass" : c.status === "fail" ? "❌ **fail**" : c.status === "could not run" ? "⚠ could not run" : c.status,
    /*
     * A probe detail is prose that already contains code spans, so it is not
     * wrapped again -- doing so produced a doubled backtick and swallowed the
     * markup. A failure detail is raw compiler output, which does need it.
     */
    c.detail
      ? c.status === "not run here" || c.status === "absent"
        ? String(c.detail)
        : `\`${String(c.detail).split("\n")[0].slice(0, 120)}\``
      : c.seconds
        ? `${c.seconds}s`
        : "",
  ]),
);
w(
  "\n_The probes above are the only checks that test a boundary rather than a type. " +
    "Each signs in as an ordinary member against the live project, which is the only way to prove that an unauthorised caller " +
    "is actually refused — and the reason a document generator must not run them on its own._",
);

/* --- X ------------------------------------------------------------------ */
h2("X. Observations from the repository");
w("_Hand-maintained, ordered by consequence._");
table(
  ["Severity", "Observation", "Evidence"],
  narrative.observations.map(([sev, text, where]) => [`**${sev}**`, text, `\`${where}\``]),
);

/* --- Y ------------------------------------------------------------------ */
h2("Y. Questions for this review");
w("Please review this build for:");
w("");
[
  "Product and UX issues",
  "Trust and safety concerns",
  "Copywriting issues",
  "Brand consistency",
  "Mobile/web inconsistencies",
  "Payment and membership issues",
  "Missing states and journeys",
  "Unnecessary permissions",
  "Launch blockers",
  "What should **not** be changed",
].forEach((q, i) => w(`${i + 1}. ${q}`));
w(
  "\nContext worth holding while reviewing: Eraya serves divorced, separated and widowed adults in India, many over 40 and " +
    "many not confident with apps. Every screen must work for someone who is not technical, on a phone, without instructions. " +
    "It is deliberately not a dating app and not a matrimony site. A trust mark that runs ahead of what the system actually " +
    "checks is treated as worse than none, because the person relying on it is a stranger deciding whether to meet someone.",
);

/* ------------------------------------------------------------------------ */
/* Write                                                                     */
/* ------------------------------------------------------------------------ */

mkdirSync(REVIEW_DIR, { recursive: true });

const document = redact(lines.join("\n") + "\n");
const leaks = auditForSecrets(document);

writeFileSync(OUT_FILE, document, "utf8");
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
writeFileSync(
  join(REVIEW_DIR, "checks.json"),
  JSON.stringify({ generatedAt: meta.generatedAt, commit: meta.commit, checks }, null, 2),
  "utf8",
);

const kb = Math.round(document.length / 1024);
console.log("");
console.log(`  Review package : artifacts/eraya-review-package.md  (${kb} KB, ${document.split("\n").length} lines)`);
console.log(`  Manifest       : artifacts/review/manifest.json`);
console.log(`  Checks         : artifacts/review/checks.json`);
console.log(`  Commit         : ${meta.commitShort}${meta.dirty ? " (working tree dirty)" : ""}`);
console.log(`  Secret audit   : ${leaks.length ? `⚠ ${leaks.join(", ")}` : "clean"}`);
console.log("");
console.log("  Upload artifacts/eraya-review-package.md to ChatGPT.");

if (leaks.length) process.exitCode = 1;
