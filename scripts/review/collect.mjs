/**
 * Everything the review package knows, read from the repository.
 *
 * The rule this file follows: derive, never restate. A value that is hardcoded
 * here is a value that goes stale silently, and a review package that quietly
 * describes last month's product is worse than no package at all. So prices
 * come from the seed migration, permissions from `app.json`, routes from the
 * filesystem, and design tokens from the stylesheet that Tailwind actually
 * compiles.
 *
 * Where something genuinely cannot be derived -- what a screen is *for*, why a
 * flow is incomplete -- it lives in `narrative` inside the generator, marked as
 * hand-maintained, so nobody mistakes prose for a measurement.
 *
 * Nothing here reads the production database. Fixtures and migrations only.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const ROOT = process.cwd();

const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), "utf8");
  } catch {
    return "";
  }
};

const readJson = (p) => {
  try {
    return JSON.parse(read(p));
  } catch {
    return null;
  }
};

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

/** Walk a directory, returning repo-relative paths of files matching `test`. */
function walk(dir, test, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, test, out);
    else if (test(entry)) out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------------------
// A. Build metadata
// ---------------------------------------------------------------------------

export function buildMetadata() {
  const status = git("status", "--porcelain");
  const web = readJson("apps/web/package.json") ?? {};
  const mobile = readJson("apps/mobile/package.json") ?? {};
  const app = readJson("apps/mobile/app.json")?.expo ?? {};

  return {
    generatedAt: new Date().toISOString(),
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    commit: git("rev-parse", "HEAD"),
    commitShort: git("rev-parse", "--short", "HEAD"),
    commitDate: git("log", "-1", "--format=%cI"),
    dirty: status.length > 0,
    dirtyFiles: status ? status.split("\n").map((l) => l.trim()) : [],
    recentCommits: git("log", "-15", "--format=%h|%cs|%s")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, date, ...rest] = line.split("|");
        return { sha, date, subject: rest.join("|") };
      }),
    web: {
      next: web.dependencies?.next,
      react: web.dependencies?.react,
      tailwind: web.devDependencies?.tailwindcss,
    },
    mobile: {
      expo: mobile.dependencies?.expo,
      reactNative: mobile.dependencies?.["react-native"],
      expoRouter: mobile.dependencies?.["expo-router"],
      appVersion: app.version,
      scheme: app.scheme,
      androidPackage: app.android?.package,
    },
    deployment: deployment(),
  };
}

function deployment() {
  const wrangler = read("apps/web/wrangler.jsonc");
  const workflow = read(".github/workflows/deploy-web.yml");
  const name = wrangler.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
  const compat = wrangler.match(/"compatibility_date"\s*:\s*"([^"]+)"/)?.[1];
  return {
    host: wrangler ? "Cloudflare Workers (@opennextjs/cloudflare)" : "unknown",
    workerName: name,
    compatibilityDate: compat,
    pipeline: workflow ? ".github/workflows/deploy-web.yml" : "none",
    trigger: workflow.match(/branches:\s*\[([^\]]+)\]/)?.[1]?.trim(),
    /* Absence is the whole point of this one -- see the indexing note in the
       generator. Reported rather than assumed. */
    indexingAllowedInPipeline: /NEXT_PUBLIC_ALLOW_INDEXING\s*:/.test(workflow),
  };
}

// ---------------------------------------------------------------------------
// C. Screens
// ---------------------------------------------------------------------------

/** Next.js App Router: a folder defines a URL; groups in (parens) do not. */
export function webRoutes() {
  return walk("apps/web/src/app", (f) => f === "page.tsx" || f === "route.ts")
    .map((file) => {
      const segments = relative(join(ROOT, "apps/web/src/app"), join(ROOT, file))
        .split(sep)
        .slice(0, -1)
        .filter((s) => !s.startsWith("(") && s !== "");
      const url = "/" + segments.join("/");
      const source = read(file);
      return {
        route: url === "/" ? "/" : url.replace(/\/$/, ""),
        file,
        kind: file.endsWith("route.ts") ? "route handler" : "page",
        authed: file.includes("(app)"),
        group: file.match(/\((app|auth|marketing)\)/)?.[1] ?? "root",
        noindex: /robots:\s*\{\s*index:\s*false/.test(source),
        dynamic: /\[[^\]]+\]/.test(url),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

/** Expo Router: same idea, minus `_layout` files, plus tab membership. */
export function mobileRoutes() {
  return walk("apps/mobile/app", (f) => f.endsWith(".tsx"))
    .filter((f) => !f.endsWith("_layout.tsx"))
    .map((file) => {
      const rel = relative(join(ROOT, "apps/mobile/app"), join(ROOT, file))
        .replace(/\.tsx$/, "")
        .split(sep);
      const segments = rel.filter((s) => !s.startsWith("("));
      const name = segments.join("/").replace(/\/index$/, "") || "index";
      return {
        screen: name,
        file,
        tab: file.includes("(tabs)"),
        onboarding: file.includes("/onboarding/"),
        dynamic: /\[[^\]]+\]/.test(name),
      };
    })
    .sort((a, b) => a.screen.localeCompare(b.screen));
}

// ---------------------------------------------------------------------------
// F. Copy
// ---------------------------------------------------------------------------

/**
 * Copy lives in `content.ts` per feature on the web, by convention (nothing
 * user-facing is written inside a component). The mobile app has no equivalent
 * -- its strings are inline -- which is itself worth reporting.
 */
export function copyInventory() {
  const files = walk("apps/web/src/features", (f) => f === "content.ts");
  const strings = [];
  for (const file of files) {
    const source = read(file);
    for (const m of source.matchAll(/"((?:[^"\\]|\\.){12,240})"/g)) {
      const text = m[1].replace(/\\"/g, '"');
      // Identifiers, classes and paths are not copy.
      if (/^[a-z-]+$/.test(text)) continue;
      if (/^[#/.]|^https?:|^[a-z]+:[a-z]/.test(text)) continue;
      if (!/[A-Z]/.test(text) && !text.includes(" ")) continue;
      if (!text.includes(" ")) continue;
      strings.push({ file, text });
    }
  }
  const mobileInline = walk("apps/mobile/app", (f) => f.endsWith(".tsx")).length;
  return { files, strings, mobileHasContentModule: false, mobileScreenFiles: mobileInline };
}

// ---------------------------------------------------------------------------
// G. Design tokens
// ---------------------------------------------------------------------------

export function designTokens() {
  const css = read("apps/web/src/app/globals.css");
  const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const web = [...block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => ({
    name: `--${m[1]}`,
    value: m[2].trim(),
  }));

  const mobileSrc = read("apps/mobile/src/theme/tokens.ts");
  const mobile = [...mobileSrc.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*("?[^,\n]+"?),/gm)].map(
    (m) => ({ name: m[1], value: m[2].replace(/"/g, "") }),
  );

  // Colour literals outside the two token files are the documented smell.
  const offenders = [];
  for (const file of [
    ...walk("apps/web/src", (f) => f.endsWith(".tsx") || f.endsWith(".ts")),
    ...walk("apps/mobile/src", (f) => f.endsWith(".tsx") || f.endsWith(".ts")),
    ...walk("apps/mobile/app", (f) => f.endsWith(".tsx")),
  ]) {
    if (file.includes("/theme/") || file.includes("shared/brand/")) continue;
    const hits = [...read(file).matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
    if (hits.length) offenders.push({ file, literals: [...new Set(hits)] });
  }

  return { web, mobile, colourLiteralsOutsideTokens: offenders };
}

// ---------------------------------------------------------------------------
// H / I. Brand and permissions
// ---------------------------------------------------------------------------

export function brandUsage() {
  const assets = existsSync(join(ROOT, "assets/brand"))
    ? readdirSync(join(ROOT, "assets/brand")).filter((f) => f.endsWith(".svg"))
    : [];
  const markModule = read("apps/web/src/shared/brand/mark.ts");
  const favicon = read("assets/brand/eraya-approved-favicon.svg");
  const pathsInModule = [...markModule.matchAll(/"M [^"]+"/g)].map((m) => m[0]);
  const geometryMatches =
    pathsInModule.length > 0 && pathsInModule.every((p) => favicon.includes(p.slice(1, -1)));

  return {
    assets,
    markModule: "apps/web/src/shared/brand/mark.ts",
    geometryMatchesApprovedAsset: geometryMatches,
    consumers: [
      ...walk("apps/web/src", (f) => f.endsWith(".tsx")),
      ...walk("apps/mobile/src", (f) => f.endsWith(".tsx")),
      ...walk("apps/mobile/app", (f) => f.endsWith(".tsx")),
    ].filter((f) => /ErayaMark|erayaMarkPaths|<Logo|eraya-mark/.test(read(f))),
    appIcon: readJson("apps/mobile/app.json")?.expo?.icon,
    splash: readJson("apps/mobile/app.json")?.expo?.plugins?.find?.(
      (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
    )?.[1],
  };
}

export function permissions() {
  const app = readJson("apps/mobile/app.json")?.expo ?? {};
  const android = app.android?.permissions ?? [];
  const ios = app.ios?.infoPlist ?? {};
  const plugins = app.plugins ?? [];

  /*
   * A permission nothing references is the flag worth raising -- so the
   * detector has to be right in both directions.
   *
   * Comments are stripped first and matching is anchored on imports and real
   * API names. An earlier version searched for the bare word "Recording" and
   * matched two prose comments ("Recording is fire-and-forget"), which reported
   * the microphone as used and silently buried the finding. Prose is not
   * evidence of capability.
   */
  const sources = [
    ...walk("apps/mobile/src", (f) => f.endsWith(".ts") || f.endsWith(".tsx")),
    ...walk("apps/mobile/app", (f) => f.endsWith(".tsx")),
  ]
    .map(read)
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  const imports = (pkg) => new RegExp(`from\\s+["']${pkg}["']`).test(sources);

  const evidence = {
    camera: imports("expo-camera") || /launchCameraAsync/.test(sources),
    photos:
      imports("expo-image-picker") || imports("expo-media-library") || /launchImageLibraryAsync/.test(sources),
    microphone:
      imports("expo-av") ||
      imports("expo-audio") ||
      /\bAudio\.Recording\b|\bMediaRecorder\b|\buseAudioRecorder\b/.test(sources),
    notifications: imports("expo-notifications"),
    location: imports("expo-location"),
    contacts: imports("expo-contacts"),
  };

  return { android, ios, plugins: plugins.map((p) => (Array.isArray(p) ? p[0] : p)), evidence };
}

// ---------------------------------------------------------------------------
// J / K. Auth, payments, plans
// ---------------------------------------------------------------------------

export function authConfig() {
  const toml = read("supabase/config.toml");
  const providers = [...toml.matchAll(/\[auth\.external\.([a-z]+)\]\s*\nenabled\s*=\s*(true|false)/g)].map(
    (m) => ({ provider: m[1], enabled: m[2] === "true" }),
  );
  return {
    siteUrl: toml.match(/^site_url\s*=\s*"([^"]+)"/m)?.[1],
    redirectUrls: (toml.match(/additional_redirect_urls\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/"/g, ""))
      .filter(Boolean),
    providers,
    smtpSender: toml.match(/admin_email\s*=\s*"([^"]+)"/)?.[1],
    emailTemplates: [...toml.matchAll(/\[auth\.email\.template\.([a-z_]+)\]/g)].map((m) => m[1]),
    phoneAuthEnabled: /\[auth\.sms\][\s\S]*?enable_signup\s*=\s*true/.test(toml),
    /* The stub that makes phone "verification" accept any code. Detected, not
       assumed, because it is the single most consequential mock in the app. */
    otpDevCodeDocumented: /OTP_DEV_CODE/.test(read("apps/web/.env.example")),
  };
}

/**
 * Prices and plan flags, from migrations -- never from the live database.
 *
 * Reading the seed alone is not enough, and getting that wrong once produced a
 * review package claiming the monthly plan auto-renewed. It never did: the
 * catalogue was seeded with `is_recurring = true` on an early assumption of a
 * mandate, and a later migration clears it with the reasoning written out. A
 * generator that stops at the seed reports a product decision that was reversed
 * months ago, and reviewers then raise it as a bug.
 *
 * So later migrations are replayed over the seed for the flags that matter.
 */
export function plans() {
  const seedFile = "supabase/migrations/20260826100600_seed_membership.sql";
  const seed = read(seedFile);
  const rows = [...seed.matchAll(
    /\(\s*'([a-z_]+)',\s*'([^']+)',\s*'([a-z]+)',\s*(\d+),\s*(\d+),\s*(\d+|null),\s*(\d+|null),\s*(true|false),\s*(\d+)\s*\)/g,
  )].map((m) => ({
    code: m[1],
    name: m[2],
    tier: m[3],
    periodMonths: Number(m[4]),
    pricePaise: Number(m[5]),
    introPricePaise: m[6] === "null" ? null : Number(m[6]),
    introPeriodMonths: m[7] === "null" ? null : Number(m[7]),
    isRecurring: m[8] === "true",
  }));

  // Replay later corrections to `is_recurring` in migration order.
  const migrations = existsSync(join(ROOT, "supabase/migrations"))
    ? readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()
    : [];
  const corrections = [];
  for (const file of migrations) {
    if (`supabase/migrations/${file}` === seedFile) continue;
    const sql = read(`supabase/migrations/${file}`);
    for (const m of sql.matchAll(
      /update\s+public\.membership_plans\s+set\s+is_recurring\s*=\s*(true|false)([\s\S]{0,200}?);/g,
    )) {
      const value = m[1] === "true";
      const scope = m[2];
      const code = scope.match(/code\s*=\s*'([a-z_]+)'/)?.[1] ?? null;
      corrections.push({ file, value, code });
      for (const row of rows) {
        if (code === null || row.code === code) row.isRecurring = value;
      }
    }
  }

  return {
    source: seedFile,
    corrections,
    rows,
    /* The product invariant, stated so a reviewer can check it at a glance. */
    allPrepaid: rows.every((r) => !r.isRecurring),
  };
}

/**
 * The free/premium matrix, read from the seed rather than from the client.
 *
 * Both tiers are seeded side by side with a human description, which makes the
 * migration the honest source: the TypeScript fallback only describes what
 * happens when the table is unreachable.
 */
export function entitlementMatrix() {
  const seed = read("supabase/migrations/20260826100600_seed_membership.sql");
  const rows = [...seed.matchAll(
    /\(\s*'(free|premium)',\s*'([A-Za-z]+)',\s*'(boolean|number)',\s*'([^']*)',\s*'([^']*)'\s*\)/g,
  )];
  const byKey = new Map();
  for (const [, tier, key, kind, value, description] of rows) {
    if (!byKey.has(key)) byKey.set(key, { capability: key, kind, description });
    byKey.get(key)[tier] = value;
  }

  // What the client falls back to when the table cannot be read.
  const src = read("apps/web/src/features/membership/entitlements.ts");
  const block = src.match(/const FREE_FALLBACK:\s*Entitlements\s*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  const fallback = Object.fromEntries(
    [...block.matchAll(/^\s*([a-zA-Z]+):\s*([^,]+),/gm)].map((m) => [m[1], m[2].trim().replace(/"/g, "")]),
  );

  return {
    source: "supabase/migrations/20260826100600_seed_membership.sql",
    rows: [...byKey.values()].map((r) => ({ ...r, fallback: fallback[r.capability] })),
  };
}

export function paymentSurface() {
  const fns = existsSync(join(ROOT, "supabase/functions"))
    ? readdirSync(join(ROOT, "supabase/functions")).filter((d) => !d.startsWith("_"))
    : [];
  const shared = read("supabase/functions/_shared/razorpay.ts");
  return {
    edgeFunctions: fns,
    modeDecidedBy: /rzp_live_/.test(shared) ? "key prefix (rzp_test_ / rzp_live_)" : "unknown",
    webhookPath: fns.includes("payments-webhook")
      ? "<supabase-project>.supabase.co/functions/v1/payments-webhook"
      : null,
    checkoutPage: existsSync(join(ROOT, "apps/web/src/app/checkout/page.tsx"))
      ? "apps/web/src/app/checkout/page.tsx"
      : null,
    serverPriced: /membership_catalogue/.test(read("apps/mobile/src/features/membership/payments.ts")),
  };
}

// ---------------------------------------------------------------------------
// Q / R / S. Analytics, backend, schema
// ---------------------------------------------------------------------------

/**
 * The funnel, and the one thing about it that fails without saying so.
 *
 * `product_events` constrains `event` to a known list, and the recording
 * function swallows every exception so a measurement can never break a
 * purchase. An event name that is not on the list is therefore dropped in
 * silence: no error, no log, no row, and a funnel that reads as "nobody is
 * using the product" rather than "the pipeline is broken".
 *
 * So this reports three things and compares them. Which events the clients
 * record, which the database records, and which the constraint will accept.
 * `unrecordable` is the interesting one -- anything in it is being thrown away
 * right now.
 */
export function analyticsEvents() {
  const clientFiles = [
    ...walk("apps/web/src", (f) => f.endsWith(".ts") || f.endsWith(".tsx")),
    ...walk("apps/mobile/src", (f) => f.endsWith(".ts")),
    ...walk("apps/mobile/app", (f) => f.endsWith(".tsx")),
  ];

  const client = new Set();
  for (const file of clientFiles) {
    const text = read(file);
    for (const m of text.matchAll(/record(?:ProductEvent)?\(\s*"([a-z_]+)"/g)) client.add(m[1]);
    // Both clients type the call with this union, so it is the complete list.
    for (const union of text.matchAll(/export type ProductEvent\s*=([^;]+);/g)) {
      for (const name of union[1].matchAll(/"([a-z_]+)"/g)) client.add(name[1]);
    }
  }

  const migrations = existsSync(join(ROOT, "supabase/migrations"))
    ? readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()
    : [];
  const sql = migrations.map((f) => read(`supabase/migrations/${f}`)).join("\n");

  const server = new Set();
  for (const m of sql.matchAll(/record_product_event\(\s*'([a-z_]+)'/g)) server.add(m[1]);
  // Triggers that insert straight into the table, having no session to read.
  for (const m of sql.matchAll(/values\s*\(\s*'([a-z_]+)'\s*,\s*new\./g)) server.add(m[1]);

  /*
   * The last `product_events_known_event` constraint in migration order wins,
   * because a later migration drops and recreates it.
   */
  const constraints = [...sql.matchAll(/constraint product_events_known_event check \(\s*event in \(([^)]*)\)/g)];
  const allowed = new Set(
    constraints.length
      ? [...constraints[constraints.length - 1][1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
      : [],
  );

  const recorded = [...new Set([...client, ...server])].sort();

  return {
    client: [...client].sort(),
    server: [...server].sort(),
    allowed: [...allowed].sort(),
    recorded,
    unrecordable: recorded.filter((e) => !allowed.has(e)),
    unused: [...allowed].filter((e) => !recorded.includes(e)).sort(),
  };
}

/**
 * What each client asks during onboarding.
 *
 * Derived from the writes rather than from the screens, because the screens are
 * where the two apps look different and the columns are where that difference
 * actually costs something. A field one client collects and the other does not
 * is a profile that means different things depending on where it was made --
 * and the consequence is rarely a missing label. `seeking` was absent from the
 * web for months: the matcher reads an unset preference as "no constraint", so
 * those members were shown to everyone and their own answer was never applied.
 */
export function onboardingParity() {
  /*
   * Both lists include the app's own photo module, because in both clients the
   * photo step calls into `features/account/photos` rather than writing the row
   * itself. Reading only the onboarding folders would report photos as absent on
   * whichever side happened to be checked that way -- a difference in where the
   * code lives, reported as a difference in what the product asks.
   */
  const webFiles = [
    ...walk("apps/web/src/features/auth", (f) => f.endsWith(".ts") || f.endsWith(".tsx")),
    ...walk("apps/web/src/features/account", (f) => f === "photos.ts"),
  ];
  const mobileFiles = [
    ...walk("apps/mobile/src/features/onboarding", (f) => f.endsWith(".ts")),
    ...walk("apps/mobile/app/onboarding", (f) => f.endsWith(".tsx")),
    ...walk("apps/mobile/src/features/account", (f) => f === "photos.ts"),
  ];

  /*
   * Columns named in an update/upsert payload. Web writes through server
   * actions with `.update({ ... })`, mobile through `patch({ ... })`; both end
   * up naming the column, which is the thing worth comparing.
   */
  const columnsIn = (files) => {
    const found = new Set();
    const known = [
      "first_name", "date_of_birth", "gender", "seeking", "city_id",
      "other_city", "relationship_status", "languages_undisclosed",
      "onboarding_stage", "phone_verified_at",
    ];
    for (const file of files) {
      const text = read(file);
      for (const column of known) {
        if (new RegExp(`\\b${column}\\s*:`).test(text)) found.add(column);
      }
      if (/profile_languages/.test(text)) found.add("profile_languages");
      if (/profile_photos/.test(text)) found.add("profile_photos");
    }
    return found;
  };

  const web = columnsIn(webFiles);
  const mobile = columnsIn(mobileFiles);

  const every = [...new Set([...web, ...mobile])].sort();

  return {
    fields: every.map((field) => ({
      field,
      web: web.has(field),
      mobile: mobile.has(field),
    })),
    onlyMobile: every.filter((f) => mobile.has(f) && !web.has(f)),
    onlyWeb: every.filter((f) => web.has(f) && !mobile.has(f)),
    webSteps: walk("apps/web/src/app/(auth)/onboarding", (f) => f === "page.tsx").length,
    mobileSteps: walk("apps/mobile/app/onboarding", (f) => f.endsWith(".tsx")).length,
  };
}

/**
 * Empty, loading and error handling on the screens where a list can be empty.
 *
 * A heuristic, and labelled as one in the package: it reports whether each
 * screen has a branch for the case, not whether that branch reads well. The
 * previous version of this section asserted "needs review -- not confirmed
 * present" for screens that had had empty states all along, which sent a
 * reviewer looking for work that did not exist.
 */
export function stateHandling() {
  const screens = [
    ["web", "Discovery", "apps/web/src/app/(app)/discovery/page.tsx"],
    ["web", "Member profile", "apps/web/src/app/(app)/discovery/[id]/page.tsx"],
    ["web", "Connections", "apps/web/src/app/(app)/connections/page.tsx"],
    ["web", "Conversation", "apps/web/src/app/(app)/connections/[id]/page.tsx"],
    ["web", "Home", "apps/web/src/app/(app)/home/page.tsx"],
    ["mobile", "Discovery", "apps/mobile/app/(tabs)/discover.tsx"],
    ["mobile", "Connections", "apps/mobile/app/(tabs)/connections.tsx"],
    ["mobile", "Messages", "apps/mobile/app/(tabs)/messages.tsx"],
    ["mobile", "Interest received", "apps/mobile/app/interests.tsx"],
    ["mobile", "Blocked members", "apps/mobile/app/you/blocked.tsx"],
  ];

  /*
   * The two apps handle this in different places, so they are measured
   * differently. A web page is a server component: Next takes loading and error
   * from sibling `loading.tsx` and `error.tsx` files, and looking for a spinner
   * inside the page would report "missing" for a route that handles it
   * correctly. A mobile screen holds its own state, so the branch is in the file.
   */
  /** Every directory from the file's own up to `apps/web/src/app`. */
  const ancestorsOf = (dir) => {
    const out = [];
    let at = dir;
    while (at.startsWith("apps/web/src/app")) {
      out.push(at);
      at = at.slice(0, at.lastIndexOf("/"));
    }
    return out;
  };

  const rows = screens
    .filter(([, , file]) => existsSync(join(ROOT, file)))
    .map(([app, name, file]) => {
      const text = read(file);
      const dir = file.slice(0, file.lastIndexOf("/"));
      return {
        app,
        screen: name,
        file,
        empty: /<EmptyState|length === 0|length > 0 \?|\.length \?/.test(text),
        loading:
          app === "web"
            ? existsSync(join(ROOT, `${dir}/loading.tsx`))
            : /<SkeletonRow|loading \?|isLoading|setLoading/.test(text),
        /*
         * Walked up to the app root, not just the sibling directory. A Next
         * error boundary catches everything below it, so one at `(app)/` covers
         * every signed-in route -- reporting those as unhandled would send a
         * reviewer to add four more boundaries that already exist.
         */
        error:
          app === "web"
            ? ancestorsOf(dir).some((d) => existsSync(join(ROOT, `${d}/error.tsx`)))
            : /error \?|<ErrorState|onRetry|Retry/.test(text),
      };
    });

  /*
   * An error boundary anywhere above a route catches it, so the absence that
   * matters is the absence of any boundary at all -- reported separately rather
   * than as a missing tick on every row.
   */
  const boundaries = walk("apps/web/src/app", (f) => f === "error.tsx" || f === "global-error.tsx");

  return { rows, webErrorBoundaries: boundaries };
}

/**
 * Moderation: the routes, what guards them, and what a moderator can do.
 *
 * Reported separately from the rest of the web surface because an admin route
 * that stops being guarded looks identical, in a route listing, to one that is.
 */
export function moderation() {
  const migrations = existsSync(join(ROOT, "supabase/migrations"))
    ? readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()
    : [];
  const sql = migrations.map((f) => read(`supabase/migrations/${f}`)).join("\n");

  const adminPages = walk("apps/web/src/app/admin", (f) => f === "page.tsx").map((f) =>
    f.replace("apps/web/src/app", "").replace(/\/page\.tsx$/, "") || "/",
  );

  // Every admin page must call the guard; a page that does not is the finding.
  const unguarded = walk("apps/web/src/app/admin", (f) => f === "page.tsx").filter(
    (f) => !read(f).includes("requireModerator"),
  );

  const adminFunctions = [
    ...new Set([...sql.matchAll(/create (?:or replace )?function public\.(admin_[a-z_]+)/g)].map((m) => m[1])),
  ].sort();

  // Each of those must check `is_moderator()` in its own body, not rely on the page.
  const bodies = [...sql.matchAll(/create (?:or replace )?function public\.(admin_[a-z_]+)[\s\S]*?\$\$;/g)];
  const unchecked = bodies
    .filter((m) => !m[0].includes("is_moderator()"))
    .map((m) => m[1]);

  return {
    adminPages,
    unguardedPages: unguarded,
    guard: sql.includes("create or replace function public.is_moderator")
      ? "is_moderator() — an allowlist of addresses in ops_config, compared against the session's verified email"
      : "none found",
    allowlistKey: /'(moderation_admins)'/.test(sql) ? "ops_config.moderation_admins" : "not found",
    adminFunctions,
    functionsNotSelfChecking: [...new Set(unchecked)].sort(),
    suspensionSupported: /alter table public\.profiles[\s\S]{0,200}suspended_at/.test(sql),
    auditTable: /create table (?:if not exists )?public\.moderation_actions/.test(sql)
      ? "moderation_actions"
      : "none",
  };
}

export function backendSurface() {
  return {
    edgeFunctions: existsSync(join(ROOT, "supabase/functions"))
      ? readdirSync(join(ROOT, "supabase/functions")).filter((d) => !d.startsWith("_"))
      : [],
    serverActions: walk("apps/web/src", (f) => f === "actions.ts"),
    routeHandlers: walk("apps/web/src/app", (f) => f === "route.ts"),
    rpcsCalled: [
      ...new Set(
        [
          ...walk("apps/web/src", (f) => f.endsWith(".ts") || f.endsWith(".tsx")),
          ...walk("apps/mobile/src", (f) => f.endsWith(".ts")),
        ].flatMap((f) => [...read(f).matchAll(/\.rpc\(\s*"([a-z_]+)"/g)].map((m) => m[1])),
      ),
    ].sort(),
  };
}

export function schema() {
  const files = existsSync(join(ROOT, "supabase/migrations"))
    ? readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()
    : [];
  const all = files.map((f) => read(`supabase/migrations/${f}`)).join("\n");
  const tables = [...new Set([...all.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)].map((m) => m[1]))].sort();

  /*
   * `\s+`, not a single space. The migrations align these statements in a
   * column -- `alter table public.cities            enable row level security;`
   * -- and a regex expecting one space matched only the longest table names.
   * The resulting package reported ten tables as having no RLS when every one
   * of them had it, which is exactly the kind of false alarm that sends someone
   * to "fix" a database that was already correct.
   */
  const rlsEnabled = [
    ...new Set(
      [...all.matchAll(/alter table\s+public\.([a-z_]+)\s+enable row level security/g)].map((m) => m[1]),
    ),
  ].sort();

  // Policies are the actual boundary; "RLS enabled" with no policy denies all.
  const policies = {};
  for (const m of all.matchAll(/create policy\s+"?([^"\n]+?)"?\s+on\s+public\.([a-z_]+)/g)) {
    (policies[m[2]] ??= []).push(m[1].trim());
  }

  const functions = [...new Set([...all.matchAll(/create (?:or replace )?function public\.([a-z_]+)/g)].map((m) => m[1]))].sort();
  return { migrationCount: files.length, latest: files.slice(-5), tables, rlsEnabled, policies, functions };
}

// ---------------------------------------------------------------------------
// M / T / W. Env names, debt, checks
// ---------------------------------------------------------------------------

/** NAMES only. The example files carry no values by design. */
export function environmentVariableNames() {
  const pick = (p) =>
    [...read(p).matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);
  return {
    web: [...new Set(pick("apps/web/.env.example"))].sort(),
    mobile: [...new Set(pick("apps/mobile/.env.example"))].sort(),
    ciSecrets: [...new Set([...read(".github/workflows/deploy-web.yml").matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))].sort(),
  };
}

export function technicalDebt() {
  const markers = [];
  for (const file of [
    ...walk("apps/web/src", (f) => f.endsWith(".ts") || f.endsWith(".tsx")),
    ...walk("apps/mobile/src", (f) => f.endsWith(".ts") || f.endsWith(".tsx")),
    ...walk("apps/mobile/app", (f) => f.endsWith(".tsx")),
    ...walk("supabase/functions", (f) => f.endsWith(".ts")),
    ...walk("scripts", (f) => f.endsWith(".mjs")),
  ]) {
    read(file)
      .split("\n")
      .forEach((line, i) => {
        if (/(^|[^A-Za-z])(TODO|FIXME|HACK|XXX)[^A-Za-z]/.test(line)) {
          markers.push({ file, line: i + 1, text: line.trim().slice(0, 160) });
        }
      });
  }

  // The documented register is the real source of known gaps in this repo.
  const openQuestions = read("docs/07-open-questions.md");
  const blockers = [...openQuestions.matchAll(/^\*\*(.+?)\.?\*\*/gm)].map((m) => m[1]);
  const preLaunchSection = openQuestions.split("## ")[1] ?? "";
  const preLaunch = [...preLaunchSection.matchAll(/^\*\*(.+?)\.?\*\*/gm)].map((m) => m[1]);

  return { codeMarkers: markers, documentedItems: blockers, preLaunchBlockers: preLaunch };
}

/**
 * Existing checks only. Nothing new is introduced to make the package look busy.
 *
 * `execSync` with a command string rather than `execFileSync`: Node refuses to
 * spawn `npm.cmd` without a shell on Windows, and the resulting `EINVAL` is a
 * spawn failure, not a failing check. An earlier version reported all four as
 * "fail" when every one of them passed -- a review package that cries wolf
 * about its own tooling is worse than one with no checks at all, so the two are
 * now distinguished explicitly.
 */
export function runChecks({ skip = false } = {}) {
  const results = [];
  const run = (name, command) => {
    if (skip) return results.push({ name, status: "skipped", detail: "--skip-checks" });
    const started = Date.now();
    try {
      execSync(command, { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
      results.push({ name, status: "pass", seconds: Math.round((Date.now() - started) / 1000) });
    } catch (error) {
      const out = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
      const spawnFailed = !out && (error.code === "EINVAL" || error.code === "ENOENT");
      results.push({
        name,
        status: spawnFailed ? "could not run" : "fail",
        seconds: Math.round((Date.now() - started) / 1000),
        detail: spawnFailed
          ? `runner error: ${error.code} — the check itself did not report`
          : out.split("\n").filter(Boolean).slice(-6).join(" · ").slice(0, 600),
      });
    }
  };

  run("TypeScript (web + mobile)", "npm run typecheck");
  run("ESLint (web)", "npm run lint");
  run("ESLint (mobile)", "npm run mobile:lint");
  run("Next.js production build", "npm run build");

  /*
   * The four probes are listed, not run.
   *
   * Each one signs in against the live project and creates throwaway accounts,
   * which it then deletes. That is the right way to prove a boundary -- an
   * authorisation check can only be tested by a real unauthorised caller -- and
   * entirely the wrong thing for a documentation generator to do every time
   * somebody wants a review package. Generating a document must not write to
   * the production database.
   *
   * So they are reported with what they prove and the command to run them, and
   * a reviewer can see at a glance which boundaries have a test at all.
   */
  const pkg = readJson("package.json") ?? {};
  const probes = [
    ["Security probe", "security", "RLS and grants, as an ordinary member: that nobody can grant themselves membership, read another member's rows, or call a function they should not"],
    ["Payments probe", "payments:probe", "server-side pricing, idempotent settlement, expiry as a date, and that every plan is prepaid rather than recurring"],
    ["Moderation probe", "moderation:probe", "that the admin RPCs refuse an ordinary member who knows their names, not merely that the page hides a button"],
    ["Analytics probe", "analytics:probe", "that each funnel event is actually recorded, by performing the transition and looking for the row"],
  ];
  for (const [name, script, proves] of probes) {
    results.push({
      name,
      status: pkg.scripts?.[script] ? "not run here" : "absent",
      detail: pkg.scripts?.[script]
        ? `\`npm run ${script}\` — ${proves}. Needs credentials and touches the live project, so it is not run by this generator.`
        : "no script",
    });
  }

  results.push({
    name: "Unit/integration tests",
    status: pkg.scripts?.test ? "unknown" : "absent",
    detail: pkg.scripts?.test ? "a test script exists" : "no test script in any workspace",
  });
  return results;
}
