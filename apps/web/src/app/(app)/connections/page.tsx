import Link from "next/link";

import { connections as copy } from "@/features/app-shell/content";
import { appRoutes } from "@/features/app-shell/nav";
import { MemberMonogram } from "@/features/members/MemberPresentation";
import { getConnections } from "@/features/members/data";

export const metadata = { title: "Connections" };

/**
 * People who chose each other.
 *
 * Not "matches". A match is something a system announces; a connection is
 * something two people did. The word matters because it sets what the screen is
 * for -- there is no score here, no compatibility percentage, and no count.
 */
export default async function ConnectionsPage() {
  const all = await getConnections();
  const open = all.filter((c) => !c.endedAt);
  const ended = all.filter((c) => c.endedAt);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
        {copy.title}
      </h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-muted">
        {copy.lede}
      </p>

      {all.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="font-serif text-xl text-ink">{copy.empty.title}</p>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-muted">
            {copy.empty.body}
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-8">
          {open.length > 0 ? (
            <ul className="grid gap-3">
              {open.map((connection) => (
                <li key={connection.id}>
                  <Link
                    href={`${appRoutes.connections}/${connection.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong sm:p-5"
                  >
                    <MemberMonogram name={connection.member.firstName} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-lg text-ink">
                        {connection.member.firstName}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.95rem] text-ink-muted">
                        {connection.lastMessage
                          ? connection.lastMessage.body
                          : copy.noMessages}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {ended.length > 0 ? (
            <section>
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
                Ended
              </h2>
              <ul className="mt-4 grid gap-3">
                {ended.map((connection) => (
                  <li key={connection.id}>
                    <Link
                      href={`${appRoutes.connections}/${connection.id}`}
                      className="flex items-center gap-4 rounded-2xl border border-line bg-surface/60 p-4 sm:p-5"
                    >
                      <MemberMonogram name={connection.member.firstName} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-serif text-lg text-ink-muted">
                          {connection.member.firstName}
                        </span>
                        <span className="mt-0.5 block text-[0.95rem] text-ink-subtle">
                          {copy.ended}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
