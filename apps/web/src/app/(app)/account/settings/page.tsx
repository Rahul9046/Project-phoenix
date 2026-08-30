import { account } from "@/features/account/content";
import { DeleteAccount } from "@/features/account/DeleteAccount";
import { AppPage, DetailRow, Panel } from "@/features/app-shell/AppPage";
import { authRoutes } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import { Button } from "@/shared/ui/Button";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await loadAuthSession();

  const memberSince = session.user
    ? new Date(session.user.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <AppPage title={account.settingsTitle} lede={account.settingsLede}>
      <div className="grid gap-5">
        <Panel>
          <dl>
            <DetailRow
              label={account.labels.email}
              value={session.user?.email ?? account.notProvided}
            />
            <DetailRow
              label={account.labels.memberSince}
              value={memberSince ?? account.notProvided}
            />
          </dl>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[0.95rem] text-ink-muted">
              Log out of Eraya on this device.
            </p>
            <Button href={authRoutes.logout} variant="secondary">
              Log out
            </Button>
          </div>
        </Panel>

        {/*
          Deletion is a real promise and is not built. Saying so, with a way to
          get it done by a person, is honest; a disabled button that implies it
          is coming next week is not.
        */}
        <Panel title={account.dangerTitle}>
          <div className="mt-3">
            <DeleteAccount />
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}
