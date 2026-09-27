import type { Guide } from "../types";

/**
 * Eraya's first guide, published 2026-09-27.
 *
 * The prose is approved copy, transcribed rather than written here: it is the
 * article as it was handed over, converted into blocks and not edited. Two
 * things were added on instruction and are the only text in this file that did
 * not arrive with the article -- the sentence linking to the community and
 * safety guidelines at the end of the meeting-in-person section, which was
 * asked for as a natural internal link rather than a bare URL. Everything else
 * is verbatim, including the em dashes and the one-sentence paragraphs, which
 * are the article's own rhythm and not an accident of conversion.
 *
 * `seoTitle` is absent on purpose. The approved SEO title and the approved H1
 * are the same sentence, and `guideTitle()` falls back to `title` -- naming it
 * twice would create two copies of one string to drift apart. The root layout's
 * `%s — Eraya` template appends the brand, as it does on every other page.
 *
 * `deck` is the approved summary. The article opens straight into its first
 * paragraph and carries no separate standfirst, so rather than invent one, the
 * approved summary does that job as well as the card's.
 *
 * No `image`: Eraya owns no artwork for this article, and the Open Graph card
 * falls back to the approved site card in `guideMetadata`. No stock photograph
 * was going to be added for SEO's sake.
 *
 * `related` is empty because nothing else is published yet. The six remaining
 * planned guides are targets in `docs/13-seo.md`, and this file should gain
 * their slugs as they land rather than naming them now -- `relatedGuides()`
 * drops unpublished slugs silently, but an article claiming relatives that do
 * not exist is a lie told in source rather than in HTML.
 */
export const datingAfterDivorceIndia: Guide = {
  slug: "dating-after-divorce-india",
  status: "published",

  title:
    "Dating After Divorce in India: A Thoughtful Guide to Starting Again",
  description:
    "Starting to date after divorce in India can feel complicated. Learn how to move forward at your own pace, meet people safely, set boundaries and build meaningful connections again.",
  summary:
    "A thoughtful guide to dating after divorce in India — from deciding when you're ready to setting boundaries, meeting safely and building meaningful connections at your own pace.",
  deck: "A thoughtful guide to dating after divorce in India — from deciding when you're ready to setting boundaries, meeting safely and building meaningful connections at your own pace.",

  category: "relationships",
  author: { kind: "organization" },
  publishedOn: "2026-09-27",

  related: [],
  cta: "join",

  body: [
    {
      kind: "paragraph",
      content: [
        "Dating after divorce can change more than a relationship. It can change your routines, friendships, family dynamics, confidence and even the way you imagine your future.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And when you eventually think about meeting someone again, the experience may feel very different from dating earlier in life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may have children now. You may be more careful about whom you trust. Your family may have opinions. You may not even be looking for marriage—you might simply want companionship, conversation or the possibility of building something meaningful with another person.",
      ],
    },
    {
      kind: "paragraph",
      content: ["There is no single correct way to begin again."],
    },
    {
      kind: "paragraph",
      content: [
        "Dating after divorce isn't about replacing what ended. It is about discovering what you want the next chapter of your life to look like.",
      ],
    },

    { kind: "heading", text: "When should you start dating after divorce?" },
    { kind: "paragraph", content: ["There is no universal waiting period."] },
    {
      kind: "paragraph",
      content: [
        "Some people feel ready relatively soon after a relationship ends. Others need considerably more time. Neither timeline automatically means someone is more or less ready.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Instead of counting months, it can be more useful to ask yourself a few questions:",
      ],
    },
    {
      kind: "list",
      items: [
        [
          "Am I interested in knowing someone new, rather than simply trying to escape loneliness?",
        ],
        [
          "Can I talk about my previous relationship without every conversation becoming about my former partner?",
        ],
        [
          "Am I comfortable being alone while I wait for the right connection?",
        ],
        [
          "Do I have some idea of what I want—and what I don't want—from another relationship?",
        ],
        [
          "Can I accept that meeting someone new may involve disappointment as well as excitement?",
        ],
      ],
    },
    { kind: "paragraph", content: ["You don't need perfect answers."] },
    {
      kind: "paragraph",
      content: [
        "Being ready can simply mean feeling curious about meeting people again without believing that a new relationship has to immediately fix something in your life.",
      ],
    },

    { kind: "heading", text: "Dating after divorce in India can feel different" },
    {
      kind: "paragraph",
      content: [
        "Dating after divorce can carry additional complexities in India.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Family expectations may still play a large role in personal relationships. Divorce can carry social stigma in some families or communities. People with children may need to think carefully about when—and whether—to introduce a new partner.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "There is also an awkward gap between conventional matrimony and mainstream dating.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Matrimonial platforms can sometimes feel too focused on marriage from the beginning, while swipe-based dating apps can feel too casual for someone who wants to take their time.",
      ],
    },
    {
      kind: "paragraph",
      content: ["But those aren't the only two choices."],
    },
    {
      kind: "paragraph",
      content: [
        "You can look for conversation, friendship, companionship, dating or a serious relationship without deciding the entire future of that connection before you've even met the person.",
      ],
    },

    { kind: "heading", text: "Decide what you're looking for now" },
    {
      kind: "paragraph",
      content: [
        "What you wanted before your marriage may not be what you want today.",
      ],
    },
    { kind: "paragraph", content: ["That is perfectly reasonable."] },
    {
      kind: "paragraph",
      content: [
        "Before creating a profile or meeting people, think about what would actually add something positive to your life.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Maybe you want a long-term relationship."],
    },
    { kind: "paragraph", content: ["Maybe you eventually want to remarry."] },
    {
      kind: "paragraph",
      content: ["Maybe marriage isn't something you're thinking about at all."],
    },
    {
      kind: "paragraph",
      content: [
        "Maybe you simply miss having someone to talk to, go out with or share parts of your life with.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Being clear with yourself makes it easier to be honest with another person.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't need to arrive with a five-year plan. You only need enough clarity to avoid pretending you want something that you don't.",
      ],
    },

    {
      kind: "heading",
      text: "Your divorce is part of your story, not your entire identity",
    },
    {
      kind: "paragraph",
      content: [
        "When divorced people meet each other, conversations about previous relationships are natural.",
      ],
    },
    { kind: "paragraph", content: ["They can also become overwhelming."] },
    {
      kind: "paragraph",
      content: [
        "You don't have to explain your entire marriage on the first conversation or first date. Share what feels relevant when trust develops.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "At the same time, try not to make every interaction a comparison with your former partner.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A new person deserves the opportunity to be known as themselves—and so do you.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You are not simply someone's ex-husband or ex-wife. Your interests, humour, ambitions, friendships, responsibilities and personality still matter.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A good connection should gradually discover those parts of you too.",
      ],
    },

    { kind: "heading", text: "Be honest about your relationship status" },
    {
      kind: "paragraph",
      content: [
        "Honesty matters particularly when separation and divorce are involved.",
      ],
    },
    { kind: "paragraph", content: ["If you are divorced, say so."] },
    {
      kind: "paragraph",
      content: [
        "If you are separated but the divorce is not legally complete, be clear about that too.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "People may have different comfort levels around dating someone who is separated, and giving them accurate information allows both of you to make informed decisions.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The same principle applies to children, although you don't need to publish private details about them.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Someone considering a serious relationship with you should eventually understand that being a parent is part of your life.",
      ],
    },

    { kind: "heading", text: "Dating after divorce when you have children" },
    {
      kind: "paragraph",
      content: [
        "Having children doesn't prevent you from building another relationship, but it can change how you approach one.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may have less free time. Your decisions can affect more people. And you may understandably be more cautious about bringing somebody new into your family's life.",
      ],
    },
    {
      kind: "paragraph",
      content: ["There is rarely a reason to rush introductions."],
    },
    {
      kind: "paragraph",
      content: [
        "First determine whether the relationship itself has stability and potential.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Until then, protecting your children's privacy is sensible. Avoid sharing unnecessary information such as their school, daily routine, exact locations or other details with someone you've only recently met online.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Dating can progress gradually without immediately becoming part of your children's world.",
      ],
    },

    { kind: "heading", text: "Don't mistake intensity for compatibility" },
    {
      kind: "paragraph",
      content: ["Starting again can make attention feel unusually powerful."],
    },
    {
      kind: "paragraph",
      content: [
        "Someone messaging constantly, expressing strong feelings immediately or talking about a future together after only a few conversations can feel exciting.",
      ],
    },
    {
      kind: "paragraph",
      content: ["But intensity isn't necessarily intimacy."],
    },
    {
      kind: "paragraph",
      content: ["Compatibility usually becomes clearer over time."],
    },
    {
      kind: "paragraph",
      content: [
        "Notice how someone behaves when you disagree. Whether they respect a boundary. Whether their actions match their words. Whether they are interested in understanding your life rather than simply impressing you.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't have to accelerate a relationship because the other person wants to.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Someone genuinely interested in building a healthy connection should be able to respect your pace.",
      ],
    },

    {
      kind: "heading",
      text: "Set boundaries without feeling guilty about them",
    },
    {
      kind: "paragraph",
      content: [
        "One advantage of starting again is that you probably understand your boundaries better than you did before.",
      ],
    },
    { kind: "paragraph", content: ["Use that knowledge."] },
    {
      kind: "paragraph",
      content: [
        "A boundary might mean refusing to share your phone number immediately. It might mean wanting several conversations before meeting. It might mean not discussing finances early in a relationship.",
      ],
    },
    {
      kind: "paragraph",
      content: ["It can also mean deciding what behaviour you will not accept."],
    },
    {
      kind: "paragraph",
      content: ["You don't need an elaborate explanation for every boundary."],
    },
    {
      kind: "paragraph",
      content: [
        "A respectful person may ask about it, but they shouldn't repeatedly pressure you to abandon it.",
      ],
    },

    { kind: "heading", text: "Be careful with money" },
    {
      kind: "paragraph",
      content: [
        "Financial requests deserve particular caution when meeting people online.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Do not send money to someone simply because you have developed an emotional connection with them.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Be cautious when someone you've never met—or barely know—suddenly has an emergency, investment opportunity, medical expense or other reason they need financial help.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can care about somebody without giving them access to your money.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Trust should develop through consistent behaviour over time, not through financial pressure.",
      ],
    },

    {
      kind: "heading",
      text: "Take online connections into the real world carefully",
    },
    {
      kind: "paragraph",
      content: [
        "If you decide to meet somebody you've been speaking with online, choose a public place for the first meeting.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Tell someone you trust where you're going."],
    },
    {
      kind: "paragraph",
      content: [
        "Arrange your own transport when possible, and avoid becoming dependent on the other person to get home.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You also don't need to share your home address immediately."],
    },
    {
      kind: "paragraph",
      content: [
        "These precautions aren't a judgment about the person you're meeting. They're simply sensible practices when two people who previously knew each other online meet in person.",
      ],
    },
    {
      /*
       * The internal link, added on instruction rather than transcribed. It is a
       * sentence rather than a bare URL dropped into the prose, and the anchor
       * text names the document it leads to -- "community and safety guidelines"
       * is what the page at /safety is actually called, so the link says where it
       * goes without the reader having to hover it.
       */
      kind: "paragraph",
      content: [
        "Eraya's ",
        { text: "community and safety guidelines", href: "/safety" },
        " cover meeting someone for the first time in more detail.",
      ],
    },

    { kind: "heading", text: "Look beyond the profile" },
    {
      kind: "paragraph",
      content: [
        "Profiles are useful introductions, but people cannot be reduced to a checklist.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Age, city, language, religion and relationship status may matter to you. But long-term compatibility often becomes visible through things that are harder to filter.",
      ],
    },
    { kind: "paragraph", content: ["How does the person communicate?"] },
    { kind: "paragraph", content: ["Do they listen?"] },
    { kind: "paragraph", content: ["Can they disagree respectfully?"] },
    { kind: "paragraph", content: ["How do they speak about former partners?"] },
    { kind: "paragraph", content: ["Do they respect your responsibilities?"] },
    { kind: "paragraph", content: ["Can you be yourself around them?"] },
    {
      kind: "paragraph",
      content: [
        "A profile can help you decide whether to start a conversation. The conversation tells you much more.",
      ],
    },

    {
      kind: "heading",
      text: "Rejection may feel different the second time around",
    },
    {
      kind: "paragraph",
      content: ["Dating inevitably includes connections that don't work out."],
    },
    {
      kind: "paragraph",
      content: [
        "After divorce, rejection can sometimes touch insecurities left by the previous relationship.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Try not to interpret every unsuccessful conversation as evidence that something is wrong with you or that finding companionship again is impossible.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Two decent people can simply be wrong for each other."],
    },
    {
      kind: "paragraph",
      content: ["You are also allowed to be the person who says no."],
    },
    {
      kind: "paragraph",
      content: [
        "Ending a conversation respectfully when you don't feel a connection is better than continuing because you feel guilty.",
      ],
    },

    { kind: "heading", text: "You don't have to rush towards remarriage" },
    {
      kind: "paragraph",
      content: [
        "In India, conversations about relationships can quickly become conversations about marriage.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But dating after divorce does not have to begin with a wedding deadline.",
      ],
    },
    {
      kind: "paragraph",
      content: ["For some people, remarriage will eventually be the goal."],
    },
    {
      kind: "paragraph",
      content: ["For others, companionship may be enough."],
    },
    {
      kind: "paragraph",
      content: [
        "And some people won't know what they want until they meet someone with whom a future begins to feel possible.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Give yourself permission to discover the answer rather than deciding it because other people expect one.",
      ],
    },

    {
      kind: "heading",
      text: "Starting again can be quieter than starting over",
    },
    {
      kind: "paragraph",
      content: ["A new beginning doesn't have to be dramatic."],
    },
    {
      kind: "paragraph",
      content: ["Sometimes it starts with creating a profile."],
    },
    { kind: "paragraph", content: ["Sometimes it's replying to a message."] },
    {
      kind: "paragraph",
      content: [
        "Sometimes it's having coffee with somebody new and discovering that conversation feels easy again.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The goal isn't to recreate your old life with a different person.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It's to build whatever comes next with more knowledge about yourself, clearer boundaries and the freedom to move at your own pace.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Eraya was created for divorced, separated and widowed adults in India who are open to that next chapter.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "There is no pressure to define where a connection must lead before it begins. Start with the person, take your time and see what develops.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Every ending can be a new beginning."],
    },
  ],
};
