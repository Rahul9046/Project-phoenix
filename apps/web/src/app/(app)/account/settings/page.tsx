import { DeleteAccount } from "@/features/account/DeleteAccount";
import { AppPage, DetailRow, Panel } from "@/features/app-shell/AppPage";
import { authRoutes } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import { LanguagePicker } from "@/features/i18n/LanguagePicker";
import { getLocale, getT } from "@/features/i18n/server";
import { Button } from "@/shared/ui/Button";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [session, t, locale] = await Promise.all([
    loadAuthSession(),
    getT(),
    getLocale(),
  ]);

  /*
   * Dates follow the interface language rather than always being en-IN.
   * "Member since 12 March 2024" in the middle of a Tamil page is a small
   * jarring note, and `toLocaleDateString` already knows how to say it.
   */
  const memberSince = session.user
    ? new Date(session.user.createdAt).toLocaleDateString(
        locale === "en" ? "en-IN" : locale,
        { day: "numeric", month: "long", year: "numeric" },
      )
    : null;

  return (
    <AppPage title={t("account.settingsTitle")} lede={t("account.settingsLede")}>
      <div className="grid gap-5">
        <Panel>
          <dl>
            <DetailRow
              label={t("account.labelEmail")}
              value={session.user?.email ?? t("common.notProvided")}
            />
            <DetailRow
              label={t("account.labelMemberSince")}
              value={memberSince ?? t("common.notProvided")}
            />
          </dl>
        </Panel>

        {/*
          The app's language, and not the languages on a member's profile.
          Those live in the profile area, are shown to other members and decide
          who somebody is introduced to; this decides nothing but which words
          Eraya uses. Kept apart here, and said plainly inside the panel.
        */}
        <Panel title={t("account.language.title")}>
          <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-muted">
            {t("account.language.lede")}
          </p>
          <div className="mt-4">
            <LanguagePicker />
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[0.95rem] text-ink-muted">
              {t("account.signOutBody")}
            </p>
            <Button href={authRoutes.logout} variant="secondary">
              {t("shell.signOut")}
            </Button>
          </div>
        </Panel>

        <Panel title={t("account.dangerTitle")}>
          <div className="mt-3">
            <DeleteAccount />
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}
