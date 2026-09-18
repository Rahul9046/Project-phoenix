import type { LegalDocument } from "./types";

/**
 * The agreement between Eraya and a member.
 *
 * The section that matters most is Premium. Eraya sells prepaid terms: there is
 * no mandate, nothing to cancel, and no second charge. The catalogue enforces
 * that -- every plan carries `is_recurring = false`, and `payments-probe`
 * fails the build if one ever does not -- so these Terms describe a purchase,
 * never a subscription.
 *
 * No price appears here. Prices live in the `membership_plans` table and are
 * shown at checkout; a number written into a legal document is a number that
 * goes stale and then contradicts the thing the member actually agreed to.
 */
export const termsOfService: LegalDocument = {
  id: "terms",
  title: "Terms of Service",
  lede: "The agreement between you and Eraya. Plain words where plain words will do.",
  sections: [
    {
      id: "agreement",
      heading: "This agreement",
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms are between you and Rahul Das, trading as Eraya, in India. By creating an account or using Eraya, you agree to them. If you do not agree, please do not use Eraya.",
        },
        {
          kind: "paragraph",
          text: "Our Privacy Policy explains what we do with your information and forms part of this agreement.",
        },
      ],
    },
    {
      id: "eligibility",
      heading: "Who can use Eraya",
      blocks: [
        {
          kind: "paragraph",
          text: "You must be 18 or over. This is the same for everyone, regardless of gender. You must have already reached your eighteenth birthday, not merely be turning 18 this year.",
        },
        {
          kind: "paragraph",
          text: "The information you give us must be accurate, including your date of birth. If we find an account belonging to someone under 18, we will remove it.",
        },
      ],
    },
    {
      id: "account",
      heading: "Your account",
      blocks: [
        {
          kind: "paragraph",
          text: "Your account is yours. Use your own identity, and do not pretend to be someone else or set up an account on another person's behalf without their knowledge.",
        },
        {
          kind: "paragraph",
          text: "Eraya has no passwords. You sign in with a six-digit code sent to your email, or with Google or Facebook. Do not share those codes with anyone. Anyone who has your code can get into your account, and nobody from Eraya will ever ask you for one.",
        },
        {
          kind: "paragraph",
          text: "If your account is suspended or removed, do not create another account to get around that.",
        },
      ],
    },
    {
      id: "what-eraya-is",
      heading: "What Eraya is, and is not",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya is a relationship and community platform for divorced, separated and widowed adults in India. It is a place to meet people.",
        },
        {
          kind: "paragraph",
          text: "Eraya is not a matrimonial agency, a marriage bureau, or a matchmaking service. We do not vet people for suitability, and we do not arrange anything on your behalf.",
        },
        {
          kind: "paragraph",
          text: "Eraya does not guarantee matches, connections, conversations, dates, relationships, marriage, or any other outcome. Buying Premium does not change that. What Premium buys is described below, and it is never a result.",
        },
      ],
    },
    {
      id: "messaging",
      heading: "Messaging",
      blocks: [
        {
          kind: "paragraph",
          text: "You can message someone once you have both expressed interest in each other and are connected. Nobody can message you before that.",
        },
        {
          kind: "paragraph",
          text: "Eraya does not routinely monitor private conversations. We may review relevant information where it is reasonably necessary to look into a report, or to deal with abuse, fraud, safety, security, enforcement of these Terms, or a legal obligation.",
        },
        {
          kind: "paragraph",
          text: "Deleting your account does not necessarily remove messages you have already sent from the other member's conversation history.",
        },
      ],
    },
    {
      id: "content",
      heading: "What you post",
      blocks: [
        {
          kind: "paragraph",
          text: "Your photos and what you write remain yours. Eraya does not claim ownership of them.",
        },
        {
          kind: "paragraph",
          text: "So that Eraya can actually work, you give us a limited licence to store, process, display, resize and otherwise handle your content as needed to operate the service and show it to the members it is meant for. This licence exists only for running Eraya. It does not let us sell your content, license it to anyone else, or use it in advertising.",
        },
        {
          kind: "paragraph",
          text: "You must have the right to post what you post. Do not upload photographs of other people without their agreement, do not upload anything you did not take or do not have permission to use, and do not post anything unlawful.",
        },
      ],
    },
    {
      id: "verification",
      heading: "Verification",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya may use email, phone or other checks where they are available. Email sign-in confirms that a person can receive mail at that address. Phone verification is not switched on at the moment, and no member carries a verified-phone mark.",
        },
        {
          kind: "paragraph",
          text: "Verification of any kind confirms only the narrow thing it checks. It is not an endorsement, and it is not a guarantee of anybody's identity, character, intentions, conduct or safety. Please do not treat a verified mark as a reason to trust someone. Use your own judgement, every time.",
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      blocks: [
        {
          kind: "paragraph",
          text: "Our Community and Safety Guidelines set out what is and is not acceptable on Eraya, and they form part of these Terms. In short: no harassment, no impersonation, no scams or financial exploitation, no sexual content or coercion, no hate, no threats of violence, no spam or data harvesting, and nothing involving minors.",
        },
      ],
    },
    {
      id: "moderation",
      heading: "Moderation and enforcement",
      blocks: [
        {
          kind: "paragraph",
          text: "You can block any member, without giving a reason, and you can report behaviour that breaks the Guidelines.",
        },
        {
          kind: "paragraph",
          text: "Where something is reported to us, or we otherwise become aware of a problem, we may look into it and access relevant information to do so. Depending on what we find we may remove content, restrict what an account can do, suspend an account, or remove it permanently. Creating a new account to evade a suspension is itself a breach of these Terms.",
        },
        {
          kind: "paragraph",
          text: "We will not always warn you first. Where safety is at stake we may act immediately. If you believe we have got it wrong, write to support@eraya.app and we will look again. We cannot promise a particular outcome or a particular timescale.",
        },
      ],
    },
    {
      id: "premium",
      heading: "Eraya Premium",
      blocks: [
        {
          kind: "paragraph",
          text: "Premium is a prepaid membership. It is not a subscription and it does not renew automatically.",
        },
        {
          kind: "list",
          items: [
            "The price shown at checkout is the price for that purchase",
            "The duration shown at checkout is the period that purchase buys",
            "Any introductory offer that applies to you is shown at checkout before you pay",
            "Your payment authorises that one purchase and nothing else",
            "Premium ends when the period you bought ends",
            "Eraya does not charge you again. There is no mandate, no standing instruction and nothing to cancel",
            "If you want Premium again, you choose to buy it again",
            "If we send you a reminder that your Premium is ending, it is information only. It does not authorise a payment",
          ],
        },
        {
          kind: "paragraph",
          text: "Premium changes what you can do on Eraya. It does not change how other members behave, and it does not make an outcome more likely.",
        },
      ],
    },
    {
      id: "payments",
      heading: "Payments",
      blocks: [
        {
          kind: "paragraph",
          text: "Payments are handled by our payment provider, Razorpay. Your card, UPI or banking credentials go to them, not to Eraya. Eraya never receives or stores your card number, UPI ID, CVV or bank login.",
        },
        {
          kind: "paragraph",
          text: "Eraya records the order and payment identifiers, the amount, whether the payment succeeded, and the membership period it bought. The price you pay is calculated on Eraya's server, not in the app or your browser.",
        },
        {
          kind: "paragraph",
          text: "Payments are currently in test mode while Eraya prepares to open. No live payment has been taken.",
        },
      ],
    },
    {
      id: "refunds",
      heading: "Refunds",
      blocks: [
        {
          kind: "paragraph",
          text: "Because Premium is a prepaid term that starts immediately, purchases are ordinarily final. There are exceptions, and we would rather list them than pretend there are none:",
        },
        {
          kind: "list",
          items: [
            "Where applicable law requires a refund",
            "Where you were charged twice, or charged the wrong amount",
            "Where the paid service was not provided as described",
            "Any other case we agree to under our refund process",
          ],
        },
        {
          kind: "paragraph",
          text: "If you think one of these applies, write to support@eraya.app with the details and we will look at it.",
        },
        {
          kind: "paragraph",
          text: "Deleting your account does not automatically entitle you to a refund for Premium time you have not used, except where the law says otherwise.",
        },
      ],
    },
    {
      id: "ending",
      heading: "Ending your account",
      blocks: [
        {
          kind: "paragraph",
          text: "You can delete your account whenever you like, from Settings. What that removes, and what survives it, is set out in the Privacy Policy.",
        },
        {
          kind: "paragraph",
          text: "We may suspend or end your account if you break these Terms or the Guidelines, if we are required to by law, or if keeping it open would put other members at risk.",
        },
      ],
    },
    {
      id: "ip",
      heading: "Eraya's own material",
      blocks: [
        {
          kind: "paragraph",
          text: "The Eraya name, logo, design, text and software belong to Eraya. You may use them as part of using the service normally. Please do not copy them, reuse them elsewhere, or present them as your own.",
        },
      ],
    },
    {
      id: "availability",
      heading: "Availability and changes",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya is provided as it is. We do not promise it will always be available or free of faults, and there will be times when it is down for maintenance or for reasons outside our control.",
        },
        {
          kind: "paragraph",
          text: "We may change, add or remove features. Where a change materially reduces something you have already paid for, we will do what is fair in the circumstances.",
        },
        {
          kind: "paragraph",
          text: "We may update these Terms. If a change matters, we will update the date on this page and, where it is significant, tell members. Continuing to use Eraya after that means the updated Terms apply.",
        },
      ],
    },
    {
      id: "liability",
      heading: "Responsibility and liability",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya introduces people. It does not supervise them. We do not carry out background checks, and we cannot vouch for anybody. You are responsible for how you interact with other members, online and in person, and for deciding who to meet.",
        },
        {
          kind: "paragraph",
          text: "To the extent the law allows, Eraya is not liable for indirect or consequential loss, for loss of profit or opportunity, or for the conduct of other members, whether on Eraya or away from it. Where we are liable, our total liability is limited to the amount you paid Eraya in the twelve months before the claim.",
        },
        {
          kind: "paragraph",
          text: "Nothing here removes rights you have under Indian consumer law, or limits liability that cannot lawfully be limited.",
        },
      ],
    },
    {
      id: "law",
      heading: "Governing law and contact",
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms are governed by the laws of India, and the courts of India have jurisdiction over any dispute.",
        },
        {
          kind: "paragraph",
          text: "For support, complaints or grievances, write to support@eraya.app.",
        },
        {
          kind: "paragraph",
          text: "These Terms are published in English. Translations may be offered for convenience; the English version is the one that governs.",
        },
      ],
    },
  ],
};
