import { CORS } from "../_shared/request.ts";

/**
 * Razorpay's checkout, on a page the app can open.
 *
 * The alternative was a native module, which would mean a new build of every
 * client before anybody could pay, a config plugin to maintain, and a second
 * integration to keep in step with the web one. This is Razorpay's own hosted
 * checkout in the system browser -- the same component the website uses, opened
 * the same way sign-in already opens Google.
 *
 * That has a consequence worth stating: payment happens in the browser's own
 * window, not in a screen Eraya drew. Card details never touch this app, which
 * is exactly where they should not be.
 *
 * The page is deliberately thin. It holds no secret, decides no price and
 * proves nothing: it hands Razorpay an order id that was created and priced by
 * the server, and hands back whatever Razorpay returns. Every claim it makes is
 * verified afterwards by `payments-verify` against the key secret.
 *
 * There is no JWT on this route -- a browser opening a page has no Supabase
 * session to present. Nothing it returns is trusted, so there is nothing here
 * for an unauthenticated visitor to gain: without a valid order id the page is
 * an empty checkout, and an order id alone buys nothing.
 */

/** Where the app is handed back control. Fixed, so this cannot be a redirector. */
const RETURN_TO = "eraya://payment";

/** Razorpay's own id shape. Anything else never reaches the page. */
const ORDER_ID = /^order_[A-Za-z0-9]+$/;
const KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]+$/;

/**
 * The plan name is the only free text on this page, and it arrives in a query
 * string. `JSON.stringify` escapes quotes but not `</script>`, which is enough
 * to break out of the block it sits in -- so the value is reduced to letters,
 * digits and spaces before it goes anywhere near the markup.
 */
function safeName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9 \-]/g, "").trim().slice(0, 40);
  return cleaned || "Eraya Premium";
}

Deno.serve((request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id") ?? "";
  const keyId = url.searchParams.get("key_id") ?? "";
  const planName = safeName(url.searchParams.get("plan") ?? "");

  if (!ORDER_ID.test(orderId) || !KEY_ID.test(keyId)) {
    return new Response("Not found", { status: 404 });
  }

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Eraya</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap">
<style>
  html, body { margin: 0; height: 100%; background: #FBF7F2; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #6B5B51; text-align: center; padding: 24px;
  }
  p { margin: 0; font-size: 16px; line-height: 1.6; }
</style>
</head>
<body>
<p id="state">Opening secure payment…</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  (function () {
    var returnTo = ${JSON.stringify(RETURN_TO)};
    var handedBack = false;

    function handBack(params) {
      if (handedBack) return;
      handedBack = true;
      var query = Object.keys(params)
        .filter(function (k) { return params[k]; })
        .map(function (k) { return k + "=" + encodeURIComponent(params[k]); })
        .join("&");
      document.getElementById("state").textContent = "Returning to Eraya…";
      window.location.replace(returnTo + "?" + query);
    }

    var checkout = new Razorpay({
      key: ${JSON.stringify(keyId)},
      order_id: ${JSON.stringify(orderId)},
      name: "Eraya",
      description: ${JSON.stringify(planName)},
      theme: { color: "#BD4F33" },
      // Everything below is reported back and then verified server-side. None
      // of it is believed on its own.
      handler: function (response) {
        handBack({
          status: "paid",
          order_id: response.razorpay_order_id,
          payment_id: response.razorpay_payment_id,
          signature: response.razorpay_signature
        });
      },
      modal: {
        ondismiss: function () {
          handBack({ status: "cancelled", order_id: ${JSON.stringify(orderId)} });
        }
      }
    });

    checkout.on("payment.failed", function () {
      // Deliberately without the provider's reason. What the person reads is
      // decided in the app, and a failure here is not proof of anything either
      // -- the server asks Razorpay directly before concluding.
      handBack({ status: "failed", order_id: ${JSON.stringify(orderId)} });
    });

    checkout.open();
  })();
</script>
</body>
</html>`;

  return new Response(page, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Nothing here is worth keeping: an order id is single use and the page
      // is rebuilt per purchase.
      "Cache-Control": "no-store",
    },
  });
});
