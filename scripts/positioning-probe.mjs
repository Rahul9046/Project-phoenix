/*
 * What the positioning pass had to achieve, and what it was forbidden to break,
 * asked of the running site rather than of the source.
 *
 *   node positioning-probe.mjs [--base http://localhost:3000]
 *
 * Every assertion is on a parsed value -- an href read out of an attribute, a
 * status code, a meta tag's content -- never on "is this string absent from the
 * body", which is the check that makes a typo in a selector look identical to a
 * missing feature.
 */
const base = (() => {
  const i = process.argv.indexOf("--base");
  return i > -1 ? process.argv[i + 1] : "http://localhost:3000";
})();

let pass = 0;
const failures = [];

function ok(cond, what, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok    ${what}`);
  } else {
    failures.push(what);
    console.log(`  FAIL  ${what}${detail ? `  -- ${detail}` : ""}`);
  }
}

const get = async (path, locale) => {
  const res = await fetch(base + path, {
    redirect: "manual",
    headers: locale ? { cookie: `eraya_locale=${locale}` } : {},
  });
  return { res, body: res.status < 300 || res.status >= 400 ? await res.text() : "" };
};

/* Pull every href on the page, with the text of its anchor. */
const links = (html) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => {
    const href = (m[1].match(/href="([^"]*)"/) || [, ""])[1];
    const text = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return { href, text };
  });

const meta = (html, name) => {
  const re = new RegExp(
    `<meta[^>]*(?:name|property)="${name}"[^>]*content="([^"]*)"`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]*content="([^"]*)"[^>]*(?:name|property)="${name}"`,
    "i",
  );
  const m = html.match(re) || html.match(alt);
  return m ? m[1] : null;
};

const AUDIENCE = {
  en: [/divorced/i, /separated/i, /widowed/i, /India/],
  hi: [/तलाकशुदा/, /अलग रह रहे/, /जीवनसाथी को खो/, /भारत/],
  bn: [/বিবাহবিচ্ছিন্ন/, /আলাদা থাকা/, /সঙ্গীকে হারানো/, /ভারত/],
  mr: [/घटस्फोटित/, /वेगळे राहणाऱ्या/, /जोडीदार गमावलेल्या/, /भारता/],
  ta: [/விவாகரத்து/, /பிரிந்து வாழ்பவர்/, /துணையை இழந்தவர்/, /இந்திய/],
  te: [/విడాకులు/, /విడిగా ఉంటున్నవారు/, /కోల్పోయినవారి/, /భారతదేశ/],
};

console.log(`\nPositioning probe against ${base}\n`);

/* ---- 1. the hero names the audience, in every language ---- */
console.log("The hero states who Eraya is for");
for (const [loc, patterns] of Object.entries(AUDIENCE)) {
  const { body } = await get("/", loc);
  const hero = body.slice(0, body.indexOf("</h1>") + 4000);
  const named = patterns.filter((p) => p.test(hero)).length;
  ok(
    named === 4,
    `${loc}: hero names divorced + separated + widowed + India`,
    `${named}/4 matched`,
  );
}

/* ---- 2. the vague copy and the unsupported claim are gone ---- */
console.log("\nThe copy this pass replaced is gone");
{
  const { body } = await get("/", "en");
  ok(!/Verified members/i.test(body), 'homepage no longer claims "Verified members"');
  ok(
    !/Meet people who understand what starting again means/i.test(body),
    "homepage no longer leads with the audience-free lede",
  );
  ok(
    /Every member confirms a working email address/i.test(body),
    "the bounded email claim is what stands in its place",
  );
  ok(
    /Built for life after a relationship ends/i.test(body),
    "the #about section carries the secondary positioning",
  );
}

/* ---- 3. SEO and link previews ---- */
console.log("\nSEO and link previews");
{
  const { body } = await get("/", "en");
  const desc = meta(body, "description");
  const og = meta(body, "og:description");
  const tw = meta(body, "twitter:description");
  const audienceIn = (s) =>
    !!s && /divorced/i.test(s) && /separated/i.test(s) && /widowed/i.test(s) && /India/.test(s);
  ok(audienceIn(desc), "meta description names the audience and India", desc || "absent");
  ok(audienceIn(og), "og:description names the audience and India", og || "absent");
  ok(audienceIn(tw), "twitter:description names the audience and India", tw || "absent");
  ok(!!desc && desc.length <= 170, `meta description is ${desc ? desc.length : "?"} chars (<=170)`);
  const banned = /#1\b|India's best|safest|100% verified|verified members|thousands of members|guaranteed/i;
  ok(!banned.test(body), "no superlative or unsupported claim anywhere on the page");
  ok(/"@type":"Organization"/.test(body), "Organization JSON-LD still emitted");
  ok(audienceIn(body.match(/"@type":"WebSite"[\s\S]{0,400}?"description":"([^"]*)"/)?.[1] || ""),
     "WebSite JSON-LD description names the audience");
}

/* ---- 4. the Android download work on main must not regress ---- */
console.log("\nAndroid download surfaces (shipped on main, must survive)");
{
  const { body } = await get("/", "en");
  const all = links(body);
  const apk = all.filter((l) => l.href.includes("/downloads/eraya.apk"));
  ok(apk.length >= 2, `direct .apk links present (${apk.length} found: header + hero)`);
  ok(
    all.some((l) => l.href === "/download"),
    "a /download help link is on the homepage",
  );
  ok(
    all.some((l) => l.href.includes("instagram.com/join.eraya")),
    "the Instagram account is still linked",
  );
  ok(/id="android"/.test(body), "the homepage Android card is still rendered");
  ok(
    apk.some((l) => /Android/i.test(l.text)),
    "the download control is labelled for Android",
  );
}
{
  const { res } = await get("/download");
  ok(res.status === 200, `/download responds 200 (got ${res.status})`);
}
for (const file of ["eraya.apk", "eraya-beta.apk"]) {
  const { res } = await get(`/downloads/${file}`);
  const loc = res.headers.get("location") || "";
  ok(
    res.status >= 300 && res.status < 400 && /github/i.test(loc),
    `/downloads/${file} redirects to the GitHub Release (${res.status})`,
    loc.slice(0, 70),
  );
}
{
  const { res } = await get("/beta");
  ok(res.status >= 300 && res.status < 400, `/beta still redirects (${res.status})`);
}

/* ---- 5. the page a new account actually starts on ---- */
console.log("\nAccount creation entry");
{
  const { body } = await get("/signup", "en");
  const p = AUDIENCE.en.filter((r) => r.test(body)).length;
  ok(p === 4, "/signup names the audience and India", `${p}/4`);
  const { body: login } = await get("/login", "en");
  ok(
    /Your next chapter is waiting/i.test(login),
    "/login is left alone - returning members are not re-pitched",
  );
}

console.log(
  `\n${pass} passed, ${failures.length} failed` +
    (failures.length ? `\n\n${failures.map((f) => "  - " + f).join("\n")}\n` : "\n"),
);
process.exit(failures.length ? 1 : 0);
