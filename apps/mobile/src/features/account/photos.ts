import * as ImagePicker from "expo-image-picker";
import {
  ImageManipulator,
  SaveFormat,
  type ImageResult,
} from "expo-image-manipulator";
import { File } from "expo-file-system";

import { supabase } from "@/lib/supabase/client";
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  type Crop,
} from "@/features/account/framing";
import type { TranslationKey } from "@eraya/i18n";

/**
 * Profile photography.
 *
 * Optional, and treated that way throughout: a member with no photos has a
 * complete profile and is shown as a monogram, not as a broken image. Eraya's
 * members are people who have had a hard few years, and some of them will not
 * want a face on a screen for a long time.
 *
 * Four things happen before a file leaves the phone.
 *
 * It is framed. Every surface in Eraya draws a photograph in a 4:5 frame, so
 * something is always cropped away; the only question is who decides what. That
 * used to be answered by the layout, which takes the middle -- and the middle of
 * a photograph is very often not the person in it.
 *
 * The framing is Eraya's own, done after the picker rather than inside it. The
 * system editor cannot be opened alongside multiple selection on Android, and
 * choosing between "pick three at once" and "decide what each one shows" is a
 * choice nobody should have to make. Doing it here also means the phone and the
 * browser ask the same question, in the same words, with the same result.
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

/*
 * The frame and the arithmetic of moving a picture inside it live in
 * `framing.ts`, which the web has a byte-identical copy of. They are passed
 * straight back out from here so that a screen only ever imports one module to
 * add a photograph.
 */
export {
  centredFraming,
  cropFor,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  MAX_ZOOM,
} from "@/features/account/framing";
export type { Crop, Framing } from "@/features/account/framing";

/** A photograph as chosen, before anything has been decided about it. */
export type PickedPhoto = {
  uri: string;
  width: number;
  height: number;
};

export type PickResult =
  | { ok: true; photos: PickedPhoto[] }
  | { ok: false; cancelled?: boolean; messageKey: TranslationKey };

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; messageKey: TranslationKey };

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Asks for photographs.
 *
 * Several at once, up to whatever room is left. Adding three used to mean
 * opening the picker three times, and a person choosing pictures of themselves
 * is picking from the same screenful each time -- so the round trip was pure
 * friction.
 *
 * Permission is requested at the moment it is needed rather than at launch. A
 * permission prompt on first open, before anyone knows what the app is for, is
 * the one most often refused.
 */
export async function pickPhotos(limit: number): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { ok: false, messageKey: "photos.permission" };
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, limit),
    quality: 1,
    exif: false,
  });

  if (picked.canceled || picked.assets.length === 0) {
    return { ok: false, cancelled: true, messageKey: "photos.noneChosen" };
  }

  const photos: PickedPhoto[] = [];

  for (const asset of picked.assets.slice(0, Math.max(1, limit))) {
    /*
     * The picker reports a size for every image it returns, but the framing
     * maths is meaningless without one -- so on the rare asset that arrives
     * without dimensions, they are read back off the file rather than guessed.
     *
     * Rendering without saving is what asks the question: the reference carries
     * the dimensions and never touches the disk, so measuring a photograph no
     * longer writes a second copy of it into the cache to read two numbers off.
     * The original URI is kept, because nothing about the picture has changed.
     */
    const width = asset.width ?? 0;
    const height = asset.height ?? 0;

    if (width > 0 && height > 0) {
      photos.push({ uri: asset.uri, width, height });
      continue;
    }

    try {
      const measured = await ImageManipulator.manipulate(asset.uri).renderAsync();
      photos.push({
        uri: asset.uri,
        width: measured.width,
        height: measured.height,
      });
    } catch {
      return { ok: false, messageKey: "photos.frameFailed" };
    }
  }

  return { ok: true, photos };
}

/**
 * Cuts a framed photograph out, uploads it, and records it against the profile.
 *
 * One photograph at a time, rather than a batch. Each is framed by the member
 * and then sent, so on a slow connection they appear one by one instead of
 * after a long silence -- and a failure on the third leaves the first two
 * safely stored.
 */
export async function uploadPhoto(
  photo: PickedPhoto,
  crop: Crop,
  position: number,
): Promise<UploadResult> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;

  if (!me) {
    return { ok: false, messageKey: "failures.sessionExpired" };
  }

  /*
   * Whole pixels, and inside the picture.
   *
   * The native cropper takes a rectangle in source pixels and fails outright on
   * one that runs even a fraction past an edge, which a float from a drag
   * gesture will eventually do. Rounding down the size and clamping the origin
   * is what keeps a perfectly ordinary drag from becoming "that photo did not
   * save".
   */
  const cropWidth = Math.max(1, Math.floor(crop.width));
  const cropHeight = Math.max(1, Math.floor(crop.height));
  const originX = Math.round(clamp(crop.x, 0, Math.max(0, photo.width - cropWidth)));
  const originY = Math.round(
    clamp(crop.y, 0, Math.max(0, photo.height - cropHeight)),
  );

  // The long edge of a 4:5 photograph is its height, so the ceiling applies
  // there and the width follows from it.
  const targetHeight = Math.min(MAX_EDGE, cropHeight);
  const targetWidth = Math.max(
    1,
    Math.round((targetHeight * FRAME_WIDTH) / FRAME_HEIGHT),
  );

  let processed: ImageResult;

  try {
    /*
     * Crop, then resize, then save -- in that order, and chained rather than
     * passed as an array of actions. `manipulateAsync` is deprecated in SDK 57
     * and is now only a shim over this; going straight to it keeps the one
     * operation the product depends on off a deprecated path.
     */
    const rendered = await ImageManipulator.manipulate(photo.uri)
      .crop({ originX, originY, width: cropWidth, height: cropHeight })
      .resize({ width: targetWidth })
      .renderAsync();

    processed = await rendered.saveAsync({
      compress: QUALITY,
      format: SaveFormat.JPEG,
    });
  } catch (error) {
    console.warn("[eraya] photo framing failed:", error);
    return { ok: false, messageKey: "photos.frameFailed" };
  }

  /*
   * A fresh name every time rather than overwriting by position. Storage and CDN
   * caches key on the path, so reusing one means the old photo can keep being
   * served after it has been replaced -- the classic "I changed my picture and
   * it still shows the old one".
   */
  const path = `${me}/${Date.now()}-${position}.jpg`;

  /*
   * Bytes, not a Blob.
   *
   * This read the file with `fetch(uri).blob()`, which is the web answer and
   * does not survive the crossing: React Native's Blob is a handle to native
   * data rather than the bytes themselves, so what reached storage was a body
   * the API would not take. Every upload failed with "That photo did not
   * upload. Please check your connection", which reads like a network problem
   * and never was one.
   *
   * `File` from expo-file-system hands over an ArrayBuffer that can actually
   * be sent.
   */
  const body = await new File(processed.uri).arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("profile-photos")
    .upload(path, body, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    // The person gets a sentence they can act on. The reason itself is worth
    // having when somebody asks why their photo would not go on, and it took
    // a round trip through a probe to find out last time.
    console.warn("[eraya] photo upload failed:", uploadError.message);
    return { ok: false, messageKey: "photos.uploadFailed" };
  }

  const { error: rowError } = await supabase
    .from("profile_photos")
    .insert({ profile_id: me, storage_path: path, position });

  if (rowError) {
    // The file landed but the row did not, so the object would be orphaned --
    // invisible to the app and still occupying storage. Clean it up rather
    // than leaving it behind.
    await supabase.storage.from("profile-photos").remove([path]);
    return { ok: false, messageKey: "photos.persistFailed" };
  }

  return { ok: true, path };
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
