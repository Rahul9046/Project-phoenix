import { account } from "@/features/account/content";
import { AppPage, DetailRow, Panel } from "@/features/app-shell/AppPage";
import { authRoutes } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import { site } from "@/features/marketing/content";
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
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-muted">
            {account.dangerBody}
          </p>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-subtle">
            {account.dangerUnavailable}{" "}
            <a
              href={`mailto:${site.email}`}
              className="text-ember-text underline underline-offset-4 hover:text-ember-strong"
            >
              {site.email}
            </a>
          </p>
        </Panel>
      </div>
    </AppPage>
  );
}
