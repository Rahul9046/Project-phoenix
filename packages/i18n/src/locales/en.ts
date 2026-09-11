/**
 * English. The source of truth.
 *
 * Every other locale is typed as `Translations`, which is `typeof en` — so a
 * missing key, an extra key or a wrong shape is a build error rather than
 * something a member discovers. Add a key here first; the compiler will then
 * tell you exactly which five files need it.
 *
 * The wording is Eraya's approved product copy, moved here rather than
 * rewritten. Where a string carried a comment explaining why it says what it
 * says, that comment came with it — those reasons are the most valuable thing
 * in this file and the easiest to lose in a move.
 *
 * `{name}`-style placeholders are filled by `t(key, { name })`. Translators
 * must keep the braces and the name inside them; the order of the surrounding
 * words is theirs to change, which is most of the point of having them.
 *
 * "Eraya" is a name and stays "Eraya" in every language.
 */
export const en = {
  common: {
    continue: "Continue",
    back: "Back",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    edit: "Edit",
    remove: "Remove",
    retry: "Try again",
    saving: "Saving…",
    loading: "Loading…",
    sending: "Sending…",
    or: "or",
    change: "Change",
    notProvided: "Not provided",
    notAnswered: "Not answered",
    preferNotToSay: "Prefer not to say",
  },

  shell: {
    skipToContent: "Skip to content",
    accountMenuLabel: "Your account",
    signOut: "Log out",
    /* Warmth without pretending to know how someone is. */
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    navHome: "Home",
    navDiscovery: "Discover",
    navConnections: "Connections",
    navMessages: "Messages",
    navAccount: "Account",
  },

  auth: {
    login: {
      title: "Welcome back.",
      lede: "Your next chapter is waiting.",
      emailCta: "Continue with email",
      switchPrompt: "New to Eraya?",
      switchCta: "Create an account",
    },
    signup: {
      title: "Welcome to Eraya.",
      lede: "A trusted space for people beginning a new chapter.",
      emailCta: "Continue with email",
      switchPrompt: "Already have an account?",
      switchCta: "Log in",
    },
    email: {
      title: "Continue with email",
      lede: "Enter the email address associated with your Eraya account.",
      label: "Email address",
      placeholder: "you@example.com",
      cta: "Continue",
      pending: "Sending code…",
      emptyError: "Enter your email address to continue.",
      formatError: "That doesn't look like an email address yet.",
      /*
       * The second half of this screen: the code, not a link.
       *
       * A link has to leave this tab, come back through a redirect, and survive
       * being opened on whichever device the mail was read on. When it fails it
       * fails as a blank page. Six digits are typed where the person already is.
       */
      sentTitle: "Check your email.",
      sentBody: "We've sent a six-digit code to",
      sentHint: "It works once, and expires in an hour.",
      codeLabel: "Six-digit code",
      codeCta: "Sign in",
      codePending: "Signing you in…",
      codeEmptyError: "Enter the code from your email.",
      codeFormatError: "That should be the six digits from the email.",
      resend: "Send another code",
      resent: "Sent. Use the newest email.",
      sentRetry: "Use a different email address",
    },
    /*
     * Worded for a check that does not happen yet. No SMS provider is
     * connected, nothing is sent, and any six digits are accepted -- so the
     * copy claims only what actually happens. When an SMS provider is
     * connected this wording goes back to talking about verification.
     */
    phone: {
      title: "Add your phone number.",
      lede: "We keep it for account recovery, and for verification once that is switched on. It is never shown on your profile.",
      countryLabel: "Country code",
      label: "Phone number",
      cta: "Continue",
      emptyError: "Enter your phone number to continue.",
      formatError: "That does not look like a phone number. Check the digits.",
      reassurance:
        "Only you can see it. Another member never sees your number, and neither does anyone you connect with.",
    },
    otp: {
      title: "Confirm your number.",
      ledePrefix:
        "Checking codes by SMS is not switched on yet, so any six digits will do for now. Your number is",
      label: "6-digit code",
      cta: "Continue",
      incompleteError: "Enter all six digits to continue.",
      invalidError: "That needs to be six digits. Check and try again.",
      changeCta: "Change phone number",
      /* Not "Phone verified" -- the step is complete rather than verified. */
      success: "Phone number saved.",
    },
    providers: {
      google: "Continue with Google",
      apple: "Continue with Apple",
      facebook: "Continue with Facebook",
      connecting: "Connecting…",
    },
    legal: {
      prefix: "By continuing you agree to our",
      terms: "Terms of Service",
      and: "and",
      privacy: "Privacy Policy",
    },
    /*
     * What to say when someone arrives back at sign-in after something failed.
     * Returning a person to a blank login page with no explanation is how a
     * working product looks broken.
     */
    problems: {
      accessDenied:
        "Sign-in was cancelled, so nothing happened. You can try again, or continue with email.",
      serverError:
        "That sign-in provider had a problem on its end. Please try again, or continue with email.",
      temporarilyUnavailable:
        "That sign-in provider is briefly unavailable. Please try again in a moment, or continue with email.",
      invalidLink:
        "That sign-in link is not valid any more. Links work once and expire after an hour — request a new one below.",
      missingCode:
        "The sign-in did not complete. Please try again, or continue with email.",
      providerNotEnabled:
        "That sign-in option is not available yet. Please continue with email.",
      fallback:
        "That sign-in did not complete. Please try again, or continue with email.",
    },
    errors: {
      network:
        "We couldn't reach Eraya just now. Check your connection and try again.",
      generic: "Something went wrong on our side. Please try again.",
      /*
       * Deliberately vague about the wait: the limit is enforced per hour, and
       * promising "a moment" would send someone back to press the button again.
       */
      rateLimited:
        "We've sent a few links to this address already. Please check your inbox, including spam — a new link can only be sent a little later.",
      providerUnavailable:
        "That sign-in option isn't available yet. Please continue with email — it takes a moment.",
    },
    webVsApp: {
      title: "Join Eraya from anywhere.",
      body: "Create your account on the web today. The full Eraya experience will be available through our mobile app.",
    },
  },

  onboarding: {
    name: {
      title: "Let's start with your name.",
      lede: "This is how other members will know you. Nothing here is final — you can change any of it later.",
      label: "First name",
      hint: "This is the name shown on your profile.",
      placeholder: "Your first name",
      error: "Enter your first name to continue.",
      tooShort: "That looks a little short. Enter at least two characters.",
    },
    birthday: {
      label: "Date of birth",
      hint: "Used to confirm you're over 18. Only your age is ever shown.",
      error: "Enter your date of birth to continue.",
      /* Names the actual problem. "Try again in a moment" cannot fix a birth date. */
      tooYoung: "Eraya is for people aged 18 and over. Please check the year.",
    },
    gender: {
      label: "Gender",
      error: "Choose an option to continue.",
      woman: "Woman",
      man: "Man",
      nonBinary: "Non-binary",
      preferNotToSay: "Prefer not to say",
    },
    seeking: {
      title: "Who would you like to meet?",
      lede: "Choose as many as apply. You can change this later, and it works both ways — you only appear to people you would also like to meet.",
      error: "Choose at least one.",
      women: "Women",
      men: "Men",
      nonBinaryPeople: "Non-binary people",
    },
    city: {
      title: "Where are you based?",
      lede: "Eraya is welcoming members across India as we build our community, city by city.",
      searchLabel: "Search for your city",
      searchPlaceholder: "Start typing your city",
      searching: "Searching…",
      noMatches: "No matching city. Check the spelling, or use what you typed.",
      /*
       * The way out of a miss, and it has to exist. India has a great many more
       * places people live than a list of cities has rows -- without this,
       * somebody from a smaller town is told to answer a question about where
       * they live with somewhere they do not.
       */
      useTyped: "Use “{typed}”",
      typedSubtitle: "The town you entered",
      hint: "Every city in India is open. Type a few letters to find yours.",
      error: "Search for your city, or use the town you typed, to continue.",
    },
    relationship: {
      title: "Where are you in your journey?",
      lede: "However you arrived here, someone else did too. This is only so we introduce you to people who understand.",
      error: "Choose the option that fits you best.",
      divorced: "Divorced",
      divorcedBody: "My marriage has legally ended.",
      separated: "Separated",
      separatedBody: "I am living apart from my spouse.",
      widowed: "Widowed",
      widowedBody: "I lost my spouse.",
    },
    languages: {
      title: "What languages do you speak?",
      lede: "Choose as many as you like. Conversations are easier in a language you're comfortable in.",
      error: "Choose at least one language, or select “Prefer not to say”.",
      preferNotToSay: "Prefer not to say",
    },
    /*
     * A photograph, if they want one. The last question and the only optional
     * one: a member with no photograph has a complete profile, which is why the
     * button says "Not just now" rather than offering a skip link.
     */
    photo: {
      title: "Add a photo, if you like.",
      lede: "It is genuinely optional. A profile without one is complete, and you can add or change photos whenever you want.",
      addCta: "Choose a photo",
      addMoreCta: "Add another",
      skipCta: "Not just now",
      /* Said plainly, because a limit discovered by being refused is a bad limit. */
      limitNote: "Up to three for now. You can add more from your account later.",
    },
    complete: {
      /*
       * The end of signup, treated as a beginning. Not "Welcome to Eraya" --
       * that is a greeting from a company to a customer. This is about the
       * person: what they have just done is start again.
       */
      eyebrow: "Your Eraya begins",
      title: "You're ready for your next chapter.",
      titleNamed: "You're ready, {name}.",
      lede: "Take it at whatever pace suits you. Nothing here expects anything of you today, and nobody can reach you until you both choose it.",
      cta: "See who's here",
      secondaryCta: "Not just yet",
    },
    stepOf: "Step {current} of {total}",
  },

  home: {
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
  },

  discovery: {
    title: "A few people worth meeting",
    lede: "Eraya introduces a considered few rather than an endless list. These are yours for today.",
    emptyTitle: "Nobody to introduce today.",
    emptyBody:
      "Eraya is still small, and we would rather show you nobody than show you anybody. New members arrive steadily — there is nothing you need to do.",
    seenAllTitle: "That is everyone for today.",
    seenAllBody:
      "More arrive as Eraya grows. Coming back later will not produce a new set — that is deliberate.",
    interested: "I'd like to know more",
    pass: "Not for me",
    connected: "You are connected",
    connectedBody: "You both expressed interest. You can write to each other now.",
    interestSent: "Interest noted",
    interestSentBody:
      "They will only hear about it if they feel the same. Nothing is sent, and nothing is public.",
    undoPass: "Undo last pass",
    readMore: "Read more",
    filters: "Filters",
  },

  connections: {
    title: "Your connections",
    lede: "People you and they both chose. Conversations live here.",
    emptyTitle: "No connections yet.",
    emptyBody:
      "A connection opens only when interest is mutual — so nobody can write to you out of the blue.",
    openConversation: "Open",
    noMessages: "No messages yet",
    ended: "This connection has ended",
    seeWhoIsHere: "See who is here",
  },

  messages: {
    title: "Messages",
    placeholder: "Write a message",
    send: "Send",
    emptyTitle: "No messages yet.",
    emptyBody: "Say hello when you are ready. There is no hurry.",
    endedTitle: "This connection has ended.",
    endedBody: "You can still read what was said. Nothing further can be sent.",
    endCta: "End connection",
    blockCta: "Block",
    reportCta: "Report",
    noConversationsTitle: "No conversations yet",
    noConversationsBody:
      "Conversations begin after you and someone else have both expressed interest. Nobody can message you before that.",
  },

  account: {
    title: "Your account",
    lede: "Everything Eraya knows about you, and everything you control.",
    profileTitle: "Profile",
    profileLede: "What other members see.",
    contactTitle: "Sign-in and contact",
    membershipTitle: "Membership",
    settingsTitle: "Settings",
    settingsLede: "Account details and preferences.",
    signOutBody: "Log out of Eraya on this device.",

    navGroupProfile: "Your profile",
    navEditProfile: "Edit profile",
    navPhotos: "Photos",
    navVerification: "Verification",
    navGroupPrivacy: "Privacy and safety",
    navBlocked: "Blocked people",
    navHelp: "Safety and help",
    navGroupAccount: "Account",

    /*
     * The app's language, which is not the same thing as the languages a member
     * speaks. That second one is profile data used to introduce people to each
     * other; this is only what Eraya's own words are written in, and changing it
     * changes nothing another member sees.
     */
    language: {
      title: "Language",
      lede: "The language Eraya speaks to you in.",
      /*
       * Says the quiet part, because the two are easy to confuse and the
       * consequence of confusing them is somebody thinking they have edited
       * their profile when they have not.
       */
      note: "This changes Eraya's own words only. The languages on your profile, and who you are introduced to, do not change.",
      saved: "Language updated.",
      failed: "That did not save. Your language has not changed.",
    },

    privacyTitle: "Privacy",
    privacyLede:
      "What other members can see, and what they never can. These are enforced by the database, not by settings you have to find.",
    privacyPoint1:
      "You are introduced to a few people at a time, and appear in theirs. There is no directory and no way to search for you.",
    privacyPoint2:
      "Your first name, age, city, chapter and languages are what another member sees.",
    privacyPoint3: "Your exact date of birth is never shown — only your age.",
    privacyPoint4:
      "Your email address and phone number are never shown to another member.",
    privacyPoint5: "If someone passes on your profile, you are never told.",
    privacyPoint6:
      "Nobody can message you unless you have both expressed interest.",

    dangerTitle: "Leaving Eraya",
    dangerBody:
      "You can delete your account at any time. It is yours, and you should not have to ask us for it back.",
    dangerCta: "Delete my account",

    /*
     * The confirmation step lists what actually disappears rather than saying
     * "all your data", which is a phrase people skim past -- particularly the
     * part they may not have considered, that conversations vanish for the
     * other person too.
     */
    confirmTitle: "Delete your account?",
    confirmBody:
      "This cannot be undone. There is no grace period and no way for us to restore it afterwards.",
    confirmItem1: "Your profile, and everything you told us about yourself",
    confirmItem2: "Every connection you have made",
    confirmItem3:
      "Every conversation, for you and for the people you were speaking to",
    confirmItem4: "Your sign-in — you would start again from scratch",
    confirmCta: "Yes, delete my account",
    confirmCancel: "Keep my account",
    confirmPending: "Deleting…",

    deletedTitle: "Your account has been deleted.",
    deletedBody:
      "Everything of yours has been removed from Eraya. If you ever want to begin again, you would be welcome.",

    labelName: "First name",
    labelDateOfBirth: "Date of birth",
    labelAge: "Age",
    labelGender: "Gender",
    labelCity: "City",
    labelRelationship: "Chapter",
    labelLanguages: "Languages",
    labelEmail: "Email",
    labelPhone: "Phone",
    labelSignInMethod: "Sign-in method",
    labelMemberSince: "Member since",
    /*
     * Not "Verified". The OTP step is mocked -- any six digits pass and no SMS
     * is sent -- so the only honest thing this can report is that the step was
     * completed.
     */
    phoneAdded: "Added",
    phoneNotAdded: "Not added",
  },

  errors: {
    title: "This did not load.",
    body: "Something on our side went wrong. Nothing you did caused it and nothing has been lost.",
    retry: "Try again",
    persists: "If it keeps happening, write to us at support@eraya.app.",
  },
};

/**
 * The shape every locale must have.
 *
 * Values are `string` rather than string literals -- `en` is deliberately not
 * `as const` -- so a translation is any string but a key is not optional.
 */
export type Translations = typeof en;
