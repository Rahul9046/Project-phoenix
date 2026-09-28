import type { Guide } from "../types";

/**
 * Eraya's sixth guide, published 2026-09-28.
 *
 * Approved copy, transcribed into blocks. Two fields that had existed unused
 * since the section shipped are used here for the first time, and neither is
 * new: `category: "safety"` and `cta: "safety"`. The CTA set is fixed at
 * `join`, `safety` and `none` precisely so an article about scams and pressure
 * can close with the guidelines rather than with an invitation to sign up, and
 * this is the first article whose subject asks for that. Nothing was added to
 * the Guides system to publish it.
 *
 * `seoTitle` is present and is the shorter of the two approved strings, the
 * same split Article #5 has: the title tag reads "Online Dating Safety After
 * Divorce: A Practical Guide" while the `h1`, the breadcrumb, the index card
 * and the JSON-LD `headline` carry the full approved heading.
 *
 * **Three `list` blocks, and they are the author's own series.** Each follows a
 * colon line and is punctuated as a list already -- semicolons throughout, "; or"
 * before the last item, a full stop to close -- which is exactly the shape
 * Article #4's single list had, item punctuation included. That is the line this
 * file holds: punctuation decides, not appearance. The author's other runs of
 * short lines -- "Their age changes.", "They insist you share your phone
 * number.", the five questions under "Trust becomes meaningful when behaviour
 * repeatedly supports those words." -- are sentences the author set apart, so
 * they stay paragraphs. Bulleting those would impose a structure the copy does
 * not have, and Article #4 refused the same temptation for the same reason.
 *
 * Standalone emphasis renders as ordinary paragraphs, Article #4's precedent:
 * `GuideInline` is a string or a link with no emphasis variant, and adding one
 * would be extending the system to preserve bold. There is no block quote, so
 * no `callout` is used; the one quoted sentence is the author's own line of
 * dialogue and is a paragraph like the copy sets it.
 *
 * `summary` and `deck` are the approved meta description -- no separate summary
 * was supplied, and reusing approved copy beats inventing a sentence.
 *
 * `related` names the closing section's three in its order, then the two the
 * body introduced earlier, which is every other guide Eraya has published. Six
 * approved links in the body: five guides and the Safety Centre. No image:
 * Eraya owns no artwork for it.
 */
export const onlineDatingSafetyAfterDivorce: Guide = {
  slug: "online-dating-safety-after-divorce",
  status: "published",

  title: "Online Dating Safety After Divorce: How to Meet New People Safely",
  seoTitle: "Online Dating Safety After Divorce: A Practical Guide",
  description:
    "Dating online after divorce? Learn how to protect your privacy, spot scams and red flags, meet safely in person and build trust without rushing.",
  summary:
    "Dating online after divorce? Learn how to protect your privacy, spot scams and red flags, meet safely in person and build trust without rushing.",
  deck: "Dating online after divorce? Learn how to protect your privacy, spot scams and red flags, meet safely in person and build trust without rushing.",

  category: "safety",
  author: { kind: "organization" },
  publishedOn: "2026-09-28",

  related: [
    "how-to-start-dating-after-divorce",
    "when-to-date-after-divorce",
    "dating-after-divorce-india",
    "dating-after-divorce-with-kids",
    "dating-after-separation-india",
  ],
  cta: "safety",

  body: [
    {
      kind: "paragraph",
      content: [
        "Dating online after divorce can feel very different from the last time you were single.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You may be using dating or relationship platforms for the first time. You may be sharing your life with strangers in ways that didn't exist when you last dated. And after a difficult marriage or separation, attention from somebody new can sometimes feel especially meaningful.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Most conversations won't become relationships."],
    },
    { kind: "paragraph", content: ["Some will simply fade."] },
    {
      kind: "paragraph",
      content: [
        "And occasionally, you may encounter somebody who isn't being honest about who they are or what they want.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Staying safe doesn't mean approaching every new person with suspicion.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It means allowing trust to grow at roughly the same pace as the relationship.",
      ],
    },

    {
      kind: "heading",
      text: "Start with less information than you think you need",
    },
    {
      kind: "paragraph",
      content: [
        "A profile needs enough information for somebody to understand who you are.",
      ],
    },
    {
      kind: "paragraph",
      content: ["It doesn't need enough information to find you offline."],
    },
    { kind: "paragraph", content: ["Avoid publicly sharing details such as:"] },
    {
      kind: "list",
      items: [
        ["your exact home address;"],
        ["your workplace address;"],
        ["your children's school;"],
        ["your regular daily routine;"],
        ["personal phone numbers or email addresses before you're comfortable;"],
        ["financial information; or"],
        ["documents containing identifying details."],
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Even information that seems harmless can become revealing when combined.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your first name, profession, neighbourhood and workplace may be enough for somebody to locate your social media profiles or learn considerably more about you.",
      ],
    },
    { kind: "paragraph", content: ["You can always share more later."] },
    {
      kind: "paragraph",
      content: [
        "It is much harder to take information back once it has been given to a stranger.",
      ],
    },

    { kind: "heading", text: "Think carefully about the photographs you use" },
    {
      kind: "paragraph",
      content: ["Photographs can reveal information beyond your appearance."],
    },
    {
      kind: "paragraph",
      content: ["Look at the background before uploading an image."],
    },
    {
      kind: "paragraph",
      content: [
        "A photograph might show your apartment building, office badge, vehicle registration number, child's school uniform or a location you visit regularly.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The same photograph may also exist on a public social media account under your full name.",
      ],
    },
    { kind: "paragraph", content: ["You don't need to become anonymous."] },
    {
      kind: "paragraph",
      content: [
        "Just understand what somebody can learn from the image before you make it part of a public or semi-public profile.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you have children, be especially cautious about including their photographs.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Your dating profile is about you. Your children don't need to become identifiable to people you're only beginning to meet.",
      ],
    },

    { kind: "heading", text: "Keep early conversations on the platform" },
    {
      kind: "paragraph",
      content: [
        "Somebody may quickly ask to move to WhatsApp, Instagram or another service.",
      ],
    },
    {
      kind: "paragraph",
      content: ["There can be perfectly ordinary reasons for that."],
    },
    {
      kind: "paragraph",
      content: ["But there is rarely a need to move immediately."],
    },
    {
      kind: "paragraph",
      content: [
        "Staying on the platform during early conversations can help keep your personal phone number and social accounts private while you're deciding whether you actually want this person in your life.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It may also preserve access to platform safety features such as reporting or blocking.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Move the conversation when you feel comfortable—not because somebody pressures you to.",
      ],
    },

    {
      kind: "heading",
      text: "A phone call or video call can be useful before meeting",
    },
    { kind: "paragraph", content: ["Text conversations reveal only so much."] },
    {
      kind: "paragraph",
      content: [
        "Before meeting in person, a voice or video conversation can help you understand whether the person communicates in a way that feels consistent with what you've experienced so far.",
      ],
    },
    {
      kind: "paragraph",
      content: ["It isn't an identity verification system."],
    },
    {
      kind: "paragraph",
      content: [
        "Someone can appear on video and still lie about their circumstances.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "But if a person repeatedly avoids every reasonable opportunity to speak or appear on video while pushing for emotional intimacy, money or an urgent relationship, treat that inconsistency seriously.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You don't need to investigate everybody."],
    },
    {
      kind: "paragraph",
      content: [
        "You do need to pay attention when someone's story continually requires excuses.",
      ],
    },

    { kind: "heading", text: "Notice when intimacy develops unusually fast" },
    {
      kind: "paragraph",
      content: ["Some connections genuinely become close quickly."],
    },
    { kind: "paragraph", content: ["Speed alone doesn't prove manipulation."] },
    {
      kind: "paragraph",
      content: [
        "But be cautious when somebody you barely know begins making unusually intense declarations.",
      ],
    },
    {
      kind: "paragraph",
      content: ["They may say you're the only person who understands them."],
    },
    {
      kind: "paragraph",
      content: ["They may talk about marriage almost immediately."],
    },
    {
      kind: "paragraph",
      content: [
        "They may describe the relationship as destiny before you've even met.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They may want constant contact and become upset when you're unavailable.",
      ],
    },
    { kind: "paragraph", content: ["The issue isn't romance."] },
    {
      kind: "paragraph",
      content: [
        "It's whether emotional intensity is being used to make normal boundaries feel unreasonable.",
      ],
    },
    {
      kind: "paragraph",
      content: ["A healthy connection can survive you saying:"],
    },
    { kind: "paragraph", content: ["I need more time."] },

    {
      kind: "heading",
      text: "Never send money to someone you've only met through dating",
    },
    { kind: "paragraph", content: ["This boundary can be simple."] },
    {
      kind: "paragraph",
      content: ["Don't send money to somebody you've recently met online."],
    },
    {
      kind: "paragraph",
      content: [
        "The reason they give may sound completely unrelated to dating:",
      ],
    },
    {
      kind: "list",
      items: [
        ["a medical emergency;"],
        ["a family crisis;"],
        ["a blocked bank account;"],
        ["a business problem;"],
        ["a travel expense;"],
        ["a phone that suddenly needs replacing;"],
        ["a temporary loan they promise to repay; or"],
        ["money needed so they can finally meet you."],
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The story may become more convincing because you have been speaking for weeks or months.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Emotional familiarity is not financial verification."],
    },
    {
      kind: "paragraph",
      content: ["You don't need to determine whether every story is true."],
    },
    {
      kind: "paragraph",
      content: [
        "You can simply decide that new romantic connections and financial transfers do not mix.",
      ],
    },

    {
      kind: "heading",
      text: "Be cautious about investments and financial opportunities",
    },
    {
      kind: "paragraph",
      content: [
        "Not every financial approach begins with somebody asking for a loan.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A person may instead tell you about an investment that has supposedly made them successful.",
      ],
    },
    {
      kind: "paragraph",
      content: ["They may offer to teach you how to trade."],
    },
    {
      kind: "paragraph",
      content: [
        "They may encourage you to use a particular investment platform, cryptocurrency service or financial website.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "They may initially suggest a small amount and show apparent profits.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A relationship is not a reason to hand somebody control over your financial decisions.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Do not share banking credentials, OTPs, card details, account passwords or access to your devices.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "And don't make an investment simply because somebody you're emotionally interested in recommends it.",
      ],
    },

    { kind: "heading", text: "Never share an OTP or password" },
    {
      kind: "paragraph",
      content: [
        "A legitimate romantic connection doesn't need your banking OTP.",
      ],
    },
    { kind: "paragraph", content: ["They don't need your email password."] },
    {
      kind: "paragraph",
      content: ["They don't need your social media password."],
    },
    {
      kind: "paragraph",
      content: ["They don't need the code that just arrived on your phone."],
    },
    {
      kind: "paragraph",
      content: ["They don't need remote access to your device."],
    },
    {
      kind: "paragraph",
      content: [
        "If somebody asks for authentication codes or account credentials, don't provide them.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "An explanation can sound convincing and still give somebody access to your money or accounts.",
      ],
    },

    { kind: "heading", text: "Be careful with identity documents" },
    {
      kind: "paragraph",
      content: [
        "There is rarely a reason for somebody you're casually dating to receive copies of your Aadhaar, PAN card, passport, driving licence, bank statement or other identity documents.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Documents can reveal far more information than somebody needs to know at the beginning of a relationship.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Likewise, don't assume a photograph of an identity document sent to you proves that the other person is genuine.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Images and documents can belong to somebody else or be altered.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Trust should come from consistent behaviour over time—not from exchanging increasingly sensitive documents.",
      ],
    },

    { kind: "heading", text: "Your divorce can reveal financial information" },
    {
      kind: "paragraph",
      content: [
        "After divorce or during separation, conversations may naturally include property, maintenance, settlements, custody or previous financial arrangements.",
      ],
    },
    { kind: "paragraph", content: ["You don't need to hide your past."] },
    {
      kind: "paragraph",
      content: [
        "But be conscious of how much financial detail you're giving somebody you've only recently met.",
      ],
    },
    { kind: "paragraph", content: ["There is a difference between saying:"] },
    { kind: "paragraph", content: ["“My divorce is still being finalised.”"] },
    {
      kind: "paragraph",
      content: [
        "and explaining exactly how much money you received, what property you own, where your investments are held and how much you earn.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Some details belong later, after trust exists."],
    },

    { kind: "heading", text: "Protect information about your children" },
    {
      kind: "paragraph",
      content: [
        "If you're a parent, safety includes information about your children.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Someone you're newly dating doesn't immediately need to know:",
      ],
    },
    {
      kind: "list",
      items: [
        ["where your children go to school;"],
        ["where they attend activities;"],
        ["when they're home alone;"],
        ["their daily schedule;"],
        ["private medical information; or"],
        ["where they regularly spend time."],
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You can be honest about being a parent without making your children's lives visible to strangers.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If a relationship becomes serious, information will naturally be shared gradually.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "For more on involving children in a new relationship, see ",
        {
          text: "dating after divorce with kids",
          href: "/guides/dating-after-divorce-with-kids",
        },
        ".",
      ],
    },

    {
      kind: "heading",
      text: "Pay attention to inconsistencies rather than becoming a detective",
    },
    {
      kind: "paragraph",
      content: [
        "You shouldn't need to conduct an investigation before having coffee with somebody.",
      ],
    },
    {
      kind: "paragraph",
      content: ["But don't repeatedly explain away things that don't add up."],
    },
    { kind: "paragraph", content: ["Their age changes."] },
    { kind: "paragraph", content: ["Their job changes."] },
    {
      kind: "paragraph",
      content: ["Their relationship status becomes unclear."],
    },
    {
      kind: "paragraph",
      content: [
        "They refuse ordinary questions about information they previously volunteered.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Their photographs and story don't seem consistent."],
    },
    {
      kind: "paragraph",
      content: [
        "They repeatedly disappear and return with dramatic explanations.",
      ],
    },
    { kind: "paragraph", content: ["One inconsistency may mean nothing."] },
    { kind: "paragraph", content: ["A pattern deserves attention."] },
    {
      kind: "paragraph",
      content: [
        "You don't need courtroom-level proof that somebody is lying before deciding you no longer want contact.",
      ],
    },

    { kind: "heading", text: "Being separated should not be hidden" },
    { kind: "paragraph", content: ["Relationship status matters."] },
    {
      kind: "paragraph",
      content: [
        "If somebody says they're divorced, separated or widowed and later gives a substantially different story, take that seriously.",
      ],
    },
    {
      kind: "paragraph",
      content: ["A complicated past isn't automatically a red flag."],
    },
    { kind: "paragraph", content: ["Dishonesty about that past can be."] },
    { kind: "paragraph", content: ["The same standard applies to you."] },
    {
      kind: "paragraph",
      content: [
        "If you're separated but not yet divorced, say so rather than presenting yourself as legally divorced.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Our guide to ",
        {
          text: "dating after separation in India",
          href: "/guides/dating-after-separation-india",
        },
        " discusses this situation in more detail.",
      ],
    },

    { kind: "heading", text: "Don't ignore pressure around boundaries" },
    {
      kind: "paragraph",
      content: [
        "Someone doesn't have to threaten you for their behaviour to be concerning.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Pay attention when a person repeatedly tries to negotiate boundaries you've already made clear.",
      ],
    },
    {
      kind: "paragraph",
      content: ["They insist you share your phone number."],
    },
    {
      kind: "paragraph",
      content: ["They become angry when you don't reply quickly."],
    },
    { kind: "paragraph", content: ["They demand private photographs."] },
    {
      kind: "paragraph",
      content: ["They pressure you to meet before you're comfortable."],
    },
    {
      kind: "paragraph",
      content: ["They try to isolate you from friends or family."],
    },
    {
      kind: "paragraph",
      content: ["They make you feel guilty for wanting time to think."],
    },
    {
      kind: "paragraph",
      content: ["A respectful person may be disappointed by a boundary."],
    },
    { kind: "paragraph", content: ["They still respect it."] },

    {
      kind: "heading",
      text: "Be especially careful with intimate photographs",
    },
    {
      kind: "paragraph",
      content: [
        "Once an intimate image leaves your device, you cannot completely control where it goes.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "A person may seem trustworthy today and behave differently after rejection, conflict or a breakup.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Never let somebody pressure you into sending photographs or videos you don't want to send.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If somebody threatens to publish intimate material unless you pay them, send more material or continue the relationship, don't assume complying will end the situation.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Preserve relevant evidence and seek appropriate help rather than continuing to negotiate under pressure.",
      ],
    },

    { kind: "heading", text: "Your first meeting should be simple" },
    {
      kind: "paragraph",
      content: [
        "The purpose of the first meeting is to learn whether you want a second one.",
      ],
    },
    {
      kind: "paragraph",
      content: ["It doesn't need to be an elaborate trip."],
    },
    {
      kind: "paragraph",
      content: ["Choose a public place where other people are around."],
    },
    {
      kind: "paragraph",
      content: [
        "A café, restaurant or similarly busy location is usually easier to leave than an isolated setting.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "For an early meeting, avoid making somebody's home—or your own home—the default.",
      ],
    },
    {
      kind: "paragraph",
      content: ["You can create privacy later if trust develops."],
    },
    { kind: "paragraph", content: ["There is no prize for accelerating it."] },

    { kind: "heading", text: "Arrange your own transportation" },
    {
      kind: "paragraph",
      content: [
        "For early meetings, being able to leave independently matters.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If possible, arrange your own transport to and from the meeting rather than depending entirely on the person you're meeting.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't need to provide your home address so they can collect you.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Having your own way home makes leaving a straightforward decision rather than a negotiation.",
      ],
    },

    { kind: "heading", text: "Tell somebody where you're going" },
    {
      kind: "paragraph",
      content: [
        "Before meeting someone new, tell a trusted friend or family member where you're going.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Share the person's name or profile and the meeting location."],
    },
    {
      kind: "paragraph",
      content: ["You might also agree to message them afterwards."],
    },
    {
      kind: "paragraph",
      content: ["This isn't an accusation against your date."],
    },
    {
      kind: "paragraph",
      content: [
        "It's a simple precaution when meeting somebody you previously knew only through the internet.",
      ],
    },

    { kind: "heading", text: "Keep control of what you consume" },
    {
      kind: "paragraph",
      content: [
        "If you're eating or drinking during a date, keep ordinary awareness of what you're consuming.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Don't feel pressured to drink alcohol because the other person is drinking.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Don't consume something you're uncomfortable with."],
    },
    {
      kind: "paragraph",
      content: [
        "And don't allow embarrassment about seeming overly cautious to override your judgement.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You don't owe somebody lowered boundaries to prove that you trust them.",
      ],
    },

    { kind: "heading", text: "You can leave at any time" },
    { kind: "paragraph", content: ["A date isn't a contract."] },
    {
      kind: "paragraph",
      content: ["You don't need a dramatic reason to end it."],
    },
    {
      kind: "paragraph",
      content: [
        "If you feel uncomfortable, pressured or simply want to go home, you can leave.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "You also don't owe somebody another meeting because they paid for dinner, travelled a long distance or seemed disappointed.",
      ],
    },
    { kind: "paragraph", content: ["Courtesy matters."] },
    { kind: "paragraph", content: ["Your safety and boundaries matter more."] },

    { kind: "heading", text: "Rejection can reveal important behaviour" },
    {
      kind: "paragraph",
      content: ["Pay attention to how somebody responds when you say no."],
    },
    {
      kind: "paragraph",
      content: [
        "That may mean declining a date, refusing to share information, saying you don't want physical intimacy or deciding not to continue the relationship.",
      ],
    },
    { kind: "paragraph", content: ["Disappointment is normal."] },
    {
      kind: "paragraph",
      content: [
        "Threats, harassment, repeated unwanted contact, humiliation or attempts to frighten you are not something you need to tolerate.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Use blocking and reporting tools when appropriate."],
    },
    {
      kind: "paragraph",
      content: [
        "If you believe you're in immediate danger, contact local emergency services or seek help from people around you rather than relying only on an app's reporting system.",
      ],
    },

    {
      kind: "heading",
      text: "Don't let embarrassment stop you from asking for help",
    },
    {
      kind: "paragraph",
      content: [
        "People can be manipulated regardless of age, education or professional experience.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Scams work because they exploit ordinary human emotions: trust, affection, urgency, hope and fear.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you've already sent money or shared sensitive information, hiding what happened because you feel embarrassed can give the other person more time.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Contact the relevant bank or financial provider promptly if financial information or money is involved.",
      ],
    },
    { kind: "paragraph", content: ["Change compromised passwords."] },
    { kind: "paragraph", content: ["Secure affected accounts."] },
    {
      kind: "paragraph",
      content: ["Preserve messages, payment information and other evidence."],
    },
    {
      kind: "paragraph",
      content: [
        "And seek appropriate law-enforcement or cybercrime assistance where necessary.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "The important thing is to respond to what has happened—not to protect yourself from imagined judgement.",
      ],
    },

    { kind: "heading", text: "Trust behaviour more than promises" },
    { kind: "paragraph", content: ["Anyone can say they're honest."] },
    {
      kind: "paragraph",
      content: ["Anyone can say they want a serious relationship."],
    },
    {
      kind: "paragraph",
      content: ["Anyone can say they would never hurt you."],
    },
    {
      kind: "paragraph",
      content: [
        "Trust becomes meaningful when behaviour repeatedly supports those words.",
      ],
    },
    { kind: "paragraph", content: ["Do they respect your boundaries?"] },
    { kind: "paragraph", content: ["Does their story remain consistent?"] },
    {
      kind: "paragraph",
      content: ["Can they handle disagreement without intimidation?"],
    },
    {
      kind: "paragraph",
      content: [
        "Are they comfortable letting the relationship develop gradually?",
      ],
    },
    {
      kind: "paragraph",
      content: ["Do you feel able to say no without fearing their reaction?"],
    },
    {
      kind: "paragraph",
      content: ["You don't need certainty before getting to know somebody."],
    },
    { kind: "paragraph", content: ["But trust should have evidence."] },

    { kind: "heading", text: "Safety doesn't require fear" },
    {
      kind: "paragraph",
      content: [
        "Dating safely doesn't mean treating every stranger as dangerous.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "It means keeping enough independence to make clear decisions while somebody is still a stranger.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Keep your personal information private until sharing it makes sense.",
      ],
    },
    { kind: "paragraph", content: ["Keep money outside new relationships."] },
    { kind: "paragraph", content: ["Meet publicly at first."] },
    { kind: "paragraph", content: ["Maintain your own transportation."] },
    { kind: "paragraph", content: ["Tell somebody where you're going."] },
    {
      kind: "paragraph",
      content: ["Pay attention to pressure and inconsistencies."],
    },
    {
      kind: "paragraph",
      content: [
        "And allow trust to be something a person builds rather than something they request.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "If you're just beginning again, read ",
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
        "If you're unsure whether you're ready yet, see ",
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
        "For the broader experience of beginning again in India, read ",
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
        "You can also review Eraya's ",
        { text: "Safety Centre", href: "/safety" },
        " for the platform's safety guidance and reporting information.",
      ],
    },
    {
      kind: "paragraph",
      content: [
        "Meeting somebody new always involves some uncertainty. Giving trust gradually lets you explore that possibility without giving away control of your safety.",
      ],
    },
    {
      kind: "paragraph",
      content: ["Stay open. Keep your boundaries. Let trust be earned."],
    },
  ],
};
