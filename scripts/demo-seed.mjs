/**
 * Demo members, for testing the journey before real people exist.
 *
 * Eraya is new. Discovery, connections and conversations cannot be exercised
 * without other members, and waiting for real ones in order to test the product
 * is not a plan. So this creates a handful of clearly fictional people.
 *
 * Four rules it follows, and each matters:
 *
 * Every address is at `@demo.eraya.invalid`. `.invalid` is reserved by RFC 2606
 * and can never resolve, so none of these can receive mail, be confused for a
 * real member, or accidentally be emailed by a future campaign. It is also the
 * marker that makes `--remove` able to find every one of them.
 *
 * The names and stories are invented and read as invented.
 *
 * The photos are generated here rather than downloaded. A demo member with a
 * stock face would be a real person's likeness attached to a fabricated profile
 * on a dating product, which is not a thing to do casually even in development,
 * and scraping one is a licensing problem on top. What each member gets instead
 * is a deterministic gradient in the brand palette with their initial -- enough
 * for the photo-forward card layout to be exercised honestly, and obviously not
 * a person.
 *
 * It is idempotent. Running it twice updates rather than duplicates.
 *
 * It never runs against anything but a local developer's machine, because it
 * needs the service-role key, which exists only in `apps/web/.env.local` and
 * must never reach a client or a repository.
 *
 * Usage, from the repository root:
 *
 *   node scripts/demo-seed.mjs                    # create or update the members
 *   node scripts/demo-seed.mjs --interest <email> # have them express interest in you
 *   node scripts/demo-seed.mjs --link <email>     # print a sign-in link for a demo member
 *   node scripts/demo-seed.mjs --remove           # delete every demo member
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const DEMO_DOMAIN = "demo.eraya.invalid";

function readEnv() {
  const file = path.join(root, "apps/web/.env.local");

  if (!fs.existsSync(file)) {
    console.error(
      "apps/web/.env.local not found. This script needs the service-role key,\n" +
        "which lives there and nowhere else.",
    );
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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * The cast.
 *
 * Written to be plainly fictional while still being realistic enough to test
 * the layouts that matter: long names, long city names, several languages, a
 * profile with no words at all, and one whose "about" is long enough to be
 * truncated on a card.
 */
const PEOPLE = [
  {
    handle: "meera",
    seeking: ["man"],
    firstName: "Meera",
    dateOfBirth: "1982-04-11",
    gender: "woman",
    city: "Pune",
    relationship: "divorced",
    languages: ["Marathi", "Hindi", "English"],
    about:
      "I teach mathematics to fourteen-year-olds, which is either the best or the worst preparation for anything. Weekends are for the garden and for arguing about films with my sister. I have been on my own for four years now and I am ready for company again, without any hurry about it.",
    lookingFor:
      "Someone who reads, who can sit quietly, and who does not mind that I am often busy on weekday evenings.",
  },
  {
    handle: "arun",
    seeking: ["woman"],
    firstName: "Arun",
    dateOfBirth: "1975-09-30",
    gender: "man",
    city: "Bengaluru",
    relationship: "widowed",
    languages: ["Kannada", "English", "Tamil"],
    about:
      "Widowed in 2021. Two grown children who keep telling me to get out of the house, so here I am. I have run the same small printing business for twenty-two years and I still enjoy it. I walk in Cubbon Park most mornings.",
    lookingFor: "Conversation. Company on the morning walk, eventually.",
  },
  {
    handle: "priya",
    seeking: ["man"],
    firstName: "Priya",
    dateOfBirth: "1988-01-19",
    gender: "woman",
    city: "Kolkata",
    relationship: "separated",
    languages: ["Bengali", "Hindi", "English"],
    about:
      "Architect, mostly houses rather than anything grand. Separated for eighteen months and finally starting to feel like myself. I cook far too much food for one person and I am told I am funnier than I think.",
    lookingFor: null,
  },
  {
    handle: "rakesh",
    seeking: ["woman"],
    firstName: "Rakesh",
    dateOfBirth: "1979-06-02",
    gender: "man",
    city: "Thiruvananthapuram",
    relationship: "divorced",
    languages: ["Malayalam", "English"],
    // Deliberately blank, to prove a profile with no words still reads well.
    about: null,
    lookingFor: null,
  },
  {
    handle: "farida",
    seeking: ["man"],
    firstName: "Farida",
    dateOfBirth: "1969-11-23",
    gender: "woman",
    city: "Hyderabad",
    relationship: "widowed",
    languages: ["Urdu", "Telugu", "Hindi", "English"],
    about:
      "Retired from the bank last year after thirty-one years and I have not been bored for a single day since. Grandmother to three. I want someone to go to the theatre with, and to complain about the theatre with afterwards.",
    lookingFor: "A companion, and honestly nothing more complicated than that.",
  },
  {
    handle: "vikram",
    seeking: ["woman"],
    firstName: "Vikram",
    dateOfBirth: "1977-12-14",
    gender: "man",
    city: "Pune",
    relationship: "divorced",
    languages: ["Marathi", "Hindi", "English"],
    about:
      "Civil engineer, mostly bridges, which I am told is a metaphor. Divorced six years. I cycle badly and cook well, and I would like someone to eat the results.",
    lookingFor: "Company that does not need filling with conversation.",
  },
  {
    handle: "anjali",
    seeking: ["man", "woman"],
    firstName: "Anjali",
    dateOfBirth: "1985-07-21",
    gender: "woman",
    city: "Mumbai",
    relationship: "separated",
    languages: ["Marathi", "Hindi", "English", "Gujarati"],
    about:
      "I run a small clinic in Bandra. Separated last year and still working out what my weekends are for. Fond of long train journeys and short arguments.",
    lookingFor: null,
  },
  {
    handle: "sanjay",
    seeking: ["woman"],
    firstName: "Sanjay",
    dateOfBirth: "1990-03-08",
    gender: "man",
    city: "Delhi",
    relationship: "divorced",
    languages: ["Hindi", "English", "Punjabi"],
    about:
      "Thirty-five, divorced two years ago, no children. I write software and I play very mediocre badminton. I am told I take things too seriously, which I am working on.",
    lookingFor: "Someone patient with the working-on-it part.",
  },
];

async function findCityId(name) {
  const { data } = await admin
    .from("cities")
    .select("id")
    .eq("name", name)
    .eq("is_active", true)
    .limit(1);
  return data?.[0]?.id ?? null;
}

async function findLanguageIds(names) {
  const { data } = await admin
    .from("languages")
    .select("id, name")
    .in("name", names);
  return (data ?? []).map((row) => row.id);
}

/**
 * A portrait-shaped placeholder, derived from the name.
 *
 * Deterministic: the same member is the same image every run, so re-seeding does
 * not reshuffle the demo set. 4:5 because that is the aspect the cards and
 * profiles render, so nothing is cropped in a way the real path would not be.
 */
async function generatePhoto(person) {
  const hue = crypto.createHash("md5").update(person.handle).digest()[0];
  const palettes = [
    ["#BD4F33", "#F4CFAE"],
    ["#5A3328", "#ECE0D1"],
    ["#3F6B52", "#E7F0E9"],
    ["#A8452C", "#F7E6DE"],
    ["#6B5B51", "#F4ECE2"],
  ];
  const [from, to] = palettes[hue % palettes.length];
  const initial = person.firstName.charAt(0).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="1500" fill="url(#g)"/>
    <text x="600" y="820" text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif" font-size="520"
          fill="rgba(255,255,255,0.82)">${initial}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

async function seedPhoto(person, userId) {
  // Idempotent: one photo per demo member, replaced rather than accumulated.
  const path = `${userId}/demo-portrait.jpg`;

  const body = await generatePhoto(person);
  const { error: uploadError } = await admin.storage
    .from("profile-photos")
    .upload(path, body, { contentType: "image/jpeg", upsert: true });

  if (uploadError) return uploadError.message;

  await admin.from("profile_photos").delete().eq("profile_id", userId);
  const { error } = await admin
    .from("profile_photos")
    .insert({ profile_id: userId, storage_path: path, position: 0 });

  return error ? error.message : null;
}

async function findUserByEmail(email) {
  // listUsers is paginated; the demo set is small enough that one page is plenty.
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((user) => user.email === email) ?? null;
}

async function seed() {
  console.log(`Seeding ${PEOPLE.length} demo members...\n`);

  for (const person of PEOPLE) {
    const email = `${person.handle}@${DEMO_DOMAIN}`;

    let user = await findUserByEmail(email);

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        // Confirmed so they count as email-verified, which is the one trust mark
        // the product actually shows.
        email_confirm: true,
        user_metadata: { demo: true },
      });

      if (error) {
        console.error(`  ${person.firstName}: ${error.message}`);
        continue;
      }
      user = data.user;
    }

    const cityId = await findCityId(person.city);
    const languageIds = await findLanguageIds(person.languages);

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: user.id,
        first_name: person.firstName,
        date_of_birth: person.dateOfBirth,
        gender: person.gender,
        seeking: person.seeking,
        city_id: cityId,
        other_city: cityId ? null : person.city,
        relationship_status: person.relationship,
        languages_undisclosed: false,
        about: person.about,
        looking_for: person.lookingFor,
        // The phone step is mocked, and these are stand-ins for people who
        // completed it. No member is shown a phone badge either way.
        phone_verified_at: new Date().toISOString(),
        onboarding_stage: "onboarding_completed",
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.error(`  ${person.firstName}: ${profileError.message}`);
      continue;
    }

    await admin.from("profile_languages").delete().eq("profile_id", user.id);
    if (languageIds.length) {
      await admin.from("profile_languages").insert(
        languageIds.map((languageId) => ({
          profile_id: user.id,
          language_id: languageId,
        })),
      );
    }

    const photoError = await seedPhoto(person, user.id);

    console.log(
      `  ${person.firstName.padEnd(8)} ${person.city.padEnd(22)} ` +
        `${photoError ? "photo failed: " + photoError : "photo ok"}`,
    );
  }

  console.log("\nDone.");
}

/**
 * Has some demo members express interest in a real account.
 *
 * This is what makes the mutual-connection moment testable: say yes to one of
 * them and the connection forms immediately, because their half already exists.
 * It also gives the premium "who is interested in you" screen something real to
 * show.
 */
async function primeInterest(targetEmail) {
  const target = await findUserByEmail(targetEmail);

  if (!target) {
    console.error(`No account found for ${targetEmail}.`);
    process.exit(1);
  }

  // Skip the target if they are themselves a demo member -- signing in as one to
  // walk the journey is the normal way to test this, and the database rejects
  // self-interest, which is correct but noisy.
  const chosen = PEOPLE.slice(0, 4);

  for (const person of chosen) {
    const user = await findUserByEmail(`${person.handle}@${DEMO_DOMAIN}`);
    if (!user || user.id === target.id) continue;

    const { error } = await admin.from("member_interests").upsert(
      { from_id: user.id, to_id: target.id, kind: "interested" },
      { onConflict: "from_id,to_id" },
    );

    console.log(
      error
        ? `  ${person.firstName}: ${error.message}`
        : `  ${person.firstName} is now interested in ${targetEmail}`,
    );
  }
}

/** Prints a sign-in link for a demo member, so their side can be walked too. */
async function printLink(email, redirectTo) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(data.properties?.action_link ?? "(no link returned)");
}

async function remove() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const demo = (data?.users ?? []).filter((user) =>
    user.email?.endsWith(`@${DEMO_DOMAIN}`),
  );

  console.log(`Removing ${demo.length} demo members...\n`);

  for (const user of demo) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    console.log(`  ${user.email} ${error ? error.message : "removed"}`);
  }

  console.log("\nDone. Real accounts are untouched.");
}

const [flag, value] = process.argv.slice(2);

if (flag === "--remove") {
  await remove();
} else if (flag === "--interest") {
  if (!value) {
    console.error("Usage: node scripts/demo-seed.mjs --interest <your-email>");
    process.exit(1);
  }
  await primeInterest(value);
} else if (flag === "--link") {
  if (!value) {
    console.error("Usage: node scripts/demo-seed.mjs --link <demo-email>");
    process.exit(1);
  }
  await printLink(value, process.argv[4] ?? "http://localhost:8081");
} else {
  await seed();
}
