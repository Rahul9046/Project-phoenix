import type { LegalDocument } from "./types";

/**
 * How members are expected to treat each other.
 *
 * Written to be read by a person who is nervous about starting again, not by a
 * lawyer. No statute numbers, no deadlines, no defined terms -- those belong in
 * the Terms, and putting them here would mean nobody finishes the page.
 *
 * It still has to be honest about enforcement. Eraya is one person reading a
 * queue by hand. So this promises care and says nothing about response times,
 * round-the-clock moderation or guaranteed outcomes, because none of those
 * exist and a safety page that overpromises is the worst place to overpromise.
 */
export const communityGuidelines: LegalDocument = {
  id: "safety",
  title: "Community and Safety Guidelines",
  lede: "Eraya is a place for divorced, separated and widowed adults to meet people and explore something new. Starting again takes trust, so here is what we ask of each other.",
  sections: [
    {
      id: "principle",
      heading: "The whole idea, in one paragraph",
      blocks: [
        {
          kind: "paragraph",
          text: "Everyone here has been through an ending. That takes a certain amount of courage to follow with a beginning, and it means people arrive carrying things. Treat the person on the other side of the conversation as someone doing something difficult, because they are. Most of what follows is that one idea, spelled out.",
        },
      ],
    },
    {
      id: "genuine",
      heading: "Be who you say you are",
      blocks: [
        {
          kind: "list",
          items: [
            "Use your own name, your own photos and your own story",
            "Do not create fake profiles",
            "Do not pretend to be someone else, real or invented",
            "Do not use photos of other people, or photos you found somewhere",
            "Do not mislead people about your age, your situation or your intentions",
          ],
        },
        {
          kind: "paragraph",
          text: "Where Eraya can verify something, it verifies only that narrow thing. It is never a guarantee of who somebody is or how they will behave. Keep your own judgement switched on.",
        },
      ],
    },
    {
      id: "respect",
      heading: "Respect",
      blocks: [
        {
          kind: "paragraph",
          text: "None of this is welcome here:",
        },
        {
          kind: "list",
          items: [
            "Harassment of any kind",
            "Threats or intimidation",
            "Abusive, demeaning or humiliating messages",
            "Contacting someone again and again when they have not replied",
            "Hateful or degrading remarks about who someone is",
          ],
        },
        {
          kind: "paragraph",
          text: "Connecting with someone is not a promise to keep talking, and it is certainly not a promise to meet. People go quiet. People change their minds. That is allowed, and it does not need to be explained.",
        },
      ],
    },
    {
      id: "consent",
      heading: "Consent and boundaries",
      blocks: [
        {
          kind: "list",
          items: [
            "Never pressure anyone into sexual conversation or activity",
            "Do not push for photos",
            "Do not push for a phone number, an address or any other contact detail",
            "Do not push to meet in person",
            "Never ask another member for money",
            "If someone says no, stops replying, disconnects or blocks you, that is the end of it",
            "Do not make another account to get around a block",
          ],
        },
        {
          kind: "paragraph",
          text: "Someone slowing down is not someone being rude. Let people move at their own pace.",
        },
      ],
    },
    {
      id: "minors",
      heading: "Adults only",
      blocks: [
        {
          kind: "list",
          items: [
            "Eraya is strictly for people aged 18 and over",
            "Do not create an account for anyone under 18, and do not help a minor get access",
            "Any romantic or sexual interaction involving a minor is absolutely prohibited",
            "Do not use profile photos that feature children",
          ],
        },
        {
          kind: "paragraph",
          text: "If you think a minor is using Eraya, report it or write to support@eraya.app. We treat this as seriously as anything on this page.",
        },
      ],
    },
    {
      id: "scams",
      heading: "Money, scams and exploitation",
      blocks: [
        {
          kind: "paragraph",
          text: "Romance scams are real, they are common, and they are aimed at exactly the people Eraya is for. None of the following is permitted:",
        },
        {
          kind: "list",
          items: [
            "Building a relationship in order to ask for money",
            "Invented emergencies, medical bills, stranded-abroad stories or unpaid customs fees",
            "Investment tips, trading schemes, cryptocurrency offers or get-rich-quick pitches",
            "Phishing, or links designed to capture someone's details",
            "Asking for passwords, one-time passcodes, card numbers or banking details",
            "Extortion, blackmail or threats to expose someone",
            "Any other attempt to manipulate someone financially",
          ],
        },
        {
          kind: "paragraph",
          text: "If somebody you met on Eraya asks you for money, that is worth reporting even if you are not sure. Nobody from Eraya will ever ask you for a passcode or a payment detail.",
        },
      ],
    },
    {
      id: "privacy",
      heading: "Other people's privacy",
      blocks: [
        {
          kind: "list",
          items: [
            "Do not share another member's private information without their permission",
            "Do not threaten to expose someone's private information, photographs or personal history",
            "Never share intimate images of anyone without their clear consent",
          ],
        },
        {
          kind: "paragraph",
          text: "What someone tells you in confidence stays with you. People here are often sharing things they have not told many people.",
        },
      ],
    },
    {
      id: "intimate",
      heading: "Sexual and intimate content",
      blocks: [
        {
          kind: "list",
          items: [
            "No sexually explicit photos in profiles or anywhere else publicly visible on Eraya",
            "No intimate images of anyone shared without their consent",
            "No sexual exploitation of any kind",
            "Absolutely no sexual material involving minors",
            "No threatening to share intimate images of someone",
          ],
        },
        {
          kind: "paragraph",
          text: "Some of these reports are handled faster than others, because some of them have to be.",
        },
      ],
    },
    {
      id: "hate",
      heading: "Hate and discrimination",
      blocks: [
        {
          kind: "paragraph",
          text: "Do not attack, threaten or dehumanise people for who they are, including their religion, caste, ethnicity, nationality, gender, sexuality, disability, appearance or marital history. Eraya exists for people whose marriages ended. Contempt for that is not a personality.",
        },
      ],
    },
    {
      id: "violence",
      heading: "Violence",
      blocks: [
        {
          kind: "paragraph",
          text: "No credible threats of violence, no organising violence, and no glorifying or encouraging serious harm, including harm to oneself.",
        },
      ],
    },
    {
      id: "commercial",
      heading: "Selling, spam and scraping",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya is not a marketplace and not a lead list.",
        },
        {
          kind: "list",
          items: [
            "No spam or bulk messaging",
            "No promoting a business, product or service",
            "No recruiting members as customers or clients",
            "No financial or referral schemes",
            "No scraping or copying member information",
            "No bots or automation used to work around how Eraya is meant to be used",
          ],
        },
      ],
    },
    {
      id: "ai",
      heading: "AI and manipulated content",
      blocks: [
        {
          kind: "paragraph",
          text: "Do not use AI-generated content, deepfakes, or manipulated images, audio or video to impersonate someone, to mislead members about who you are, to sexually exploit anyone, to commit fraud, or to harass anyone.",
        },
        {
          kind: "paragraph",
          text: "This is about deception, not about tools. Using something to help you word a message is not what this prohibits. Your profile photos should be photographs of you.",
        },
      ],
    },
    {
      id: "meeting",
      heading: "If you decide to meet",
      blocks: [
        {
          kind: "paragraph",
          text: "Meeting someone is a real step. A few things worth doing, every time and not only the first time:",
        },
        {
          kind: "list",
          items: [
            "Meet somewhere public, and keep the first few meetings public",
            "Tell somebody you trust where you are going and who you are meeting",
            "Arrange your own way there and your own way back",
            "Keep your financial details to yourself, however the conversation goes",
            "If something feels wrong, leave. You do not owe anyone an explanation",
          ],
        },
        {
          kind: "paragraph",
          text: "Nobody is owed a meeting. Changing your mind on the day is a complete reason.",
        },
      ],
    },
    {
      id: "blocking",
      heading: "Blocking",
      blocks: [
        {
          kind: "paragraph",
          text: "Blocking someone is a boundary, not an accusation. You never have to justify it, to them or to us, and the person you block is not told why. Use it whenever you want to.",
        },
      ],
    },
    {
      id: "reporting",
      heading: "Reporting",
      blocks: [
        {
          kind: "paragraph",
          text: "If someone breaks these guidelines, report them. You can report from a profile or a conversation, and you can write to support@eraya.app where that is easier.",
        },
        {
          kind: "paragraph",
          text: "To look into a report we may need to read relevant information, including messages connected to it. Please do not make reports you know to be false, or use reporting to punish somebody for disconnecting.",
        },
      ],
    },
    {
      id: "enforcement",
      heading: "What we do about it",
      blocks: [
        {
          kind: "paragraph",
          text: "Depending on what we find, we may:",
        },
        {
          kind: "list",
          items: [
            "Do nothing, where we cannot establish that anything happened",
            "Remove or restrict content",
            "Limit what an account can do",
            "Suspend an account",
            "Remove an account permanently",
            "Keep relevant information where there is a legitimate reason to",
            "Respond to lawful requests from authorities",
          ],
        },
        {
          kind: "paragraph",
          text: "Being honest about the limits: Eraya is small. Reports are read by a person, not around the clock, and not instantly. We cannot promise that every report gets a human investigation, a particular outcome, or a reply within a set time. We do not run background checks on members, and we cannot guarantee anyone's safety. What we can say is that reports are taken seriously and that safety comes before growth.",
        },
      ],
    },
    {
      id: "emergency",
      heading: "In an emergency",
      blocks: [
        {
          kind: "paragraph",
          text: "Eraya's reporting system is not an emergency service and is not monitored around the clock. If you are in danger or somebody else is, contact your local emergency services first. Report it to us afterwards.",
        },
      ],
    },
  ],
};
