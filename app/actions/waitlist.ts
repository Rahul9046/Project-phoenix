"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveCities } from "@/lib/data/reference";

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
  const city = String(formData.get("city") ?? "").trim();
  const otherCity = String(formData.get("otherCity") ?? "").trim();

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) {
    fieldErrors.name = "Please enter your name.";
  } else if (name.length > 80) {
    fieldErrors.name = "That name is a little too long.";
  }

  if (!emailPattern.test(email) || email.length > 160) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  // The list of cities comes from the database, so the form and the validation
  // can never disagree about what is on offer.
  const cities = await getActiveCities();
  const chosen = cities.find((entry) => entry.name === city);
  const isOther = city === OTHER_CITY_LABEL;

  if (!chosen && !isOther) {
    fieldErrors.city = "Please choose your city.";
  }

  if (isOther && (otherCity.length < 2 || otherCity.length > 80)) {
    fieldErrors.otherCity = "Please tell us which city you are in.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  const resolvedCity = isOther ? otherCity : city;
  const list = isOther || !chosen?.isLaunchCity ? "waitlist" : "early_access";

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
    message: isOther
      ? `Thank you, ${name}. You are on the waitlist — we will email you as soon as Eraya opens in ${resolvedCity}.`
      : `Thank you, ${name}. You are on the early access list for ${resolvedCity} — we will email you when Eraya opens there.`,
  };
}

/** Matches the option rendered by the landing page form. */
const OTHER_CITY_LABEL = "Another city";
