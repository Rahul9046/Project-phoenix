import { AuthSessionProvider } from "@/features/auth/AuthSessionProvider";
import { loadAuthSession } from "@/features/auth/load-session";

/**
 * Auth and onboarding run without the marketing header and footer. On a phone
 * the screen should feel like an app; on a desktop it becomes a centred column
 * with room around it rather than a stretched mobile view.
 *
 * The session is read here, on the server, and handed down. Screens receive
 * who they are rendering for as data rather than discovering it after mount,
 * which is what removes the loading flash and makes the stage trustworthy.
 */
export default async function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await loadAuthSession();

  return (
    <main id="main" className="flex min-h-dvh flex-1 flex-col bg-canvas">
      <AuthSessionProvider serverSession={session}>
        {children}
      </AuthSessionProvider>
    </main>
  );
}
