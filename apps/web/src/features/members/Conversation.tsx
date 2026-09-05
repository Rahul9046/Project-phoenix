"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { conversation } from "@/features/app-shell/content";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { sendMessage } from "@/features/members/actions";
import type { Message } from "@/features/members/data";

/**
 * A conversation between two people who both chose it.
 *
 * What is deliberately absent matters more than what is here. No read receipts,
 * no typing indicator, no "seen at 21:04", no unread count, no nudge to reply.
 * Each of those exists to make one person feel owed and the other feel watched,
 * and this is a product for people who have recently had enough of both.
 *
 * There is also no polling. Messages arrive when the page is opened or after one
 * is sent. A conversation that updates under you every few seconds is asking to
 * be sat in; this one is asking to be visited.
 */
export function Conversation({
  connectionId,
  messages,
  otherName,
  ended,
}: {
  connectionId: string;
  messages: Message[];
  otherName: string;
  ended: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !body.trim()) return;

    setPending(true);
    setError(null);

    const result = await sendMessage(connectionId, body);

    if (!result.ok) {
      setError(result.message ?? "That did not send.");
      setPending(false);
      return;
    }

    setBody("");
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex min-h-[50vh] flex-col">
      <div className="flex-1">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-name text-ink">
              {conversation.emptyTitle}
            </p>
            <p className="mt-2 leading-relaxed text-ink-muted">
              {conversation.emptyBody}
            </p>
          </div>
        ) : (
          <ol className="grid gap-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={message.fromMe ? "flex justify-end" : "flex"}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed sm:max-w-[75%] ${
                    message.fromMe
                      ? "bg-ember text-canvas"
                      : "border border-line bg-surface text-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  {/*
                    A time, and only a time. No tick, no "delivered", no "seen".
                  */}
                  <p
                    className={`mt-1.5 text-[0.75rem] ${
                      message.fromMe ? "text-canvas/70" : "text-ink-subtle"
                    }`}
                  >
                    {new Date(message.at).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      {ended ? (
        <div className="mt-8 rounded-2xl border border-line bg-sand/50 p-5 text-center">
          <p className="font-medium text-ink">{conversation.endedTitle}</p>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">
            {conversation.endedBody}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8">
          <label htmlFor="message" className="sr-only">
            Write to {otherName}
          </label>
          <textarea
            id="message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={conversation.placeholder}
            rows={3}
            maxLength={4000}
            disabled={pending}
            className="w-full resize-none rounded-2xl border border-line-strong bg-surface px-4 py-3.5 text-base leading-relaxed text-ink placeholder:text-ink-subtle/70 transition-colors focus:border-ember focus:outline-none"
          />

          {error ? <ErrorMessage className="mt-3">{error}</ErrorMessage> : null}

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={pending || !body.trim()}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ember px-7 text-[0.95rem] font-medium text-canvas transition-colors hover:bg-ember-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Sending…" : conversation.send}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
