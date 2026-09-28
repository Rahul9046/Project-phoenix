import type { Guide } from "../types";

/**
 * Eraya's seventh guide, published 2026-09-28, and the last of the batch the
 * section was built for.
 *
 * Approved copy, transcribed into blocks. Nothing in the Guides system changed
 * to accept it, and nothing in the system is now waiting to be filled: the
 * planned list in `docs/13-seo.md` is empty after this article, which is the
 * state the registry was always meant to reach rather than a gap to paper over.
 * No placeholder slug was invented to keep a draft test company -- the draft
 * gate is proved by fixtures in `select.test.ts` and by
 * `/guides/this-guide-does-not-exist` in the probe, neither of which needs a
 * real unwritten article to exist.
 *
 * `seoTitle` is present and is the shorter, more search-shaped of the two
 * approved strings, as in Articles #5 and #6: the title tag asks the reader's
 * question ("What's the Difference?") while the `h1`, the breadcrumb, the index
 * card and the JSON-LD `headline` carry the approved heading.
 *
 * No `list` block. The copy's one colon-and-lines passage is the four questions
 * a reader might ask themselves, and they are quoted sentences rather than a
 * punctuated series -- no semicolons, no closing "or" -- so the rule Article #6
 * settled leaves them as paragraphs. The quotation marks are the author's own
 * and are kept as typed.
 *
 * Standalone emphasis renders as ordinary paragraphs, Article #4's precedent:
 * `GuideInline` is a string or a link with no emphasis variant, and adding one
 * would be extending the system to preserve bold. No block quote, so no
 * `callout`.
 *
 * `summary` and `deck` are the approved meta description -- no separate summary
 * was supplied, and reusing approved copy beats inventing a sentence.
 *
 * `related` names the closing section's two in its order, then the four the
 * body introduced earlier. Seven approved links in the body: all six other
 * guides and the Safety Centre. With this article every guide links to every
 * other, and the cluster is finished rather than merely closed. No image:
 * Eraya owns no artwork for it.
 */
export const datingAppsVsMatrimonyAfterDivorce: Guide = {
  slug: "dating-apps-vs-matrimony-after-divorce",
  status: "published",

  title: "Dating Apps vs Matrimony After Divorce: Which Is Right for You?",
  seoTitle: "Dating Apps vs Matrimony After Divorce: What’s the Difference?",
  description:
    "Dating again after divorce? Understand how dating apps and matrimony platforms differ, what each is designed for and which approach may fit what you want next.",
  summary:
    "Dating again after divorce? Understand how dating apps and matrimony platforms differ, what each is designed for and which approach may fit what you want next.",
  deck: "Dating again after divorce? Understand how dating apps and matrimony platforms differ, what each is designed for and which approach may fit what you want next.",

  category: "relationships",
  author: { kind: "organization" },
  publishedOn: "2026-09-28",

  related: [
    "how-to-start-dating-after-divorce",
    "dating-after-divorce-india",
    "dating-after-separation-india",
    "dating-after-divorce-with-kids",
    "when-to-date-after-divorce",
    "online-dating-safety-after-divorce",
  ],
  cta: "join",

  body: [
    {
      kind: "paragraph",
      content: [
        "After divorce, deciding that you want to meet someone new is one decision.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Deciding how you want to meet them is another."],
    },
    {
      kind: "paragraph",
      content: [
        "In India, that choice often seems to come down to two familiar options: dating apps or matrimony platforms.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They can look similar from the outside. Both let you create a profile, discover people and begin conversations.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But they are usually built around very different assumptions about why two people are meeting.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A dating app may begin with attraction or conversation and leave the destination open.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A matrimony platform generally begins with marriage as the expected destination.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Neither approach automatically produces better relationships.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The useful question is what kind of connection you want to explore now.",
      ],
    },

    {
      kind: "heading",
      text: "Dating and matrimony start with different expectations",
    },
    {
      kind: "paragraph",
      content: ["The biggest difference isn't the profile format."],
    },
    {
      kind: "paragraph",
      content: ["It's the expectation behind the introduction."],
    },
    {
      kind: "paragraph",
      content: [
        "On a dating platform, two people may begin talking without knowing exactly where the relationship will lead.",
      ],
    },
    {
      kind: "paragraph",
      content: ["They might eventually want a committed relationship."],
    },
    { kind: "paragraph", content: ["They might eventually marry."] },
    {
      kind: "paragraph",
      content: [
        "Or they may discover that they aren't compatible and move on.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Matrimony generally reverses that process."],
    },
    {
      kind: "paragraph",
      content: [
        "Marriage is usually established as the objective first, and the people involved then explore whether they could be suitable partners for it.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "That difference can affect almost every conversation that follows.",
      ],
    },

    { kind: "heading", text: "Divorce can change what you're looking for" },
    {
      kind: "paragraph",
      content: [
        "What you wanted before your first marriage may not be what you want now.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Perhaps you eventually want to marry again."],
    },
    { kind: "paragraph", content: ["Perhaps you don't."] },
    {
      kind: "paragraph",
      content: [
        "You may want companionship without immediately planning another wedding.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may want a committed relationship but need considerable time before thinking about marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Or you may genuinely be ready to find another spouse."],
    },
    {
      kind: "paragraph",
      content: [
        "None of those answers is inherently more serious than another.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The important part is knowing enough about what you want to choose an environment where other people's expectations are reasonably compatible with yours.",
      ],
    },

    { kind: "heading", text: "Dating apps leave more of the destination open" },
    {
      kind: "paragraph",
      content: [
        "Dating platforms generally allow the relationship to define itself over time.",
      ],
    },
    { kind: "paragraph", content: ["That can be valuable after divorce."] },
    { kind: "paragraph", content: ["Instead of beginning with:"] },
    { kind: "paragraph", content: ["“Could I marry this person?”"] },
    { kind: "paragraph", content: ["you may have space to ask:"] },
    {
      kind: "paragraph",
      content: ["“Do I actually enjoy talking to this person?”"],
    },
    { kind: "paragraph", content: ["“Do I feel comfortable around them?”"] },
    { kind: "paragraph", content: ["“Are we compatible?”"] },
    { kind: "paragraph", content: ["“Do I want to see them again?”"] },
    {
      kind: "paragraph",
      content: ["Marriage can still become part of the relationship later."],
    },
    {
      kind: "paragraph",
      content: [
        "It simply doesn't have to be the premise of the first conversation.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "For somebody who isn't yet certain whether they want to remarry, that flexibility may matter.",
      ],
    },

    { kind: "heading", text: "Matrimony makes the intention clearer" },
    {
      kind: "paragraph",
      content: [
        "For somebody who knows they want another marriage, a matrimony platform can offer a different advantage.",
      ],
    },
    {
      kind: "paragraph",
      content: ["The purpose of being there is usually understood."],
    },
    {
      kind: "paragraph",
      content: [
        "You may not need several conversations to discover whether the other person is even open to marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Profiles can also contain information that people or families commonly consider when evaluating marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: ["That clarity can reduce one kind of uncertainty."],
    },
    {
      kind: "paragraph",
      content: [
        "But shared intention doesn't automatically mean compatibility.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Two people can both want marriage and still want very different marriages.",
      ],
    },

    { kind: "heading", text: "Family involvement can be different" },
    {
      kind: "paragraph",
      content: [
        "In India, matrimony often involves more than the two people whose profiles are being viewed.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Parents or relatives may create profiles, manage conversations or become involved relatively early.",
      ],
    },
    { kind: "paragraph", content: ["For some people, that is useful."] },
    {
      kind: "paragraph",
      content: [
        "They may value their family's participation and want a process where family compatibility matters from the beginning.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "For others, especially after divorce, that may feel like returning immediately to a process they aren't ready to repeat.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Dating platforms usually place the initial interaction more directly between the two people.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Families may become involved later if the relationship becomes serious.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Neither structure is universally preferable."],
    },
    {
      kind: "paragraph",
      content: [
        "The question is how much family involvement you want and when you want it.",
      ],
    },

    { kind: "heading", text: "Matrimony profiles may ask different questions" },
    {
      kind: "paragraph",
      content: [
        "The information emphasised on matrimony platforms can be different from what you encounter on dating platforms.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Depending on the platform and the people using it, profiles may focus on factors such as education, occupation, family background, income, religion, community or marriage preferences.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Dating profiles tend to focus more heavily on the individual: photographs, interests, personality, lifestyle and what kind of connection they are seeking.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Those are broad patterns rather than rules."],
    },
    { kind: "paragraph", content: ["Different services work differently."] },
    {
      kind: "paragraph",
      content: [
        "But the information a platform asks for often tells you something about the decisions it expects people to make there.",
      ],
    },

    {
      kind: "heading",
      text: "After divorce, you may not want to become a biodata again",
    },
    {
      kind: "paragraph",
      content: ["Divorce can change how it feels to be evaluated."],
    },
    {
      kind: "paragraph",
      content: [
        "You may have already experienced a marriage process where family background, profession, income or social expectations played a large role.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Starting again may make you want something different."],
    },
    {
      kind: "paragraph",
      content: [
        "You may want somebody to discover who you are now rather than first deciding whether your circumstances fit a checklist.",
      ],
    },
    {
      kind: "paragraph",
      content: ["That doesn't make practical compatibility irrelevant."],
    },
    {
      kind: "paragraph",
      content: [
        "Finances, family, children, location, values and future plans can become important in any serious relationship.",
      ],
    },
    {
      kind: "paragraph",
      content: ["The difference is when those questions become central."],
    },
    {
      kind: "paragraph",
      content: [
        "You may prefer to establish a human connection before turning the relationship into a compatibility exercise.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Or you may prefer the clarity of addressing those questions immediately.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Knowing which feels more natural to you can help you choose where to spend your time.",
      ],
    },

    { kind: "heading", text: "Relationship status matters on either platform" },
    {
      kind: "paragraph",
      content: [
        "Whether you're using dating or matrimony, be accurate about your relationship status.",
      ],
    },
    { kind: "paragraph", content: ["Divorced means divorced."] },
    { kind: "paragraph", content: ["Separated means separated."] },
    { kind: "paragraph", content: ["Widowed means widowed."] },
    {
      kind: "paragraph",
      content: [
        "If your divorce isn't legally final, don't present yourself as divorced simply because the marriage has ended emotionally.",
      ],
    },
    {
      kind: "paragraph",
      content: ["That distinction may matter to the person you're meeting."],
    },
    {
      kind: "paragraph",
      content: [
        "If you're currently separated, our guide to ",
        {
          text: "dating after separation in India",
          href: "/guides/dating-after-separation-india",
        },
        " explores that situation in more detail.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Honesty isn't only about avoiding misunderstandings."],
    },
    {
      kind: "paragraph",
      content: [
        "It allows another person to make an informed decision about whether your circumstances fit what they're comfortable with.",
      ],
    },

    {
      kind: "heading",
      text: "Having children may affect what you're looking for",
    },
    {
      kind: "paragraph",
      content: [
        "Parents often have considerations that didn't exist before their first marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may need somebody who understands that your children are a permanent part of your life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may have custody schedules or parenting responsibilities that limit spontaneity.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may not want somebody new to meet your children until the relationship is established.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And if you're considering remarriage, questions about future family life can become especially important.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Neither a dating app nor a matrimony platform solves those questions for you.",
      ],
    },
    {
      kind: "paragraph",
      content: ["They need to be discussed between the people involved."],
    },
    {
      kind: "paragraph",
      content: [
        "If you're navigating this part of starting again, see ",
        {
          text: "dating after divorce with kids",
          href: "/guides/dating-after-divorce-with-kids",
        },
        ".",
      ],
    },

    { kind: "heading", text: "Don't confuse detailed profiles with certainty" },
    {
      kind: "paragraph",
      content: [
        "A matrimony profile may contain extensive information about somebody.",
      ],
    },
    { kind: "paragraph", content: ["A dating profile may contain much less."] },
    {
      kind: "paragraph",
      content: [
        "Neither tells you what being in a relationship with that person will actually feel like.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A list of qualifications cannot show you how somebody behaves during disagreement.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A photograph cannot tell you whether somebody respects boundaries.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A carefully written bio cannot tell you whether their actions consistently match their words.",
      ],
    },
    { kind: "paragraph", content: ["Profiles are introductions."] },
    {
      kind: "paragraph",
      content: ["Compatibility becomes visible through interaction over time."],
    },

    {
      kind: "heading",
      text: "Don't confuse chemistry with compatibility either",
    },
    {
      kind: "paragraph",
      content: ["Dating platforms can create the opposite problem."],
    },
    {
      kind: "paragraph",
      content: ["A conversation may feel exciting immediately."],
    },
    { kind: "paragraph", content: ["You may find somebody attractive."] },
    {
      kind: "paragraph",
      content: ["Messages may continue late into the night."],
    },
    { kind: "paragraph", content: ["That chemistry can be enjoyable."] },
    {
      kind: "paragraph",
      content: ["It still doesn't answer every important question."],
    },
    { kind: "paragraph", content: ["How does this person handle conflict?"] },
    { kind: "paragraph", content: ["What do they want from a relationship?"] },
    {
      kind: "paragraph",
      content: [
        "How do they think about money, children, family or commitment?",
      ],
    },
    { kind: "paragraph", content: ["Are your everyday lives compatible?"] },
    {
      kind: "paragraph",
      content: ["Dating gives those questions time to emerge."],
    },
    { kind: "paragraph", content: ["It doesn't make them unnecessary."] },

    {
      kind: "heading",
      text: "You don't have to decide about remarriage before you start dating",
    },
    {
      kind: "paragraph",
      content: ["This distinction can be especially useful after divorce."],
    },
    {
      kind: "paragraph",
      content: [
        "You can be ready to meet somebody without being ready to decide whether you'll ever marry again.",
      ],
    },
    { kind: "paragraph", content: ["Dating isn't a promise of remarriage."] },
    {
      kind: "paragraph",
      content: [
        "It is an opportunity to learn about another person and about yourself in relationships now.",
      ],
    },
    { kind: "paragraph", content: ["Your answer may change."] },
    {
      kind: "paragraph",
      content: [
        "You may begin believing you never want another marriage and later meet somebody with whom marriage feels meaningful.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may begin expecting to remarry and later realise that companionship without marriage suits you better.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You are allowed to discover the answer rather than declare it before meeting anybody.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you're still deciding whether you're ready to begin at all, read ",
        {
          text: "when should you start dating after divorce?",
          href: "/guides/when-to-date-after-divorce",
        },
        ".",
      ],
    },

    { kind: "heading", text: "If you know you want remarriage, say so" },
    {
      kind: "paragraph",
      content: [
        "Keeping the destination open doesn't mean hiding your intentions.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If marriage is important to you, saying that early can save both people time.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can be clear without turning the first conversation into an interview.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Likewise, if you know you don't want to remarry, don't allow somebody to build a relationship under the assumption that marriage is where it is heading.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Clarity doesn't require certainty about the person."],
    },
    { kind: "paragraph", content: ["It requires honesty about yourself."] },

    {
      kind: "heading",
      text: "Second marriage doesn't need to repeat the first process",
    },
    {
      kind: "paragraph",
      content: [
        "Wanting to marry again doesn't mean you have to find your next partner in exactly the same way you found your previous one.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You might meet through a matrimony platform."],
    },
    {
      kind: "paragraph",
      content: ["You might meet through a dating or relationship platform."],
    },
    {
      kind: "paragraph",
      content: [
        "You might meet through friends, work, family, hobbies or ordinary life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The method of introduction doesn't determine how serious the eventual relationship becomes.",
      ],
    },
    {
      kind: "paragraph",
      content: ["A relationship that begins casually can become a marriage."],
    },
    {
      kind: "paragraph",
      content: [
        "A conversation begun specifically for marriage can end after one meeting.",
      ],
    },
    { kind: "paragraph", content: ["The platform creates the introduction."] },
    {
      kind: "paragraph",
      content: ["The people determine what happens afterwards."],
    },

    {
      kind: "heading",
      text: "You can use more than one way of meeting people",
    },
    {
      kind: "paragraph",
      content: [
        "Choosing one approach doesn't necessarily mean permanently rejecting the other.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may decide to explore a relationship-focused platform while remaining open to introductions through family.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may try matrimony and discover that the process doesn't suit what you want right now.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You may step away from apps entirely for a while."],
    },
    {
      kind: "paragraph",
      content: [
        "There is no requirement to commit to a method simply because you created a profile.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Pay attention to how the experience affects you."],
    },
    {
      kind: "paragraph",
      content: [
        "If a platform repeatedly makes you feel pressured into decisions you're not ready to make, it may not be the right environment for you at this stage.",
      ],
    },

    { kind: "heading", text: "Whatever platform you use, move carefully" },
    {
      kind: "paragraph",
      content: [
        "The label on the service doesn't make the people using it automatically trustworthy.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A profile on a matrimony platform can still contain misleading information.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A person on a dating platform can still misrepresent their relationship status, intentions or identity.",
      ],
    },
    { kind: "paragraph", content: ["The same basic precautions apply."] },
    { kind: "paragraph", content: ["Protect sensitive personal information."] },
    {
      kind: "paragraph",
      content: ["Don't share banking credentials, OTPs or passwords."],
    },
    {
      kind: "paragraph",
      content: ["Don't send money to somebody you've recently met online."],
    },
    {
      kind: "paragraph",
      content: ["Meet in public when meeting for the first time."],
    },
    {
      kind: "paragraph",
      content: ["Maintain your own transportation where possible."],
    },
    {
      kind: "paragraph",
      content: ["Tell somebody you trust where you're going."],
    },
    {
      kind: "paragraph",
      content: [
        "And let trust develop through consistent behaviour rather than through the seriousness implied by the platform.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "For more detailed precautions, read ",
        {
          text: "online dating safety after divorce",
          href: "/guides/online-dating-safety-after-divorce",
        },
        " and Eraya's ",
        { text: "Safety Centre", href: "/safety" },
        ".",
      ],
    },

    {
      kind: "heading",
      text: "Ask yourself what you want the first conversation to mean",
    },
    {
      kind: "paragraph",
      content: [
        "One way to think about the difference is to imagine meeting somebody interesting tomorrow.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Would you prefer the first conversation to begin with the understanding that both of you are evaluating marriage?",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Or would you rather begin by discovering whether you enjoy knowing each other and decide what the relationship means later?",
      ],
    },
    {
      kind: "paragraph",
      content: ["Your answer doesn't need to be permanent."],
    },
    {
      kind: "paragraph",
      content: ["It only needs to reflect where you are now."],
    },

    {
      kind: "heading",
      text: "There is another possibility between casual dating and matrimony",
    },
    {
      kind: "paragraph",
      content: [
        "Sometimes the choice is presented as though there are only two options.",
      ],
    },
    { kind: "paragraph", content: ["Casual dating on one side."] },
    {
      kind: "paragraph",
      content: ["Marriage-focused matrimony on the other."],
    },
    {
      kind: "paragraph",
      content: ["But many adults after divorce want something between them."],
    },
    {
      kind: "paragraph",
      content: ["They aren't looking for endless casual encounters."],
    },
    {
      kind: "paragraph",
      content: [
        "They also don't want every introduction to begin as an evaluation for marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They want to meet people who understand that relationships can develop gradually while still being meaningful.",
      ],
    },
    { kind: "paragraph", content: ["That space matters."] },
    {
      kind: "paragraph",
      content: [
        "A person can be serious about connection without already being committed to its destination.",
      ],
    },

    {
      kind: "heading",
      text: "Choose the environment that matches your current chapter",
    },
    {
      kind: "paragraph",
      content: [
        "After divorce, starting again doesn't have to mean recreating the path that led to your first marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: ["And it doesn't require rejecting marriage either."],
    },
    { kind: "paragraph", content: ["You may know exactly what you want."] },
    { kind: "paragraph", content: ["You may still be discovering it."] },
    { kind: "paragraph", content: ["Either is a reasonable place to begin."] },
    {
      kind: "paragraph",
      content: [
        "If you're ready to meet people but aren't sure how to start, read ",
        {
          text: "how to start dating again after divorce",
          href: "/guides/how-to-start-dating-after-divorce",
        },
        ".",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "For a broader look at beginning again, see ",
        {
          text: "dating after divorce in India",
          href: "/guides/dating-after-divorce-india",
        },
        ".",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The most useful platform is not necessarily the one with the most profiles or the strongest promise.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It's the one whose expectations give you room to build the kind of relationship you're actually open to.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Eraya is designed for divorced, separated and widowed adults in India who want meaningful connections without assuming that every introduction must immediately become a marriage proposal.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't need to decide the ending before you've met the person.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Know what you're open to. Be clear about it. Let the relationship show you what comes next.",
      ],
    },
  ],
};
