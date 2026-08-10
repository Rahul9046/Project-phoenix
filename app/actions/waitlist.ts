"use server";

import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

import { launchCities, otherCityValue } from "@/content/site";

export type WaitlistState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success"; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Where signups land.
 *
 * This is a file-backed store so the form is genuinely functional in
 * development and on a single long-lived server. It is NOT durable on
 * serverless or multi-instance hosting — swap this for the real datastore
 * before launch. See docs/07-open-questions.md.
 */
const storePath = path.join(process.cwd(), "data", "waitlist.jsonl");

async function record(entry: Record<string, string>) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await appendFile(storePath, `${JSON.stringify(entry)}\n`, "utf8");
}

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

  const isLaunchCity = (launchCities as readonly string[]).includes(city);
  const isOther = city === otherCityValue;

  if (!isLaunchCity && !isOther) {
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

  try {
    await record({
      name,
      email,
      city: resolvedCity,
      list: isOther ? "waitlist" : "early-access",
      submittedAt: new Date().toISOString(),
    });
  } catch {
    return {
      status: "error",
      message:
        "Something went wrong on our side. Please try again in a moment.",
      fieldErrors: {},
    };
  }

  return {
    status: "success",
    message: isOther
      ? `Thank you, ${name}. You are on the waitlist — we will email you as soon as Eraya opens in ${resolvedCity}.`
      : `Thank you, ${name}. You are on the early access list for ${resolvedCity} — we will email you when Eraya opens there.`,
  };
}
