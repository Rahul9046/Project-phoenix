import { getT } from "@/features/i18n/server";
import { AppPage, Panel } from "@/features/app-shell/AppPage";

export const metadata = { title: "Privacy" };

/**
 * What Eraya does and does not show about someone.
 *
 * Every line here is a fact about the current system, not an intention. The
 * "nobody sees anybody" claim is enforced by RLS — there is no cross-member
 * read policy — so it is safe to state plainly.
 */
export default async function PrivacyPage() {
  const t = await getT();
  return (
    <AppPage title={t("account.privacyTitle")} lede={t("account.privacyLede")}>
      <div className="grid gap-5">
        <Panel>
          <ul className="grid gap-3">
            {/*
              Six numbered keys rather than an array of strings. A list in a
              locale file is a shape the compiler cannot check the length of --
              a translation with five entries would simply show one promise
              fewer, and these are promises about privacy.
            */}
            {([
              t("account.privacyPoint1"),
              t("account.privacyPoint2"),
              t("account.privacyPoint3"),
              t("account.privacyPoint4"),
              t("account.privacyPoint5"),
              t("account.privacyPoint6"),
            ]).map((point) => (
              <li
                key={point}
                className="text-[0.95rem] leading-relaxed text-ink-muted"
              >
                {point}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppPage>
  );
}
