/**
 * Every screen, in every language, checked against what actually renders.
 *
 *   npm run locale:probe                              # a dev server on :3000
 *   npm run locale:probe -- --base https://eraya.app  # production
 *
 * Six languages across thirty screens is nearly two hundred renders, which is
 * not something a person can walk. It is also the check with the worst ratio
 * of effort to insight when done by hand: the failure is one sentence, in one
 * language, on one screen, and the eye slides straight over it -- particularly
 * in a script the reader does not know.
 *
 * So this asks the running website rather than reading the code, and asks in
 * ways that can only be answered by having rendered the page.
 *
 *   lang            the `lang` attribute is the language that was asked for
 *   font            `--font-script` is the stack for that script, so Devanagari
 *                   is not about to arrive as empty boxes
 *   one dictionary  the words the browser is handed are that language's, and
 *                   no other language's are in there with them
 *   translated      sentences from that language are in the server's markup,
 *                   counted -- proof it rendered, not merely that it answered
 *   no English      no English sentence stands where its translation is absent
 *
 * `one dictionary` is the load-bearing one, and it is what the 2026-09-23
 * change to `packages/i18n` was for. A Cloudflare Worker isolate holds what a
 * module imports on behalf of every request it is serving, and all six
 * dictionaries were being held to render one. The isolate exceeded its 128 MB
 * ceiling in front of a member who had just finished signing up. Nothing in a
 * typecheck, a lint or a build can see that; this can, because it counts the
 * languages in the payload the browser is actually given.
 *
 * `no English` is the one that catches everyday bugs. A hardcoded English
 * sentence is invisible to `i18n:check`, which only compares the locale files
 * with each other -- both clients have shipped one. It is reported as a pair:
 * the English that was found, and the translation that should have stood
 * there.
 *
 * Signed-in and onboarding screens need a member, so one throwaway
 * `@demo.eraya.invalid` account is created, walked forward through the flow a
 * step at a time so that each gated screen is reachable in turn, and deleted
 * in a `finally`. There is no staging environment, so against a `--base` that
 * is not localhost the account is made in the production database -- and
 * removed from it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readLocale } from "../packages/i18n/scripts/read-locales.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(name);
  return at !== -1 && args[at + 1] ? args[at + 1] : fallback;
};
const base = flag("--base", "http://localhost:3000").replace(/\/$/, "");

function readEnv() {
  const file = path.join(root, "apps/web/.env.local");
  if (!fs.existsSync(file)) {
    console.error("apps/web/.env.local not found. This needs the service-role key.");
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

const env = readEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key in apps/web/.env.local.");
  process.exit(1);
}

const svc = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

const LOCALES = ["en", "hi", "bn", "mr", "te", "ta"];
const TRANSLATED = LOCALES.filter((locale) => locale !== "en");

/** Mirrors `layout.tsx`: English carries the region, the other five do not. */
const htmlLang = (locale) => (locale === "en" ? "en-IN" : locale);

/** Mirrors `FONT_STACKS`, by the one name in each that identifies the script. */
const FONT_MARKER = {
  en: "ui-sans-serif",
  hi: "Noto Sans Devanagari",
  mr: "Noto Sans Devanagari",
  bn: "Noto Sans Bengali",
  te: "Noto Sans Telugu",
  ta: "Noto Sans Tamil",
};

/**
 * Screens whose body is a legal document, published in English only.
 *
 * Their interface -- header, navigation, footer -- is translated like anything
 * else and is checked like anything else. The document inside them is not, and
 * will not be until a lawyer has read it in one language, so English there is a
 * known state of the product rather than something this probe discovered. It
 * is counted and reported, never failed.
 */
const ENGLISH_BODY = new Set(["/terms", "/privacy"]);

/**
 * How much rendered text is enough to draw a conclusion from.
 *
 * Several screens are a Suspense boundary whose server markup is the word
 * "Loading" and whose every sentence arrives on the client instead. Reading
 * forty characters of fallback and announcing that the login screen is not
 * translated is worse than saying nothing, so those screens are recognised and
 * reported as what they are. What still holds them to account is `one
 * dictionary`, which does not care where the words are rendered.
 */
const ENOUGH_MARKUP = 300;

const dictionaries = Object.fromEntries(
  LOCALES.map((locale) => [locale, readLocale(`${locale}.ts`)]),
);

/*
 * Which sentences can tell one language from another.
 *
 * Short ones cannot: "OK" or "Next" turns up inside an unrelated word or a
 * class name and reports a leak that is not there. Ones carrying a
 * `{placeholder}` never appear verbatim, because the placeholder is filled
 * before the sentence reaches the page. And a value a locale left identical to
 * English -- "Eraya", a language's own name -- cannot distinguish the two by
 * definition, so it proves nothing in either direction.
 */
const MIN_LENGTH = 16;

function comparable(locale) {
  const english = dictionaries.en;
  const theirs = dictionaries[locale];
  const rows = [];

  for (const [key, value] of english) {
    const translated = theirs.get(key);
    if (!translated || translated === value) continue;
    if (value.length < MIN_LENGTH || translated.length < MIN_LENGTH) continue;
    if (value.includes("{") || translated.includes("{")) continue;
    rows.push({ key, english: value, translated });
  }

  return rows;
}

const COMPARABLE = Object.fromEntries(TRANSLATED.map((l) => [l, comparable(l)]));

/**
 * The page a reader meets, and the payload the browser is handed, kept apart.
 *
 * The markup is what the server rendered and what a reader sees first. The
 * payload is the serialised props React replays on the client, and it carries
 * the whole dictionary rather than the sentences this page used -- which is
 * why counting a language in the payload answers "how many dictionaries were
 * shipped" and counting it in the markup answers "did this screen render in
 * that language". Asking either question of the other's text gives a confident
 * wrong answer.
 */
function split(html) {
  const payload = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join("\n");

  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return { markup: normalise(markup), payload: normalise(payload) };
}

/** HTML and JavaScript both escape the apostrophes this copy is full of. */
function normalise(text) {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;|&#34;|\\"/gi, '"')
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#x2019;|&rsquo;/gi, "’")
    .replace(/&hellip;/gi, "…")
    .replace(/\\n/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
}

/** Curly and straight quotes are one character for the purpose of matching. */
const flat = (text) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

const results = [];
const notes = [];

function check(route, locale, name, passed, detail = "") {
  results.push({ route, locale, name, passed, detail });
  if (!passed) {
    console.log(`\n        FAIL  ${locale.padEnd(3)} ${name}${detail ? `\n              ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ */

async function rest(resource, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    ...init,
    headers: { ...svc, Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  return { status: response.status, body: await response.text() };
}

async function setProfile(id, patch) {
  const { status, body } = await rest(`profiles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (status >= 300) throw new Error(`profile patch failed: ${status} ${body}`);
}

/** The id behind an address, or null. Used only to clear this probe's own. */
async function findMember(email) {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?per_page=1000`,
    { headers: svc },
  );
  const { users = [] } = await response.json();
  return users.find((one) => one.email === email)?.id ?? null;
}

/**
 * Session cookies the website itself minted.
 *
 * A magic link verified through `/auth/confirm`, which is where the email
 * template points -- not `/auth/callback`, which is where OAuth returns and
 * which answers a link like this with an error. What comes back is what a
 * browser would be holding, so the renders below are the real thing rather
 * than an approximation of it.
 */
async function signIn(email) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const link = await response.json();
  const hash = link.hashed_token ?? link.properties?.hashed_token;
  if (!hash) throw new Error(`no hashed_token: ${JSON.stringify(link).slice(0, 200)}`);

  const confirmed = await fetch(`${base}/auth/confirm?token_hash=${hash}&type=email`, {
    redirect: "manual",
    headers: { "User-Agent": "eraya-locale-probe" },
  });

  const cookies = (confirmed.headers.getSetCookie?.() ?? [])
    .map((cookie) => cookie.split(";")[0])
    .filter((cookie) => !cookie.endsWith("="));

  if (cookies.length === 0) {
    throw new Error(
      `no session cookie from /auth/confirm (${confirmed.status} -> ${confirmed.headers.get("location")})`,
    );
  }
  return cookies;
}

async function render(route, locale, cookies) {
  const response = await fetch(`${base}${route}`, {
    headers: {
      Cookie: [`eraya_locale=${locale}`, ...cookies].join("; "),
      "Accept-Language": "en",
      "User-Agent": "eraya-locale-probe",
    },
    redirect: "follow",
  });
  return {
    status: response.status,
    html: await response.text(),
    landed: new URL(response.url).pathname,
  };
}

/* ------------------------------------------------------------------ */

async function walk(route, cookies, member = null) {
  process.stdout.write(`  ${route.padEnd(26)}`);
  const line = [];

  for (const locale of LOCALES) {
    /*
     * For a signed-in member the profile wins over the cookie, deliberately:
     * a language chosen on their phone should be waiting for them in a
     * browser. So the preference has to be moved in the database rather than
     * in a header -- otherwise every signed-in screen renders English and the
     * probe reports a fault that is really itself asking the wrong way.
     */
    if (member) await setProfile(member, { ui_locale: locale });

    const { status, html, landed } = await render(route, locale, cookies);

    if (status !== 200) {
      check(route, locale, "renders", false, `${status}, landed on ${landed}`);
      line.push(`${locale}:${status}`);
      continue;
    }

    const { markup, payload } = split(html);

    const lang = (/<html[^>]*?\blang="([^"]+)"/s.exec(html) ?? [])[1] ?? "(none)";
    check(route, locale, "lang", lang === htmlLang(locale), `lang="${lang}", wanted "${htmlLang(locale)}"`);
    check(route, locale, "font", html.includes(FONT_MARKER[locale]), `--font-script carries no ${FONT_MARKER[locale]}`);

    /*
     * How many languages the browser was handed.
     *
     * The dictionary crosses to the client as a prop, whole, so every sentence
     * of the chosen language is in the payload whether this screen used it or
     * not -- and no sentence of any other language should be there at all.
     * Before 2026-09-23 all six were, which is what this exists to keep from
     * happening again.
     */
    const shipped = TRANSLATED.map((other) => {
      const rows = COMPARABLE[other];
      const found = rows.filter((row) => payload.includes(flat(row.translated))).length;
      return { locale: other, found, of: rows.length };
    });

    const mine = shipped.find((s) => s.locale === locale);
    const strangers = shipped.filter((s) => s.locale !== locale && s.found > s.of * 0.02);

    if (locale === "en") {
      // English is the fallback and is always present; what must not be here
      // is any of the other five.
      check(
        route,
        locale,
        "one dictionary",
        strangers.length === 0,
        `English page also carries ${strangers.map((s) => `${s.locale} (${s.found})`).join(", ")}`,
      );
      line.push("en:ok");
      continue;
    }

    check(
      route,
      locale,
      "one dictionary",
      mine.found > mine.of * 0.9 && strangers.length === 0,
      strangers.length
        ? `page also carries ${strangers.map((s) => `${s.locale} (${s.found}/${s.of})`).join(", ")}`
        : `only ${mine.found}/${mine.of} of ${locale} arrived with the page -- the words are ` +
          `being imported into the bundle instead of handed over as data, which is what put ` +
          `all six languages in every isolate`,
    );

    /*
     * Everything below reads the markup, so it only applies to a screen that
     * rendered its words on the server.
     */
    if (markup.trim().length < ENOUGH_MARKUP) {
      notes.push(`${route}: rendered on the client, so only the payload could be checked`);
      line.push(`${locale}:client`);
      continue;
    }

    let seen = 0;
    const leaks = [];

    for (const { key, english, translated } of COMPARABLE[locale]) {
      if (markup.includes(flat(translated))) {
        seen += 1;
        continue;
      }
      if (markup.includes(flat(english))) {
        leaks.push(
          `${key}\n                found:  "${english.slice(0, 66)}"\n                wanted: "${translated.slice(0, 66)}"`,
        );
      }
    }

    check(
      route,
      locale,
      "translated",
      seen >= 3,
      `only ${seen} sentence(s) of ${locale} in the markup -- the screen may have rendered in English`,
    );

    if (ENGLISH_BODY.has(route)) {
      if (leaks.length) notes.push(`${route} in ${locale}: ${leaks.length} English sentence(s), in the legal text`);
    } else {
      check(
        route,
        locale,
        "no English",
        leaks.length === 0,
        leaks.slice(0, 4).join("\n              ") +
          (leaks.length > 4 ? `\n              ...and ${leaks.length - 4} more` : ""),
      );
    }

    line.push(`${locale}:${seen}${leaks.length ? `!${leaks.length}` : ""}`);
  }

  const failed = results.filter((r) => r.route === route && !r.passed).length;
  console.log(`${failed ? "  FAIL" : "  pass"}  ${line.join(" ")}`);
}

/* ------------------------------------------------------------------ */

const EMAIL = "localeprobe@demo.eraya.invalid";

const PUBLIC_ROUTES = ["/", "/pricing", "/safety", "/privacy", "/terms", "/contact", "/login", "/signup"];

const SIGNED_IN_ROUTES = [
  "/home",
  "/discovery",
  "/connections",
  "/account",
  "/account/settings",
  "/account/privacy",
  "/account/membership",
  "/account/verification",
];

console.log(`\nLocale probe against ${base}`);
console.log("Each column is a language: the number is sentences of it found in the markup,");
console.log('"!n" is n English leaks, "client" is a screen that renders in the browser.\n');

let created = null;

try {
  console.log("Signed out\n");
  for (const route of PUBLIC_ROUTES) await walk(route, []);

  console.log("\nSetting up a throwaway member");

  /*
   * Clear the last run's account before making this one.
   *
   * The `finally` below removes it, but a `finally` only runs if the process
   * lives to reach it -- an interrupt, a closed pipe or a killed terminal all
   * leave the account behind, and the next run then dies at `email_exists`
   * with nothing to show for itself. A probe that cannot be run twice is a
   * probe nobody runs, so the address is cleared rather than assumed free.
   *
   * Only ever this one address, which is why it is a constant rather than
   * anything derived: nothing here should be capable of deleting a member.
   */
  const leftover = await findMember(EMAIL);
  if (leftover) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${leftover}`, { method: "DELETE", headers: svc });
    console.log(`  cleared ${leftover.slice(0, 8)}, left behind by an earlier run`);
  }

  const made = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify({ email: EMAIL, email_confirm: true }),
  });
  const user = await made.json();
  created = user.id;
  if (!created) throw new Error(`could not create ${EMAIL}: ${JSON.stringify(user).slice(0, 200)}`);

  const cookies = await signIn(EMAIL);
  console.log(`  ${EMAIL}  ${created.slice(0, 8)}  ${cookies.length} cookie(s)\n`);

  /*
   * Onboarding, one gate at a time.
   *
   * Every screen turns away anybody who has not answered the one before it, so
   * the profile is brought to exactly the state that screen expects, all six
   * languages are read, and only then is the next answer written. Walking them
   * in any other order collects six redirects and a row of ticks that mean
   * nothing.
   */
  const cities = await rest("cities?select=id&limit=1");
  const cityId = JSON.parse(cities.body)[0]?.id ?? null;

  const ladder = [
    ["/auth/phone", { onboarding_stage: "authenticated" }],
    ["/onboarding/basics", { onboarding_stage: "phone_verified" }],
    ["/onboarding/seeking", { first_name: "Probe", date_of_birth: "1990-04-04", gender: "woman" }],
    ["/onboarding/city", { seeking: ["man"] }],
    ["/onboarding/relationship", cityId ? { city_id: cityId } : { other_city: "Pondicherry" }],
    ["/onboarding/religion", { relationship_status: "divorced" }],
    ["/onboarding/languages", { religion: "prefer_not_to_say" }],
    ["/onboarding/photo", { languages_undisclosed: true }],
    ["/onboarding/complete", {}],
  ];

  console.log("Onboarding\n");
  for (const [route, patch] of ladder) {
    if (Object.keys(patch).length) await setProfile(created, patch);
    await walk(route, cookies, created);
  }

  console.log("\nSigned in\n");
  await setProfile(created, { onboarding_stage: "onboarding_completed" });
  for (const route of SIGNED_IN_ROUTES) await walk(route, cookies, created);
} catch (error) {
  console.error(`\n  probe stopped: ${error.message}\n`);
  results.push({ route: "(setup)", locale: "-", name: "probe ran", passed: false, detail: error.message });
} finally {
  if (created) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${created}`, { method: "DELETE", headers: svc });
    console.log(`\nRemoved ${EMAIL}`);
  }
}

const failed = results.filter((r) => !r.passed);

if (notes.length) {
  console.log("\nNoted, not failed:");
  for (const note of [...new Set(notes)]) console.log(`  ${note}`);
}

console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

if (failed.length) {
  const byName = new Map();
  for (const one of failed) byName.set(one.name, (byName.get(one.name) ?? 0) + 1);
  console.log(`\n  ${[...byName].map(([name, count]) => `${name} (${count})`).join(", ")}`);
  console.log(`  on ${[...new Set(failed.map((one) => one.route))].join(", ")}\n`);
}

process.exit(failed.length === 0 ? 0 : 1);
