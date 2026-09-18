import { createClient } from "@/lib/supabase/client";

/**
 * Profile photography, in the browser.
 *
 * The same system the app uses and deliberately not a second one: the same
 * `profile-photos` bucket, the same `${ownerId}/...` path convention that the
 * storage policies key on, and the same `profile_photos` rows carrying the
 * order. A photo added on a laptop is indistinguishable from one added on a
 * phone, because it is the same photo in the same place.
 *
 * Optional, and treated that way throughout. A member with no photos has a
 * complete profile and is shown as a monogram, not as a broken image. Eraya's
 * members are people who have had a hard few years, and some of them will not
 * want a face on a screen for a long time.
 *
 * Three things happen before a file leaves the browser, matching what the app
 * does before a file leaves the phone.
 *
 * It is resized and re-encoded. A photo off a modern camera is several
 * megabytes, and uploading that over Indian mobile data to display it a few
 * hundred pixels wide is rude — so it is capped at 1400px on the long edge and
 * written as JPEG at 82%, which lands around 200KB and is indistinguishable at
 * any size this product draws.
 *
 * The re-encode also strips EXIF, which matters more than the size. A photo
 * straight out of a camera roll usually carries the GPS coordinates of wherever
 * it was taken — frequently somebody's home — and uploading that to a product
 * where strangers meet would be handing out an address with the picture.
 * Drawing to a canvas and re-encoding keeps the pixels and nothing else; it is
 * the browser's equivalent of what `ImageManipulator` does on the phone, and it
 * is the reason this does not simply upload the `File` it was given.
 *
 * The path is prefixed with the owner's id, which is what the storage policies
 * check. A path that does not begin with the caller's own id cannot be written,
 * so there is no client-side trust involved in the naming.
 */

/** The account screen's ceiling, and the database's `position < 6` check. */
export const MAX_PHOTOS = 6;

const MAX_EDGE = 1400;
const QUALITY = 0.82;
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * What the picker will offer. The bucket also accepts HEIC, but no browser can
 * decode one into a canvas, so offering it would mean accepting a file that
 * fails at the resize step with nothing useful to say.
 */
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export type PhotosResult =
  | { ok: true; paths: string[] }
  | { ok: false; message: string };

/**
 * Resize, re-encode, and drop everything that is not pixels.
 *
 * `createImageBitmap` is asked to respect the orientation flag, because that
 * flag is part of the EXIF being thrown away — without it, a photo taken in
 * portrait on a phone arrives on its side, which looks like the product
 * mangling somebody's picture.
 */
async function process(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", QUALITY);
  });
}

/**
 * Uploads photographs and records them against the profile.
 *
 * A partial success is a success. If the third of three fails, the first two
 * are still uploaded and returned — throwing them away because of a later
 * failure would mean choosing all three again.
 */
export async function addPhotos(
  files: File[],
  limit: number,
): Promise<PhotosResult> {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;

  if (!me) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  /*
   * The next position is taken from the highest one in use, not from how many
   * photos there are.
   *
   * Those differ the moment somebody deletes one from the middle: three photos
   * at 0, 1, 2 minus the middle leaves two rows occupying 0 and 2, and counting
   * them says the next is 2 — which collides with the unique index on
   * (profile_id, position) and fails the insert. The member sees "that photo did
   * not save" for a photo that is perfectly fine.
   */
  const { data: existing } = await supabase
    .from("profile_photos")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  const startPosition = existing?.[0] ? existing[0].position + 1 : 0;

  /*
   * And the ceiling is the column's, not the caller's. `position < 6` is checked
   * by the database, so a member near the limit is given the room that is
   * actually left rather than being allowed to try and be refused.
   */
  const room = Math.min(Math.max(0, limit), MAX_PHOTOS - startPosition);
  const chosen = files.slice(0, room);
  const paths: string[] = [];

  if (files.length > 0 && chosen.length === 0) {
    return { ok: false, message: "You have reached the limit for now." };
  }

  for (const [index, file] of chosen.entries()) {
    const position = startPosition + index;

    const body = await process(file);

    if (!body) {
      return paths.length > 0
        ? { ok: true, paths }
        : {
            ok: false,
            message: "That file could not be read as a photo. Try a JPEG or PNG.",
          };
    }

    /*
     * A fresh name every time rather than overwriting by position. Storage and
     * CDN caches key on the path, so reusing one means the old photo can keep
     * being served after it has been replaced — the classic "I changed my
     * picture and it still shows the old one".
     */
    const path = `${me}/${Date.now()}-${position}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(path, body, { contentType: "image/jpeg", upsert: false });

    if (uploadError) {
      // The person gets a sentence they can act on. The reason itself is worth
      // having when somebody asks why their photo would not go on.
      console.warn("[eraya] photo upload failed:", uploadError.message);
      return paths.length > 0
        ? { ok: true, paths }
        : {
            ok: false,
            message:
              "That photo did not upload. Please check your connection and try again.",
          };
    }

    const { error: rowError } = await supabase
      .from("profile_photos")
      .insert({ profile_id: me, storage_path: path, position });

    if (rowError) {
      // The file landed but the row did not, so the object would be orphaned —
      // invisible to the product and still occupying storage. Clean it up
      // rather than leaving it behind.
      await supabase.storage.from("profile-photos").remove([path]);
      return paths.length > 0
        ? { ok: true, paths }
        : { ok: false, message: "That photo did not save. Please try again." };
    }

    paths.push(path);
  }

  return { ok: true, paths };
}

export async function removePhoto(path: string): Promise<boolean> {
  const supabase = createClient();

  const { error: rowError } = await supabase
    .from("profile_photos")
    .delete()
    .eq("storage_path", path);

  if (rowError) return false;

  // The row first, then the file. In the other order, a failure between the two
  // leaves a row pointing at nothing, which renders as a broken image.
  await supabase.storage.from("profile-photos").remove([path]);
  return true;
}

/** The member's own photos, in their own order. */
export async function myPhotoPaths(): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profile_photos")
    .select("storage_path, position")
    .order("position", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => row.storage_path);
}

/**
 * A URL the browser can actually load.
 *
 * The bucket is private, so there is no public URL to construct. A signed one
 * expires, which is the point: a photo URL copied out of Eraya stops working,
 * rather than outliving a block, a deletion or a closed account.
 */
export async function photoUrlFor(path: string): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from("profile-photos")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
