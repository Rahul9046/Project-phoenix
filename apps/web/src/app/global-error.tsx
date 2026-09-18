"use client";

import { useEffect } from "react";

/**
 * The last resort: an error in the root layout itself.
 *
 * This replaces the entire document, so it must render its own `<html>` and
 * `<body>`. That also means it cannot rely on anything the layout provides —
 * not the fonts, and not the stylesheet that defines the brand tokens. So the
 * colours are written out literally here, taken from `globals.css`, and the
 * type falls back through the stack rather than assuming Manrope loaded.
 *
 * Duplicating four hex values is the right trade. The alternative is a page
 * that is blameless in code review and renders as unstyled black-on-white at
 * the exact moment somebody is deciding whether this product is real.
 *
 * Nothing here is a link. Navigation is part of the layout that has just
 * failed, so a reload is the only action that can be honestly offered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error in the root layout", error.digest ?? error);
  }, [error]);

  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fbf7f2",
          color: "#2a211c",
          fontFamily:
            "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "2rem 1.25rem",
        }}
      >
        <main
          style={{
            maxWidth: "30rem",
            textAlign: "center",
            backgroundColor: "#ffffff",
            border: "1px solid #e6dacb",
            borderRadius: "1rem",
            padding: "2rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            Eraya did not load.
          </h1>
          <p style={{ margin: "0.75rem 0 0", lineHeight: 1.6, color: "#6b5b51" }}>
            Something on our side went wrong. Nothing you did caused it and
            nothing has been lost.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: "3.5rem",
              padding: "0 1.75rem",
              borderRadius: "999px",
              border: "none",
              backgroundColor: "#bd4f33",
              color: "#fbf7f2",
              fontSize: "1rem",
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          <p style={{ margin: "1.5rem 0 0", fontSize: "0.9rem", color: "#7b6a5e" }}>
            If it keeps happening, write to us at support@eraya.app.
          </p>
        </main>
      </body>
    </html>
  );
}
