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
    ["Account deletion", "apps/mobile/src/features/account/delete.ts"],
    ["Blocking", "apps/mobile/app/you/blocked.tsx, supabase/migrations/*connection_tables*"],
  ],

  mockedOrIncomplete: [
    ["Phone verification is a stub — any six digits pass while OTP_DEV_CODE is set; no SMS is sent. Deferred deliberately: real SMS needs DLT registration", "apps/web/.env.example, supabase/functions/phone-otp-*", "mocked"],
    ["Razorpay is in TEST mode — no real money moves", "mode is read from the key prefix, supabase/functions/_shared/razorpay.ts", "test-only"],
    ["Privacy policy and terms are placeholders; DPDP Act applies", "apps/web/src/app/(marketing)/privacy, terms", "launch blocker"],
    ["No profile review, photo review or automated moderation exists", "—", "absent"],
    ["International cards are refused by the Razorpay account (international_transaction_not_allowed)", "commercial setting, not code", "blocked"],
    ["Product is deployed but noindex — invisible to search until launch", "apps/web/next.config.ts, apps/web/src/app/layout.tsx", "deliberate"],
  ],

  /* Trust claims are the ones most worth auditing, so they are called out. */
  trustNotes: [
    "No trust badge is shown for anything Eraya has not actually checked. Phone verification is mocked, so no member is shown a 'phone verified' mark on another member's card — deliberate, documented in CLAUDE.md.",
    "Copy is constrained to claims defensible on launch day: no member counts, no testimonials, no '100% verified'.",
  ],

  journeys: [
    ["New user registration", "Email address → six-digit code → onboarding. No password exists anywhere in the product.", "Nothing verifies identity beyond control of the mailbox."],
    ["Email authentication", "Supabase OTP; the email carries a code, never a link, because a PKCE link cannot be opened on a different device from the one that requested it.", "Deliverability depends on Resend; sender is no-reply@eraya.app."],
    ["Phone verification", "Six digits collected and stored against the profile.", "MOCKED — any six digits pass while OTP_DEV_CODE is set. Real DLT-registered SMS is a launch blocker."],
    ["Onboarding", "Nine steps on mobile, five on web. Photo is optional; a profile without one is complete.", "Web and mobile ask for different things — see the screen inventory."],
    ["Discovery", "A considered few rather than an endless feed. Filters are free-tier.", "Behaviour with an empty result set needs review."],
    ["Expressing interest / connection", "Interest is one-way until reciprocated; a connection opens messaging.", "Who has expressed interest in you is a premium capability."],
    ["Messaging", "Only between connected members.", "No moderation, no reporting inside a thread."],
    ["Premium purchase", "Server creates and prices the order; client opens /checkout in a browser; signature verified server-side; settle_payment is idempotent.", "Verified end to end in test mode."],
    ["Premium expiry", "Premium is a date, not a boolean — active only while current_period_end > now().", "No renewal reminder exists."],
    ["Blocking", "Blocks are enforced in the database, not the UI.", "No notification to either party."],
    ["Reporting", "Rows can be written.", "Nothing reads them. No queue, no tooling, no SLA."],
    ["Account deletion", "`delete_my_account()` takes the id from the session, deletes the member's objects from the `profile-photos` bucket first, then deletes the auth user so everything else cascades. Audit rows keep history with a null actor.", "Files go first deliberately — the reverse order would orphan objects with no owner to attribute them to. Note this applies to the product's own deletion path; deleting a user through the Supabase admin API bypasses it and leaves objects behind."],
  ],

  observations: [
    ["launch blocker", "Privacy policy and terms are placeholders. India's DPDP Act applies and both app stores require them.", "apps/web/src/app/(marketing)/{privacy,terms}"],
    ["trust", "Phone verification accepts any six digits. Anything in the product that implies a verified number is currently untrue.", "supabase/functions/phone-otp-*"],
    ["product", "Analytics cover payments only. Registration, onboarding, discovery, interest, connection and messaging emit no events, so there is no funnel before the paywall.", "grep for recordProductEvent"],
    ["safety", "Reports can be filed but nothing reads them: no queue, no tooling, no one accountable. Trust copy must not imply review that does not happen.", "supabase/migrations/*connection_tables*"],
    ["UX", "Web and mobile onboarding ask for different fields. Someone starting on one and finishing on the other meets an inconsistent product.", "onboarding routes in both apps"],
    ["safety", "Reporting and blocking write rows, but nothing reads reports. Trust copy should not imply review that does not happen.", "supabase/migrations/*connection_tables*"],
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
const db = collect.schema();
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
    analyticsEvents: events,
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
bullet("Any string implying verification: phone verification is mocked, so wording must not imply a checked number.");
bullet("Payment failure copy must not assert 'you have not been charged' unless the server established it.");
bullet("Mobile strings are inline and therefore drift from the web's wording without anything catching it.");

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
    ["Phone verification", auth.otpDevCodeDocumented ? "**MOCKED** — `OTP_DEV_CODE` makes the OTP functions accept one fixed code and send no SMS" : "real"],
    ["Email templates in VCS", auth.emailTemplates.join(", ") || "none"],
    ["Transactional sender", `\`${auth.smtpSender}\``],
    ["Session", "Supabase SSR cookies on web; `expo-secure-store` on mobile"],
    ["Redirect allowlist", `${auth.redirectUrls.length} entries — anything unlisted fails as an error, not a session`],
  ],
);
bullet("`src/proxy.ts` refreshes the session on every rendered request. It is an optimistic check, **not** the authorisation boundary — Row Level Security is.");
bullet("**Flag:** phone verification is mocked. Any copy or badge implying a checked number is currently untrue.");

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
    ["Phone number", "`profiles` / phone verification tables", "verification is mocked"],
    ["Payment metadata", "`payments`", "order and payment ids, amount, status — no card data ever"],
    ["Analytics", "`product_events`", "no client-readable rows"],
    ["Audit", "`auth_events`, `payment_events`", "actor set to null on account deletion — history kept, person unlinked"],
  ],
);
bullet("Account deletion cascades from `auth.users` through `profiles` to languages, subscriptions, blocks, connections, messages and reports.");
bullet("Razorpay receives no name, address or contact details — only an order note tying a payment to a member and plan.");
bullet("Account deletion removes the member's objects from the `profile-photos` bucket before deleting the auth row — storage is handled, not left to the foreign keys that cannot reach it.");

/* --- N ------------------------------------------------------------------ */
h2("N. Moderation and safety");
table(
  ["Capability", "State"],
  [
    ["Block", "**implemented** — enforced in the database"],
    ["Report", "**partial** — rows can be written; nothing reads them"],
    ["Moderation queue", "**does not exist**"],
    ["Moderation tooling", "**does not exist**"],
    ["Profile review before going live", "**does not exist**"],
    ["Photo review", "**does not exist**"],
    ["Automated moderation", "**does not exist**"],
    ["Human moderation / escalation", "**does not exist**"],
    ["Support address", "`support@eraya.app` — live"],
  ],
);
w("\n**This is the section most likely to contradict marketing copy.** Trust language must not imply review that does not happen.");

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
    ["Empty discovery", "**needs review — not confirmed present**"],
    ["No connections / no messages", "**needs review — not confirmed present**"],
    ["Offline", "**no explicit handling found**"],
  ],
);

/* --- Q ------------------------------------------------------------------ */
h2("Q. Analytics");
table(["Event", "Area"], events.map((e) => [`\`${e}\``, e.startsWith("payment") || e.startsWith("premium") || e.startsWith("membership") ? "payments" : "other"]));
w(
  `\n**${events.length} events, all in the payment funnel.** No events exist for registration, onboarding completion, ` +
    "discovery, expressing interest, connection, or messaging — so there is no measurable funnel before the paywall.",
);

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
    c.detail ? `\`${String(c.detail).split("\n")[0].slice(0, 120)}\`` : c.seconds ? `${c.seconds}s` : "",
  ]),
);
bullet("`npm run security` — 50 Row Level Security probes against a throwaway account. Not run here to avoid touching the live project; run it separately.");
bullet("`npm run payments:probe` — 23 payment-rule probes, same reason.");

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
