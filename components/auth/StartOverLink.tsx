"use client";

import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth/AuthSessionProvider";
import { authRoutes } from "@/lib/auth/flow";

/**
 * The way out of a session.
 *
 * Every signed-in screen needs one: without it, someone who is part-way
 * through — or finished — can never get back to the sign-in screen, because
 * the guards keep sending them forward to where they left off. It is also the
 * only honest answer to "this isn't my account" on a shared computer.
 */
export function StartOverLink({
  label = "Use a different account",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <button
      type="button"
      onClick={() => {
        signOut();
        router.replace(authRoutes.login);
      }}
      className={`rounded-full px-2 py-1 font-medium text-ember-text underline underline-offset-4 transition-colors hover:text-ember-strong ${className}`.trim()}
    >
      {label}
    </button>
  );
}
