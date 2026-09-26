import { downloads } from "@/features/marketing/android-beta";

/**
 * The permanent address of a downloadable build.
 *
 * `https://www.eraya.app/downloads/eraya-beta.apk` is what goes in an Instagram
 * bio, a WhatsApp message and a tester's browser history, so it is owned by the
 * site rather than by whoever is storing the bytes this month, and it carries
 * no version -- see `android-beta.ts` for why. This route only knows which
 * public names are real and sends the browser on to the current build.
 *
 * ## Why a redirect rather than streaming the file through the Worker
 *
 * The Worker could fetch the asset and pass the body along, which would let it
 * set `Content-Type` and `Content-Disposition` itself. It would also put a
 * 62.6 MiB transfer through a free-plan Worker on every download, and -- unless
 * `Range` were forwarded and `206` passed back by hand -- a connection that
 * drops at 60 MB would start again at zero. The audience for this link is on
 * Indian mobile data, coming from Instagram, so resumable is not a nicety.
 *
 * GitHub's CDN already does ranges, resumption and edge caching, and already
 * answers with `Content-Disposition: attachment; filename=<the asset name>`,
 * which is what actually names the saved file -- and is the reason a
 * version-less link still puts a version-stamped APK in Downloads.
 *
 * Nothing sets `Content-Type` or `Content-Disposition` on the 302 itself. A
 * browser discards both when it follows a redirect, and a header the response
 * claims but nothing honours is the failure this codebase has already had once
 * with `netlify.toml`.
 *
 * 302 and not 301: this target moves with every beta, and a permanent redirect
 * is cached by browsers indefinitely.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/downloads/[file]">,
) {
  const { file } = await params;
  const asset = downloads[file];

  /*
   * An unknown filename is a 404 and not a redirect to the beta. A guess that
   * silently works teaches people an address the site has not promised to keep
   * answering, and the whole point of this route is that one address is.
   */
  if (!asset) {
    return new Response("No such download.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      /*
       * A minute, because the address no longer names a version: after a
       * release is published this is the only thing standing between a tap and
       * the new build. Long enough to absorb a double tap and a link preview,
       * short enough that shipping a beta is live before anyone is told.
       */
      "Cache-Control": "public, max-age=60",
      Location: asset,
    },
  });
}
