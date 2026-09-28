/**
 * What a search engine is actually told, asked of the running site.
 *
 * Every other way of checking this lies by omission. `tsc` and `next build`
 * both pass on a site that is entirely `noindex`, because a wrong directive is
 * still a valid string, and a `grep` for `robots` finds the source that would
 * emit the tag rather than the deployment that does. The one that bit this
 * project is narrower still: `NEXT_PUBLIC_ALLOW_INDEXING` is inlined at build
 * time from the *deploy workflow's* environment, so the repository cannot know
 * its value and a local build proves nothing about production either way. A
 * hand-maintained note in `scripts/review-package.mjs` said this site was
 * noindex for as long as it had been indexable, and nothing failed.
 *
 * So this asks eraya.app. It fetches the pages, parses what came back, and
 * asserts on parsed values -- a canonical URL is compared as a URL, the
 * JSON-LD is handed to `JSON.parse`, the sitemap's `<loc>` list is read out and
 * every entry is fetched. Nothing here passes because a string was absent from
 * a response body, which is the failure mode that made the other probes in this
 * repository worth writing: a typo in a selector and a missing feature look
 * identical to `!body.includes(...)`.
 *
 * Run from the repository root:
 *
 *   npm run seo:probe                                # production
 *   npm run seo:probe -- --base http://localhost:3000
 *
 * It reads nothing, writes nothing and signs in as nobody. Every route it
 * touches is one an anonymous crawler can reach, which is the whole point: the
 * question is what Google sees, and Google has no session.
 */

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
const BASE = (baseArg === -1 ? "https://eraya.app" : args[baseArg + 1]).replace(
  /\/$/,
  "",
);

/** The canonical host every public URL on the site must name. */
const CANONICAL_ORIGIN = "https://eraya.app";

/**
 * Public, and meant to be found.
 *
 * `/beta` is here because it is genuinely public and an Instagram link points
 * straight at it, so it is in the sitemap and has to hold up to the same checks
 * as the rest.
 */
const PUBLIC_PATHS = [
  "/",
  "/safety",
  "/privacy",
  "/terms",
  "/contact",
  "/pricing",
  "/beta",
  "/guides",
  "/guides/dating-after-divorce-india",
  "/guides/dating-after-divorce-with-kids",
  "/guides/dating-after-separation-india",
  "/guides/how-to-start-dating-after-divorce",
  "/guides/online-dating-safety-after-divorce",
  "/guides/when-to-date-after-divorce",
];

/**
 * Private, and each must prove it cannot become a search result.
 *
 * Two acceptable answers, not one, and the probe accepts either: a redirect
 * away, so there is nothing to index, or a body that declares `noindex` --
 * indexable in principle, refused in fact. Demanding a meta tag from `/home`
 * would fail a correct site, because an anonymous request never gets a `<head>`
 * from it at all.
 *
 * The `/discovery/[id]` entry carries a UUID that belongs to nobody. A member's
 * profile is the worst thing on this site to leak to a crawler, and the only
 * honest way to ask what happens is to request one.
 */
const PRIVATE_PATHS = [
  "/login",
  "/signup",
  "/auth/email",
  "/auth/phone",
  "/auth/otp",
  "/logout",
  "/onboarding/basics",
  "/onboarding/photo",
  "/home",
  "/discovery",
  "/discovery/00000000-0000-4000-8000-000000000000",
  "/connections",
  "/account",
  "/account/settings",
  "/checkout",
  "/admin/reports",
  /*
   * A slug nobody will ever write. Proof the route 404s rather than renders.
   *
   * `/guides/dating-after-divorce-india` used to sit beside it, so that the day
   * it was published would be a day this probe failed and somebody had to move
   * the slug deliberately rather than let a placeholder ship quietly. That day
   * was 2026-09-27: it is a real article now, it is in `PUBLIC_PATHS`, and the
   * article checks in `probeGuides` cover it. The next planned guide can take
   * its place here when somebody starts writing one.
   */
  "/guides/this-guide-does-not-exist",
];

/** Prefixes that must never appear in the sitemap, whatever else changes. */
const NEVER_IN_SITEMAP = [
  "/account",
  "/admin",
  "/api",
  "/auth",
  "/checkout",
  "/connections",
  "/discovery",
  "/home",
  "/login",
  "/logout",
  "/onboarding",
  "/signup",
];

/** Hosts that mean a build leaked its own address into production metadata. */
const WRONG_HOSTS = [
  "localhost",
  "127.0.0.1",
  "workers.dev",
  "vercel.app",
  "netlify.app",
  "expo.dev",
  "github.io",
  "www.eraya.app",
];

const results = [];
const notes = [];

function check(where, name, passed, detail = "") {
  results.push({ where, name, passed, detail });
  console.log(
    `  ${passed ? "ok  " : "FAIL"} ${name}${detail ? ` -- ${detail}` : ""}`,
  );
}

function note(text) {
  notes.push(text);
}

/** Fetches a path on the base host, or an absolute URL as given. */
async function get(target, { redirect = "manual" } = {}) {
  const url = target.startsWith("http") ? target : `${BASE}${target}`;
  const response = await fetch(url, {
    redirect,
    headers: {
      // Ask the way a crawler asks. Nothing here varies on user-agent today,
      // and if something ever does, this is the identity whose answer matters.
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    },
  });
  const type = response.headers.get("content-type") ?? "";
  const textual =
    type.startsWith("text/") || type.includes("xml") || type.includes("json");
  return {
    status: response.status,
    headers: response.headers,
    body: textual ? await response.text() : "",
  };
}

/* ----------------------------------------------------------------- parsing */

/** The `content` of one meta tag, by `name` or `property`, or null. */
function meta(html, key) {
  const forward = new RegExp(
    `<meta[^>]+(?:name|property)="${key}"[^>]*content="([^"]*)"`,
    "i",
  );
  const reversed = new RegExp(
    `<meta[^>]+content="([^"]*)"[^>]*(?:name|property)="${key}"`,
    "i",
  );
  return (html.match(forward) ?? html.match(reversed))?.[1] ?? null;
}

/** Every `robots` meta directive on the page, lowercased, in document order. */
function robotsDirectives(html) {
  return [
    ...html.matchAll(/<meta[^>]+name="robots"[^>]*content="([^"]*)"/gi),
  ].map((match) => match[1].toLowerCase().trim());
}

function canonicalHref(html) {
  return (
    html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]*)"/i)?.[1] ?? null
  );
}

function pageTitle(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null;
}

/**
 * Every JSON-LD block on the page, parsed.
 *
 * `JSON.parse` is the validation. A block that does not parse is invisible to
 * Google, and the only way to know it parses is to parse it -- a regex that
 * finds the opening tag says nothing about the syntax inside it.
 */
function jsonLdBlocks(html) {
  return [
    ...html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => JSON.parse(match[1]));
}

/** Flattens an `@graph` into the nodes it holds. */
function nodesOf(block) {
  return Array.isArray(block["@graph"]) ? block["@graph"] : [block];
}

/** Every key present anywhere in a parsed value, at any depth. */
function everyKey(value, into = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) everyKey(item, into);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      everyKey(child, into);
    }
  }
  return into;
}

/* -------------------------------------------------------------- robots.txt */

/** The `*` group's rules, plus the Sitemap and Host lines. */
function parseRobots(text) {
  const allow = [];
  const disallow = [];
  const sitemaps = [];
  let host = null;
  let inStarGroup = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const at = line.indexOf(":");
    if (!line || at === -1) continue;
    const field = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();

    if (field === "user-agent") inStarGroup = value === "*";
    else if (field === "sitemap") sitemaps.push(value);
    else if (field === "host") host = value;
    else if (inStarGroup && field === "allow") allow.push(value);
    else if (inStarGroup && field === "disallow") disallow.push(value);
  }

  return { allow, disallow, sitemaps, host };
}

/**
 * Whether robots.txt lets `*` fetch a path.
 *
 * Longest matching rule wins, and Allow beats Disallow at equal length, which
 * is the rule every major crawler implements. Written out rather than assumed
 * because `Allow: /` plus `Disallow: /home` is exactly the arrangement a naive
 * "does any disallow match" check gets backwards.
 */
function crawlable(rules, path) {
  let best = { length: -1, allowed: true };
  for (const [list, allowed] of [
    [rules.disallow, false],
    [rules.allow, true],
  ]) {
    for (const rule of list) {
      if (rule && path.startsWith(rule) && rule.length >= best.length) {
        best = { length: rule.length, allowed };
      }
    }
  }
  return best.allowed;
}

async function probeRobotsTxt() {
  console.log("\nrobots.txt\n");
  const { status, headers, body } = await get("/robots.txt");

  check("/robots.txt", "served", status === 200, `HTTP ${status}`);
  if (status !== 200) return;

  check(
    "/robots.txt",
    "content-type is text/plain",
    (headers.get("content-type") ?? "").includes("text/plain"),
    headers.get("content-type") ?? "(none)",
  );

  const rules = parseRobots(body);

  check(
    "/robots.txt",
    "does not close the site to crawlers",
    !rules.disallow.includes("/"),
    rules.disallow.includes("/")
      ? "Disallow: / -- this deployment is closed"
      : `${rules.disallow.length} disallow rules`,
  );

  check(
    "/robots.txt",
    "names the sitemap on the canonical host",
    rules.sitemaps.includes(`${CANONICAL_ORIGIN}/sitemap.xml`),
    rules.sitemaps.join(", ") || "(no Sitemap line)",
  );

  for (const path of PUBLIC_PATHS) {
    check("/robots.txt", `allows ${path}`, crawlable(rules, path));
  }

  for (const path of [
    "/home",
    "/discovery",
    "/account",
    "/connections",
    "/onboarding/basics",
    "/api/activity",
  ]) {
    check("/robots.txt", `disallows ${path}`, !crawlable(rules, path));
  }

  /*
   * The inverse check, and the one easiest to get backwards.
   *
   * `/login` and `/signup` must stay *fetchable* so the `noindex` in their own
   * head can be read. Disallowing them hides the directive that keeps them out,
   * and a disallowed URL linked from elsewhere can still be indexed on the
   * strength of the link alone -- the worse outcome of the two.
   */
  for (const path of ["/login", "/signup"]) {
    check(
      "/robots.txt",
      `leaves ${path} fetchable so its noindex can be read`,
      crawlable(rules, path),
      crawlable(rules, path) ? "" : "disallowed -- hides its own noindex",
    );
  }
}

/* ------------------------------------------------------------- sitemap.xml */

async function probeSitemap() {
  console.log("\nsitemap.xml\n");
  const { status, headers, body } = await get("/sitemap.xml");

  check("/sitemap.xml", "served", status === 200, `HTTP ${status}`);
  if (status !== 200) return;

  check(
    "/sitemap.xml",
    "content-type is XML",
    (headers.get("content-type") ?? "").includes("xml"),
    headers.get("content-type") ?? "(none)",
  );

  check(
    "/sitemap.xml",
    "declares the sitemap namespace",
    body.includes("http://www.sitemaps.org/schemas/sitemap/0.9"),
  );

  const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    match[1].trim(),
  );

  check(
    "/sitemap.xml",
    "lists at least one URL",
    locations.length > 0,
    `${locations.length} URLs`,
  );

  const parsed = [];
  for (const location of locations) {
    let url;
    try {
      url = new URL(location);
    } catch {
      check("/sitemap.xml", `${location} parses as a URL`, false);
      continue;
    }
    parsed.push(url);

    check(
      "/sitemap.xml",
      `${url.pathname} is on the canonical origin`,
      url.origin === CANONICAL_ORIGIN,
      url.origin,
    );

    check(
      "/sitemap.xml",
      `${url.pathname} carries no query string`,
      url.search === "",
      url.search,
    );

    const forbidden = NEVER_IN_SITEMAP.find(
      (prefix) =>
        url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    );
    check(
      "/sitemap.xml",
      `${url.pathname} is not a private route`,
      !forbidden,
      forbidden ? `matches ${forbidden}` : "",
    );
  }

  /* Every page the site asks to have indexed must actually be indexable. */
  for (const url of parsed) {
    const { status: pageStatus, body: pageBody } = await get(url.pathname);
    const directives = robotsDirectives(pageBody);
    check(
      "/sitemap.xml",
      `${url.pathname} is reachable and indexable`,
      pageStatus === 200 && !directives.some((d) => d.includes("noindex")),
      `HTTP ${pageStatus}${directives.length ? `, robots: ${directives.join(" | ")}` : ""}`,
    );
  }

  /* And every page this probe calls public must be in the list. */
  const listed = new Set(
    parsed.map((url) => url.pathname.replace(/\/$/, "") || "/"),
  );
  for (const path of PUBLIC_PATHS) {
    check(
      "/sitemap.xml",
      `lists ${path}`,
      listed.has(path.replace(/\/$/, "") || "/"),
    );
  }
}

/* ------------------------------------------------------------ public pages */

async function probePublicPages() {
  console.log("\nPublic pages\n");
  const titles = new Map();
  const descriptions = new Map();

  for (const path of PUBLIC_PATHS) {
    console.log(`\n  ${path}`);
    const { status, headers, body } = await get(path);

    check(path, "HTTP 200", status === 200, `HTTP ${status}`);
    if (status !== 200) continue;

    /* The header form of the same directive, which overrides the tag. */
    const headerRobots = headers.get("x-robots-tag");
    check(
      path,
      "no noindex in X-Robots-Tag",
      !(headerRobots ?? "").toLowerCase().includes("noindex"),
      headerRobots ?? "(header absent, which is correct when indexing is on)",
    );

    const directives = robotsDirectives(body);
    check(
      path,
      "robots meta permits indexing",
      directives.length > 0 && !directives.some((d) => d.includes("noindex")),
      directives.join(" | ") || "(no robots meta)",
    );
    check(
      path,
      "exactly one robots meta",
      directives.length === 1,
      `${directives.length} found`,
    );

    const href = canonicalHref(body);
    check(path, "has a canonical link", href !== null);
    if (href) {
      let url = null;
      try {
        url = new URL(href);
      } catch {
        /* reported by the check below */
      }
      check(path, "canonical is an absolute URL", url !== null, href);
      if (url) {
        check(
          path,
          "canonical is on https://eraya.app",
          url.origin === CANONICAL_ORIGIN,
          url.origin,
        );
        check(
          path,
          "canonical points at this page, not another",
          (url.pathname.replace(/\/$/, "") || "/") === path,
          url.pathname,
        );
        check(path, "canonical carries no query string", url.search === "", url.search);
      }
    }

    const heading = pageTitle(body);
    check(path, "has a title", Boolean(heading?.trim()), heading ?? "(none)");
    if (heading) titles.set(path, heading);

    const description = meta(body, "description");
    check(
      path,
      "has a meta description",
      Boolean(description?.trim()),
      description ? `${description.length} chars` : "(none)",
    );
    if (description) descriptions.set(path, description);

    /* Open Graph: what a shared link looks like in a chat window. */
    for (const key of [
      "og:title",
      "og:description",
      "og:url",
      "og:site_name",
      "og:image",
    ]) {
      check(path, `has ${key}`, Boolean(meta(body, key)?.trim()));
    }

    const ogUrl = meta(body, "og:url");
    if (ogUrl) {
      let origin = null;
      try {
        origin = new URL(ogUrl).origin;
      } catch {
        /* reported below */
      }
      check(
        path,
        "og:url is on the canonical origin",
        origin === CANONICAL_ORIGIN,
        origin ?? ogUrl,
      );
    }

    const ogImage = meta(body, "og:image");
    if (ogImage) {
      const image = await get(new URL(ogImage, CANONICAL_ORIGIN).href, {
        redirect: "follow",
      });
      check(path, "og:image resolves", image.status === 200, `HTTP ${image.status}`);
    }

    /* No build's own address may appear in anything a crawler reads. */
    const end = body.indexOf("</head>");
    const head = end === -1 ? body : body.slice(0, end + 7);
    const leaked = WRONG_HOSTS.filter((host) => head.includes(host));
    check(
      path,
      "no development or preview host in the head",
      leaked.length === 0,
      leaked.join(", "),
    );
  }

  /* Duplicates are a site-wide property, so they are checked once, at the end. */
  console.log("\n  (across the public pages)");
  for (const [label, values] of [
    ["title", titles],
    ["description", descriptions],
  ]) {
    const seen = new Map();
    for (const [path, value] of values) {
      seen.set(value, [...(seen.get(value) ?? []), path]);
    }
    const duplicates = [...seen.values()].filter((paths) => paths.length > 1);
    check(
      "(site)",
      `every public page has its own ${label}`,
      duplicates.length === 0,
      duplicates.map((paths) => paths.join(" = ")).join("; "),
    );
  }
}

/* ----------------------------------------------------------- private pages */

async function probePrivatePages() {
  console.log("\nPrivate and authenticated routes\n");

  for (const path of PRIVATE_PATHS) {
    const { status, headers, body } = await get(path);
    const directives = robotsDirectives(body);
    const headerRobots = (headers.get("x-robots-tag") ?? "").toLowerCase();

    const redirected = status >= 300 && status < 400;
    const refused =
      directives.length > 0 && directives.some((d) => d.includes("noindex"));

    check(
      path,
      "cannot become a search result",
      redirected || refused || headerRobots.includes("noindex"),
      redirected
        ? `HTTP ${status} to ${headers.get("location") ?? "?"}`
        : `HTTP ${status}, robots: ${directives.join(" | ") || "(none)"}`,
    );

    /*
     * A served body must not carry two directives that disagree.
     *
     * Google resolves a conflict in favour of the restrictive one, so this is
     * not a leak and it is not a failure -- but two tags disagreeing means two
     * places are deciding, and only one of them knows this page is private.
     */
    if (directives.length > 1) {
      note(
        `${path} serves ${directives.length} robots meta tags (${directives.join(" | ")}); the restrictive one wins, but they disagree`,
      );
    }

    /* Structured data describes the public site and belongs nowhere near here. */
    if (status === 200) {
      let blocks = [];
      try {
        blocks = jsonLdBlocks(body);
      } catch (error) {
        check(path, "JSON-LD, if any, parses", false, error.message);
      }
      check(
        path,
        "carries no site-level structured data",
        blocks.length === 0,
        blocks.length ? `${blocks.length} ld+json blocks` : "",
      );
    }
  }
}

/* -------------------------------------------------------------- the domain */

async function probeCanonicalHost() {
  console.log("\nCanonical host\n");

  const response = await fetch("https://www.eraya.app/", {
    redirect: "manual",
  });
  const location = response.headers.get("location") ?? "";

  check(
    "www.eraya.app",
    "redirects rather than serving a second copy",
    response.status >= 300 && response.status < 400,
    `HTTP ${response.status}`,
  );
  check(
    "www.eraya.app",
    "redirect is permanent (301 or 308)",
    response.status === 301 || response.status === 308,
    `HTTP ${response.status}`,
  );
  check(
    "www.eraya.app",
    "redirects to the canonical origin",
    location.startsWith(CANONICAL_ORIGIN),
    location || "(no Location header)",
  );
}

/* ---------------------------------------------------------- structured data */

/**
 * Properties that would be a lie on this site today.
 *
 * Not a style rule. Eraya has no ratings, no reviews, no published member count
 * and no verified social profiles, so any of these appearing means somebody
 * invented a fact for a reader who cannot see the page and cannot check it --
 * the same failure as a trust mark for a check nobody performed, and harder to
 * notice. `sameAs` is on the list until real profile URLs exist in the
 * repository; the day they do, this line is the one to change.
 */
const FABRICATIONS = [
  "aggregateRating",
  "ratingValue",
  "reviewCount",
  "ratingCount",
  "review",
  "author",
  "sameAs",
  "numberOfEmployees",
  "foundingDate",
  "interactionStatistic",
  "memberOf",
  "award",
];

async function probeStructuredData() {
  console.log("\nStructured data\n");
  const { body } = await get("/");

  let blocks;
  try {
    blocks = jsonLdBlocks(body);
  } catch (error) {
    check("/", "JSON-LD parses", false, error.message);
    return;
  }

  check("/", "JSON-LD parses", true, `${blocks.length} block(s)`);
  check("/", "the homepage carries structured data", blocks.length > 0);
  if (!blocks.length) return;

  check(
    "/",
    "every block declares @context schema.org",
    blocks.every((block) => block["@context"] === "https://schema.org"),
    blocks.map((block) => block["@context"] ?? "(none)").join(", "),
  );

  const nodes = blocks.flatMap(nodesOf);
  const types = nodes.map((node) => node["@type"]);

  for (const wanted of ["WebSite", "Organization"]) {
    check(
      "/",
      `describes a ${wanted}`,
      types.includes(wanted),
      types.join(", "),
    );
  }

  for (const node of nodes) {
    const label = node["@type"] ?? "(untyped)";
    check("/", `${label} is named Eraya`, node.name === "Eraya", String(node.name));
    check(
      "/",
      `${label} url is the canonical origin`,
      node.url === CANONICAL_ORIGIN,
      String(node.url),
    );
  }

  const website = nodes.find((node) => node["@type"] === "WebSite");
  const organization = nodes.find((node) => node["@type"] === "Organization");

  if (website && organization) {
    check(
      "/",
      "WebSite.publisher resolves to the Organization node",
      Boolean(organization["@id"]) &&
        website.publisher?.["@id"] === organization["@id"],
      `${website.publisher?.["@id"]} vs ${organization["@id"]}`,
    );
  }

  if (organization?.logo?.url) {
    const logo = await get(organization.logo.url, { redirect: "follow" });
    check(
      "/",
      "Organization logo resolves",
      logo.status === 200,
      `HTTP ${logo.status}`,
    );
  }

  const invented = FABRICATIONS.filter((key) => everyKey(blocks).has(key));
  check(
    "/",
    "claims nothing the product cannot be held to",
    invented.length === 0,
    invented.join(", "),
  );
}

/* --------------------------------------------------------------- the guides */

/**
 * Claims a guide must never make.
 *
 * `author` is legitimate here and absent from this list -- an `Article` is
 * supposed to name one -- but everything that would dress that author up as a
 * clinician is forbidden. Eraya employs no counsellors, psychologists or
 * doctors, and a guide about a hard subject carrying an implied professional
 * authority is the most harmful untruth this site could publish.
 */
const GUIDE_FABRICATIONS = [
  "aggregateRating",
  "ratingValue",
  "reviewCount",
  "ratingCount",
  "review",
  "hasCredential",
  "jobTitle",
  "honorificPrefix",
  "reviewedBy",
  "award",
  "sameAs",
  "wordCount",
  "interactionStatistic",
];

/**
 * The Guides section, and every guide the sitemap claims exists.
 *
 * The index itself is checked with the other public pages -- it is in
 * `PUBLIC_PATHS`, so its canonical, title, description, Open Graph tags and
 * indexability are already asserted there. This adds what is particular to the
 * section: that the sitemap lists it, and that every article it lists is a real,
 * published, structured article rather than a placeholder.
 *
 * With nothing published yet this finds no articles and says so as a note rather
 * than a failure. That is the correct state today: the infrastructure is built
 * and no prose has been invented to fill it. The checks below start doing work
 * on the day the first real guide ships, which is the day they are needed.
 */
async function probeGuides() {
  console.log("\nGuides\n");

  const { body: sitemapBody } = await get("/sitemap.xml");
  const locations = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].trim(),
  );

  const indexListed = locations.some(
    (location) => new URL(location).pathname.replace(/\/$/, "") === "/guides",
  );
  check("/guides", "the section index is in the sitemap", indexListed);

  const articles = locations
    .map((location) => new URL(location).pathname)
    .filter((path) => path.startsWith("/guides/"));

  if (articles.length === 0) {
    note(
      "no guides published yet: the article checks found nothing to run against, which is the expected state until the first guide ships",
    );
    check(
      "/guides",
      "the index renders without any guides published",
      (await get("/guides")).status === 200,
    );
    return;
  }

  for (const path of articles) {
    console.log(`
  ${path}`);
    const { status, body } = await get(path);

    check(path, "HTTP 200", status === 200, `HTTP ${status}`);
    if (status !== 200) continue;

    let blocks;
    try {
      blocks = jsonLdBlocks(body);
    } catch (error) {
      check(path, "JSON-LD parses", false, error.message);
      continue;
    }

    const nodes = blocks.flatMap(nodesOf);
    const types = nodes.map((node) => node["@type"]);
    const article = nodes.find((node) => node["@type"] === "Article");
    const crumbs = nodes.find((node) => node["@type"] === "BreadcrumbList");

    check(path, "JSON-LD parses", true, types.join(", "));
    check(path, "describes an Article", Boolean(article));
    check(path, "describes a BreadcrumbList", Boolean(crumbs));

    /*
     * The `Organization` the article names as publisher has to be a node that is
     * actually on this page, or the reference dangles and the publisher
     * relationship says nothing.
     */
    const organization = nodes.find((node) => node["@type"] === "Organization");
    check(
      path,
      "the publisher reference resolves to a node on the page",
      Boolean(organization?.["@id"]) &&
        article?.publisher?.["@id"] === organization["@id"],
      `${article?.publisher?.["@id"]} vs ${organization?.["@id"]}`,
    );

    if (article) {
      const expected = `${CANONICAL_ORIGIN}${path}`;
      check(
        path,
        "mainEntityOfPage matches the canonical URL",
        article.mainEntityOfPage?.["@id"] === expected,
        String(article.mainEntityOfPage?.["@id"]),
      );
      check(
        path,
        "the page's canonical agrees with it",
        canonicalHref(body) === expected,
        String(canonicalHref(body)),
      );

      /* Real dates, in the format the specification asks for. */
      for (const field of ["datePublished", "dateModified"]) {
        check(
          path,
          `${field} is an ISO date`,
          /^\d{4}-\d{2}-\d{2}$/.test(String(article[field])),
          String(article[field]),
        );
      }
      check(
        path,
        "dateModified is not before datePublished",
        String(article.dateModified) >= String(article.datePublished),
        `${article.datePublished} -> ${article.dateModified}`,
      );

      check(path, "has a headline", Boolean(String(article.headline || "").trim()));
      check(
        path,
        "has a description",
        Boolean(String(article.description || "").trim()),
      );
      check(path, "names an author", Boolean(article.author));
    }

    if (crumbs) {
      const trail = crumbs.itemListElement ?? [];
      check(
        path,
        "the breadcrumb trail is Home > Guides > article",
        trail.length === 3,
        `${trail.length} levels`,
      );
      check(
        path,
        "the trail is numbered from 1 in order",
        trail.every((item, index) => item.position === index + 1),
        trail.map((item) => item.position).join(", "),
      );
      /*
       * The last step is the current page and carries no `item`. Giving it one
       * is a self-referential link, and the specification's own shape omits it.
       */
      check(
        path,
        "the last breadcrumb is the current page and carries no URL",
        trail.length > 0 && trail[trail.length - 1].item === undefined,
        String(trail[trail.length - 1]?.item),
      );
      /* And the trail must describe a path the page really shows. */
      check(
        path,
        "the visible breadcrumb nav is on the page too",
        /<nav[^>]+aria-label="[^"]*"[^>]*>[\s\S]{0,400}?\/guides/i.test(body),
      );
    }

    /* Open Graph, which a page declaring its own `openGraph` can silently lose. */
    for (const key of ["og:title", "og:description", "og:url", "og:site_name", "og:image"]) {
      check(path, `has ${key}`, Boolean(meta(body, key)?.trim()));
    }
    check(
      path,
      "og:type is article",
      meta(body, "og:type") === "article",
      String(meta(body, "og:type")),
    );

    const invented = GUIDE_FABRICATIONS.filter((key) => everyKey(blocks).has(key));
    check(
      path,
      "claims no credential, rating or review",
      invented.length === 0,
      invented.join(", "),
    );
  }
}

/* -------------------------------------------------------------------- main */

console.log(`\nSEO probe -- ${BASE}`);

try {
  await probeRobotsTxt();
  await probeSitemap();
  await probePublicPages();
  await probeGuides();
  await probePrivatePages();
  if (BASE === CANONICAL_ORIGIN) await probeCanonicalHost();
  else note("www redirect not checked: --base is not the production origin");
  await probeStructuredData();
} catch (error) {
  console.error(`\n  probe stopped: ${error.message}\n`);
  results.push({
    where: "(setup)",
    name: "probe ran to completion",
    passed: false,
    detail: error.message,
  });
}

const failed = results.filter((result) => !result.passed);

if (notes.length) {
  console.log("\nNoted, not failed:");
  for (const text of [...new Set(notes)]) console.log(`  ${text}`);
}

console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

if (failed.length) {
  console.log("");
  for (const one of failed) {
    console.log(
      `  ${one.where}: ${one.name}${one.detail ? ` -- ${one.detail}` : ""}`,
    );
  }
  console.log("");
}

process.exit(failed.length === 0 ? 0 : 1);
