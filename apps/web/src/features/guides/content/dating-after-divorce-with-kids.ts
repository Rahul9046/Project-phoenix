import type { Guide } from "../types";

/**
 * Eraya's fourth guide, published 2026-09-28.
 *
 * Approved copy, transcribed into blocks. The formatting decisions are the ones
 * Articles #2 and #3 settled and nothing here needed a new one.
 *
 * `seoTitle` is absent: the approved SEO title, the `h1` and the approved
 * breadcrumb are all "Dating After Divorce With Kids: A Practical Guide for
 * Parents", so naming it twice would only create two copies of one string to
 * drift apart. Article #2 needed the field because its title carried a subtitle
 * the breadcrumb did not; this one does not.
 *
 * Standalone bold lines render as ordinary paragraphs. `GuideInline` is a string
 * or a link with no emphasis variant, and adding one would be extending the
 * Guides system rather than using it -- so the author's short pivot lines
 * ("being ready to date", "a first meeting.") are paragraphs of their own, in
 * the author's words and the author's order. Only the weight is lost.
 *
 * The one `list` is the author's own semicolon-separated series under "Be
 * thoughtful about sharing:", which is the same shape as Article #3's and is
 * genuinely a list. The four reassurance lines under "A simple explanation may
 * be enough:" are deliberately *not* a list: the copy sets them as separate
 * lines, and bulleting them would impose structure the author did not write.
 * There is no block quote in this article, so no `callout` is used.
 *
 * `summary` and `deck` are the approved meta description -- no separate summary
 * was supplied, and reusing approved copy beats inventing a sentence.
 *
 * This is the first guide to link to all three of the others, and `related`
 * names them in the order the closing section introduces them. No image: Eraya
 * owns no artwork for it.
 */
export const datingAfterDivorceWithKids: Guide = {
  slug: "dating-after-divorce-with-kids",
  status: "published",

  title: "Dating After Divorce With Kids: A Practical Guide for Parents",
  description:
    "Dating after divorce with kids can feel complicated. Learn when to tell your children, when to introduce a new partner, set boundaries and move forward at a healthy pace.",
  summary:
    "Dating after divorce with kids can feel complicated. Learn when to tell your children, when to introduce a new partner, set boundaries and move forward at a healthy pace.",
  deck: "Dating after divorce with kids can feel complicated. Learn when to tell your children, when to introduce a new partner, set boundaries and move forward at a healthy pace.",

  category: "relationships",
  author: { kind: "organization" },
  publishedOn: "2026-09-28",

  related: [
    "when-to-date-after-divorce",
    "how-to-start-dating-after-divorce",
    "dating-after-divorce-india",
  ],
  cta: "join",

  body: [
    {
      kind: "paragraph",
      content: ["Dating after divorce can already feel unfamiliar."],
    },
    {
      kind: "paragraph",
      content: [
        "Dating after divorce when you have children adds another layer entirely.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You aren't only thinking about whether you like someone. You may also be wondering when to tell your children, when a new partner should meet them, how your former spouse might react and whether dating again will disrupt a life your children are still adjusting to.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It can sometimes feel as though every decision affects somebody else.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But being a parent doesn't mean your own need for companionship disappears.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can build a new relationship while still protecting the stability and emotional wellbeing of your children.",
      ],
    },
    { kind: "paragraph", content: ["The two don't have to compete."] },

    {
      kind: "heading",
      text: "Being ready to date and involving your children are two different decisions",
    },
    {
      kind: "paragraph",
      content: [
        "One of the most useful distinctions divorced parents can make is between:",
      ],
    },
    { kind: "paragraph", content: ["being ready to date"] },
    { kind: "paragraph", content: ["and"] },
    {
      kind: "paragraph",
      content: [
        "being ready to bring someone you're dating into your children's lives.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Those things don't need to happen at the same time."],
    },
    {
      kind: "paragraph",
      content: [
        "You can meet people, have conversations and go on dates without involving your children at all.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "In the early stages, you're still discovering whether you actually like the person yourself.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "There is little reason for your children to become emotionally involved in every connection you're exploring.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Let the relationship earn its place in your family life gradually.",
      ],
    },

    {
      kind: "heading",
      text: "You don't need your children's permission to date",
    },
    {
      kind: "paragraph",
      content: [
        "Children can have strong reactions when a parent begins dating again.",
      ],
    },
    { kind: "paragraph", content: ["Some may be curious."] },
    { kind: "paragraph", content: ["Some may be happy for you."] },
    {
      kind: "paragraph",
      content: [
        "Others may feel uncomfortable, angry or frightened that another person is going to replace their other parent.",
      ],
    },
    { kind: "paragraph", content: ["Their feelings deserve to be heard."] },
    {
      kind: "paragraph",
      content: [
        "But listening to those feelings doesn't mean asking your children to make adult relationship decisions for you.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A child shouldn't have to decide whether their mother or father is allowed to date.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You remain responsible for that decision."],
    },
    {
      kind: "paragraph",
      content: [
        "The goal is to give children space to express what they're feeling without giving them responsibility for managing your personal life.",
      ],
    },

    {
      kind: "heading",
      text: "Don't ask children to keep your dating life secret",
    },
    {
      kind: "paragraph",
      content: [
        "Divorce can already leave children feeling caught between parents.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Avoid putting them in the middle again."],
    },
    {
      kind: "paragraph",
      content: [
        "If you've started dating, don't ask your children to hide it from your former spouse.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Likewise, don't use your children to discover whether your ex is seeing someone.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Children shouldn't become messengers, investigators or keepers of adult secrets.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Whatever communication is necessary between co-parents should happen between the adults whenever possible.",
      ],
    },

    {
      kind: "heading",
      text: "You don't have to tell your children about every date",
    },
    {
      kind: "paragraph",
      content: [
        "Going on a date doesn't automatically require a family announcement.",
      ],
    },
    { kind: "paragraph", content: ["Early dating is uncertain by nature."] },
    {
      kind: "paragraph",
      content: ["You may meet someone once and never see them again."],
    },
    {
      kind: "paragraph",
      content: [
        "You may talk for several weeks and realise there isn't enough compatibility to continue.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If every early connection is introduced to your children, they may repeatedly experience people appearing and disappearing from their lives.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It is reasonable to keep early dating private while you work out whether a relationship has genuine potential.",
      ],
    },
    { kind: "paragraph", content: ["Privacy is different from secrecy."] },
    { kind: "paragraph", content: ["You aren't hiding something shameful."] },
    {
      kind: "paragraph",
      content: [
        "You're simply allowing an adult relationship to develop before involving your children.",
      ],
    },

    {
      kind: "heading",
      text: "When should you tell your children you're dating?",
    },
    { kind: "paragraph", content: ["There isn't one correct moment."] },
    {
      kind: "paragraph",
      content: [
        "Age, maturity, how long you've been separated, your relationship with your co-parent and how much your children already know will all affect the conversation.",
      ],
    },
    {
      kind: "paragraph",
      content: ["But you don't need to provide every detail."],
    },
    { kind: "paragraph", content: ["A simple explanation may be enough:"] },
    { kind: "paragraph", content: ["You're starting to meet new people."] },
    {
      kind: "paragraph",
      content: ["Nobody is replacing their mother or father."],
    },
    {
      kind: "paragraph",
      content: ["You still love them exactly as you did before."],
    },
    { kind: "paragraph", content: ["And nothing needs to change overnight."] },
    {
      kind: "paragraph",
      content: [
        "Children often need reassurance about what a new relationship doesn't mean before they can become curious about what it does mean.",
      ],
    },

    {
      kind: "heading",
      text: "When should your children meet a new partner?",
    },
    {
      kind: "paragraph",
      content: [
        "This is usually a more significant decision than telling them you're dating.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Before making an introduction, ask yourself what you actually know about the relationship.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Has it lasted beyond the initial excitement?"],
    },
    {
      kind: "paragraph",
      content: [
        "Have you seen how this person handles disagreement, frustration and boundaries?",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Have you discussed the fact that you have children and what role—if any—they might eventually have in their lives?",
      ],
    },
    {
      kind: "paragraph",
      content: ["Do you both see the relationship continuing?"],
    },
    {
      kind: "paragraph",
      content: [
        "There isn't a magic number of weeks or months that guarantees the right answer.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But introducing children very early can create emotional involvement before you know whether the relationship itself is stable.",
      ],
    },
    { kind: "paragraph", content: ["There is rarely a need to rush."] },

    {
      kind: "heading",
      text: "The first introduction doesn't need to be a major event",
    },
    {
      kind: "paragraph",
      content: [
        "If you decide it's time for your children to meet someone, keep the first meeting relatively simple.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It doesn't need to be a weekend trip, a family celebration or an elaborate day designed to make everybody bond.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A short meal, a walk or another relaxed activity can remove some of the pressure.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Your children don't need to immediately adore your partner."],
    },
    {
      kind: "paragraph",
      content: [
        "Your partner doesn't need to immediately become part of the family.",
      ],
    },
    { kind: "paragraph", content: ["The first meeting can simply be that:"] },
    { kind: "paragraph", content: ["a first meeting."] },
    {
      kind: "paragraph",
      content: ["Give relationships room to develop naturally."],
    },

    { kind: "heading", text: "Don't force affection" },
    { kind: "paragraph", content: ["You may be excited about someone new."] },
    { kind: "paragraph", content: ["Your children may not be."] },
    {
      kind: "paragraph",
      content: ["That doesn't automatically mean something is wrong."],
    },
    {
      kind: "paragraph",
      content: [
        "Children may need time to understand what the relationship means.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They may remain loyal to their other parent and worry that liking your partner somehow betrays them.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They may simply have a different personality from the person you're dating.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Avoid demanding affection or enthusiasm."],
    },
    {
      kind: "paragraph",
      content: ["Your child can be expected to behave respectfully."],
    },
    {
      kind: "paragraph",
      content: ["They don't need to feel a particular emotion on command."],
    },
    {
      kind: "paragraph",
      content: ["The same principle applies to your partner."],
    },
    {
      kind: "paragraph",
      content: [
        "A new partner shouldn't be expected to instantly love your children as though they have known them for years.",
      ],
    },
    { kind: "paragraph", content: ["Respect can come first."] },
    { kind: "paragraph", content: ["Closeness can develop later."] },

    { kind: "heading", text: "A new partner is not a replacement parent" },
    {
      kind: "paragraph",
      content: [
        "Children already have their own relationships with their parents.",
      ],
    },
    {
      kind: "paragraph",
      content: ["A new partner doesn't need to replace anybody."],
    },
    {
      kind: "paragraph",
      content: [
        "Trying to establish parental authority too quickly can create unnecessary conflict, particularly with older children.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Early on, discipline and major parenting decisions should generally remain with the child's parents or established caregivers.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your partner can become an important adult in your children's lives over time.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But that role should develop through trust rather than being assigned immediately because the adults are in a relationship.",
      ],
    },

    {
      kind: "heading",
      text: "Pay attention to how someone treats your role as a parent",
    },
    {
      kind: "paragraph",
      content: [
        "When you're dating with children, compatibility isn't only about chemistry between two adults.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Pay attention to how the person responds to the realities of your life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Do they become irritated when your children's needs change your plans?",
      ],
    },
    { kind: "paragraph", content: ["Do they expect to always come first?"] },
    {
      kind: "paragraph",
      content: [
        "Do they pressure you to introduce them before you're comfortable?",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Do they respect your parenting responsibilities and boundaries?",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Someone doesn't need to become deeply involved with your children immediately.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But they do need to respect the fact that being a parent is part of your life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your children aren't an inconvenience attached to the relationship.",
      ],
    },

    { kind: "heading", text: "Protect your children's privacy" },
    {
      kind: "paragraph",
      content: [
        "Getting to know somebody new doesn't mean they immediately need access to everything about your children.",
      ],
    },
    { kind: "paragraph", content: ["Be thoughtful about sharing:"] },
    {
      kind: "list",
      items: [
        ["your children's school;"],
        ["their daily routine;"],
        ["where they regularly spend time;"],
        ["private photographs;"],
        ["medical or emotional information; or"],
        ["details about when they may be home without you."],
      ],
    },
    {
      kind: "paragraph",
      content: [
        "This is particularly important when you've met somebody online and are still establishing who they are.",
      ],
    },
    { kind: "paragraph", content: ["Trust should grow gradually."] },
    {
      kind: "paragraph",
      content: [
        "The same online dating safety principles that apply to your own personal information matter even more when information about children is involved.",
      ],
    },

    {
      kind: "heading",
      text: "Be cautious with photographs of your children on dating profiles",
    },
    { kind: "paragraph", content: ["Your dating profile is about you."] },
    {
      kind: "paragraph",
      content: ["It doesn't need to become a profile of your children."],
    },
    {
      kind: "paragraph",
      content: [
        "A photograph may reveal more than you realise—school uniforms, locations, names, routines or other identifying details.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your children also haven't necessarily agreed to have their photographs shown to strangers on a dating platform.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can be completely honest about being a parent without making your children's identities public.",
      ],
    },
    {
      kind: "paragraph",
      content: ["A sentence can communicate that you have children."],
    },
    { kind: "paragraph", content: ["Their photographs don't have to."] },

    {
      kind: "heading",
      text: "Dating may require more planning when you're a parent",
    },
    {
      kind: "paragraph",
      content: ["Spontaneity can be harder when you have children."],
    },
    {
      kind: "paragraph",
      content: [
        "There may be school schedules, custody arrangements, childcare, work and family responsibilities to manage before you can even meet somebody for coffee.",
      ],
    },
    {
      kind: "paragraph",
      content: ["That doesn't make you difficult to date."],
    },
    {
      kind: "paragraph",
      content: ["It simply means your life has responsibilities."],
    },
    {
      kind: "paragraph",
      content: [
        "Be realistic about the amount of time you actually have available.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't need to pretend to have a completely flexible schedule to keep somebody interested.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A compatible person should be able to understand that sometimes plans require notice.",
      ],
    },

    { kind: "heading", text: "Don't feel guilty for wanting companionship" },
    {
      kind: "paragraph",
      content: ["Parents can sometimes feel selfish for dating after divorce."],
    },
    {
      kind: "paragraph",
      content: [
        "Time spent on a date can feel like time taken away from children.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Wanting companionship doesn't mean your children matter less."],
    },
    {
      kind: "paragraph",
      content: [
        "You are still an adult with your own emotional and social life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Children can remain a central part of your life without being the only part of it.",
      ],
    },
    {
      kind: "paragraph",
      content: ["The important question isn't whether you date."],
    },
    {
      kind: "paragraph",
      content: [
        "It is whether you're continuing to give your children the stability, attention and care they need while you do.",
      ],
    },

    {
      kind: "heading",
      text: "Keep your relationship with your children separate from the success of your dating life",
    },
    {
      kind: "paragraph",
      content: ["A promising relationship can make you excited."],
    },
    { kind: "paragraph", content: ["A breakup can make you miserable."] },
    {
      kind: "paragraph",
      content: ["Try not to make your children responsible for either."],
    },
    {
      kind: "paragraph",
      content: [
        "Children shouldn't become the people you rely on to analyse your dates, reassure you after rejection or listen to the intimate details of a relationship.",
      ],
    },
    { kind: "paragraph", content: ["You deserve adult support too."] },
    {
      kind: "paragraph",
      content: [
        "Friends, family members, counsellors or other trusted adults are more appropriate places for many of those conversations.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your children can know that you're happy or disappointed without becoming your emotional support system.",
      ],
    },

    { kind: "heading", text: "Co-parenting can make dating more complicated" },
    {
      kind: "paragraph",
      content: [
        "A new relationship can sometimes create tension between former spouses.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Your ex may dislike the person you're dating."],
    },
    {
      kind: "paragraph",
      content: ["You may dislike somebody they're dating."],
    },
    {
      kind: "paragraph",
      content: [
        "There may also be practical questions about introductions, schedules and boundaries.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Where possible, keep disagreements about new partners between adults.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Avoid criticising your former spouse's partner in front of your children or asking your children to report what happens in the other household.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If there are genuine concerns about a child's safety or wellbeing, those deserve to be addressed seriously through appropriate channels.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But ordinary discomfort with an ex moving on is different from a safety concern.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Keeping that distinction clear can prevent children from being pulled into adult conflict.",
      ],
    },

    { kind: "heading", text: "Don't rush to create a new family" },
    {
      kind: "paragraph",
      content: [
        "A relationship can feel especially exciting after a difficult divorce.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may begin imagining holidays together, living together, remarriage or a blended family.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Those possibilities may eventually become real."],
    },
    {
      kind: "paragraph",
      content: ["But children often experience change differently from adults."],
    },
    {
      kind: "paragraph",
      content: [
        "Moving homes, changing routines, sharing space with a new partner or suddenly gaining step-siblings can be significant transitions.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A relationship doesn't become more meaningful because those steps happen quickly.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Give everyone—including yourself—time to understand what the new relationship actually is before restructuring family life around it.",
      ],
    },

    {
      kind: "heading",
      text: "What if your children don't like the person you're dating?",
    },
    {
      kind: "paragraph",
      content: ["Don't immediately dismiss their reaction."],
    },
    {
      kind: "paragraph",
      content: [
        "But don't automatically end a relationship because a child isn't enthusiastic either.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Instead, try to understand why they feel that way."],
    },
    {
      kind: "paragraph",
      content: ["Are they worried their other parent is being replaced?"],
    },
    {
      kind: "paragraph",
      content: ["Do they dislike having to share your attention?"],
    },
    {
      kind: "paragraph",
      content: ["Are they uncomfortable with change generally?"],
    },
    {
      kind: "paragraph",
      content: [
        "Or have they noticed specific behaviour from your partner that makes them uneasy?",
      ],
    },
    { kind: "paragraph", content: ["Those are very different situations."] },
    {
      kind: "paragraph",
      content: [
        "Listen carefully, particularly if a child describes behaviour that makes them feel unsafe, frightened, pressured or uncomfortable.",
      ],
    },
    {
      kind: "paragraph",
      content: ["At the same time, remember that adjustment can take time."],
    },
    {
      kind: "paragraph",
      content: [
        "Your responsibility is to take their concerns seriously without making them responsible for deciding the future of your adult relationship.",
      ],
    },

    {
      kind: "heading",
      text: "What if the relationship ends after your children have met them?",
    },
    {
      kind: "paragraph",
      content: ["This is one reason to avoid introductions too early."],
    },
    {
      kind: "paragraph",
      content: ["But even relationships that seem stable can end."],
    },
    {
      kind: "paragraph",
      content: [
        "If your children have formed a connection with your partner, they may experience the breakup as a loss too.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Don't pretend the person never existed."],
    },
    {
      kind: "paragraph",
      content: [
        "Explain what has happened in a way appropriate for your child's age, without sharing unnecessary adult details.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Let them feel disappointed if they're disappointed."],
    },
    {
      kind: "paragraph",
      content: [
        "And reassure them that the end of your relationship doesn't change your relationship with them.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You cannot guarantee that every relationship will last."],
    },
    {
      kind: "paragraph",
      content: [
        "You can control how thoughtfully you involve your children and how honestly you support them when circumstances change.",
      ],
    },

    {
      kind: "heading",
      text: "Your children don't need a perfect example of starting again",
    },
    {
      kind: "paragraph",
      content: [
        "Dating after divorce with kids isn't about handling every decision flawlessly.",
      ],
    },
    { kind: "paragraph", content: ["There may be awkward conversations."] },
    {
      kind: "paragraph",
      content: ["A child may react differently from how you expected."],
    },
    {
      kind: "paragraph",
      content: ["A relationship you thought had potential may not work."],
    },
    {
      kind: "paragraph",
      content: [
        "You may decide to stop dating for a while and begin again later.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "What children can see, however, is how you approach relationships.",
      ],
    },
    { kind: "paragraph", content: ["They can see you setting boundaries."] },
    {
      kind: "paragraph",
      content: ["They can see you treating people respectfully."],
    },
    {
      kind: "paragraph",
      content: [
        "They can see you refusing to stay in situations that aren't healthy for you.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And they can see that starting again doesn't require forgetting the family that already exists.",
      ],
    },

    {
      kind: "heading",
      text: "Move at a pace that works for both parts of your life",
    },
    { kind: "paragraph", content: ["Being a parent changes the way you date."] },
    {
      kind: "paragraph",
      content: [
        "It doesn't mean you have to stop being a person outside parenthood.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can protect your children's stability while still allowing yourself the possibility of companionship.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Keep the early stages of dating focused on getting to know the other person.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Introduce your children only when the relationship has enough stability to justify bringing it into their lives.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Listen to your children's feelings without asking them to make adult decisions.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And don't rush to turn a promising relationship into a new family structure.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you're still deciding whether you're personally ready to begin, read ",
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
        "If you're ready but unsure how to actually begin meeting people, see ",
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
        "For the broader experience of starting again in India, read ",
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
        "And when you're meeting somebody you've first connected with online, review Eraya's ",
        { text: "Safety Centre", href: "/safety" },
        ".",
      ],
    },
    {
      kind: "paragraph",
      content: ["Your children are an important part of your life."],
    },
    {
      kind: "paragraph",
      content: [
        "A future relationship can become another important part of it.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't have to choose between being a thoughtful parent and allowing yourself to start again.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Eraya is a community for divorced, separated and widowed adults in India who are open to meaningful connections and whatever their next chapter may bring.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Protect what matters. Take your time. Let something new grow naturally.",
      ],
    },
  ],
};
