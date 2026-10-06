import { androidCta } from "@/features/marketing/android-app";
import { getT } from "@/features/i18n/server";
import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";
import { AndroidIcon } from "@/shared/ui/PlatformIcon";
import { Section } from "@/shared/ui/Section";
import { Eyebrow } from "@/shared/ui/SectionHeading";

/**
 * The Android app, offered on the public site.
 *
 * Set in a sand card on a canvas section rather than taking a tone of its own.
 * The page alternates canvas and sand band by band, and inserting a ninth band
 * would put two of the same colour next to each other wherever it landed; a
 * card separates it from `Begin` below without disturbing that rhythm, and
 * reads as an aside -- which is what it is. The web product is complete, and
 * the app is a second way in rather than the way in.
 *
 * `text-heading` rather than the `text-title` every other section uses. At
 * `clamp(2.15rem, 4.2vw, 3rem)` a title inside a card at this width stops
 * looking like a card.
 *
 * ## Why there is no device detection
 *
 * The honest sentence fits on one line and is true for everybody: Android only,
 * and on an iPhone or a computer Eraya works in the browser. Saying it
 * unconditionally is better than sniffing a user agent, for three reasons. It
 * cannot be wrong, where a sniff is wrong for every tablet, desktop-mode browser
 * and in-app webview it has not heard of. It tells a desktop visitor something
 * useful -- the app exists, on the phone they are not holding -- which a page
 * that hid the section from them would not. And this page is server-rendered on
 * a Cloudflare Worker with a 10 ms CPU budget it has already exceeded once, so
 * a per-request branch that fragments the response is a cost with no benefit.
 *
 * The one thing it must never do is offer an APK to an iPhone as though it
 * would install, and a line that names Android in the button and again
 * underneath does not.
 */
export async function AndroidApp() {
  const t = await getT();

  return (
    <Section id="android">
      <Container>
        {/*
          `px-4` before `sm`, not the `px-6` the other cards on this page use.

          Measured, not guessed. At a 320 px viewport the scrollbar leaves 305,
          the container's own gutter takes 48, and whatever this card adds comes
          straight off the button inside it. At `px-6` the button was 215 px wide
          and "Download for Android" wrapped onto a second line; at `px-4` it is
          223 and fits. From `sm` up there is room to spare and the padding goes
          back to the page's usual 12.

          A longer language still wraps to two lines here, which is fine -- the
          button grows and stays one tap. English wrapping at the commonest
          small-phone width was the part worth fixing.
        */}
        <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-sand px-4 py-12 text-center sm:px-12 sm:py-14">
          <div className="flex justify-center">
            <Eyebrow>{t("marketing.androidApp.eyebrow")}</Eyebrow>
          </div>

          <h2 className="mt-5 text-heading text-ink">
            {t("marketing.androidApp.title")}
          </h2>

          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            {t("marketing.androidApp.lede")}
          </p>

          {/*
            Full width until there is room for it not to be. Most of this
            traffic arrives on a phone held in one hand, where a button that
            spans the column is the easiest thing on the screen to hit and needs
            no aim at all. `size="lg"` is 52 CSS pixels tall, comfortably over
            the 44 Android asks for.
          */}
          <Button
            href={androidCta.href}
            download={androidCta.kind === "direct"}
            size="lg"
            className="mt-9 w-full sm:w-auto"
          >
            {/*
              `text-canvas` is what the filled variant already sets, and the mark
              inherits it through `currentColor` -- so it is white here without
              being hardcoded white, which is what lets the same component stay
              legible on the hero's outlined button.
            */}
            <AndroidIcon className="h-5 w-5 shrink-0" />
            {t("marketing.androidApp.cta")}
          </Button>

          {/*
            Direct only. On Play the store names the version, and a number
            printed here would be one this repository had to remember to change.
          */}
          {androidCta.kind === "direct" ? (
            <p className="mt-5 text-sm font-medium text-ink-subtle">
              {t("marketing.androidApp.version", {
                version: androidCta.version,
              })}
            </p>
          ) : null}

          <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-ink-subtle">
            {t("marketing.androidApp.platformNote")}
          </p>

          {/*
            The install itself is explained on `/download` rather than here. A
            homepage card is not the place for three steps, and somebody who
            has never sideloaded an app would rather read them before tapping
            than discover them from a system dialog.
          */}
          {androidCta.kind === "direct" ? (
            <p className="mt-5">
              <Button href="/download" variant="quiet">
                {t("marketing.androidApp.helpLink")}
              </Button>
            </p>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
