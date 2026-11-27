/**
 * Decide which Supabase project a writing probe is allowed to touch.
 *
 * `security-probe.mjs` creates and deletes auth users. `payments-probe.mjs`
 * calls `begin_payment`, `settle_payment` and `revoke_payment` -- it writes real
 * payment rows and grants and withdraws real membership terms. Both read
 * `apps/web/.env.local` when the environment does not name a target, and that
 * file points at **production**, the one project real members use.
 *
 * Until now the only thing standing between `npm run security` and production
 * was a line of output saying which project it had picked. That is a label, not
 * a guard: it is printed and then the probe writes anyway, and nobody reads a
 * URL they were not already suspicious of.
 *
 * So the default is inverted here. A local stack runs without ceremony; any
 * other project is refused unless the caller names it, exactly:
 *
 *   ERAYA_PROBE_ALLOW_REMOTE=mwixuwmxvppeagyruueu npm run security
 *
 * Naming the project rather than passing a bare `--yes` is deliberate. A
 * blanket opt-in left in a shell profile authorises every project for ever; a
 * project ref authorises one, and stops working the moment the target changes.
 */

const LOCAL_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
  "0.0.0.0",
  "host.docker.internal",
]);

/** `https://<ref>.supabase.co` -> `<ref>`; anything else -> null. */
export function projectRef(url) {
  const match = /^https:\/\/([a-z0-9]{12,})\.supabase\.(co|in)$/i.exec(
    String(url).replace(/\/+$/, "")
  );
  return match ? match[1] : null;
}

export function isLocalTarget(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return (
    LOCAL_HOSTS.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    // RFC1918, for a stack on another machine on the same desk.
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Refuse, loudly and before any client is built, when a writing probe is
 * pointed at something that is not a local stack and has not been named.
 *
 * Returns the target description so the caller can print it; exits the process
 * otherwise. Deliberately not a thrown error -- a probe that swallowed this in
 * a try/catch would be back where it started.
 */
export function assertSafeProbeTarget(url, { probe, writes } = {}) {
  const local = isLocalTarget(url);
  const ref = projectRef(url);
  const allowed = (process.env.ERAYA_PROBE_ALLOW_REMOTE ?? "").trim();

  if (local) {
    console.log(`target: ${url}  [local stack]\n`);
    return { url, local: true, ref: null };
  }

  if (ref && allowed && allowed === ref) {
    console.log(
      `target: ${url}  [REMOTE, authorised by ERAYA_PROBE_ALLOW_REMOTE=${ref}]\n`
    );
    return { url, local: false, ref };
  }

  const what = writes ?? "writes to the database";
  console.error(
    [
      "",
      `REFUSING TO RUN. ${probe ?? "This probe"} ${what}, and`,
      `${url}`,
      "is not a local Supabase stack.",
      "",
      allowed
        ? `ERAYA_PROBE_ALLOW_REMOTE is set to "${allowed}", which does not match this` +
          `\ntarget${ref ? ` (${ref})` : ""}. Nothing was run.`
        : "No ERAYA_PROBE_ALLOW_REMOTE is set, so this is almost certainly the\n" +
          "production project reached through apps/web/.env.local.",
      "",
      "To run against a local stack (the intended way):",
      "",
      "  npx supabase start",
      "  SUPABASE_URL=http://127.0.0.1:54321 \\",
      "  SUPABASE_ANON_KEY=<local anon> \\",
      "  SUPABASE_SERVICE_ROLE_KEY=<local service role> \\",
      "  npm run <this probe>",
      "",
      "If you genuinely mean to write to a hosted project, name it:",
      "",
      `  ERAYA_PROBE_ALLOW_REMOTE=${ref ?? "<project-ref>"} npm run <this probe>`,
      "",
    ].join("\n")
  );
  process.exit(2);
}
