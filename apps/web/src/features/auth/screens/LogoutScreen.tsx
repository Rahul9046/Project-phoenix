"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { useAuth } from "@/features/auth/AuthSessionProvider";
import { authRoutes } from "@/features/auth/flow";

/**
 * Clears the session and returns to sign-in.
 *
 * A plain URL anyone can reach, which matters while the session lives only in
 * `localStorage`: it is the reliable way to get back to a clean slate without
 * opening devtools. It stays useful once real sessions exist — that version
 * calls the server to revoke, then redirects the same way.
 */
export function LogoutScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    signOut();
    router.replace(authRoutes.login);
  }, [signOut, router]);

  return <AuthLoading />;
}
