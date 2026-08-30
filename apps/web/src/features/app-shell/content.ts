/**
 * Every word the signed-in shell says.
 *
 * Kept short on purpose. The product's difference has to live in what the
 * screens do, not in paragraphs explaining that they are different — a person
 * who skims must still feel it.
 */

export const shell = {
  skipToContent: "Skip to content",
  accountMenuLabel: "Your account",
  signOut: "Log out",
} as const;

/** Time-of-day greeting. Warmth without pretending to know how someone is. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const home = {
  eyebrow: "My Eraya",
  lede: "Your next chapter, at your own pace.",

  introductionsTitle: "A few people worth meeting",
  introductionsLede:
    "Chosen rather than listed. They will be here tomorrow too — there is nothing to catch.",
  introductionsEmpty:
    "No introductions yet. Eraya is still small, and we would rather show you nobody than show you anybody.",
  introductionsCta: "See who",

  connectionsTitle: "Your connections",
  connectionsEmpty: "Nobody yet. A connection opens when interest is mutual.",

  interestTitle: "People interested in you",
  interestLocked:
    "Eraya Premium shows you who has expressed interest before you decide.",
  interestEmpty: "Nobody new since you last looked.",

  profileTitle: "Your profile",
  profileComplete: "Your profile is complete.",
  profileCta: "Review your profile",
} as const;

export const discovery = {
  title: "A few people worth meeting",
  lede: "Eraya introduces a considered few rather than an endless list. These are yours for today.",
  empty: {
    title: "Nobody to introduce today.",
    body: "Eraya is still small, and we would rather show you nobody than show you anybody. New members arrive steadily — there is nothing you need to do.",
  },
  seenAll: {
    title: "That is everyone for today.",
    body: "More arrive as Eraya grows. Coming back later will not produce a new set — that is deliberate.",
  },
  interested: "I'd like to know more",
  pass: "Not for me",
  connected: "You are connected",
  connectedBody: "You both expressed interest. You can write to each other now.",
  interestSent: "Interest noted",
  interestSentBody:
    "They will only hear about it if they feel the same. Nothing is sent, and nothing is public.",
} as const;

export const connections = {
  title: "Your connections",
  lede: "People you and they both chose. Conversations live here.",
  empty: {
    title: "No connections yet.",
    body: "A connection opens only when interest is mutual — so nobody can write to you out of the blue.",
  },
  openConversation: "Open",
  noMessages: "No messages yet",
  ended: "This connection has ended",
} as const;

export const conversation = {
  placeholder: "Write a message",
  send: "Send",
  emptyTitle: "No messages yet.",
  emptyBody: "Say hello when you are ready. There is no hurry.",
  endedTitle: "This connection has ended.",
  endedBody: "You can still read what was said. Nothing further can be sent.",
  endCta: "End connection",
  blockCta: "Block",
  reportCta: "Report",
} as const;

export const webVsAppNote = {
  title: "Eraya on the web",
  body: "Create your Eraya account on the web today. The full Eraya experience will be available through our mobile app.",
} as const;
