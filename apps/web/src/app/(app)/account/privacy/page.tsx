import { account } from "@/features/account/content";
import { AppPage, Panel } from "@/features/app-shell/AppPage";

export const metadata = { title: "Privacy" };

/**
 * What Eraya does and does not show about someone.
 *
 * Every line here is a fact about the current system, not an intention. The
 * "nobody sees anybody" claim is enforced by RLS — there is no cross-member
 * read policy — so it is safe to state plainly.
 */
export default function PrivacyPage() {
  return (
    <AppPage title={account.privacyTitle} lede={account.privacyLede}>
      <div className="grid gap-5">
        <Panel>
          <ul className="grid gap-3">
            {account.privacyPoints.map((point) => (
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
