import { getT } from "@/features/i18n/server";
import { AppPage, Panel } from "@/features/app-shell/AppPage";
import { authRoutes } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import { Button } from "@/shared/ui/Button";

export const metadata = { title: "Verification" };

/**
 * What Eraya has actually checked about the person reading the page.
 *
 * The rule this screen exists to keep is that nothing claims a check that has
 * not happened. Email is confirmed because it is how somebody signs in. Phone
 * is confirmed only when an SMS was genuinely answered -- `phoneVerified` is
 * read from `phone_verified_at` together with `phone_verified_via`, so the
 * accounts the pre-launch stand-in marked do not appear here as verified.
 * Identity and relationship status are listed as unavailable rather than
 * pending, because "pending" implies a queue and there is no queue.
 *
 * The unverified phone row is an invitation and not a warning. Declining costs
 * a member nothing: discovery, interest, connections and messages are all
 * untouched by it, and there is no risk to warn anybody about. Wording that
 * implied a lapse would be pressure applied on behalf of a benefit the member
 * has already weighed and set aside.
 *
 * It is also where a member who skipped at signup comes to change their mind,
 * which is why the action is a link to the ordinary phone screen rather than
 * anything of its own. That screen owns the MSG91 widget, its captcha and every
 * server-side limit; a second way in would be a second implementation of all
 * three, and the one that eventually drifts is the one nobody is looking at.
 */
export default async function VerificationPage() {
  const t = await getT();
  const session = await loadAuthSession();

  const emailVerified = Boolean(session.user?.email);

  return (
    <AppPage
      title={t("account.verification.title")}
      lede={t("account.verification.lede")}
    >
      <div className="grid gap-5">
        <Panel title={t("account.verification.emailLabel")}>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">
            {emailVerified
              ? t("account.verification.emailDone")
              : t("account.verification.emailAbsent")}
          </p>
        </Panel>

        {/*
          Verified and unverified are different rows rather than one row with a
          pill, because they say different things. The verified one has a single
          job: reassure the member that the mark on their profile does not come
          with their number attached to it.
        */}
        <Panel
          title={
            session.phoneVerified
              ? t("common.phoneVerified")
              : t("account.verification.phoneLabel")
          }
        >
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">
            {session.phoneVerified
              ? t("account.verification.phoneDone")
              : t("account.verification.phoneAbsent")}
          </p>

          {/*
            No number is shown, verified or not. A member knows their own
            number, and printing it here would put it on a screen that can be
            read over a shoulder in exchange for nothing.
          */}
          {session.phoneVerified ? null : (
            <div className="mt-4">
              <Button href={authRoutes.phone} variant="secondary">
                {t("account.verification.phoneCta")}
              </Button>
            </div>
          )}
        </Panel>

        <Panel title={t("account.verification.identityLabel")}>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">
            {t("account.verification.identityDetail")}
          </p>
        </Panel>

        <Panel title={t("account.verification.relationshipLabel")}>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">
            {t("account.verification.relationshipDetail")}
          </p>
        </Panel>
      </div>
    </AppPage>
  );
}
