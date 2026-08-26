/**
 * A member's initial on a warm tile.
 *
 * No photograph, because profile photos do not exist yet and a silhouette
 * placeholder would imply one is missing. An initial is a real piece of
 * information about the person, and it reads as deliberate rather than empty.
 */
export function Avatar({
  name,
  size = "md",
}: {
  name: string | null;
  size?: "sm" | "md";
}) {
  const initial = (name?.trim()?.[0] ?? "E").toUpperCase();

  const dimensions =
    size === "sm" ? "h-8 w-8 text-[0.85rem]" : "h-10 w-10 text-[0.95rem]";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-full bg-ember-tint font-medium text-ember-text`}
    >
      {initial}
    </span>
  );
}
