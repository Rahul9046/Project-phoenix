import type { Guide } from "../types";

/**
 * Eraya's fifth guide, published 2026-09-28.
 *
 * Approved copy, transcribed into blocks. Every formatting decision this
 * article needed had already been settled by Articles #2 to #4, and none of
 * them was reopened for it.
 *
 * **`seoTitle` is present, and it is the shorter of the two.** The approved
 * `h1` is "Dating After Separation in India: How to Start Again Before
 * Divorce" and the approved SEO title is "Dating After Separation in India: A
 * Practical Guide". Article #2 introduced the field for the opposite split --
 * a subtitle wanted in the title tag and not in the trail -- and it works the
 * same way here: `guideTitle` takes `seoTitle` for the `<title>`, while the
 * heading, the breadcrumb and the index card all read the `h1`.
 *
 * Standalone emphasis renders as ordinary paragraphs, which is Article #4's
 * precedent. `GuideInline` is a string or a link with no emphasis variant, and
 * adding one would be extending the Guides system rather than using it. So the
 * author's short lines -- the two questions under "There are two different
 * questions here:", the four under "A straightforward explanation is usually
 * enough:", the five precautions before the Safety Centre link -- are
 * paragraphs of their own, in the author's words and the author's order. Only
 * the weight is lost.
 *
 * There is no `list` block in this article, deliberately. Article #4's single
 * list was the author's own semicolon-separated series; this copy contains no
 * such series, and bulleting lines the author set as separate sentences would
 * impose a structure the copy does not have. There is no block quote either,
 * so no `callout` is used.
 *
 * `summary` and `deck` are the approved meta description -- no separate
 * summary was supplied, and reusing approved copy beats inventing a sentence.
 * The same decision as Article #4.
 *
 * This is the first guide to link to all four of the others, and `related`
 * names them in the order the closing section introduces them. The link to
 * Article #4 appears twice in the body, once where children first come up and
 * once at the close, because the approved copy places it in both. No image:
 * Eraya owns no artwork for it.
 */
export const datingAfterSeparationIndia: Guide = {
  slug: "dating-after-separation-india",
  status: "published",

  title: "Dating After Separation in India: How to Start Again Before Divorce",
  seoTitle: "Dating After Separation in India: A Practical Guide",
  description:
    "Dating after separation in India can feel complicated. Learn how to approach new relationships, boundaries, children, honesty and dating before your divorce is final.",
  summary:
    "Dating after separation in India can feel complicated. Learn how to approach new relationships, boundaries, children, honesty and dating before your divorce is final.",
  deck: "Dating after separation in India can feel complicated. Learn how to approach new relationships, boundaries, children, honesty and dating before your divorce is final.",

  category: "relationships",
  author: { kind: "organization" },
  publishedOn: "2026-09-28",

  related: [
    "when-to-date-after-divorce",
    "how-to-start-dating-after-divorce",
    "dating-after-divorce-india",
    "dating-after-divorce-with-kids",
  ],
  cta: "join",

  body: [
    {
      kind: "paragraph",
      content: ["Separation can put you in an unusual place."],
    },
    {
      kind: "paragraph",
      content: [
        "Your marriage may have ended emotionally, but your divorce may not be final. You may be living separately while still dealing with legal proceedings, finances, children or conversations between families.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And somewhere in the middle of all that, you may begin wondering whether you're ready to meet someone new.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Dating after separation in India can feel particularly complicated because the question isn't only whether you are ready.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "There may be legal uncertainty, family expectations, social judgement and practical questions about how to describe your relationship status to someone new.",
      ],
    },
    { kind: "paragraph", content: ["There is no need to rush."] },
    {
      kind: "paragraph",
      content: [
        "But separation also doesn't mean your personal life has to remain frozen indefinitely.",
      ],
    },

    { kind: "heading", text: "Separation and divorce are not the same thing" },
    { kind: "paragraph", content: ["The first distinction matters."] },
    {
      kind: "paragraph",
      content: [
        "Being separated from your spouse doesn't necessarily mean you're legally divorced.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may have been living apart for months or years while still legally married.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "That doesn't automatically tell you whether you should or shouldn't date.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But it does mean you should be clear about your actual situation.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Don't describe yourself as divorced if the divorce hasn't happened.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You can simply say that you're separated."],
    },
    {
      kind: "paragraph",
      content: [
        "The right person doesn't need a cleaner version of your story. They need an honest one.",
      ],
    },

    { kind: "heading", text: "Can you date while separated in India?" },
    { kind: "paragraph", content: ["There are two different questions here:"] },
    { kind: "paragraph", content: ["Are you personally ready to date?"] },
    { kind: "paragraph", content: ["and"] },
    {
      kind: "paragraph",
      content: [
        "Are there legal implications to dating while your marriage is still legally unresolved?",
      ],
    },
    { kind: "paragraph", content: ["Those shouldn't be confused."] },
    {
      kind: "paragraph",
      content: [
        "Indian family-law circumstances can vary considerably depending on the facts of the marriage, the proceedings involved and the personal laws that apply.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A new relationship may also become relevant to an ongoing dispute depending on the circumstances.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Eraya cannot tell you what dating would mean for your particular legal situation.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If your divorce, maintenance, custody or another matrimonial proceeding is ongoing and you're concerned that a new relationship could affect it, speak with a qualified family-law professional about your specific circumstances before making assumptions.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Legal uncertainty doesn't need to become relationship dishonesty.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Whatever your situation, someone you're dating should know that you're separated rather than divorced.",
      ],
    },

    {
      kind: "heading",
      text: "Ask yourself what the separation actually means",
    },
    {
      kind: "paragraph",
      content: ["Not every separation means the same thing."],
    },
    {
      kind: "paragraph",
      content: [
        "For some couples, separation is clearly the end of the marriage and divorce proceedings are simply taking time.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "For others, living apart may be temporary while they decide whether reconciliation is possible.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Before bringing somebody new into your life, try to be honest with yourself about where you stand.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If your spouse asked to reconcile tomorrow, would you seriously consider it?",
      ],
    },
    {
      kind: "paragraph",
      content: ["Are you still actively trying to repair the marriage?"],
    },
    {
      kind: "paragraph",
      content: [
        "Are you dating because you've accepted that the relationship has ended, or because you want relief from the uncertainty surrounding it?",
      ],
    },
    {
      kind: "paragraph",
      content: ["You don't need to have every part of your future resolved."],
    },
    {
      kind: "paragraph",
      content: [
        "But a new person shouldn't unknowingly enter a relationship in which the previous one is still being actively negotiated.",
      ],
    },

    {
      kind: "heading",
      text: "Don't use a new relationship to make the separation feel final",
    },
    {
      kind: "paragraph",
      content: ["Separation can create an uncomfortable emotional gap."],
    },
    {
      kind: "paragraph",
      content: [
        "The old relationship may be over, but your new life hasn't completely formed yet.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Meeting somebody can temporarily make that uncertainty disappear.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Suddenly there is excitement, attention and something to look forward to.",
      ],
    },
    {
      kind: "paragraph",
      content: ["That doesn't make the connection meaningless."],
    },
    {
      kind: "paragraph",
      content: [
        "But it is worth asking whether you genuinely want to know this person or whether you need the relationship to prove that you've moved on.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A new relationship doesn't have to certify that your marriage is finished.",
      ],
    },
    {
      kind: "paragraph",
      content: ["That decision needs to stand on its own."],
    },

    { kind: "heading", text: "Be honest about your status early" },
    {
      kind: "paragraph",
      content: [
        "You don't need to explain your entire marriage on the first message.",
      ],
    },
    {
      kind: "paragraph",
      content: ["But being separated is significant information."],
    },
    {
      kind: "paragraph",
      content: [
        "Don't wait until somebody is emotionally invested before mentioning that you're still legally married.",
      ],
    },
    {
      kind: "paragraph",
      content: ["A straightforward explanation is usually enough:"],
    },
    { kind: "paragraph", content: ["You're separated."] },
    { kind: "paragraph", content: ["Whether divorce proceedings have begun."] },
    {
      kind: "paragraph",
      content: ["Whether reconciliation remains a possibility."],
    },
    {
      kind: "paragraph",
      content: [
        "Whether you have children or other significant ongoing responsibilities connecting you to your spouse.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You don't owe a stranger every painful detail."],
    },
    {
      kind: "paragraph",
      content: [
        "But they should have enough information to decide whether they're comfortable continuing.",
      ],
    },
    { kind: "paragraph", content: ["Honesty gives both people a choice."] },

    { kind: "heading", text: "You don't have to defend your separation" },
    {
      kind: "paragraph",
      content: [
        "There is a difference between explaining your circumstances and putting yourself on trial.",
      ],
    },
    {
      kind: "paragraph",
      content: ["A new person may naturally want to understand what happened."],
    },
    {
      kind: "paragraph",
      content: ["You can answer at the level you're comfortable with."],
    },
    {
      kind: "paragraph",
      content: [
        "You don't need to produce evidence that your marriage was unhappy enough to justify leaving it.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And you don't need to turn every early conversation into a detailed account of what your spouse did wrong.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Over time, somebody close to you will naturally learn more about your past.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Early dating doesn't require your entire history at once."],
    },

    {
      kind: "heading",
      text: "Expect that some people won't be comfortable dating someone who is separated",
    },
    {
      kind: "paragraph",
      content: [
        "You can be completely ready for a relationship and still meet somebody who doesn't want to date until your divorce is final.",
      ],
    },
    {
      kind: "paragraph",
      content: ["That doesn't necessarily mean they are judging you."],
    },
    {
      kind: "paragraph",
      content: [
        "They may have personal boundaries around unresolved marriages.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They may have had a difficult previous experience with somebody who returned to their spouse.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Or they may simply want a situation with less uncertainty."],
    },
    {
      kind: "paragraph",
      content: [
        "Their boundary is allowed to exist alongside your decision to date.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Being transparent early helps both of you discover that difference before either person becomes deeply invested.",
      ],
    },

    {
      kind: "heading",
      text: "Family expectations may make separation feel less private in India",
    },
    {
      kind: "paragraph",
      content: [
        "Relationships in India often exist within a wider family context.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Parents, siblings and extended family members may know about the separation, have opinions about reconciliation or become involved in divorce discussions.",
      ],
    },
    { kind: "paragraph", content: ["Some may encourage you to move on."] },
    {
      kind: "paragraph",
      content: [
        "Others may believe you shouldn't meet anyone until the divorce is complete.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can listen to people you trust without allowing every relative to vote on your personal life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "At the same time, think carefully before introducing somebody you're only beginning to date into family conflict surrounding your separation.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A new relationship needs room to become a relationship before it becomes a family discussion.",
      ],
    },

    {
      kind: "heading",
      text: "Don't make a new partner responsible for your divorce",
    },
    { kind: "paragraph", content: ["Someone you're dating can support you."] },
    {
      kind: "paragraph",
      content: ["They shouldn't have to manage your separation."],
    },
    {
      kind: "paragraph",
      content: [
        "Try not to make them the messenger between you and your spouse, the person who negotiates family disagreements or the person responsible for pushing your divorce proceedings forward.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They also shouldn't have to constantly prove that choosing them was the correct decision.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your previous marriage and your new relationship are connected by your life, but they are still different relationships.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Keeping some separation between them gives the new one a better chance to develop on its own terms.",
      ],
    },

    { kind: "heading", text: "Be careful with comparisons" },
    {
      kind: "paragraph",
      content: [
        "After spending years with one person, comparison can happen automatically.",
      ],
    },
    { kind: "paragraph", content: ["Your new date communicates differently."] },
    { kind: "paragraph", content: ["They respond to conflict differently."] },
    {
      kind: "paragraph",
      content: [
        "They may give you attention you felt was missing from your marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Those differences can feel especially powerful during separation.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But being different from your spouse doesn't automatically make someone compatible with you.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Try to learn who the person actually is rather than viewing every quality through the contrast with your marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: ["The goal isn't to find the opposite of your former partner."],
    },
    {
      kind: "paragraph",
      content: ["It's to understand what works for you now."],
    },

    { kind: "heading", text: "Decide what you're actually looking for" },
    {
      kind: "paragraph",
      content: [
        "Dating doesn't have to mean you're searching for another marriage.",
      ],
    },
    { kind: "paragraph", content: ["You may want companionship."] },
    {
      kind: "paragraph",
      content: ["You may want a committed relationship eventually."],
    },
    {
      kind: "paragraph",
      content: [
        "You may simply want to meet people and discover what dating feels like at this stage of your life.",
      ],
    },
    {
      kind: "paragraph",
      content: ["All of those possibilities can be legitimate."],
    },
    {
      kind: "paragraph",
      content: [
        "Problems begin when two people are quietly expecting completely different things.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't need to know exactly where a relationship will lead.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But being honest about what you're currently open to can prevent unnecessary hurt.",
      ],
    },

    {
      kind: "heading",
      text: "Children can make separation and dating overlap",
    },
    {
      kind: "paragraph",
      content: [
        "If you have children, separation may already have changed their daily life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They may be adjusting to parents living apart, new routines, custody arrangements or uncertainty about whether their parents will reunite.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Introducing a new partner adds another change."],
    },
    { kind: "paragraph", content: ["That doesn't mean you can't date."] },
    {
      kind: "paragraph",
      content: [
        "It means your readiness to meet someone and your children's readiness to meet that person should be treated as separate decisions.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can keep early dating within your adult life while a relationship is still developing.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If it becomes serious enough to involve your children, move deliberately.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Our guide to ",
        {
          text: "dating after divorce with kids",
          href: "/guides/dating-after-divorce-with-kids",
        },
        " explores introductions, privacy, co-parenting and boundaries in more detail.",
      ],
    },

    { kind: "heading", text: "Don't involve children in secrecy" },
    {
      kind: "paragraph",
      content: [
        "If you're dating during separation, avoid asking your children to hide it from your spouse.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A child shouldn't have to decide what one parent is allowed to know about the other.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They also shouldn't become a source of information about your spouse's personal life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Whatever tension exists between the adults, children should not become messengers or investigators.",
      ],
    },

    {
      kind: "heading",
      text: "Protect your privacy while meeting people online",
    },
    {
      kind: "paragraph",
      content: [
        "Separation can make some personal information particularly sensitive.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Someone you've only recently met doesn't need immediate access to the details of your divorce proceedings, financial arrangements, home, children's routines or conflict with your spouse.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Share information gradually as trust develops."],
    },
    {
      kind: "paragraph",
      content: [
        "Be cautious if somebody quickly becomes intensely interested in your finances, settlement, property or other assets.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And when meeting someone from the internet for the first time, use the same practical precautions you would at any other stage of life.",
      ],
    },
    { kind: "paragraph", content: ["Meet somewhere public."] },
    { kind: "paragraph", content: ["Arrange your own transportation."] },
    {
      kind: "paragraph",
      content: ["Tell somebody you trust where you're going."],
    },
    { kind: "paragraph", content: ["Keep financial information private."] },
    {
      kind: "paragraph",
      content: [
        "Never send money because somebody you've recently met creates an urgent emotional story.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can also review Eraya's ",
        { text: "Safety Centre", href: "/safety" },
        " before meeting somebody you've connected with online.",
      ],
    },

    { kind: "heading", text: "Pay attention to emotional intensity" },
    {
      kind: "paragraph",
      content: [
        "A new relationship during separation can feel unusually powerful.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may be experiencing affection at the same time as grief, conflict or loneliness.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "That contrast can make a connection feel deeper very quickly.",
      ],
    },
    { kind: "paragraph", content: ["Enjoying that feeling isn't wrong."] },
    {
      kind: "paragraph",
      content: ["Just avoid treating intensity as proof of compatibility."],
    },
    { kind: "paragraph", content: ["Time still matters."] },
    {
      kind: "paragraph",
      content: [
        "Notice how the person handles boundaries, disappointment, disagreement and ordinary life—not only how connected you feel during emotionally charged moments.",
      ],
    },

    {
      kind: "heading",
      text: "Don't promise a future just to create certainty",
    },
    {
      kind: "paragraph",
      content: [
        "When the rest of your life feels uncertain, it can be tempting to make the new relationship certain very quickly.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You might begin discussing living together, marriage or long-term plans before you've had enough time to know each other.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Those conversations can feel reassuring."],
    },
    { kind: "paragraph", content: ["But promises don't remove uncertainty."] },
    {
      kind: "paragraph",
      content: [
        "Let the relationship develop based on what you learn about each other rather than what you need it to represent.",
      ],
    },

    { kind: "heading", text: "What if your divorce takes years?" },
    {
      kind: "paragraph",
      content: [
        "Legal proceedings don't always move at the pace of personal life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you know your marriage has ended but the formal process is taking a long time, you may decide that you don't want to postpone companionship indefinitely.",
      ],
    },
    { kind: "paragraph", content: ["That is a personal decision."] },
    {
      kind: "paragraph",
      content: [
        "What matters in a new relationship is that you don't hide the uncertainty.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Someone dating you should understand that you're still legally married, what stage the separation or divorce has reached, and any meaningful limitations that creates for the relationship.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you're unsure about the legal consequences of dating during that period, get advice specific to your circumstances rather than relying on assumptions from friends, social media or another person's divorce.",
      ],
    },

    { kind: "heading", text: "What if reconciliation becomes possible?" },
    {
      kind: "paragraph",
      content: [
        "This is one of the difficult realities of dating while separated.",
      ],
    },
    { kind: "paragraph", content: ["Sometimes circumstances change."] },
    {
      kind: "paragraph",
      content: [
        "If you genuinely begin considering reconciliation with your spouse, don't continue building another relationship while quietly deciding between two people.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Be honest with the person you're dating."],
    },
    {
      kind: "paragraph",
      content: [
        "They deserve to know that the situation they agreed to has changed.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may need space to decide what you actually want before continuing either relationship.",
      ],
    },
    { kind: "paragraph", content: ["Uncertainty is understandable."] },
    {
      kind: "paragraph",
      content: [
        "Keeping somebody inside uncertainty without telling them isn't.",
      ],
    },

    {
      kind: "heading",
      text: "You don't have to wait until life looks perfect",
    },
    {
      kind: "paragraph",
      content: [
        "There may never be a moment when every loose end is resolved.",
      ],
    },
    { kind: "paragraph", content: ["The divorce may still be proceeding."] },
    { kind: "paragraph", content: ["Your family may still have opinions."] },
    { kind: "paragraph", content: ["Your routine may still be changing."] },
    {
      kind: "paragraph",
      content: [
        "You may still occasionally feel sad about the marriage even though you know it has ended.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Being ready doesn't require becoming completely unaffected by your past.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A better question may be whether you have enough emotional space to become genuinely curious about somebody else's life rather than asking them to rescue you from your own.",
      ],
    },

    { kind: "heading", text: "Start small" },
    {
      kind: "paragraph",
      content: [
        "You don't need to decide whether you're ready for another lifelong relationship before having one conversation.",
      ],
    },
    { kind: "paragraph", content: ["You can start by meeting people."] },
    { kind: "paragraph", content: ["Talk."] },
    { kind: "paragraph", content: ["Have coffee."] },
    {
      kind: "paragraph",
      content: [
        "Notice how it feels to share parts of yourself with somebody new.",
      ],
    },
    { kind: "paragraph", content: ["If it feels overwhelming, slow down."] },
    {
      kind: "paragraph",
      content: [
        "If it feels like you're constantly thinking about your spouse while you're with someone else, you may need more time.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If it feels interesting, comfortable and increasingly grounded, you can keep exploring.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Starting again doesn't require knowing where the new beginning will lead.",
      ],
    },

    { kind: "heading", text: "Separation is a transition, not your identity" },
    {
      kind: "paragraph",
      content: [
        "Being separated can sometimes feel like living between labels.",
      ],
    },
    { kind: "paragraph", content: ["Not married in the way you once were."] },
    { kind: "paragraph", content: ["Not yet divorced."] },
    { kind: "paragraph", content: ["Not sure what comes next."] },
    {
      kind: "paragraph",
      content: [
        "But your relationship status doesn't need to become your entire identity.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You are allowed to have interests, friendships, ambitions and eventually relationships that aren't defined by the marriage you're leaving.",
      ],
    },
    { kind: "paragraph", content: ["Move carefully where you need to."] },
    {
      kind: "paragraph",
      content: ["Be honest where another person deserves honesty."],
    },
    {
      kind: "paragraph",
      content: [
        "And give yourself permission to discover what your life looks like next.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you're wondering whether you're emotionally ready, read ",
        {
          text: "when should you start dating after divorce?",
          href: "/guides/when-to-date-after-divorce",
        },
        ".",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you're ready to meet people but don't know where to begin, see ",
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
        "For the broader experience of beginning again, read ",
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
        "And if you're navigating parenthood as well, see ",
        {
          text: "dating after divorce with kids",
          href: "/guides/dating-after-divorce-with-kids",
        },
        ".",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't need to pretend the previous chapter is legally finished before acknowledging that your life is changing.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "What matters is approaching whatever comes next with honesty—to yourself and to the person you're inviting into it.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Move carefully. Be clear about where you stand. Let the next chapter begin when you're ready.",
      ],
    },
  ],
};
