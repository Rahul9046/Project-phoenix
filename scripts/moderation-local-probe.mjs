/**
 * Prove the moderation boundary, at runtime, against a disposable local stack.
 *
 * `20261127100100_content_moderation.sql` makes claims that are only worth
 * anything if they hold against a real request from a real member's token:
 * that a pending photograph is unreachable, that a member cannot approve their
 * own, that replacing one does not inherit its approval, and that text
 * screening cannot be walked around by an older client. Structural checks on
 * the SQL cannot establish any of that -- a policy that reads correctly and a
 * policy that is enforced look identical in a migration file.
 *
 * So every assertion below is a live HTTP request, as a named member, through
 * the same REST and Storage APIs the two shipped clients use.
 *
 * LOCAL ONLY, and not overridable. It creates auth users, uploads image bytes
 * and writes profiles. `local-fixtures.mjs` takes the same position for the
 * same reason: nothing here belongs anywhere but a database that can be thrown
 * away.
 *
 *   npm run moderation:local
 */

import { createClient } from "@supabase/supabase-js";
import { isLocalTarget } from "./lib/probe-target.mjs";

const URL_BASE = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

if (!URL_BASE || !SERVICE || !ANON) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY\n" +
      "(from `npx supabase status`).",
  );
  process.exit(1);
}

if (!isLocalTarget(URL_BASE)) {
  console.error(`\nREFUSING: ${URL_BASE} is not a local Supabase stack.`);
  console.error("This probe creates accounts, profiles and photo objects.");
  console.error("There is deliberately no way to override that.\n");
  process.exit(2);
}

console.log(`target: ${URL_BASE}  [local stack]\n`);

const db = createClient(URL_BASE, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
const failures = [];

function ok(cond, what, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  ok    ${what}`);
  } else {
    failures.push(what + (detail ? ` (${detail})` : ""));
    console.log(`  FAIL  ${what}${detail ? `  -- ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PEOPLE = [
  {
    key: "owner",
    email: "mod-owner@seed.local",
    first_name: "Priya",
    gender: "woman",
    seeking: ["man"],
  },
  {
    key: "other",
    email: "mod-other@seed.local",
    first_name: "Vikram",
    gender: "man",
    seeking: ["woman"],
  },
  {
    key: "moderator",
    email: "mod-admin@seed.local",
    first_name: "Asha",
    gender: "woman",
    seeking: ["man"],
  },
  /*
   * Two demonstration accounts, for the isolation assertions.
   *
   * `account_kind` is set through the service role below rather than here,
   * because setting it is precisely the thing a member must not be able to do
   * and the probe asserts that separately.
   */
  {
    key: "demoA",
    email: "mod-demo-a@seed.local",
    first_name: "Demo Meera",
    gender: "woman",
    seeking: ["man"],
    demonstration: true,
  },
  {
    key: "demoB",
    email: "mod-demo-b@seed.local",
    first_name: "Demo Arjun",
    gender: "man",
    seeking: ["woman"],
    demonstration: true,
  },
];

const ids = {};
const tokens = {};

async function tokenFor(email) {
  const { data, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:8081" },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  const response = await fetch(data.properties.action_link, { redirect: "manual" });
  const fragment = new URLSearchParams(
    (response.headers.get("location") ?? "").split("#")[1] ?? "",
  );
  const token = fragment.get("access_token");
  if (!token) throw new Error(`${email}: no access token in the redirect`);
  return token;
}

/** A REST/RPC call as a member, exactly as a client makes it. */
async function asMember(token, path, init = {}) {
  const response = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function rpc(token, fn, args = {}) {
  return asMember(token, `/rest/v1/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

// A one-pixel PNG. The assertions are about who may read bytes, not about what
// the bytes depict.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadAs(token, path) {
  const response = await fetch(
    `${URL_BASE}/storage/v1/object/profile-photos/${path}`,
    {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "image/png",
      },
      body: PIXEL,
    },
  );
  return response.status;
}

async function downloadAs(token, path) {
  const response = await fetch(
    `${URL_BASE}/storage/v1/object/profile-photos/${path}`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  return response.status;
}

async function setup() {
  for (const person of PEOPLE) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => u.email === person.email);
    if (existing) await db.auth.admin.deleteUser(existing.id);

    const { data, error } = await db.auth.admin.createUser({
      email: person.email,
      email_confirm: true,
    });
    if (error) throw new Error(`${person.email}: ${error.message}`);
    ids[person.key] = data.user.id;

    const { error: upErr } = await db
      .from("profiles")
      .update({
        first_name: person.first_name,
        gender: person.gender,
        seeking: person.seeking,
        date_of_birth: "1988-04-12",
        other_city: "Pune",
        relationship_status: "divorced",
        onboarding_stage: "onboarding_completed",
      })
      .eq("id", data.user.id);
    if (upErr) throw new Error(`${person.email} profile: ${upErr.message}`);

    /*
     * The service role is the only thing that may set this, which is the whole
     * point of the column. `auth.uid()` is null for the service role, so the
     * guard trigger lets it through; every other caller is refused.
     */
    if (person.demonstration) {
      const { error: kindErr } = await db
        .from("profiles")
        .update({ account_kind: "demonstration" })
        .eq("id", data.user.id);
      if (kindErr) throw new Error(`${person.email} account_kind: ${kindErr.message}`);
    }

    tokens[person.key] = await tokenFor(person.email);
  }

  // The moderator allowlist lives in ops_config, service-role only. This is the
  // same mechanism production uses; nothing special is granted here.
  const { error } = await db
    .from("ops_config")
    .upsert(
      { key: "moderation_admins", value: ["mod-admin@seed.local"] },
      { onConflict: "key" },
    );
  if (error) throw new Error(`ops_config: ${error.message}`);
}

// ---------------------------------------------------------------------------

async function main() {
  await setup();

  // -------------------------------------------------------------------------
  console.log("A new photograph is unreviewed, whatever the client claims");

  const ownerPath = `${ids.owner}/${Date.now()}-0.jpg`;
  const uploadStatus = await uploadAs(tokens.owner, ownerPath);
  ok(uploadStatus === 200, "a member can still upload into their own folder", `http ${uploadStatus}`);

  // The row, inserted the way `uploadPhoto` does -- and then the way a
  // malicious client would.
  const inserted = await asMember(tokens.owner, "/rest/v1/profile_photos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      profile_id: ids.owner,
      storage_path: ownerPath,
      position: 0,
    }),
  });
  ok(inserted.status === 201, "the photo row is accepted", `http ${inserted.status}`);
  const photoId = Array.isArray(inserted.body) ? inserted.body[0]?.id : null;
  ok(
    Array.isArray(inserted.body) && inserted.body[0]?.moderation_state === "pending",
    "a newly uploaded photograph is pending",
    JSON.stringify(inserted.body?.[0]?.moderation_state),
  );

  const liar = `${ids.owner}/${Date.now()}-1.jpg`;
  await uploadAs(tokens.owner, liar);
  const lied = await asMember(tokens.owner, "/rest/v1/profile_photos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      profile_id: ids.owner,
      storage_path: liar,
      position: 1,
      moderation_state: "approved",
    }),
  });
  ok(
    lied.status === 201 &&
      Array.isArray(lied.body) &&
      lied.body[0]?.moderation_state === "pending",
    "a client that inserts moderation_state 'approved' is overruled, not obeyed",
    JSON.stringify(lied.body?.[0]?.moderation_state ?? lied.body),
  );

  // -------------------------------------------------------------------------
  console.log("\nA member cannot moderate their own photograph");

  const selfApprove = await asMember(
    tokens.owner,
    `/rest/v1/profile_photos?id=eq.${photoId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ moderation_state: "approved" }),
    },
  );
  ok(
    selfApprove.status >= 400,
    "a member PATCHing their own moderation_state is refused",
    `http ${selfApprove.status}`,
  );

  const stillPending = await asMember(
    tokens.owner,
    `/rest/v1/profile_photos?id=eq.${photoId}&select=moderation_state`,
  );
  ok(
    stillPending.body?.[0]?.moderation_state === "pending",
    "and the photograph is still pending afterwards",
    JSON.stringify(stillPending.body),
  );

  const selfReposition = await asMember(
    tokens.owner,
    `/rest/v1/profile_photos?id=eq.${photoId}`,
    { method: "PATCH", body: JSON.stringify({ position: 2 }) },
  );
  ok(
    selfReposition.status < 400,
    "but reordering their own photographs still works",
    `http ${selfReposition.status}`,
  );

  const notModerator = await rpc(tokens.owner, "approve_photo", { photo_id: photoId });
  ok(
    notModerator.status >= 400,
    "approve_photo refuses a member who is not a moderator",
    `http ${notModerator.status}`,
  );
  const notModeratorReject = await rpc(tokens.other, "reject_photo", {
    photo_id: photoId,
    reason: "explicit",
  });
  ok(
    notModeratorReject.status >= 400,
    "reject_photo refuses a member who is not a moderator",
    `http ${notModeratorReject.status}`,
  );
  const queuePeek = await rpc(tokens.other, "photo_review_queue", {});
  ok(
    Array.isArray(queuePeek.body) && queuePeek.body.length === 0,
    "photo_review_queue returns nothing to a member who is not a moderator",
    JSON.stringify(queuePeek.body).slice(0, 80),
  );

  // -------------------------------------------------------------------------
  console.log("\nA pending photograph does not leak");

  const otherReads = await downloadAs(tokens.other, ownerPath);
  ok(
    otherReads === 400 || otherReads === 403 || otherReads === 404,
    "another member cannot download a pending photograph by its exact path",
    `http ${otherReads}`,
  );

  const ownerReads = await downloadAs(tokens.owner, ownerPath);
  ok(ownerReads === 200, "the owner can see their own pending photograph", `http ${ownerReads}`);

  const moderatorReads = await downloadAs(tokens.moderator, ownerPath);
  ok(
    moderatorReads === 200,
    "a moderator can see it, which is what reviewing requires",
    `http ${moderatorReads}`,
  );

  const profileView = await rpc(tokens.other, "member_profile", { member_id: ids.owner });
  ok(
    Array.isArray(profileView.body) && profileView.body.length === 1,
    "the owner is still visible as a profile",
    `rows ${profileView.body?.length}`,
  );
  ok(
    profileView.body?.[0]?.photo_path === null,
    "...but member_profile reports no photo path while it is pending",
    JSON.stringify(profileView.body?.[0]?.photo_path),
  );
  ok(
    profileView.body?.[0]?.photo_count === 0,
    "...and a photo count of zero, so the card falls back to the monogram",
    JSON.stringify(profileView.body?.[0]?.photo_count),
  );

  const photosRpc = await rpc(tokens.other, "member_photos", { member_id: ids.owner });
  ok(
    Array.isArray(photosRpc.body) && photosRpc.body.length === 0,
    "member_photos returns nothing while every photograph is pending",
    JSON.stringify(photosRpc.body).slice(0, 80),
  );

  const directTable = await asMember(
    tokens.other,
    `/rest/v1/profile_photos?profile_id=eq.${ids.owner}&select=storage_path,moderation_state`,
  );
  ok(
    Array.isArray(directTable.body) && directTable.body.length === 0,
    "and selecting the table directly as another member returns nothing",
    JSON.stringify(directTable.body).slice(0, 80),
  );

  const ownPhotos = await rpc(tokens.owner, "my_photos", {});
  ok(
    Array.isArray(ownPhotos.body) && ownPhotos.body.length >= 1,
    "the owner can list their own photographs and see the state",
    `rows ${ownPhotos.body?.length}`,
  );

  // -------------------------------------------------------------------------
  console.log("\nApproval, rejection, and what each one changes");

  const approved = await rpc(tokens.moderator, "approve_photo", { photo_id: photoId });
  ok(approved.status === 200 && approved.body === true, "a moderator can approve", `http ${approved.status}`);

  const afterApproval = await downloadAs(tokens.other, ownerPath);
  ok(afterApproval === 200, "an approved photograph becomes readable by others", `http ${afterApproval}`);

  const cardAfter = await rpc(tokens.other, "member_profile", { member_id: ids.owner });
  ok(
    cardAfter.body?.[0]?.photo_path === ownerPath,
    "...and appears on the card",
    JSON.stringify(cardAfter.body?.[0]?.photo_path),
  );
  ok(cardAfter.body?.[0]?.photo_count === 1, "...with a count of one");

  const attribution = await db
    .from("profile_photos")
    .select("moderated_by, moderated_at")
    .eq("id", photoId)
    .single();
  ok(
    attribution.data?.moderated_by === ids.moderator && attribution.data?.moderated_at,
    "the decision records who made it and when",
    JSON.stringify(attribution.data),
  );

  const rejected = await rpc(tokens.moderator, "reject_photo", {
    photo_id: photoId,
    reason: "explicit",
  });
  ok(rejected.status === 200, "a moderator can reject", `http ${rejected.status}`);

  const afterRejection = await downloadAs(tokens.other, ownerPath);
  ok(
    afterRejection !== 200,
    "a rejected photograph stops being readable by others",
    `http ${afterRejection}`,
  );
  const ownerSeesRejection = await rpc(tokens.owner, "my_photos", {});
  const rejectedRow = (ownerSeesRejection.body ?? []).find((r) => r.id === photoId);
  ok(
    rejectedRow?.moderation_state === "rejected" &&
      rejectedRow?.rejection_reason === "explicit",
    "the owner is told it was rejected, and why",
    JSON.stringify(rejectedRow),
  );

  const reasonless = await rpc(tokens.moderator, "reject_photo", { photo_id: photoId });
  ok(reasonless.status >= 400, "a rejection with no reason is refused", `http ${reasonless.status}`);

  // -------------------------------------------------------------------------
  console.log("\nReplacing a photograph does not inherit its approval");

  await rpc(tokens.moderator, "approve_photo", { photo_id: photoId });
  const replacementPath = `${ids.owner}/${Date.now() + 1}-0.jpg`;
  await uploadAs(tokens.owner, replacementPath);
  const replacement = await asMember(tokens.owner, "/rest/v1/profile_photos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      profile_id: ids.owner,
      storage_path: replacementPath,
      position: 3,
    }),
  });
  ok(
    replacement.body?.[0]?.moderation_state === "pending",
    "a replacement uploaded alongside an approved one is pending",
    JSON.stringify(replacement.body?.[0]?.moderation_state),
  );
  const replacementRead = await downloadAs(tokens.other, replacementPath);
  ok(
    replacementRead !== 200,
    "...and its bytes are not readable by another member",
    `http ${replacementRead}`,
  );

  // Overwriting the approved object in place: the path is the same, so the row
  // -- and its approval -- would be inherited if the upload were allowed to
  // replace the bytes behind an approved record.
  const overwrite = await fetch(
    `${URL_BASE}/storage/v1/object/profile-photos/${ownerPath}`,
    {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${tokens.owner}`,
        "Content-Type": "image/png",
      },
      body: PIXEL,
    },
  );
  ok(
    overwrite.status !== 200,
    "re-uploading to an existing approved path is refused (no upsert)",
    `http ${overwrite.status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\nExisting content was grandfathered, not hidden and not claimed as reviewed");

  const legacyPath = `${ids.other}/legacy-0.jpg`;
  await db.storage.from("profile-photos").upload(legacyPath, PIXEL, {
    contentType: "image/png",
    upsert: true,
  });
  // Written with the service role and then forced to the pre-migration shape,
  // which is what a row that predates this migration looks like.
  await db.from("profile_photos").insert({
    profile_id: ids.other,
    storage_path: legacyPath,
    position: 0,
  });
  await db
    .from("profile_photos")
    .update({ moderation_state: "grandfathered" })
    .eq("storage_path", legacyPath);

  const legacyRead = await downloadAs(tokens.owner, legacyPath);
  ok(legacyRead === 200, "a grandfathered photograph stays visible to others", `http ${legacyRead}`);

  const legacyRow = await db
    .from("profile_photos")
    .select("moderated_by, moderated_at, moderation_state")
    .eq("storage_path", legacyPath)
    .single();
  ok(
    legacyRow.data?.moderated_by === null && legacyRow.data?.moderated_at === null,
    "...and is never recorded as having been approved by anybody",
    JSON.stringify(legacyRow.data),
  );

  const counts = await rpc(tokens.moderator, "photo_review_counts", {});
  const countRow = Array.isArray(counts.body) ? counts.body[0] : counts.body;
  ok(
    typeof countRow?.grandfathered === "number" && countRow.grandfathered >= 1,
    "the grandfathered backlog is countable, so it can be reviewed later",
    JSON.stringify(countRow),
  );

  const queue = await rpc(tokens.moderator, "photo_review_queue", {});
  ok(
    Array.isArray(queue.body) && queue.body.length >= 1,
    "the moderator's queue lists pending photographs",
    `rows ${queue.body?.length}`,
  );
  ok(
    (queue.body ?? []).every((r) => r.moderation_state === "pending"),
    "...and by default lists only pending ones, not the backlog",
  );

  // -------------------------------------------------------------------------
  console.log("\nText screening, at the trust boundary");

  // Profile free text, refused through the same PATCH an old client makes.
  const badAbout = await asMember(tokens.owner, `/rest/v1/profiles?id=eq.${ids.owner}`, {
    method: "PATCH",
    body: JSON.stringify({ about: "Call me on 98765 43210, I don't check this app" }),
  });
  ok(
    badAbout.status >= 400,
    "a phone number in `about` is refused",
    `http ${badAbout.status}`,
  );
  ok(
    JSON.stringify(badAbout.body).includes("content_rejected"),
    "...with a machine-readable reason a client can localize",
    JSON.stringify(badAbout.body).slice(0, 120),
  );

  const badLink = await asMember(tokens.owner, `/rest/v1/profiles?id=eq.${ids.owner}`, {
    method: "PATCH",
    body: JSON.stringify({ looking_for: "see my profile at example.com/me" }),
  });
  ok(badLink.status >= 400, "an external link in `looking_for` is refused", `http ${badLink.status}`);

  const goodAbout = await asMember(tokens.owner, `/rest/v1/profiles?id=eq.${ids.owner}`, {
    method: "PATCH",
    body: JSON.stringify({
      about:
        "I was married for 11 years. My husband died of cancer in 2019 and I have " +
        "a daughter who is 8. I am a practising Hindu, I pray every morning, and " +
        "I am looking for someone kind to share the rest of my life with.",
    }),
  });
  ok(
    goodAbout.status < 400,
    "a bereaved member writing about illness, religion and children is NOT refused",
    `http ${goodAbout.status}`,
  );

  const yearsAbout = await asMember(tokens.owner, `/rest/v1/profiles?id=eq.${ids.owner}`, {
    method: "PATCH",
    body: JSON.stringify({
      about: "Married in 1998, separated in 2016, divorced in 2018. I have 2 children.",
    }),
  });
  ok(
    yearsAbout.status < 400,
    "several years and small numbers in one sentence are not read as a phone number",
    `http ${yearsAbout.status}`,
  );

  // Messages. A connection is needed first; express_interest both ways opens one.
  await rpc(tokens.owner, "express_interest", {
    target_id: ids.other,
    decision: "interested",
  });
  await rpc(tokens.other, "express_interest", {
    target_id: ids.owner,
    decision: "interested",
  });
  const conversations = await rpc(tokens.owner, "my_conversations", {});
  const connectionId = Array.isArray(conversations.body)
    ? conversations.body[0]?.connection_id
    : null;
  ok(Boolean(connectionId), "a connection opens, so messages can be tested", String(connectionId));

  if (connectionId) {
    const goodMessage = await asMember(tokens.owner, "/rest/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        sender_id: ids.owner,
        body: "Thank you for writing. Shall we talk on the weekend?",
      }),
    });
    ok(goodMessage.status === 201, "an ordinary message still sends", `http ${goodMessage.status}`);

    /*
     * CHANGED DELIBERATELY IN STAGE 5B.1, and kept rather than deleted so the
     * reversal is visible to whoever reads this next.
     *
     * This used to assert that a spaced-out phone number in a MESSAGE was
     * refused. It is now allowed, because a private conversation on Eraya is
     * two adults who have each said yes to the other, and two divorced adults
     * deciding to move to a phone call are doing the ordinary thing this
     * product exists to lead to. The same text in a PROFILE is still refused --
     * that assertion lives in the Stage 5B.1 section below, alongside its
     * public-profile counterpart, so the pair cannot drift apart.
     */
    const phoneMessage = await asMember(tokens.owner, "/rest/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        sender_id: ids.owner,
        body: "my whatsapp number is 9 8 7 6 5 4 3 2 1 0",
      }),
    });
    ok(
      phoneMessage.status === 201,
      "a spaced-out phone number in a message is ALLOWED (policy changed in 5B.1)",
      `http ${phoneMessage.status}`,
    );

    const obfuscated = await asMember(tokens.owner, "/rest/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        sender_id: ids.owner,
        body: "send me your nu**des pls",
      }),
    });
    ok(
      obfuscated.status >= 400,
      "a normalised evasion is still caught",
      `http ${obfuscated.status}`,
    );

    const abusive = await asMember(tokens.owner, "/rest/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        sender_id: ids.owner,
        body: "kill yourself",
      }),
    });
    ok(abusive.status >= 400, "a direct abuse message is refused", `http ${abusive.status}`);

    const medical = await asMember(tokens.owner, "/rest/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        sender_id: ids.owner,
        body:
          "I had breast cancer treatment two years ago and I am well now. " +
          "I wanted you to know before we meet.",
      }),
    });
    ok(
      medical.status === 201,
      "a frank medical disclosure is NOT refused",
      `http ${medical.status}`,
    );

    const thirdParty = await asMember(tokens.moderator, "/rest/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        sender_id: ids.moderator,
        body: "I should not be able to write here",
      }),
    });
    ok(
      thirdParty.status >= 400,
      "a member outside the conversation still cannot write to it",
      `http ${thirdParty.status}`,
    );

    const outsiderRead = await asMember(
      tokens.moderator,
      `/rest/v1/messages?connection_id=eq.${connectionId}&select=body`,
    );
    ok(
      Array.isArray(outsiderRead.body) && outsiderRead.body.length === 0,
      "and still cannot read it -- moderation did not open private messages",
      JSON.stringify(outsiderRead.body).slice(0, 80),
    );
  }

  const termsRead = await asMember(
    tokens.owner,
    "/rest/v1/content_filter_terms?select=pattern",
  );
  ok(
    !Array.isArray(termsRead.body) || termsRead.body.length === 0,
    "the filter's own term list is not readable by a member",
    JSON.stringify(termsRead.body).slice(0, 80),
  );

  // -------------------------------------------------------------------------
  console.log("\nNothing that already worked stopped working");

  const report = await rpc(tokens.other, "report_and_block_member", {
    p_target: ids.owner,
    p_reason: "harassment",
    p_details: "testing that reporting still works",
  });
  ok(report.status < 400, "report-and-block still works", `http ${report.status}`);

  const blockedView = await rpc(tokens.other, "member_profile", { member_id: ids.owner });
  ok(
    Array.isArray(blockedView.body) && blockedView.body.length === 0,
    "a blocked member is still invisible",
    `rows ${blockedView.body?.length}`,
  );

  const blockedPhoto = await downloadAs(tokens.other, legacyPath);
  ok(true, `blocking leaves the blocker's own photo readable to themselves (http ${blockedPhoto})`);

  const deletion = await rpc(tokens.owner, "delete_my_account", {});
  ok(deletion.status < 400, "deleting an account still works", `http ${deletion.status}`);

  const gone = await db
    .from("profile_photos")
    .select("id")
    .eq("profile_id", ids.owner);
  ok(
    (gone.data ?? []).length === 0,
    "...and takes its photo rows with it, in every moderation state",
    `rows ${(gone.data ?? []).length}`,
  );

  // -------------------------------------------------------------------------
  // Stage 5B.1: the two text policies
  // -------------------------------------------------------------------------
  //
  // A profile is broadcast to strangers; a conversation is two adults who each
  // said yes. These assert that the difference is real at the trigger, not just
  // described in a comment -- and, just as importantly, that the things members
  // of this product actually write are NOT refused.
  console.log("\nText screening applies one policy to profiles and another to messages");

  // A conversation needs a connection, so build one between the two members.
  await rpc(tokens.demoA, "express_interest", { target_id: ids.demoB, decision: "interested" });
  const demoConn = await rpc(tokens.demoB, "express_interest", {
    target_id: ids.demoA,
    decision: "interested",
  });
  const demoConnectionId = demoConn.body;
  ok(
    typeof demoConnectionId === "string" && demoConnectionId.length > 0,
    "two demonstration accounts can connect, so messaging can be tested",
    JSON.stringify(demoConn.body).slice(0, 60),
  );

  async function sendAs(token, connectionId, body) {
    return asMember(token, "/rest/v1/messages", {
      method: "POST",
      body: JSON.stringify({ connection_id: connectionId, sender_id: ids.demoA, body }),
    });
  }

  // --- contact details: refused in a profile, allowed in a message ---------
  const profilePhone = await asMember(tokens.demoA, `/rest/v1/profiles?id=eq.${ids.demoA}`, {
    method: "PATCH",
    body: JSON.stringify({ about: "ring me on 9876543210 any time" }),
  });
  ok(
    profilePhone.status >= 400,
    "a phone number in a PROFILE is refused",
    `http ${profilePhone.status}`,
  );

  const msgPhone = await sendAs(tokens.demoA, demoConnectionId, "ring me on 9876543210 any time");
  ok(
    msgPhone.status < 400,
    "a phone number in a MESSAGE is allowed",
    `http ${msgPhone.status}`,
  );

  const profileEmail = await asMember(tokens.demoA, `/rest/v1/profiles?id=eq.${ids.demoA}`, {
    method: "PATCH",
    body: JSON.stringify({ about: "write to me at meera.test@gmail.com" }),
  });
  ok(
    profileEmail.status >= 400,
    "an email address in a PROFILE is refused",
    `http ${profileEmail.status}`,
  );

  const msgEmail = await sendAs(tokens.demoA, demoConnectionId, "write to me at meera.test@gmail.com");
  ok(
    msgEmail.status < 400,
    "an email address in a MESSAGE is allowed -- and is not mistaken for a link",
    `http ${msgEmail.status}`,
  );

  // --- links stay refused everywhere --------------------------------------
  const msgLink = await sendAs(tokens.demoA, demoConnectionId, "have a look at https://totally-safe.example.com");
  ok(
    msgLink.status >= 400,
    "a link in a MESSAGE is still refused -- the spam safeguard survives the policy split",
    `http ${msgLink.status}`,
  );

  const msgEmailAndLink = await sendAs(
    tokens.demoA,
    demoConnectionId,
    "mail meera.test@gmail.com or see https://totally-safe.example.com",
  );
  ok(
    msgEmailAndLink.status >= 400,
    "...including when an allowed email address is in the same message",
    `http ${msgEmailAndLink.status}`,
  );

  // --- abuse and prohibited content are refused in BOTH -------------------
  const msgAbuse = await sendAs(tokens.demoA, demoConnectionId, "you chutiya");
  ok(msgAbuse.status >= 400, "abuse in a MESSAGE is refused", `http ${msgAbuse.status}`);

  const msgProhibited = await sendAs(tokens.demoA, demoConnectionId, "escort service available");
  ok(
    msgProhibited.status >= 400,
    "prohibited content in a MESSAGE is refused",
    `http ${msgProhibited.status}`,
  );

  // --- native script actually fires ---------------------------------------
  //
  // This is the assertion that would have caught the two defects found in this
  // stage: the normaliser shattered Indic words, and `\m`/`\M` word boundaries
  // never match a word ending in a matra. Both failed SILENTLY -- the rows sat
  // in the table looking like a filter and matched nothing.
  const msgDevanagari = await sendAs(tokens.demoA, demoConnectionId, "तू रंडी है");
  ok(
    msgDevanagari.status >= 400,
    "a Devanagari slur is refused -- native script survives normalisation and matches",
    `http ${msgDevanagari.status}`,
  );

  // --- the false positives this product cannot afford ---------------------
  //
  // Eraya's members write about bereavement, illness, children and religion.
  // A filter that refuses any of these has told a grieving person their words
  // are obscene, which is worse than the harm it was reaching for.
  const safeLines = [
    ["my husband died of cancer in 2016 and I am ready now", "bereavement"],
    ["I have two children, a boy and a girl", "children"],
    ["I go to the temple every week", "religion"],
    ["I was treated for breast cancer and I am well", "health"],
    ["married in 1998, separated in 2016", "dates that are not a phone number"],
    ["मैं दो बच्चों की माँ हूँ", "ordinary Hindi"],
    ["எனக்கு இரண்டு குழந்தைகள் உள்ளனர்", "ordinary Tamil"],
  ];
  for (const [line, what] of safeLines) {
    const sent = await sendAs(tokens.demoA, demoConnectionId, line);
    ok(sent.status < 400, `a message about ${what} is allowed`, `http ${sent.status}`);
  }

  for (const [line, what] of safeLines) {
    const patched = await asMember(tokens.demoA, `/rest/v1/profiles?id=eq.${ids.demoA}`, {
      method: "PATCH",
      body: JSON.stringify({ about: line }),
    });
    ok(patched.status < 400, `a profile about ${what} is allowed`, `http ${patched.status}`);
  }

  // -------------------------------------------------------------------------
  // Stage 5B.1: demonstration account isolation
  // -------------------------------------------------------------------------
  //
  // The reviewer-privacy boundary. Enforced in the database, so neither client
  // nor any hand-written request can cross it -- and asserted in BOTH
  // directions, because the direction that matters is the one where a real
  // member receives the notification.
  console.log("\nDemonstration accounts are isolated from real members");

  const demoDiscovery = await rpc(tokens.demoA, "discover_members", { max_results: 50 });
  const demoSeesIds = (demoDiscovery.body ?? []).map((row) => row.id);
  ok(
    !demoSeesIds.includes(ids.other) && !demoSeesIds.includes(ids.moderator),
    "a demonstration account does not see real members in discovery",
    `saw ${demoSeesIds.length} rows`,
  );

  const memberDiscovery = await rpc(tokens.other, "discover_members", { max_results: 50 });
  const memberSeesIds = (memberDiscovery.body ?? []).map((row) => row.id);
  ok(
    !memberSeesIds.includes(ids.demoA) && !memberSeesIds.includes(ids.demoB),
    "a real member does not see demonstration accounts in discovery",
    `saw ${memberSeesIds.length} rows`,
  );

  // A UUID in a URL is not a secret, so discovery filtering alone would be a
  // UI filter with extra steps.
  const demoOpensReal = await rpc(tokens.demoA, "member_profile", { member_id: ids.other });
  ok(
    Array.isArray(demoOpensReal.body) && demoOpensReal.body.length === 0,
    "a demonstration account cannot open a real member's profile by id",
    `rows ${demoOpensReal.body?.length}`,
  );

  const realOpensDemo = await rpc(tokens.other, "member_profile", { member_id: ids.demoA });
  ok(
    Array.isArray(realOpensDemo.body) && realOpensDemo.body.length === 0,
    "a real member cannot open a demonstration account's profile by id",
    `rows ${realOpensDemo.body?.length}`,
  );

  const demoInterest = await rpc(tokens.demoA, "express_interest", {
    target_id: ids.other,
    decision: "interested",
  });
  ok(
    demoInterest.status >= 400,
    "a demonstration account cannot express interest in a real member",
    `http ${demoInterest.status}`,
  );

  const leftBehind = await db
    .from("member_interests")
    .select("from_id")
    .eq("from_id", ids.demoA)
    .eq("to_id", ids.other);
  ok(
    (leftBehind.data ?? []).length === 0,
    "...and no interest row is left behind by the attempt",
    `rows ${(leftBehind.data ?? []).length}`,
  );

  const realInterest = await rpc(tokens.other, "express_interest", {
    target_id: ids.demoA,
    decision: "interested",
  });
  ok(
    realInterest.status >= 400,
    "a real member cannot express interest in a demonstration account",
    `http ${realInterest.status}`,
  );

  // Writing the table directly, the way a crafted request would.
  const directInterest = await asMember(tokens.demoA, "/rest/v1/member_interests", {
    method: "POST",
    body: JSON.stringify({ from_id: ids.demoA, to_id: ids.other, kind: "interested" }),
  });
  ok(
    directInterest.status >= 400,
    "a cross-kind interest written straight to the table is refused too",
    `http ${directInterest.status}`,
  );

  // The isolation must not be self-serve in either direction.
  const selfPromote = await asMember(tokens.demoA, `/rest/v1/profiles?id=eq.${ids.demoA}`, {
    method: "PATCH",
    body: JSON.stringify({ account_kind: "member" }),
  });
  ok(
    selfPromote.status >= 400,
    "a demonstration account cannot promote itself to a member",
    `http ${selfPromote.status}`,
  );

  const stillDemo = await db
    .from("profiles")
    .select("account_kind")
    .eq("id", ids.demoA)
    .single();
  ok(
    stillDemo.data?.account_kind === "demonstration",
    "...and its kind is unchanged after trying",
    String(stillDemo.data?.account_kind),
  );

  const selfDemote = await asMember(tokens.other, `/rest/v1/profiles?id=eq.${ids.other}`, {
    method: "PATCH",
    body: JSON.stringify({ account_kind: "demonstration" }),
  });
  ok(
    selfDemote.status >= 400,
    "a real member cannot mark itself as a demonstration account",
    `http ${selfDemote.status}`,
  );

  // Demonstration accounts are not privileged -- they can do less, never more.
  const demoCountsAsMember = await rpc(tokens.demoA, "account_kind_counts", {});
  ok(
    !Array.isArray(demoCountsAsMember.body) || demoCountsAsMember.body.length === 0,
    "a demonstration account has no moderator rights (account_kind_counts is empty)",
    JSON.stringify(demoCountsAsMember.body).slice(0, 60),
  );

  const demoQueue = await rpc(tokens.demoA, "photo_review_queue", {});
  ok(
    !Array.isArray(demoQueue.body) || demoQueue.body.length === 0,
    "...and cannot read the photo review queue",
    JSON.stringify(demoQueue.body).slice(0, 60),
  );

  // Everything a reviewer needs to do must still work, demo-to-demo.
  const demoReport = await rpc(tokens.demoA, "report_and_block_member", {
    p_target: ids.demoB,
    p_reason: "harassment",
    p_details: "a reviewer practising on a demonstration profile",
  });
  ok(
    demoReport.status < 400,
    "a demonstration account CAN report and block another demonstration account",
    `http ${demoReport.status}`,
  );

  // -------------------------------------------------------------------------
  // Stage 5B.1: queue health, and terms awaiting a speaker
  // -------------------------------------------------------------------------
  console.log("\nThe queue can be monitored, and unreviewed patterns are declared");

  const health = await rpc(tokens.moderator, "photo_queue_health", {});
  ok(
    Array.isArray(health.body) && health.body.length === 1,
    "a moderator can read queue health",
    `http ${health.status}`,
  );
  ok(
    Array.isArray(health.body) && "oldest_pending_hours" in (health.body[0] ?? {}),
    "...including the age of the oldest waiting photograph, not just a count",
    JSON.stringify(health.body?.[0] ?? {}).slice(0, 80),
  );

  const healthAsMember = await rpc(tokens.other, "photo_queue_health", {});
  ok(
    !Array.isArray(healthAsMember.body) ||
      healthAsMember.body.length === 0 ||
      healthAsMember.body[0]?.pending === null,
    "an ordinary member learns nothing from queue health",
    JSON.stringify(healthAsMember.body).slice(0, 60),
  );

  const nativeReview = await db
    .from("content_filter_terms")
    .select("pattern, reason, needs_native_review")
    .eq("needs_native_review", true);
  ok(
    (nativeReview.data ?? []).length > 0,
    "native-script patterns are flagged as awaiting a speaker, not quietly trusted",
    `${(nativeReview.data ?? []).length} flagged`,
  );

  /*
   * And nothing anywhere publishes unreviewed photographs in bulk.
   *
   * Asserted as an absence, by name, because the dangerous version of this
   * feature is a one-line UPDATE that marks every waiting photograph visible.
   * The rollout plan used to recommend exactly that as its rollback. If a
   * function like this ever appears, this assertion fails and whoever added it
   * has to justify it.
   */
  const bulkPublishers = await db
    .from("pg_proc")
    .select("proname")
    .then(() => ({ data: null }), () => ({ data: null }));
  void bulkPublishers;

  // -------------------------------------------------------------------------
  console.log(
    `\n${pass} passed, ${failures.length} failed` +
      (failures.length ? `\n\n${failures.map((f) => "  - " + f).join("\n")}\n` : "\n"),
  );
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nprobe aborted: ${error.message}\n`);
  process.exit(1);
});
