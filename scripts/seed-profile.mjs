/**
 * Seeded profiles.
 *
 * Distinct from `demo-seed.mjs`, and the distinction is the reason this file
 * exists rather than another entry in that script's cast.
 *
 * The demo members are a development fixture: invented people, obviously
 * invented stories, gradients for faces, living wherever a developer happens to
 * be pointed. Nobody outside the team is ever meant to meet one. These are the
 * opposite -- profiles written to stand in front of real members on the live
 * product, and every decision below follows from that one difference.
 *
 * Four rules, and each matters:
 *
 * **A separate, reserved domain.** Every address is at `@seed.eraya.invalid`.
 * `.invalid` is reserved by RFC 2606 and can never resolve, so none of these can
 * receive mail or be swept up by a future campaign. The domain differs from the
 * demo set's `@demo.eraya.invalid` deliberately: `demo-seed.mjs --remove` must
 * not take these with it, and this script's `--remove` must not take the demo
 * cast. Two cohorts, two markers, neither able to delete the other.
 *
 * **No trust mark the product has not earned.** The account is NOT email
 * confirmed, because a `.invalid` address cannot receive mail and
 * `MemberPresentation` renders `emailVerified` as a visible mark on the card.
 * `phone_verified_at` stays null for the same reason. CLAUDE.md's rule is that
 * Eraya never shows a badge for something it has not checked, and a seeded
 * profile is exactly where that rule is most tempting to bend and most
 * important to keep -- the person reading the mark is a stranger deciding
 * whether to meet somebody.
 *
 * **No manufactured consent.** `legal_version_accepted` and `legal_accepted_at`
 * stay null. These accounts never passed a sign-in screen carrying the notice,
 * and the acceptance migration is explicit that backfilling a version somebody
 * was never shown manufactures the very evidence the columns exist to record.
 *
 * **Photographs that depict nobody.** Generated portraits only. A photograph of
 * a real person attached to a fabricated profile on a dating product is that
 * person's likeness being used to imply they are looking for a relationship,
 * which is not a thing to do -- and on a live product, unlike in development,
 * there is no version of it that stays private.
 *
 * It creates no interests, no conversations and no messages. A seeded profile
 * that appears to be doing things is a different and much worse object than one
 * that simply exists.
 *
 * It is idempotent. Running it twice updates rather than duplicates.
 *
 * It needs the service-role key, which exists only in `apps/web/.env.local`.
 *
 * Usage, from the repository root:
 *
 *   node scripts/seed-profile.mjs --dry-run   # say what would happen, touch nothing
 *   node scripts/seed-profile.mjs             # create or update the profiles
 *   node scripts/seed-profile.mjs --list      # show every seeded account
 *   node scripts/seed-profile.mjs --remove    # delete every seeded account
 *
 * Flags:
 *   --only <handle>   restrict to one person
 *   --no-trim         upload the source images exactly as supplied
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import zlib from "node:zlib";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/**
 * The marker that makes every one of these findable later.
 *
 * Nothing in the product reads it and nothing renders it -- `member_card`
 * carries no address -- so a seeded profile is presented exactly as any other.
 * It exists so that `--remove` can be exact rather than a list of ids somebody
 * has to keep somewhere.
 */
const SEED_DOMAIN = "seed.eraya.invalid";

/** Mirrors the domain in `user_metadata`, for anyone querying auth directly. */
const SEED_METADATA = { seeded: true, cohort: "bangalore-2026-09" };

// ---------------------------------------------------------------------------
// The people
// ---------------------------------------------------------------------------
//
// Only the columns `public.profiles` actually has. Eraya asks seven questions at
// onboarding -- name and date of birth, city, languages, relationship status,
// religion, who they hope to meet, and a photograph -- plus two free-text
// fields. There is no occupation column and no interests column, so anything of
// that kind belongs inside `about`, in the person's own words, which is where a
// reader would expect to find it anyway.

const PEOPLE = [
  {
    handle: "jemima",
    firstName: "Jemima",
    // Age is derived, never stored. 27 as of 2026-09-28.
    dateOfBirth: "1999-03-14",
    gender: "woman",
    seeking: ["man"],
    city: "Bengaluru",
    relationship: "separated",
    religion: "muslim",
    languages: ["English", "Hindi", "Urdu", "Kannada"],
    uiLocale: "en",
    about:
      "I work in HR at a company in Whitefield, which mostly means I am the " +
      "person everyone tells things to. I have got better at listening than I " +
      "used to be. Outside work I bake far more than one person can eat, I am " +
      "slowly making my Kannada less embarrassing, and I walk in Cubbon Park " +
      "on Sunday mornings before the crowds arrive.\n\n" +
      "I separated last year. It was quiet rather than dramatic and it took me " +
      "a while to stop apologising for it. The year since has been mostly " +
      "good. I have found out I am decent company on my own, which was not " +
      "something I knew about myself.",
    lookingFor:
      "Someone settled enough in himself that he is not in a hurry. I would " +
      "rather take a long time and be sure. Conversation matters more to me " +
      "than plans -- if we can talk easily on an ordinary Tuesday evening, the " +
      "rest of it will follow.",
    photos: {
      zip: "C:/Users/rahul/Documents/work/bot profiles/Bangalore/Jemima.zip",
      /*
       * Explicit rather than alphabetical, because position 0 is the picture
       * every card and every discovery deck shows. BF1_3 is the one where her
       * face is unobscured and well lit; BF1_4 has a phone across half of it,
       * which is a poor first impression and a fine third.
       */
      order: ["BF1_3.jpg", "BF1_2.jpg", "BF1_4.jpg"],
    },
  },
  {
    handle: "neha",
    /*
     * First name only, as everywhere else. The supplied name was "Neha Karnam"
     * and the surname is deliberately not stored: there is no column for one,
     * `first_name` is what the card renders beside the age, and a surname on an
     * Indian dating profile is community signalling -- which is the thing the
     * religion migration says Eraya is built to leave out.
     */
    firstName: "Neha",
    // 30 as of 2026-09-28.
    dateOfBirth: "1996-02-20",
    gender: "woman",
    seeking: ["man"],
    city: "Bengaluru",
    relationship: "widowed",
    religion: "hindu",
    languages: ["English", "Hindi", "Kannada", "Telugu"],
    uiLocale: "en",
    about:
      "I work in publishing -- textbooks mostly, which is less glamorous " +
      "than it sounds and more interesting than you would think. Weekends I " +
      "am in Cubbon Park with a book, or dragging somebody to a place that " +
      "does good filter coffee.\n\n" +
      "I lost my husband three years ago. I am not carrying it around any " +
      "more, but I would rather say it here than halfway through a " +
      "conversation.",
    lookingFor:
      "Someone with their own life who wants company inside it rather than " +
      "an audience. I am not in a hurry, and I would rather take the time to " +
      "actually know somebody than arrive somewhere quickly.",
    photos: {
      zip: "C:/Users/rahul/Documents/work/bot profiles/Bangalore/Neha Karnam.zip",
      // Daylight and the clearest face first; the sunset shot is atmospheric
      // but reads as a mood before it reads as a person.
      order: [
        "profile_photo_6.jpg",
        "profile_photo_4.jpg",
        "profile_photo_5.jpg",
      ],
    },
  },
  {
    handle: "swarnalata",
    // First name only, as with Neha. The supplied name was "Swarnalata Seth".
    firstName: "Swarnalata",
    // 29 as of 2026-09-28.
    dateOfBirth: "1997-01-18",
    gender: "woman",
    seeking: ["man"],
    city: "Bengaluru",
    relationship: "divorced",
    religion: "hindu",
    /*
     * Three rather than four, and chosen by the founder rather than inferred
     * from the surname. A guess at somebody's languages from their name is the
     * same guess the religion migration refuses to make about their religion.
     */
    languages: ["English", "Hindi", "Kannada"],
    uiLocale: "en",
    about:
      "I am a physiotherapist. I spend all day telling people to be patient " +
      "with their own bodies and I am notably bad at taking my own advice. " +
      "Outside work I swim badly but often, I read two books at once and " +
      "finish neither, and I will drive three hours for a good breakfast.\n\n" +
      "My marriage ended two years ago. It was the right decision, and it " +
      "still took me most of a year to stop explaining myself about it.",
    lookingFor:
      "Someone kind, and curious about things that have nothing to do with " +
      "him. I would like to be properly known rather than quickly chosen.",
    photos: {
      zip: "C:/Users/rahul/Documents/work/bot profiles/Bangalore/Swarnalata Seth.zip",
      // Direct-to-camera first, the laugh second, the mirror selfie last --
      // the same ordering logic as the other two.
      order: [
        "profile_photo_1.jpg",
        "profile_photo_6.jpg",
        "profile_photo_4.jpg",
      ],
    },
  },
  {
    handle: "moumita",
    /*
     * Both photographs show sindoor, which in India reads as married and sits
     * against `divorced`. Raised twice and the founder chose to publish as-is
     * on 2026-09-28; recorded here so nobody later reads it as an oversight.
     * Replacing the images is a new zip at the path below and a re-run -- the
     * script deletes and replaces a profile's photos rather than adding to
     * them, so nothing has to be cleaned up first.
     */
    firstName: "Moumita",
    // 29 as of 2026-09-28.
    dateOfBirth: "1997-03-22",
    gender: "woman",
    seeking: ["man"],
    city: "Kolkata",
    relationship: "divorced",
    religion: "hindu",
    languages: ["Bengali", "Hindi", "English"],
    uiLocale: "en",
    about:
      "I teach English at a school in the south of the city, which means I " +
      "spend my days being corrected by fourteen-year-olds about what is and " +
      "is not embarrassing. Weekends are College Street, the same three " +
      "coffee places, and a flat with more plants in it than sense.\n\n" +
      "My marriage ended a year and a half ago. It was quieter than people " +
      "expect these things to be.",
    lookingFor:
      "Someone who reads, who argues well and kindly, and who is not looking " +
      "for me to be a project. I would rather go slowly and get it right.",
    photos: {
      zip: "C:/Users/rahul/Documents/work/bot profiles/Kolkata/Moumita banerjee.zip",
      // The closer portrait first; the lakeside one is further off and reads
      // as a scene before it reads as a person.
      order: ["profile_photo_4.jpg", "profile_photo_2.jpg"],
    },
  },
  {
    handle: "sampa",
    /*
     * Same as Moumita, and from the same batch: all three photographs show
     * sindoor, one is shot against a marigold and fairy-light wedding
     * backdrop, and the others add a red thread necklace and a red-bordered
     * white saree. Five of five across the Kolkata folder against none of the
     * Bengaluru nine, so it is the generation prompt rather than unlucky
     * images -- "Bengali woman" produces married-woman iconography unless it
     * is negatively prompted out. Published as-is on the founder's decision,
     * 2026-09-28, after the contradiction was raised twice.
     */
    firstName: "Sampa",
    // 32 as of 2026-09-28.
    dateOfBirth: "1994-04-11",
    gender: "woman",
    seeking: ["man"],
    city: "Kolkata",
    relationship: "divorced",
    religion: "hindu",
    languages: ["Bengali", "Hindi", "English"],
    uiLocale: "en",
    about:
      "I work in accounts at a hospital, which is as unglamorous as it " +
      "sounds and suits me better than anything else I have tried. My " +
      "evenings are usually my mother's kitchen, or somebody's balcony " +
      "arguing about nothing in particular, which I am told is the only real " +
      "Bengali hobby.\n\n" +
      "I have been divorced four years. It took the first two to stop " +
      "treating it as something I had to apologise for.",
    lookingFor:
      "Someone who has also been through something and did not come out of " +
      "it hard. I am not in a rush, and I would far rather be asked " +
      "questions than impressed.",
    photos: {
      zip: "C:/Users/rahul/Documents/work/bot profiles/Kolkata/Sampa Jana.zip",
      // The wedding backdrop goes last rather than first: position 0 is the
      // one picture every card and deck shows, and a marigold arch behind a
      // divorced member is the worst of the three to lead with.
      order: [
        "profile_photo_1.jpg",
        "profile_photo_4.jpg",
        "profile_photo_3.jpg",
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reading a zip without a dependency
// ---------------------------------------------------------------------------
//
// Forty lines against a new package in the tree for a script that runs by hand
// a handful of times. Zip entries are either stored or deflated and `zlib` does
// the second one, so there is nothing else to it.

function readZip(file) {
  const buffer = fs.readFileSync(file);

  // The end-of-central-directory record is last, after a comment of unknown
  // length, so it is found by scanning backwards for its signature.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${file} is not a zip archive`);

  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);

  const entries = [];

  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(at + 10);
    const compressedSize = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const localAt = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);

    // The local header repeats the name and extra fields, at its own lengths.
    const localNameLength = buffer.readUInt16LE(localAt + 26);
    const localExtraLength = buffer.readUInt16LE(localAt + 28);
    const dataAt = localAt + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataAt, dataAt + compressedSize);

    // Directory entries end in a slash and carry no content.
    if (!name.endsWith("/")) {
      entries.push({
        name: path.posix.basename(name),
        data: method === 0 ? raw : zlib.inflateRawSync(raw),
      });
    }

    at += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// The slicing artefact at the bottom of a contact-sheet crop
// ---------------------------------------------------------------------------
//
// Portraits arrive as cells cut out of a generated contact sheet, and a cut that
// lands a few pixels low carries the sheet's white gutter and a sliver of the
// next cell along with it. On a sheet that is invisible. On a profile card,
// filling the frame, it is a bright band across the bottom of somebody's
// photograph that reads as a rendering bug.
//
// So the gutter is found rather than assumed -- the same approach, and the same
// reasoning, as `slice-contact-sheet.mjs`: read the image in greyscale, take the
// mean of each row, and a run of near-white rows in the bottom portion is a
// gutter rather than part of the picture. Everything from there down goes.
//
// Nothing is resized, nothing is recompressed unless a trim actually happens,
// and an image with no gutter is uploaded as the exact bytes supplied.

/** Above this mean, a row is gutter rather than picture. */
const GUTTER_LUMA = 235;
/** Only the bottom of the frame is considered. A bright sky is not a gutter. */
const SEARCH_FROM = 0.8;

async function trimSheetGutter(buffer) {
  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  if (!width || !height) return { buffer, trimmed: 0 };

  const grey = await sharp(buffer).greyscale().raw().toBuffer();

  let cut = -1;
  for (let y = Math.floor(height * SEARCH_FROM); y < height; y += 1) {
    let sum = 0;
    for (let x = 0; x < width; x += 1) sum += grey[y * width + x];
    if (sum / width >= GUTTER_LUMA) {
      cut = y;
      break;
    }
  }

  if (cut < 0) return { buffer, trimmed: 0 };

  const kept = await sharp(buffer)
    .extract({ left: 0, top: 0, width, height: cut })
    // High enough that a 512px crop is indistinguishable from its source.
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();

  return { buffer: kept, trimmed: height - cut };
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function findCityId(admin, name) {
  const { data } = await admin
    .from("cities")
    .select("id")
    .eq("name", name)
    .eq("is_active", true)
    .limit(1);
  return data?.[0]?.id ?? null;
}

async function findLanguageIds(admin, names) {
  const { data } = await admin
    .from("languages")
    .select("id, name")
    .in("name", names);

  const found = data ?? [];
  const missing = names.filter((n) => !found.some((row) => row.name === n));
  if (missing.length) {
    console.warn(`    unknown language(s) ignored: ${missing.join(", ")}`);
  }
  return found.map((row) => row.id);
}

async function findUserByEmail(admin, email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((user) => user.email === email) ?? null;
}

// ---------------------------------------------------------------------------
// Photographs
// ---------------------------------------------------------------------------

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** The source images for a person, in the order they should be shown. */
function sourcePhotos(person) {
  const spec = person.photos;
  if (!spec) return [];

  let entries;

  if (spec.zip) {
    if (!fs.existsSync(spec.zip)) {
      throw new Error(`photo archive not found: ${spec.zip}`);
    }
    entries = readZip(spec.zip);
  } else if (spec.dir) {
    entries = fs
      .readdirSync(spec.dir)
      .filter((name) => CONTENT_TYPES[path.extname(name).toLowerCase()])
      .map((name) => ({
        name,
        data: fs.readFileSync(path.join(spec.dir, name)),
      }));
  } else {
    return [];
  }

  entries = entries.filter(
    (entry) => CONTENT_TYPES[path.extname(entry.name).toLowerCase()],
  );

  if (!spec.order) return entries.sort((a, b) => a.name.localeCompare(b.name));

  // An explicit order names the files; anything unnamed is dropped rather than
  // appended, so a stray file in the archive cannot become somebody's photo.
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const ordered = [];
  for (const name of spec.order) {
    const entry = byName.get(name);
    if (!entry) throw new Error(`${name} is not in the archive`);
    ordered.push(entry);
  }
  return ordered;
}

/** The six-photo limit is enforced by a trigger; stop short of provoking it. */
const MAX_PHOTOS = 6;

async function seedPhotos(admin, person, userId, { trim }) {
  const sources = sourcePhotos(person).slice(0, MAX_PHOTOS);
  if (!sources.length) return { uploaded: [], note: "no photos supplied" };

  /*
   * Replace rather than accumulate, so re-running is idempotent. The files go
   * first and the rows second: a row with no file renders a broken image, a
   * file with no row is merely unreferenced, and if this fails halfway the
   * second is the better state to be in.
   */
  const { data: existing } = await admin
    .from("profile_photos")
    .select("storage_path")
    .eq("profile_id", userId);

  if (existing?.length) {
    await admin.storage
      .from("profile-photos")
      .remove(existing.map((row) => row.storage_path));
    await admin.from("profile_photos").delete().eq("profile_id", userId);
  }

  const uploaded = [];

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const extension = path.extname(source.name).toLowerCase();

    let body = source.data;
    let trimmed = 0;

    if (trim && CONTENT_TYPES[extension] === "image/jpeg") {
      const result = await trimSheetGutter(body);
      body = result.buffer;
      trimmed = result.trimmed;
    }

    /*
     * The storage path must begin with the owner's id -- `profile_photos` has a
     * check constraint saying so, and the bucket policies key off the same
     * prefix. `seed-` in the filename is a second, harmless marker.
     */
    const objectPath = `${userId}/seed-${index}${extension}`;

    const { error: uploadError } = await admin.storage
      .from("profile-photos")
      .upload(objectPath, body, {
        contentType: CONTENT_TYPES[extension] ?? "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { error } = await admin
      .from("profile_photos")
      .insert({ profile_id: userId, storage_path: objectPath, position: index });

    if (error) throw new Error(error.message);

    uploaded.push({
      source: source.name,
      path: objectPath,
      position: index,
      bytes: body.length,
      trimmed,
    });
  }

  return { uploaded, note: `${uploaded.length} photo(s)` };
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function seed(admin, { only, trim, dryRun }) {
  const chosen = only ? PEOPLE.filter((p) => p.handle === only) : PEOPLE;

  if (!chosen.length) {
    console.error(`No seeded person with handle "${only}".`);
    process.exit(1);
  }

  for (const person of chosen) {
    const email = `${person.handle}@${SEED_DOMAIN}`;
    console.log(`\n${person.firstName}  <${email}>`);

    /*
     * A held entry is one whose copy is settled but whose photographs are not
     * fit to publish. Skipped even when named by `--only`, because the whole
     * point is that no accidental run creates it -- and a flag that a hurried
     * `--only` overrides is not a safeguard. Removing `hold` is the decision.
     */
    if (person.hold) {
      console.log(`    HELD, not created: ${person.hold}`);
      console.log("    Remove the `hold` line in PEOPLE to create this one.");
      continue;
    }

    const cityId = await findCityId(admin, person.city);
    if (!cityId) {
      console.log(`    city "${person.city}" not in the table; using other_city`);
    }
    const languageIds = await findLanguageIds(admin, person.languages);

    const row = {
      first_name: person.firstName,
      date_of_birth: person.dateOfBirth,
      gender: person.gender,
      seeking: person.seeking,
      city_id: cityId,
      other_city: cityId ? null : person.city,
      relationship_status: person.relationship,
      religion: person.religion,
      languages_undisclosed: false,
      about: person.about,
      looking_for: person.lookingFor,
      ui_locale: person.uiLocale ?? "en",
      // Not verified, and never claimed to be. See the header.
      phone_verified_at: null,
      phone_verified_via: null,
      onboarding_stage: "onboarding_completed",
    };

    if (dryRun) {
      const sources = sourcePhotos(person);
      console.log("    would write:", JSON.stringify(row, null, 2).replace(/\n/g, "\n    "));
      console.log(`    languages: ${languageIds.length} matched`);
      console.log(`    photos: ${sources.map((s) => s.name).join(", ")}`);
      continue;
    }

    let user = await findUserByEmail(admin, email);

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        // Deliberately NOT confirmed: a `.invalid` address receives nothing, and
        // `emailVerified` is rendered as a trust mark on the member card.
        email_confirm: false,
        user_metadata: SEED_METADATA,
      });

      if (error) {
        console.error(`    failed: ${error.message}`);
        continue;
      }
      user = data.user;
      console.log(`    created auth user ${user.id}`);
    } else {
      console.log(`    updating existing ${user.id}`);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: user.id, ...row }, { onConflict: "id" });

    if (profileError) {
      console.error(`    failed: ${profileError.message}`);
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

    try {
      const { uploaded } = await seedPhotos(admin, person, user.id, { trim });
      for (const photo of uploaded) {
        const note = photo.trimmed
          ? `trimmed ${photo.trimmed}px of sheet gutter`
          : "as supplied";
        console.log(
          `    photo ${photo.position}: ${photo.source.padEnd(12)} -> ${photo.path}  (${photo.bytes} bytes, ${note})`,
        );
      }
    } catch (error) {
      console.error(`    photos failed: ${error.message}`);
    }

    console.log(`    id: ${user.id}`);
  }

  console.log("\nDone.");
}

// ---------------------------------------------------------------------------
// Listing and removal
// ---------------------------------------------------------------------------

async function seededUsers(admin) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? []).filter((user) =>
    user.email?.endsWith(`@${SEED_DOMAIN}`),
  );
}

async function list(admin) {
  const users = await seededUsers(admin);

  if (!users.length) {
    console.log("No seeded accounts.");
    return;
  }

  console.log(`${users.length} seeded account(s):\n`);
  for (const user of users) {
    const { data } = await admin
      .from("profiles")
      .select("first_name, onboarding_stage, suspended_at")
      .eq("id", user.id)
      .maybeSingle();

    const state = data?.suspended_at ? "suspended" : (data?.onboarding_stage ?? "no profile");
    console.log(`  ${user.id}  ${(data?.first_name ?? "-").padEnd(12)} ${user.email.padEnd(32)} ${state}`);
  }
}

async function remove(admin, { only }) {
  let users = await seededUsers(admin);
  if (only) users = users.filter((u) => u.email === `${only}@${SEED_DOMAIN}`);

  if (!users.length) {
    console.log("Nothing to remove.");
    return;
  }

  console.log(`Removing ${users.length} seeded account(s)...\n`);

  for (const user of users) {
    /*
     * Files first, and through the Storage API, because there is no other way:
     * `storage.objects` has no foreign key to `auth.users`, so deleting the
     * account cascades every row except the files, and afterwards there is no
     * id left to find them by. `demo-seed.mjs` learned this the expensive way.
     */
    const { data: files } = await admin.storage
      .from("profile-photos")
      .list(user.id, { limit: 100 });

    if (files?.length) {
      await admin.storage
        .from("profile-photos")
        .remove(files.map((file) => `${user.id}/${file.name}`));
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    const photos = files?.length ? `, ${files.length} photo(s)` : "";
    console.log(`  ${user.email} ${error ? error.message : `removed${photos}`}`);
  }

  console.log("\nDone. Real accounts and the demo cast are untouched.");
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
};

const options = {
  only: valueOf("--only"),
  trim: !has("--no-trim"),
  dryRun: has("--dry-run"),
};

const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key.");
  process.exit(1);
}

console.log(`Target: ${url}\n`);

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (has("--remove")) {
  await remove(admin, options);
} else if (has("--list")) {
  await list(admin);
} else {
  await seed(admin, options);
}
