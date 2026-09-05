import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { supabase } from "@/lib/supabase/client";

/**
 * Profile photography.
 *
 * Optional, and treated that way throughout: a member with no photos has a
 * complete profile and is shown as a monogram, not as a broken image. Eraya's
 * members are people who have had a hard few years, and some of them will not
 * want a face on a screen for a long time.
 *
 * Three things happen before a file leaves the phone.
 *
 * It is resized and re-encoded. A modern phone camera produces a 4-6MB HEIC, and
 * uploading that over Indian mobile data to display it at 400 points wide is
 * rude -- so it is capped at 1400px on the long edge and written as JPEG at 82%,
 * which lands around 200KB and is indistinguishable at any size this app draws.
 *
 * The re-encode also strips EXIF, which matters more than the size. A photo
 * straight out of a camera roll usually carries the GPS coordinates of wherever
 * it was taken -- frequently somebody's home -- and uploading that to a product
 * where strangers meet would be handing out an address with the picture.
 *
 * The path is prefixed with the owner's id, which is what the storage policies
 * key on. A path that does not begin with the caller's own id cannot be written,
 * so there is no client-side trust involved in the naming.
 */

export const MAX_PHOTOS = 6;

const MAX_EDGE = 1400;
const QUALITY = 0.82;

export type PhotosResult =
  | { ok: true; paths: string[] }
  | { ok: false; cancelled?: boolean; message: string };

/**
 * Asks for photographs and uploads them.
 *
 * Several at once, up to whatever room is left. Adding three used to mean
 * opening the picker three times, and a person choosing pictures of themselves
 * is picking from the same screenful each time -- so the round trip was pure
 * friction.
 *
 * That is why there is no crop step any more. Android's picker cannot offer
 * multiple selection and its editor at the same time, and choosing between them
 * is easy: every surface that draws a photo already fills a 4:5 frame, so the
 * crop was previewing a decision the layout makes anyway. Anyone who wants a
 * particular framing can crop in their own photo app, which is better at it.
 *
 * Permission is requested at the moment it is needed rather than at launch. A
 * permission prompt on first open, before anyone knows what the app is for, is
 * the one most often refused.
 *
 * A partial success is a success. If the third of three fails, the first two are
 * still uploaded and returned -- throwing them away because of a later failure
 * would mean choosing all three again.
 */
export async function addPhotos(
  startPosition: number,
  limit: number,
): Promise<PhotosResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return {
      ok: false,
      message:
        "Eraya needs permission to open your photos. You can grant it in your phone's settings.",
    };
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, limit),
    quality: 1,
    exif: false,
  });

  if (picked.canceled || picked.assets.length === 0) {
    return { ok: false, cancelled: true, message: "No photo chosen." };
  }

  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;

  if (!me) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  const chosen = picked.assets.slice(0, Math.max(1, limit));
  const paths: string[] = [];

  for (const [index, asset] of chosen.entries()) {
    const position = startPosition + index;

    const processed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: Math.min(asset.width ?? MAX_EDGE, MAX_EDGE) } }],
      { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );

  /*
   * A fresh name every time rather than overwriting by position. Storage and CDN
   * caches key on the path, so reusing one means the old photo can keep being
   * served after it has been replaced -- the classic "I changed my picture and
   * it still shows the old one".
   */
    const path = `${me}/${Date.now()}-${position}.jpg`;

    const body = await fetch(processed.uri).then((response) => response.blob());

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(path, body, { contentType: "image/jpeg", upsert: false });

    if (uploadError) {
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
      // The file landed but the row did not, so the object would be orphaned --
      // invisible to the app and still occupying storage. Clean it up rather
      // than leaving it behind.
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

/** Moves a photo to the front, so it becomes the one shown first. */
export async function makePrimary(paths: string[], path: string): Promise<boolean> {
  const reordered = [path, ...paths.filter((entry) => entry !== path)];

  /*
   * A unique index on (profile_id, position) means the positions cannot simply
   * be reassigned in place -- the first update would collide with a row that
   * still holds the target position. Moving everything out of range first and
   * back afterwards is the standard way through it without dropping the
   * constraint that keeps the ordering honest.
   */
  for (const [index, entry] of reordered.entries()) {
    const { error } = await supabase
      .from("profile_photos")
      .update({ position: index + 100 })
      .eq("storage_path", entry);
    if (error) return false;
  }

  for (const [index, entry] of reordered.entries()) {
    const { error } = await supabase
      .from("profile_photos")
      .update({ position: index })
      .eq("storage_path", entry);
    if (error) return false;
  }

  return true;
}
