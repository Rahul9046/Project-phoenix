/**
 * A small number on a navigation item.
 *
 * Terracotta, not red. Red is the colour this design system uses for a
 * destructive action and for an error, and neither is what a new connection is.
 * Ember is the accent already used for "this is the live thing on this screen",
 * which is exactly what a badge means; borrowing the error colour would make
 * somebody's first message look like something had gone wrong.
 *
 * Nothing is drawn at zero. An empty badge, or a "0", is a permanent reminder
 * that there is nothing waiting -- which is the opposite of the point, and a
 * quietly discouraging thing to show a member on a product where having nobody
 * yet is normal and fine.
 *
 * The number is `aria-hidden`. It is meaningless read on its own -- "Connections
 * 2" could as easily be two connections in total as two new ones -- so the
 * caller puts the whole sentence on the link's own `aria-label` instead, and
 * this renders only what a sighted reader needs.
 */
export function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className="
        ml-1.5 inline-flex min-w-5 items-center justify-center
        rounded-full bg-ember px-1.5
        text-[0.7rem] font-semibold leading-5 tabular-nums text-canvas
      "
    >
      {compactCount(count)}
    </span>
  );
}

/**
 * Ninety-nine is as much as the shape can hold.
 *
 * Past that the exact number stops being information anybody acts on, and a
 * four-digit badge stretches the pill until it pushes the label it belongs to.
 * The accessible label carries the real figure.
 */
export function compactCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
