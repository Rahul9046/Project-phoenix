"use server";

import { createClient } from "@/lib/supabase/server";
import { getCityById } from "@/shared/data/reference";

export type WaitlistState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Postgres unique violation — this address is already on the list. */
const UNIQUE_VIOLATION = "23505";

/**
 * Where landing-page signups go.
 *
 * Now a Supabase table rather than a file on disk, which was never durable on
 * serverless or multi-instance hosting. Inserted under the anon key and the
 * insert-only RLS policy: the browser can add an entry and cannot read anyone
 * else's, which is the correct shape for a public form collecting personal
 * details.
 */
export async function joinWaitlist(
  _previous: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  // Bots fill every field they find; humans never see this one.
  if (String(formData.get("company") ?? "").trim() !== "") {
    return { status: "success", message: "Thank you. We have your details." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  // A city id now, chosen from the searchable field. Registration is open
  // across India, so there is no "somewhere else" branch left.
  const cityId = String(formData.get("cityId") ?? "").trim();

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) {
    fieldErrors.name = "Please enter your name.";
  } else if (name.length > 80) {
    fieldErrors.name = "That name is a little too long.";
  }

  if (!emailPattern.test(email) || email.length > 160) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  // Resolved server-side rather than trusted: the id arrives from a hidden
  // field, and a hidden field is a suggestion.
  const city = cityId ? await getCityById(cityId) : null;

  if (!city) {
    fieldErrors.city = "Search for your city and choose it from the list.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  // Everyone is welcome; this only records which list they belong on for
  // sequencing invitations. It has never gated registration and does not now.
  const resolvedCity = city!.state ? `${city!.name}, ${city!.state}` : city!.name;
  const list = city!.isFocusCity ? "early_access" : "waitlist";

  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist")
    .insert({ name, email, city: resolvedCity, list });

  if (error && error.code !== UNIQUE_VIOLATION) {
    return {
      status: "error",
      message:
        "Something went wrong on our side. Please try again in a moment.",
      fieldErrors: {},
    };
  }

  // A duplicate is not a failure worth reporting: they are on the list either
  // way, and saying so would only tell a stranger which addresses we hold.
  return {
    status: "success",
    message: `Thank you, ${name}. You are on the list for ${resolvedCity} — we will email you as soon as Eraya opens there.`,
  };
}
