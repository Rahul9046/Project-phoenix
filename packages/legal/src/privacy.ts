import type { LegalDocument } from "./types";

/**
 * What Eraya holds about a person, and what it does with it.
 *
 * Every claim here is checkable against the repository. Where a service is
 * configured but not switched on -- MSG91, live Razorpay -- this says the
 * capability is not in use rather than describing it as though it were, because
 * a policy that describes a fuller product than exists is not a cautious policy,
 * it is an inaccurate one.
 */
export const privacyPolicy: LegalDocument = {
  id: "privacy",
  title: "Privacy Policy",
  lede: "What Eraya collects, why, who can see it, and what happens when you leave. Written to be read, not to be survived.",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya is operated by Rahul Das, trading as Eraya, in India. For anything about your privacy, including a grievance, write to support@eraya.app. That address is read by a person and is the only contact address Eraya gives out.",
        },
        {
          kind: "paragraph",
          text: "Eraya is a relationship and community platform for divorced, separated and widowed adults. It is strictly for people aged 18 and over.",
        },
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      blocks: [
        {
          kind: "subheading",
          text: "What you tell us",
        },
        {
          kind: "paragraph",
          text: "When you create an account and fill in your profile, we collect:",
        },
        {
          kind: "list",
          items: [
            "Your email address, which is how you sign in",
            "Your first name",
            "Your date of birth. We store the date so we can confirm you are 18 or over, but only your age is ever shown to another member",
            "Your gender, and who you are hoping to meet",
            "Your relationship status, which Eraya calls your chapter",
            "Your city",
            "The languages you speak",
            "Anything you choose to write about yourself",
            "Profile photos, which are optional. An account without a photo is a complete account",
          ],
        },
        {
          kind: "paragraph",
          text: "If you sign in with Google or Facebook, we receive your name and email address from them so that we can create your account. We do not receive your password, and we do not post anything to those accounts.",
        },
        {
          kind: "subheading",
          text: "Your phone number",
        },
        {
          kind: "paragraph",
          text: "Eraya asks for a phone number during signup. Real network verification is not switched on yet: no SMS is sent, the number is not checked against a mobile network, and no member is shown a verified mark on the strength of it. If and when verification is genuinely live, we will say so here before it starts.",
        },
        {
          kind: "subheading",
          text: "What you do on Eraya",
        },
        {
          kind: "list",
          items: [
            "Who you express interest in, and who expresses interest in you",
            "The connections that result",
            "Messages you exchange with the people you have connected with",
            "Members you have blocked",
            "Reports you make about other members, and reports made about you",
          ],
        },
        {
          kind: "subheading",
          text: "Payments",
        },
        {
          kind: "paragraph",
          text: "If you buy Eraya Premium, we store the order and payment identifiers our payment provider gives us, the amount, the status of the payment and the membership period it bought. We do not receive or store your card number, your UPI ID, your CVV or your bank credentials. Those go to the payment provider and never reach Eraya.",
        },
        {
          kind: "subheading",
          text: "Technical and operational records",
        },
        {
          kind: "paragraph",
          text: "We keep product analytics about how the app is used, records of authentication events such as sign-ins, records of payment events, and the operational and security logs our hosting and database providers generate in the ordinary course of running a service.",
        },
      ],
    },
    {
      id: "why",
      heading: "Why we process it",
      blocks: [
        {
          kind: "list",
          items: [
            "To create and run your account, and to sign you in",
            "To confirm that you are 18 or over",
            "To show your profile to the members Eraya introduces you to, and to show you theirs",
            "To let you express interest, connect and exchange messages",
            "To take payment for Premium and to give you the membership you paid for",
            "To act on reports, investigate abuse and fraud, and keep members safe",
            "To keep the service secure and working, and to fix it when it breaks",
            "To understand how the product is used so we can improve it",
            "To meet our legal obligations, and to establish or defend legal claims",
          ],
        },
      ],
    },
    {
      id: "who-sees",
      heading: "Who can see your profile",
      blocks: [
        {
          kind: "paragraph",
          text: "Your profile is visible inside Eraya, to members you are introduced to. It is not a public web page. There is no directory, no profile search, and no way for someone to look you up by name.",
        },
        {
          kind: "paragraph",
          text: "Member profiles are not intended to be found by search engines, and the signed-in part of Eraya tells search engines not to index it. We will not deliberately make member profiles publicly indexable. If Eraya's public marketing pages are opened to search engines in future, member profiles stay out of that.",
        },
        {
          kind: "paragraph",
          text: "Another member sees your first name, your age, your city, your chapter, your languages and what you have written. They never see your date of birth, your email address or your phone number.",
        },
      ],
    },
    {
      id: "messages",
      heading: "Your messages",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya does not routinely read or monitor private conversations. Nobody sits reading members' messages.",
        },
        {
          kind: "paragraph",
          text: "Messages and related information may be accessed or processed where it is reasonably necessary to look into a report, to investigate abuse, fraud or a safety concern, to protect the security of the service, to comply with the law, to enforce our Terms, or to operate the service.",
        },
        {
          kind: "paragraph",
          text: "Messages are not end-to-end encrypted, and we do not claim that they are. They are stored in Eraya's database and are protected by the access controls described below, which means Eraya is technically able to read them in the circumstances above. We would rather say that plainly than let anyone assume otherwise.",
        },
      ],
    },
    {
      id: "not-sold",
      heading: "What we do not do",
      blocks: [
        {
          kind: "list",
          items: [
            "We do not sell your personal data",
            "We do not sell your photos",
            "We do not share your personal data with third-party advertisers for targeted advertising",
            "We do not use your private messages, your photos or your private profile information to train AI models. If that ever changes, it will require your separate, explicit consent, asked for in plain words",
          ],
        },
        {
          kind: "paragraph",
          text: "This does not rule out using automated tools to help keep members safe, for example to help detect abuse or fraud. If Eraya introduces anything like that, we will describe it here and handle it lawfully.",
        },
      ],
    },
    {
      id: "providers",
      heading: "The services we rely on",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya is a small operation and uses established providers rather than building everything itself. The ones that handle your information are:",
        },
        {
          kind: "list",
          items: [
            "Supabase, which provides Eraya's database, authentication and photo storage. This is where your account and your content live",
            "Cloudflare, which hosts and serves the Eraya website",
            "Resend, which delivers Eraya's emails, including your six-digit sign-in codes",
            "Razorpay, which processes payments. Razorpay is currently in test mode, so no real money moves and no live payment has been taken",
            "Google and Meta, if you choose to sign in with Google or Facebook",
          ],
        },
        {
          kind: "paragraph",
          text: "MSG91 is configured for sending SMS one-time passcodes but is not in use, because phone verification is not switched on. No phone number has been sent to it.",
        },
        {
          kind: "paragraph",
          text: "These providers process information on Eraya's behalf and under their own terms. Some of them operate outside India, which means your information may be processed outside India.",
        },
      ],
    },
    {
      id: "security",
      heading: "How your information is protected",
      blocks: [
        {
          kind: "paragraph",
          text: "Access to member data is enforced in the database itself, through row-level security policies, rather than only in the app. A request that asks for someone else's row does not get it, regardless of which client made the request. Sensitive operations run on the server with credentials that never reach your phone or browser.",
        },
        {
          kind: "paragraph",
          text: "Connections to Eraya use HTTPS. Sign-in uses a six-digit code sent to your email, or Google or Facebook sign-in. There is no password to be stolen or reused.",
        },
        {
          kind: "paragraph",
          text: "We are deliberately not claiming more than that. Eraya has not been through a security audit or penetration test, holds no security certification, and does not have continuous security monitoring. No service can promise absolute security, and we are not going to be the one that does.",
        },
      ],
    },
    {
      id: "storage",
      heading: "Cookies and storage on your device",
      blocks: [
        {
          kind: "paragraph",
          text: "On the website, Eraya sets cookies that keep you signed in, and a cookie that remembers which of the six languages you chose. There are no advertising cookies and no third-party tracking cookies.",
        },
        {
          kind: "paragraph",
          text: "In the app, your sign-in session is held in the device's secure storage, and your language choice is stored on the device.",
        },
        {
          kind: "paragraph",
          text: "That is the whole list. Eraya does not use advertising identifiers, tracking pixels or cross-site tracking.",
        },
      ],
    },
    {
      id: "deletion",
      heading: "Keeping and deleting your information",
      blocks: [
        {
          kind: "paragraph",
          text: "You can delete your account at any time, from Settings on either the website or the app. Deleting your account deletes or de-identifies the personal information associated with it, including your profile, your answers, your photos, your interests and your connections.",
        },
        {
          kind: "paragraph",
          text: "Some things survive that, and you should know which:",
        },
        {
          kind: "list",
          items: [
            "Messages you have already sent may remain in the other member's copy of the conversation. We cannot reach into someone else's conversation history and remove what they received",
            "Information we are required to keep for legal, tax, fraud-prevention, security, dispute-resolution or record-keeping reasons is kept for as long as that reason applies",
            "Backups may still contain your information for a period, until they are overwritten or removed through normal processes",
          ],
        },
        {
          kind: "paragraph",
          text: "Deleting your account does not by itself entitle you to a refund of unused Premium time. See the Terms for how refunds work.",
        },
      ],
    },
    {
      id: "your-choices",
      heading: "Your choices",
      blocks: [
        {
          kind: "paragraph",
          text: "You can view and change most of your information in the app or on the website: edit your profile, add or remove photos, change your language, block members, and delete your account.",
        },
        {
          kind: "paragraph",
          text: "Indian data protection law gives you rights over your personal data, including to access it, to have inaccurate data corrected, to have data erased, and to complain. To exercise any of these, write to support@eraya.app. We will respond as quickly as we reasonably can. We may need to confirm who you are first, and there are requests we may not be able to meet in full, for example where the information is also someone else's or where we are required to keep it.",
        },
      ],
    },
    {
      id: "children",
      heading: "Under-18s",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya is for adults. Nobody under 18 may create an account or use the service, and this is enforced when a date of birth is entered, in both clients and in the database. If we find an account belonging to someone under 18, we will remove it. If you believe a minor is using Eraya, tell us at support@eraya.app.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        {
          kind: "paragraph",
          text: "If this policy changes in a way that matters, we will update the date on this page and, where the change is significant, tell members directly. Continuing to use Eraya after a change means the updated policy applies to you.",
        },
        {
          kind: "paragraph",
          text: "This policy is published in English. Translations may be offered for convenience; the English version is the one that governs.",
        },
      ],
    },
  ],
};
