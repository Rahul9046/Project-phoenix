import type { Gender, RelationshipStatus, Religion } from "@/features/auth/types";

/**
 * A member, as this app understands them.
 *
 * Mapped from the database's `member_card` composite type into camelCase once,
 * in `data.ts`, so screens never touch a snake_case field and a column rename
 * is a one-line change rather than a search across the app.
 *
 * What is absent is the important part. There is no email, no phone number, no
 * date of birth and no internal state beyond this -- because `member_card` does
 * not carry them. The privacy boundary is enforced in Postgres, and this type is
 * simply the shape of what comes back through it.
 */
export type Member = {
  id: string;
  firstName: string;
  age: number | null;
  city: string | null;
  state: string | null;
  relationshipStatus: RelationshipStatus | null;
  gender: Gender | null;
  /**
   * Null when they have not said, and null when they said they would rather
   * not -- the database collapses both before this leaves it, so there is no
   * "prefer not to say" to render and no way to render it by mistake. See
   * `disclosed_religion()`.
   */
  religion: Religion | null;
  languages: string[];
  about: string | null;
  lookingFor: string | null;
  /** Storage path. Turned into a signed URL by `photoUrlFor`. */
  photoPath: string | null;
  photoCount: number;
  /**
   * True when the person completed the phone step. Deliberately not surfaced as
   * a trust mark anywhere: verification is mocked. Kept on the type so that when
   * SMS is connected, the badge is one line in `TrustMarks` and nothing else.
   */
  phoneVerified: boolean;
  emailVerified: boolean;
};

export type Conversation = {
  connectionId: string;
  member: Member;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageFromMe: boolean;
  /** Computed from your own marker. Never says anything about them. */
  unread: boolean;
  endedAt: string | null;
  endedByMe: boolean;
};

export type Message = {
  id: string;
  body: string;
  createdAt: string;
  fromMe: boolean;
};

/** The free filters. Every one of these is available to every member. */
export type DiscoveryFilters = {
  minAge: number | null;
  maxAge: number | null;
  cityIds: string[];
  languageIds: string[];
  relationshipStatuses: RelationshipStatus[];
  /**
   * Disclosed religions only.
   *
   * `prefer_not_to_say` can never appear here -- the picker does not offer it,
   * and the database matches on the disclosed value regardless, so a member who
   * declined is absent from every religion filter rather than being findable by
   * the fact that they declined.
   */
  religions: Religion[];
};

export const emptyFilters: DiscoveryFilters = {
  minAge: null,
  maxAge: null,
  cityIds: [],
  languageIds: [],
  relationshipStatuses: [],
  religions: [],
};

export function countActiveFilters(filters: DiscoveryFilters): number {
  return (
    (filters.minAge !== null || filters.maxAge !== null ? 1 : 0) +
    (filters.cityIds.length > 0 ? 1 : 0) +
    (filters.languageIds.length > 0 ? 1 : 0) +
    (filters.relationshipStatuses.length > 0 ? 1 : 0) +
    (filters.religions.length > 0 ? 1 : 0)
  );
}

export const AGE_FLOOR = 18;
export const AGE_CEILING = 75;
