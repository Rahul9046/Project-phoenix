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
    legalEffectiveFrom: "In effect from {date}",
    legalEnglishOnly: "This document is published in English, and the English version is the one that applies. Translations will follow once they have been properly reviewed.",
    legalPrivacy: "Privacy Policy",
    legalTerms: "Terms of Service",
    legalGuidelines: "Community and Safety",
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
    /*
     * The label on the language control, for a screen reader and for the sheet
     * it opens. Deliberately a verb: the control is there for somebody who
     * cannot read the screen it sits on, and "Language" alone does not say
     * that tapping it changes anything.
     */
    changeLanguage: "Change language",

    /*
     * The two marks Eraya is willing to put on a stranger's profile.
     *
     * They live in `common` because four surfaces render them -- a discovery
     * card, a profile, a connection header and a member's own account -- across
     * two clients, and a trust mark that is worded differently in two places is
     * a trust mark that means something slightly different in two places.
     *
     * Neither says "verified profile" or "verified member". Eraya has checked a
     * mailbox and, sometimes, a handset. It has not checked a person, and the
     * wording must never let a reader think otherwise.
     */
    emailVerified: "Email verified",
    phoneVerified: "Phone verified",
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

    /*
     * What a badge means, said out loud.
     *
     * A number in a coloured circle is invisible to a screen reader and
     * ambiguous to everybody else -- "Connections, 2" could be two connections
     * in total. These are the labels the navigation actually announces, so the
     * count always arrives with the noun it is counting.
     *
     * Separate one/many keys because `t` substitutes placeholders and does not
     * pluralise, and because "1 new connections" is the kind of small wrongness
     * that makes a product feel unattended. Same pattern as `home.introductions`.
     *
     * `activityBoth` is the web's, where conversations live inside Connections
     * and one badge has to speak for two kinds of thing.
     */
    activityNewConnectionsOne: "1 new connection",
    activityNewConnectionsMany: "{count} new connections",
    activityUnreadOne: "1 conversation with unread messages",
    activityUnreadMany: "{count} conversations with unread messages",
    activityBoth: "{connections}, and {messages}",
  },

  auth: {
    login: {
      title: "Welcome back.",
      lede: "Your next chapter is waiting.",
      emailCta: "Continue with email",
      switchPrompt: "New to Eraya?",
      switchCta: "Create an account",
    },
    /*
     * The app's single sign-in screen, which is also its sign-up screen.
     *
     * The mobile app has no separate sign-up: a provider or an email address
     * either matches an account or creates one, so `login` and `signup` above --
     * which the website uses for its two pages -- do not fit it. Hence one more
     * block rather than reusing a heading written for a page that knows which of
     * the two the person is doing.
     */
    signIn: {
      title: "Your next chapter.",
      lede:
        "For people who are divorced, separated or widowed, and ready to meet someone who understands.",
      emailDivider: "or with your email",
      emailHint:
        "We will send you a six-digit code. There is no password to remember.",
      /* Said before the first tap, not in a policy nobody opens. */
      reassurance:
        "Eraya is free to join. Nothing is shared with anyone until you choose it, and you can delete your account and everything in it at any time.",
    },
    /*
     * The two screens that exist only to wait: the app's entry point, and
     * where a tapped sign-in link lands. Nobody should read either for more
     * than a moment -- but a stalled connection makes the first one the
     * longest-lived screen in the product, and it must not be in a language
     * the member cannot read.
     */
    entry: {
      unreachableTitle: "We could not reach Eraya",
      signInAgain: "Sign in again",
      signingIn: "Signing you in…",
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
      linkNote: "The same email has a button you can tap instead. On some phones the browser will not hand the link back to the app, which is why the code is here — it always works.",
      codePlaceholder: "000000",
    },
    /*
     * Worded for a check that does not happen yet. No SMS provider is
     * connected, nothing is sent, and any six digits are accepted -- so the
     * copy claims only what actually happens. When an SMS provider is
     * connected this wording goes back to talking about verification.
     */
    phone: {
      title: "Add your phone number.",
      lede: "We keep it for account recovery, and for verification if you choose it. It is never shown on your profile.",
      countryLabel: "Country code",
      label: "Phone number",
      cta: "Continue",
      emptyError: "Enter your phone number to continue.",
      formatError: "That does not look like a phone number. Check the digits.",
      reassurance:
        "Only you can see it. Another member never sees your number, and neither does anyone you connect with.",
      numberPlaceholder: "98765 43210",
      notLiveNote: "Checking numbers by SMS is not switched on yet, so nothing will be sent. Your number is stored, and no other member ever sees it.",
      /*
       * The step is optional, and the screen says so before the button rather
       * than after it. A "Skip" a person only finds once they have decided they
       * cannot face the form is a skip that arrives too late to be a choice.
       *
       * The sentence names the upside and the cost of declining in the same
       * breath, and the cost is nothing: no capability is withheld, so there is
       * no warning to give and none is given.
       */
      optional: "This is optional. Verifying adds a trust mark to your profile, and you can do it later from your account.",
      skip: "Skip for now",
      skipping: "One moment…",
    },
    otp: {
      title: "Confirm your number.",
      /*
       * The number is masked. They typed it one screen ago, so the last two
       * digits are enough to confirm it went to the right place, and the
       * screen is reachable on a shared or borrowed phone.
       */
      lede: "Enter the six-digit code sent to {phone}.",
      /*
       * The app only. Its SMS path is genuinely not switched on -- it waits on
       * a DLT-approved template -- so this sentence is true there and was a
       * lie on the web, which has been sending real codes since MSG91 went
       * live. The web used to render it and now renders `lede`.
       */
      ledePrefix:
        "Checking codes by SMS is not switched on yet, so any six digits will do for now. Your number is",
      label: "6-digit code",
      cta: "Continue",
      incompleteError: "Enter all six digits to continue.",
      invalidError: "That needs to be six digits. Check and try again.",
      changeCta: "Change phone number",
      /* Not "Phone verified" -- the step is complete rather than verified. */
      success: "Phone number saved.",
      resendIn: "Resend code in {seconds}s",
      resend: "Resend code",
      resendSent: "A new code is on its way.",
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
      tooYoung: "You must be at least 18 years old to use Eraya.",
      title: "When were you born?",
      chooseCta: "Choose your date of birth",
    },
    gender: {
      label: "Gender",
      error: "Choose an option to continue.",
      woman: "Woman",
      man: "Man",
      nonBinary: "Non-binary",
      preferNotToSay: "Prefer not to say",
      title: "How do you describe yourself?",
    },
    seeking: {
      title: "Who would you like to meet?",
      lede: "Choose as many as apply. You can change this later, and it works both ways — you only appear to people you would also like to meet.",
      error: "Choose at least one.",
      women: "Women",
      men: "Men",
      nonBinaryPeople: "Non-binary people",
      everyoneNote: "You will be introduced to anyone who would also like to meet you.",
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
      trustNote: "Eraya does not check this. It is taken on trust, the same way you are trusting everyone else here.",
    },
    religion: {
      title: "What's your religion?",
      lede: "Share only what you're comfortable with. You can choose not to say.",
      error: "Choose an option to continue.",
      hindu: "Hindu",
      muslim: "Muslim",
      christian: "Christian",
      sikh: "Sikh",
      buddhist: "Buddhist",
      jain: "Jain",
      other: "Other",
      /*
       * An answer, and the screen treats it as one -- it is chosen, it is
       * stored, and it lets somebody continue. What it never becomes is a line
       * on a profile: "Religion: Prefer not to say" advertises that the
       * question was asked and points at the one person who declined, which is
       * worse than silence. The database collapses it to nothing before it
       * reaches another member; see disclosed_religion().
       */
      preferNotToSay: "Prefer not to say",
      /*
       * Said on the screen, because it is the thing somebody hesitating is
       * actually worried about. Eraya asks, stores what it is told, and infers
       * nothing -- not from a name, a city or a language.
       */
      privacyNote: "You can change this at any time, or stop sharing it. Eraya never guesses your religion from your name, your city or the languages you speak.",
    },
    languages: {
      title: "What languages do you speak?",
      lede: "Choose as many as you like. Conversations are easier in a language you're comfortable in.",
      error: "Choose at least one language, or select “Prefer not to say”.",
      preferNotToSay: "Prefer not to say",
      selected: "{count} selected",
      ratherNotSay: "I would rather not say",
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
      adding: "Adding…",
      removeFailed: "That photo could not be removed. Please try again in a moment.",
      privacyNote: "Photos are only shown inside Eraya, to members you are introduced to. Location information is removed from every picture before it leaves your phone.",
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
    profileTitle: "Your profile",
    profileComplete: "Your profile is complete.",
    profileCta: "Review your profile",
    today: "Today",
    introductionsNone: "No new introductions today",
    introductionsOne: "One person to meet",
    introductionsMany: "{count} people to meet",
    introductionsNoneBody: "More arrive as the community grows around you.",
    introductionsSomeBody: "A few at a time, chosen without a ranking.",
    introductionsLoading: "Introductions, loading",
    waitingTitle: "Waiting for a first word",
    waitingLedeOne: "You chose each other. Neither of you has said anything yet.",
    waitingLedeMany: "You chose each other. Nothing has been said yet.",
    sayHello: "Say hello when you are ready.",
    startConversation: "Start a conversation with {name}",
    conversationWith: "Conversation with {name}",
    recentTitle: "Recent",
    allMessages: "All messages",
    fromYou: "You:",
    unread: "Unread",
    interestOne: "Someone is interested in getting to know you",
    interestMany: "{count} people are interested in getting to know you",
    interestPrivateOne:
      "We keep interests private so you can discover people without pressure or influence. We won't reveal who it is — even with Premium. If you both choose each other, we'll let you know.",
    interestPrivateMany:
      "We keep interests private so you can discover people without pressure or influence. We won't reveal who they are — even with Premium. If you both choose each other, we'll let you know.",
    promptTitle: "Say a little more about yourself",
    promptBody: "A few lines in your own words is the difference between a profile and a person. It takes a minute, and you can change it whenever you like.",
    promptCta: "Add it now",
    promptLater: "Later",
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
    filterReligion: "Religion",
  },

  connections: {
    title: "Your connections",
    lede: "People you and they both chose. Conversations live here.",
    emptyTitle: "No connections yet.",
    emptyBody:
      "A connection opens only when interest is mutual — so nobody can write to you out of the blue.",
    openConversation: "Open",
    noMessages: "No messages yet",
    unreadMark: "Unread messages",
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

  /*
   * Reporting somebody, which always blocks them.
   *
   * One group rather than more keys under `messages`, because this flow is
   * reached from a conversation on the website and from both a conversation and
   * a profile in the app -- and a member who reports from two places must be
   * asked the same question in the same words.
   *
   * The wording still promises no review, because there is still no queue a
   * member can be told about. What it does promise is the block, which is real,
   * immediate, and enforced by the database rather than by this screen.
   *
   * `reasons` is keyed by the `report_reason` enum in Postgres. The keys are
   * identifiers and are never translated; only the sentences beside them are.
   */
  report: {
    title: "Report and block {name}?",
    body:
      "{name} is blocked the moment you send this — no messages, and neither of you is shown to the other again.",
    note:
      "Eraya is small and has no moderation team yet, so we cannot promise anyone will write back. The block does not wait for us; it takes effect immediately either way.",

    reasonLabel: "Why are you reporting {name}?",
    reasons: {
      harassment: "Harassment or abusive behaviour",
      inappropriate_content: "Inappropriate or sexual content",
      fake_profile: "Fake or misleading profile",
      scam: "Scam or asking for money",
      spam: "Spam or unwanted promotion",
      safety_threat: "Threats or safety concern",
      underage: "Under 18",
      other: "Something else",
    },

    detailsLabel: "Tell us more",
    detailsOptional: "Optional. A sentence is enough.",
    detailsRequired:
      "Required, because “Something else” does not say what happened.",
    detailsPlaceholder: "In your own words.",
    detailsMissing: "Please tell us what happened.",
    reasonMissing: "Please choose a reason.",

    cancel: "Cancel",
    submit: "Report & block {name}",
    submitting: "Reporting…",
    failed:
      "We could not do that just now. Please try again in a moment, or write to us.",

    doneTitle: "Report received. {name} is blocked.",
    doneBody:
      "Your report has been recorded, and {name} has been blocked — you will not be shown to each other again, and neither of you can send the other anything.",
    doneCta: "Done",
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
    labelReligion: "Religion",
    labelEmail: "Email",
    labelPhone: "Phone",
    labelSignInMethod: "Sign-in method",
    labelMemberSince: "Member since",

    navVerificationDescription: "What Eraya has checked, and what it has not",

    /*
     * A member's own verification, on their own screen.
     *
     * The unverified half is deliberately an invitation and not a warning.
     * Declining costs nothing -- discovery, interest, connections and messages
     * are all untouched by it -- so wording that implies a lapse would be
     * pressure applied on behalf of a benefit the member has already weighed.
     */
    verification: {
      title: "Verification",
      lede: "Eraya only shows a mark for something it has genuinely checked. Where it has not, it says so.",

      emailLabel: "Email address",
      emailDone: "Confirmed. This is how you sign in.",
      emailAbsent: "Confirm your address with the code we sent.",

      phoneLabel: "Phone verification",
      phoneDone: "Your phone number stays private.",
      phoneAbsent: "Add another trust mark to your profile. Your phone number stays private.",
      phoneCta: "Verify phone",

      identityLabel: "Identity",
      identityDetail: "Eraya does not verify identity documents. Nobody here has been checked against one.",

      relationshipLabel: "Relationship status",
      relationshipDetail: "Taken on trust, from you and from everyone else. There is no way for us to confirm it.",
    },
  },

  errors: {
    title: "This did not load.",
    body: "Something on our side went wrong. Nothing you did caused it and nothing has been lost.",
    retry: "Try again",
    persists: "If it keeps happening, write to us at support@eraya.app.",
  },
  /*
   * The public site.
   *
   * It was the last thing in the product still written in one language, which
   * made the language control on its header a button that changed nothing. A
   * person deciding whether Eraya is for them reads this before they have an
   * account to hold a preference -- so this is the first thing they should be
   * able to read in their own language, not the last.
   */
  marketing: {
    nav: {
      howItWorks: "How it works",
      safety: "Safety & Trust",
      pricing: "Pricing",
      about: "About Eraya",
      login: "Log in",
      begin: "Begin your journey",
      signedInAs: "Signed in as {name}",
      openMenu: "Open menu",
      closeMenu: "Close menu",
    },

    hero: {
      eyebrow: "For those beginning again",
      /* Two lines, because the second is set in terracotta on its own. */
      headlineOne: "Every ending can be",
      headlineTwo: "a new beginning.",
      lede: "Meet people who understand what starting again means.",
      primaryCta: "Create your account",
      secondaryCta: "How Eraya works",
      note: "Open across India. Verified members. A considered few, never an endless list.",
    },

    trust: {
      eyebrow: "Safety & Trust",
      title: "Trust comes before connection.",
      lede: "Meeting someone new asks a lot of you. Eraya's job is to make that feel safe long before it feels exciting — so the groundwork comes first.",
      reachTitle: "Nobody can reach you uninvited",
      reachBody: "A conversation opens only when you have both chosen it. There is no inbox for strangers, and no way to message someone who has not chosen you back.",
      browsableTitle: "You are not browsable",
      browsableBody: "Eraya introduces a considered few rather than listing everyone. There is no directory to search, and no way to look someone up.",
      sharedTitle: "Only what you agreed to share",
      sharedBody: "Your email address and phone number are never shown to another member, and your date of birth is never shown at all — only your age.",
      chapterTitle: "Built for one chapter of life",
      chapterBody: "Eraya is for people who are divorced, separated or widowed. Nobody creates a profile on someone else's behalf.",
      interestTitle: "Interest is private",
      interestBody: "If you pass on someone, they are never told. Nobody learns they were passed over, and nobody can be pestered.",
    },
    why: {
      eyebrow: "About Eraya",
      title: "Built for a different moment in life.",
      lede: "Most platforms are designed for people starting out. Eraya is designed for people starting again — and that changes almost everything about how it should work.",
      paywallTitle: "No paywall before a first conversation",
      paywallBody: "You should not have to pay to find out whether there is anything to talk about. Starting a meaningful conversation is part of the experience, not the upsell.",
      curiosityTitle: "No engineered curiosity",
      curiosityBody: "No blurred faces, no “someone liked you” nudges designed to make you upgrade. What is true is what you are shown.",
      collectingTitle: "No endless collecting",
      collectingBody: "Eraya is not built to keep you scrolling. A smaller number of considered introductions respects your time far more than an infinite list.",
      trustTitle: "Designed around trust",
      trustBody: "Verification, review and privacy are not features bolted on at the end. They are the reason the rest of the product can exist.",
    },

    how: {
      eyebrow: "How it works",
      title: "Three simple steps.",
      lede: "No jargon, no complicated setup. If you can send a message, you can use Eraya.",
      oneTitle: "Create your profile",
      oneBody: "Tell us a little about yourself — your name, your city, and the chapter you are in. It takes a few minutes.",
      twoTitle: "Discover people at your pace",
      twoBody: "See a small number of people at a time. Look today, come back next week — nothing expires.",
      threeTitle: "Connect when you're comfortable",
      threeBody: "A conversation only begins when you choose to open it. There is no rush, and no obligation.",
    },

    built: {
      eyebrow: "Built differently",
      title: "Fewer people. More thought.",
      lede: "A few decisions shape everything else about Eraya.",
      fewTitle: "A considered few, not an endless feed",
      fewBody: "You see a limited set of people who genuinely fit what you are looking for, rather than an infinite list to work through.",
      mindTitle: "Change your mind, freely",
      mindBody: "Moved past someone too quickly? You can go back to the previous profile in a session, at no cost.",
      privacyTitle: "Privacy-respecting communication",
      privacyBody: "You talk within Eraya until you decide otherwise. Your personal contact details stay yours to give.",
      pressureTitle: "No pressure to rush",
      pressureBody: "No streaks, no countdowns, no reminders that someone is waiting. You set the pace.",
    },

    cities: {
      eyebrow: "Where Eraya is",
      title: "Open everywhere in India.",
      body: "Every city and town in India is here — search for yours and it will be in the list. Where you live shapes who you are likely to meet, never whether you can join.",
      elsewhere: "Eraya is young, so some places have more members than others. Create your account and take your time; introductions arrive as the community grows around you.",
      cta: "Create your account",
      coverageBody: "cities and towns to choose from, across all {states} states and union territories.",
      coverageNote: "Your city is on the list. It decides who you are likely to meet nearby — never whether you can join.",
    },

    finalCta: {
      title: "Your next chapter doesn't have to begin alone.",
      lede: "Wherever you are in it — a year on, or ten — there are people who understand. Eraya is being built for them, and for you.",
      cta: "Create your account",
    },

    begin: {
      eyebrow: "Begin",
      title: "Your next chapter starts when you are ready.",
      lede: "Creating an account is free and takes a few minutes. Nothing is shared with anyone until you choose it, and nobody can reach you until you both do.",
      cta: "Create your account",
      secondary: "I already have an account",
      reassurance: "Open across India. Free to join, and free to leave — you can delete your account and everything in it at any time.",
    },

    /*
     * The Android beta, on the public site and on /beta.
     *
     * One block for both, because the landing page an Instagram link points at
     * and the card on the home page are the same offer written once. `{version}`
     * is passed in from `android-beta.ts` rather than typed into six files, so
     * bumping the build cannot leave five languages claiming the old number.
     */
    androidBeta: {
      eyebrow: "Android beta",
      title: "Eraya Android Beta",
      lede: "Be among the first to experience Eraya.",
      cta: "Download Android Beta",
      version: "Beta version {version}",
      note: "Android may ask you to allow installation from your browser. Eraya is currently in beta.",
      /* The /beta page, which stands alone with no header or footer. */
      pageTitle: "Your next chapter starts here.",
      pageLede: "Eraya is a trusted community for divorced, separated and widowed people in India. The Android app is in open beta — install it, create your account, and take it at your own pace.",
      backToSite: "Visit eraya.app",
    },
    footer: {
      erayaTitle: "Eraya",
      about: "About",
      howItWorks: "How it works",
      safety: "Safety",
      legalTitle: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      contact: "Contact",
      tagline: "A trusted place to begin again, for people who are divorced, separated or widowed.",
      social: "Social",
      comingSoon: "coming soon",
      copyright: "© {year} Eraya. A {organization} product.",
    },
    /*
     * Prices, terms and the promise about renewal.
     *
     * The amounts are not here. They come from the `plans` table and are
     * formatted by the page, so a price cannot be changed in one language and
     * not the other five -- which is the sort of drift that stops being a
     * translation bug and starts being a claim about money.
     */
    pricing: {
      eyebrow: "Membership",
      title: "Everything you need to meet someone is free.",
      lede: "Browsing, filters, expressing interest and messaging the people you connect with cost nothing, and will not start costing something later. Eraya Premium adds a few things on top for those who want them.",
      freeName: "Free",
      freePriceNote: "Always. No card, no trial period.",
      freeCta: "Create your account",
      premiumName: "Eraya Premium",
      premiumPriceNote: "from ₹199 for your first month",
      premiumIntro: "Everything in Free, and:",
      premiumFrom: "from",
      premiumTerms: "One membership, four lengths: monthly, quarterly, half-yearly or annual.",
      premiumCta: "Choose how long",
      chooseCta: "Choose {name}",
      chooseUnavailable: "Opens when payments do",
      includedTitle: "Included with every account",
      plansTitle: "Choose how long",
      plansLede: "The same Premium membership either way — only the length of the term changes. Prices are fixed. There is nothing to work out.",
      perMonth: "{amount} a month",
      recurringNote: "{first} for your first month, then {thereafter} for any month you choose to buy afterwards. Nothing renews on its own.",
      oneOffNote: "{price} for {period}, paid once. Not a recurring subscription.",
      renewalPromiseTitle: "Nothing renews behind your back",
      renewalPromiseBody: "Every term is paid once and simply ends. Nothing continues on its own, no card is charged a second time, and there is nothing to cancel. If you would like to carry on when a term runs out, you choose to buy another.",
      renewalPromiseNudge: "We will not ring you or fill your inbox asking you to come back. If a term ends and you would like to carry on, that is entirely your decision to make, in your own time.",
      notYetTitle: "Premium is not on sale yet",
      notYetBody: "We are still choosing how payments are handled, so nothing here can be purchased today and nothing will charge you. Create your account now — it is free — and we will tell you when Premium opens. You will always see the full price before agreeing to anything.",
      faqTitle: "Before you ask",
      faqFreeQ: "Will the free features start costing money later?",
      faqFreeA: "No. Browsing, filters, expressing interest and messaging someone you have connected with are free, and are meant to stay that way. Premium adds to that rather than taking anything away.",
      faqCancelQ: "Do I need to cancel?",
      faqCancelA: "There is nothing to cancel. Every term is paid for once and ends by itself, so no second payment is ever taken. You keep Premium until the term you paid for runs out.",
      faqRenewQ: "What happens after the first month at ₹199?",
      faqRenewA: "It simply ends. The introductory price applies to your first month. If you would like another month after that, you buy it at ₹299 when you choose to — no plan renews on its own.",
      freePrice: "₹0",
      firstMonth: "first month",
      insteadOf: "instead of",
    },

    /*
     * The three standing pages. Both the privacy and terms pages say outright
     * that they are not yet the legal documents, which is why translating them
     * is reasonable: they describe what the product does today. The documents
     * that replace them will need a lawyer in each language, not a translator.
     */
    privacy: {
      eyebrow: "Privacy",
      title: "Privacy at Eraya.",
      intro: "The formal privacy policy is being written and will be published here before Eraya opens to the public. This page is not that document — it is a plain account of what Eraya stores today and who can see it.",
      storeTitle: "What we store",
      storeAccount: "When you create an account we store your email address, and the answers you give during onboarding: your first name, date of birth, gender, city, the chapter you are in, and the languages you speak. If you use Google or Facebook to sign in, we receive your name and email address from them.",
      storePhone: "We record the phone number step, but we do not currently verify it against a mobile network and we do not store the number itself.",
      storeActivity: "Once you are using Eraya we store who you have expressed interest in, who you have connected with, and the messages you exchange with them.",
      seeTitle: "What other members see",
      seeProfile: "Another member sees your first name, your age, your city, the chapter you are in, and the languages you speak. They never see your email address, your phone number, or your date of birth — only the age calculated from it.",
      seeDirectory: "There is no directory and no search. You are introduced to a few people at a time and appear in theirs; nobody can look you up. If someone passes on your profile, you are never told, and nobody can message you unless you have both expressed interest.",
      deleteTitle: "Deleting everything",
      deleteBody: "You can delete your account from Settings at any time. It removes your profile, your answers, your connections and your messages permanently. There is no grace period and we cannot restore it afterwards.",
      deleteContact: "If you would rather we did it, or you have any question about your data, write to",
    },

    terms: {
      eyebrow: "Terms",
      title: "Terms of use.",
      body: "Eraya has not launched yet, so there is no service to set terms for. The full terms of use will be published on this page before the app opens, and before anyone is asked to agree to them.",
      operator: "This site is operated by {organization}. If you have a question in the meantime, write to",
    },

    contact: {
      eyebrow: "Contact",
      title: "Talk to us.",
      body: "Eraya is being built by a small team at {organization}. If you have a question, a concern, or something you think we should know about building this well — we would like to hear it.",
      emailPrefix: "Email",
      emailSuffix: "and a person will read it.",
    },
  },

  membership: {
    addsSecondChancesTitle: "More second chances",
    addsSecondChancesBody: "Bring back more of the people you passed on by mistake.",
    addsQuietTitle: "Browse quietly",
    addsQuietBody: "Look at profiles without showing up in their viewers.",
    addsEarlierTitle: "Shown earlier",
    addsEarlierBody: "Your profile appears sooner in other people's introductions.",
    freeAccount: "Creating an account and your profile",
    freeIntroductions: "Being introduced to people",
    freeFilters: "Every filter — age, city, language, chapter",
    freeInterest: "Expressing interest",
    freeMessaging: "Messaging anyone you have connected with",
    freeBlocking: "Blocking and reporting",
    freeDeletion: "Deleting your account and everything in it",
    addMoreTime: "Add more time",
    loadingPlans: "Loading plans",
    choosePlan: "Choose a plan",
    paidTitle: "Premium is active",
    paidThanks: "Thank you.",
    processingTitle: "Confirming your payment",
    processingBody:
      "Premium will appear here as soon as the confirmation reaches us. There is nothing you need to do.",
    cancelledTitle: "Payment cancelled",
    cancelledBody: "You have not been charged.",
    failedTitle: "That payment did not go through",
    failedBody:
      "Please try again. If money has left your account, it will be confirmed here automatically.",
    unconfirmedTitle: "We could not confirm this payment",
    statusNotCompleted: "Not completed",
    statusConfirming: "Confirming",
    statusPartlyRefunded: "Partly refunded",
      statusPaid: "Paid",
      statusFailed: "Failed",
      statusCancelled: "Cancelled",
      statusRefunded: "Refunded",
      statusUnknown: "Unknown",
      unconfirmedBody: "Something on our side did not add up, so we are not going to guess. If money has left your account it is not lost — write to support@eraya.app and we will sort it out.",
  },

  payment: {
    checkAgain: "Check again",
    backToMembership: "Back to membership",
    checkingTitle: "Checking your payment",
    checkingBody: "Asking our server what happened. This takes a moment.",
    paidBody: "Your payment went through. Thank you.",
    processingBody:
      "Your bank has not finished telling us what happened. Premium appears the moment it does, and there is nothing you need to do. It is safe to close the app.",
    cancelledBody: "You have not been charged. Nothing has changed about your account.",
    failedBody:
      "Please try again, or use a different method. If money has left your account, it will be confirmed here automatically.",
    offlineTitle: "We could not check just now",
    offlineBody:
      "Your connection dropped before we could confirm. Nothing is lost: open Membership when you are back online and it will show where this stands.",
  },

  safety: {
    actionFailed: "That did not go through. Please try again.",
    connectionEnded: "The connection has ended.",
    endTitle: "End connection",
    endPoint1:
      "Neither of you will be able to send anything further. What has already been said stays readable to you both.",
    endPoint2: "They will not appear in your introductions again.",
    cannotBeUndone: "This cannot be undone.",
    keepConnection: "Keep the connection",
    blockPoint1:
      "You will not see each other again anywhere in Eraya, and neither of you can send the other anything.",
    blockPoint2: "Any conversation between you is closed.",
    blockPoint3: "This is enforced by Eraya, not just hidden from view.",
      blockedToast: "{name} is blocked.",
      endTitleNamed: "End your connection with {name}?",
      endNotTold: "{name} is not told that you ended it.",
      blockTitleNamed: "Block {name}?",
      blockNotTold: "{name} is not told that you blocked them.",
      blockConfirmNamed: "Block {name}",
  },

  photos: {
    /*
     * Framing, which the app and the website both offer. Every surface draws a
     * photograph in a 4:5 frame, so a crop happens either way -- these are the
     * words for letting the member decide it instead of the layout.
     */
    frame: {
      title: "Frame your photo",
      lede: "Photos are shown in this shape everywhere in Eraya.",
      ofBatch: "Photo {index} of {count}.",
      hintPointer: "Drag the picture to move it, and use the slider to zoom.",
      hintTouch: "Drag the picture to move it, and pinch to zoom.",
      frameLabel:
        "Photo framing. Use the arrow keys to move the picture, and plus or minus to zoom.",
      zoom: "Zoom",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      use: "Use this photo",
      saving: "Saving…",
      reset: "Centre it again",
    },
    frameFailed: "That photo could not be prepared. Please try another one.",
    added: "Photo added.",
    deleteFailed: "That did not delete. Please try again.",
    removed: "Photo removed.",
    saveFailed: "That did not save. Please try again.",
    nowFirst: "That is now your first photo.",
    firstHint: "Your first photo. Tap for options.",
    add: "Add a photo",
    addFirst: "Add your first photo",
    sheetTitle: "This photo",
    makeFirst: "Make this my first photo",
    removeThis: "Remove this photo",
    permission:
      "Eraya needs permission to open your photos. You can grant it in your phone's settings.",
    noneChosen: "No photo chosen.",
    uploadFailed: "That photo did not upload. Please check your connection and try again.",
    persistFailed: "That photo did not save. Please try again.",
  },

  help: {
    takeTimeTitle: "Take your time in the conversation",
    takeTimeBody:
      "There is no hurry here and nobody is counting. Somebody pushing to move to another app or to meet immediately is telling you something.",
    meetPublicTitle: "Meet somewhere public, the first few times",
    meetPublicBody:
      "A café in the middle of the afternoon. Tell someone you trust where you are going and when you expect to be back.",
    neverSendMoneyTitle: "Never send money",
    neverSendMoneyBody:
      "No genuine person you met here will ask. An emergency that needs a transfer today is the oldest pattern there is.",
    blockTitle: "Block without explaining yourself",
    blockBody:
      "You owe nobody a reason. Blocking is immediate, it is enforced by Eraya rather than hidden from view, and they are never told.",
      limitsTitle: "What Eraya can and cannot do",
      limitsBody: "Blocking works immediately and is enforced by the system. Reports are recorded, but Eraya is small and has no moderation team yet, so we cannot promise that anyone will read one or reply to you. If something serious happens, please contact the police as well as us.",
  },

  failures: {
    sessionExpired: "Your session has expired. Please sign in again.",
    network: "We could not reach Eraya just now. Check your connection and try again.",
    sendCodeFailed: "We could not send your code just now. Please try again shortly.",
    invalidNumber:
      "That does not look like a mobile number we can reach. Check the digits and try again.",
    invalidIndianNumber:
      "That does not look like an Indian mobile number. It should be ten digits.",
    cooldown: "Please wait a little before asking for another code.",
    dailyCap: "That is several codes in a short time. Please try again a little later.",
    attemptCap: "That is several attempts in a short time. Please try again a little later.",
    verifyFailed: "We could not check that code just now. Please try again shortly.",
    invalidCode: "That code does not look right. Check it and try again.",
    codeExpired: "That code has expired. Ask for a new one.",
    tooManyAttempts:
      "That is too many tries for one code. Ask for a new one and take it slowly.",
    noRequest: "Ask for a code first, then enter it here.",
    sixDigits: "That needs to be six digits.",
    signInNetwork:
      "We could not sign you in just now. Please check your connection and try again.",
    signInFailed: "We could not sign you in just now. Please try again in a moment.",
    signInCancelled: "Sign-in was cancelled.",
    invalidEmail: "That does not look like an email address.",
    emailRateLimited:
      "We have sent a few codes to this address already. Please wait a little while before asking for another.",
    emailSendFailed:
      "We could not send your code just now. Please check the address and try again shortly.",
    emailSixDigits: "That needs to be the six digits from the email.",
    emailCodeFailed:
      "That code did not work. It may have expired — ask for a new email and use the latest one.",
    saveFailed: "We could not save that just now. Please check your connection and try again.",
    underage:
      "Eraya is for people aged 18 and over. Please check the year in your date of birth.",
    tooLong: "That is a little longer than we can store. Please shorten it slightly.",
    unrecognisedAnswer: "One of those answers was not recognised. Please choose it again.",
    actionFailedMoment: "That did not go through. Please try again in a moment.",
    writeSomething: "Write something first.",
    conversationEnded: "This conversation has ended. Nothing further can be sent.",
    sendFailed: "That did not send. Please try again.",
    unexpected: "An unexpected error.",
    didNotLoad: "That did not load",
    didNotLoadBody: "Check your connection and try again. Nothing has been lost.",
  },

  mobileDiscovery: {
    nothingToBringBack: "There is nothing to bring back.",
    secondChancesUsed: "You have used all of today's second chances. They return tomorrow.",
    broughtBack: "Brought back into your introductions.",
    noMatchesTitle: "Nobody matches those filters",
    noMatchesBody:
      "Try widening the age range, or adding another city. Eraya is young, so narrow filters find fewer people than they will in a few months.",
    clearFilters: "Clear filters",
    everyoneTitle: "That is everyone for now",
    everyoneBody:
      "You have seen everyone we have for today. New people arrive as the community grows, and a fresh set is chosen each morning.",
    showPeople: "Show people",
    addCity: "Add a city",
    searchCityToFilter: "Search for a city to filter by",
    searchingCities: "Searching cities",
      clearAll: "Clear all",
      anyAge: "Any age",
  },

  memberView: {
    interestPrivate: "Kept to yourself. They are never told.",
    unavailableTitle: "This profile is not available",
    unavailableBody: "They may have left Eraya, or you are no longer able to see each other.",
    theirHopes: "What they are hoping for",
      aboutTitle: "About",
      detailsTitle: "Details",
  },

  mobileMessages: {
    loadingConversation: "Loading conversation",
    backToMessages: "Back to messages",
    connectionEndedShort: "Connection ended",
    viewProfile: "View profile",
    conversationOptions: "Conversation options",
    loadingEarlier: "Loading earlier messages",
    stillReadable: "Still readable. Nothing further can be sent.",
    noConnectionsBody:
      "When you and someone else both express interest, they appear here. Nobody is told you were interested unless they feel the same.",
      youPrefix: "You: ",
      groupNew: "New",
      groupTalking: "Talking",
      groupEnded: "Ended",
      goBack: "Go back",
      sayHelloCta: "Say hello",
  },

  mobileAccount: {
    profileOpens: "Your profile. Opens what other members see.",
    tapToSeeProfile: "Tap to see your profile",
    wordsCityLanguages: "Your words, city, languages",
    noneYetOptional: "None yet — optional",
    seePremium: "See what premium adds",
    whatOthersSee: "What others can see",
    signedInWith: "Signed in with",
    emailedCode: "An emailed code",
    staySignedIn: "Stay signed in",
    loadingProfile: "Loading your profile",
    profileUpdated: "Your profile is updated.",
    aboutHint:
      "A few lines in your own words. What you do, what your days look like, what you are like to be around.",
    hopingForLabel: "What you are hoping for",
    hopingForHint:
      "Optional. Nobody is matched on this — it is read by people, not by an algorithm.",
    saveChanges: "Save changes",
    whereDoYouLive: "Where do you live?",
    unblocked: "Unblocked. You may see each other again.",
    loadingBlocked: "Loading blocked people",
    noneBlockedTitle: "You have not blocked anyone",
    noneBlockedBody:
      "If you ever need to, blocking is on every profile and in every conversation. It takes effect immediately and the other person is never told.",
    privacyPointProfileFields:
      "Another member sees your first name, age, city, chapter, languages, and whatever you have written about yourself.",
    privacyPointContact: "Your email address and phone number are never shown to anyone.",
    privacyPointPassing:
      "If someone passes on your profile, you are never told. If you pass on theirs, they are never told.",
    privacyPointReceipts:
      "Nobody is told when you last opened a conversation, or whether you have read a message.",
    privacyPointBlocking:
      "Blocking is enforced by Eraya, not just hidden from view — a blocked person cannot load your profile or your photos.",
    notRightNow: "Not right now",
    sixDigitCode: "Six digit code",
    clearSearch: "Clear search",
      unblock: "Unblock",
      aboutYouLabel: "About you",
      whereYouLive: "Where you live",
      notBuiltTitle: "Not built yet",
      notBuiltBody: "Eraya does not send push notifications at all, so there is nothing here to turn off. We would rather show you this than a switch that does nothing.",
      stillBuildingTitle: "Still being built",
      stillBuildingBody: "Choosing who can see your photos, and browsing without appearing in anyone’s viewers, are both designed and not yet built. We will say so here rather than implying they already work.",
  },
};

/**
 * The shape every locale must have.
 *
 * Values are `string` rather than string literals -- `en` is deliberately not
 * `as const` -- so a translation is any string but a key is not optional.
 */
export type Translations = typeof en;
