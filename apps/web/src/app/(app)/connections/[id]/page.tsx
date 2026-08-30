import Link from "next/link";
import { notFound } from "next/navigation";

import { appRoutes } from "@/features/app-shell/nav";
import { Conversation } from "@/features/members/Conversation";
import { ConversationSafety } from "@/features/members/ConversationSafety";
import { MemberMonogram, MemberSummary, TrustMarks } from "@/features/members/MemberPresentation";
import { getConversation } from "@/features/members/data";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: PageProps<"/connections/[id]">) {
  const { id } = await params;
  const result = await getConversation(id);

  if (!result) notFound();

  const { connection, messages } = result;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
      <Link
        href={appRoutes.connections}
        className="inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">&lsaquo;</span> Connections
      </Link>

      {/* Who this is, kept present rather than reduced to a name in a bar. */}
      <header className="mt-4 flex items-start gap-4 border-b border-line pb-6">
        <MemberMonogram name={connection.member.firstName} />
        <div className="min-w-0 pt-0.5">
          <h1 className="font-serif text-2xl tracking-[-0.01em] text-ink">
            {connection.member.firstName}
          </h1>
          <div className="mt-1">
            <MemberSummary member={connection.member} />
          </div>
          <div className="mt-2">
            <TrustMarks member={connection.member} />
          </div>
        </div>
      </header>

      <div className="mt-8">
        <Conversation
          connectionId={connection.id}
          messages={messages}
          otherName={connection.member.firstName}
          ended={Boolean(connection.endedAt)}
        />
      </div>

      {/* Quiet, and always present. Someone who needs it should not have to
          hunt for it, and nobody else should have to look at it. */}
      <ConversationSafety
        connectionId={connection.id}
        memberId={connection.member.id}
        otherName={connection.member.firstName}
        ended={Boolean(connection.endedAt)}
      />
    </div>
  );
}
