"use client";

import { useEffect, useId, useRef, useState } from "react";

import { inputClasses } from "@/features/auth/components/FormField";
import {
  searchCities,
  type CityResult,
} from "@/shared/data/cities";

/**
 * A searchable city field, covering every city in India.
 *
 * Replaces a radio list of seven. That list could not survive the product
 * decision to open registration nationwide: 493 radio buttons is not a choice,
 * it is a wall, and on a phone it is unusable.
 *
 * Built as an ARIA combobox rather than a `<select>` because a native select
 * cannot be typed into on mobile in any useful way, and cannot show a second
 * line of text — which is needed here, since several Indian cities share a name
 * and only the state tells them apart.
 *
 * Nothing here filters by availability. Every city is selectable; the focus
 * cities affect result *order* and nothing else.
 *
 * Lives in shared/ because two features need it — onboarding and the landing
 * page waitlist. Its wording is passed in rather than imported, so neither
 * feature has to reach into the other's copy file to change a placeholder.
 */

export type CitySearchLabels = {
  searchLabel: string;
  searchPlaceholder: string;
  searching: string;
  noMatches: string;
  changeCta: string;
};
export function CitySearch({
  value,
  onChange,
  labels,
  disabled = false,
  autoFocus = false,
}: {
  /** The currently selected city, or null. */
  value: CityResult | null;
  onChange: (city: CityResult | null) => void;
  labels: CitySearchLabels;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const inputId = useId();

  const [query, setQuery] = useState("");
  /*
   * Results are stored with the query they answer, rather than as a bare list
   * alongside a separate "searching" flag.
   *
   * That pairing is what makes everything else derivable: whether a search is
   * outstanding is `trimmed !== results.query`, and stale results are simply not
   * rendered because they answer a different question. The alternative — clearing
   * the list whenever the box empties — means calling setState in an effect body,
   * which cascades renders and which the linter rightly objects to.
   */
  const [results, setResults] = useState<{ query: string; items: CityResult[] }>(
    { query: "", items: [] },
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Every search is numbered. Responses can arrive out of order — a short query
  // is usually quicker than the longer one typed after it — and without this a
  // stale response overwrites fresh results, so the list disagrees with the box.
  const requestRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const requestId = ++requestRef.current;

    // Debounced, because this fires per keystroke. 150ms is below the threshold
    // where typing feels laggy but high enough to spare a request per letter.
    const timer = setTimeout(async () => {
      const found = await searchCities(trimmed);
      if (requestId !== requestRef.current) return;

      setResults({ query: trimmed, items: found });
      setActiveIndex(0);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on an outside press, so the list does not hang over the rest of the
  // form after attention has moved on.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the highlighted option in view when arrowing past the fold.
  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const trimmedQuery = query.trim();
  /* Only render results that answer the query currently in the box. */
  const items = results.query === trimmedQuery ? results.items : [];
  const searching = trimmedQuery.length > 0 && results.query !== trimmedQuery;

  function select(city: CityResult) {
    onChange(city);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(items.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + items.length) % Math.max(items.length, 1),
      );
    } else if (event.key === "Enter") {
      // Only swallow Enter when it is choosing something. Otherwise it must
      // reach the form, or the keyboard path cannot submit.
      if (open && items[activeIndex]) {
        event.preventDefault();
        select(items[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && trimmedQuery.length > 0;
  const noMatches = showList && !searching && items.length === 0;

  return (
    <div ref={containerRef} className="relative">
      {value ? (
        /*
          Selected state. A filled input would be ambiguous — is that text a
          choice, or something half-typed? A distinct block says the answer is
          recorded, and gives one obvious way to change it.
        */
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line-strong bg-surface px-4 py-3.5">
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">
              {value.name}
            </span>
            <span className="block truncate text-sm text-ink-subtle">
              {value.state}
            </span>
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              // Focus lands back in the field, so changing your mind does not
              // require reaching for the mouse again.
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="shrink-0 rounded-full px-3 py-2 text-[0.95rem] font-medium text-ember-text transition-colors hover:bg-sand"
          >
            {labels.changeCta}
          </button>
        </div>
      ) : (
        <>
          <label htmlFor={inputId} className="sr-only">
            {labels.searchLabel}
          </label>

          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              showList && items[activeIndex]
                ? `${listId}-${activeIndex}`
                : undefined
            }
            autoComplete="off"
            autoCapitalize="words"
            // The only field on the screen; landing in it saves a tap on a phone.
            autoFocus={autoFocus}
            value={query}
            disabled={disabled}
            placeholder={labels.searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className={inputClasses}
          />

          {showList ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={labels.searchLabel}
              className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface py-1.5 shadow-[0_12px_32px_-12px_rgba(42,33,28,0.22)]"
            >
              {items.map((city, index) => (
                <li
                  key={city.id}
                  id={`${listId}-${index}`}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  role="option"
                  aria-selected={index === activeIndex}
                  // onMouseDown, not onClick: mousedown fires before the input
                  // loses focus, so the outside-press handler cannot close the
                  // list out from under the tap.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    select(city);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2 ${
                    index === activeIndex ? "bg-sand" : ""
                  }`}
                >
                  <span className="text-[0.95rem] text-ink">{city.name}</span>
                  {/* The state is what separates the several Udaipurs. */}
                  <span className="text-sm text-ink-subtle">{city.state}</span>
                </li>
              ))}

              {noMatches ? (
                <li className="px-4 py-3 text-[0.95rem] text-ink-subtle">
                  {labels.noMatches}
                </li>
              ) : null}

              {searching && items.length === 0 ? (
                <li className="px-4 py-3 text-[0.95rem] text-ink-subtle">
                  {labels.searching}
                </li>
              ) : null}
            </ul>
          ) : null}
        </>
      )}

      {/* Announced politely for screen readers, which cannot see the list grow. */}
      <p role="status" aria-live="polite" className="sr-only">
        {showList && !searching
          ? `${items.length} ${items.length === 1 ? "city" : "cities"} found`
          : ""}
      </p>
    </div>
  );
}
