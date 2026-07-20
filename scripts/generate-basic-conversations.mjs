import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.join(process.cwd(), "data", "example-contexts");

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from",
  "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "this", "to", "we",
  "with", "you", "your",
]);

const pages = [
  {
    id: "13-introductions", title: "Personal introductions",
    description: "Ways a user can introduce themselves at the start of a conversation.",
    intent: "introduction", domain: "conversation", purpose: "acknowledge an introduction", tone: "warm",
    left: ["My name is", "I'm", "You can call me", "I go by", "I'd like to introduce myself as", "Let me introduce myself; I'm", "For this conversation, call me", "I should introduce myself—I'm"],
    right: ["Alex.", "Bailey.", "Casey.", "Dana.", "Eli.", "Frankie.", "Harper.", "Jordan.", "Morgan.", "Riley."],
    responses: [
      "Nice to meet you. I can use the name in this message while responding to this turn.",
      "Hello, and thank you for introducing yourself.",
      "It is good to meet you. I am Lexi Language.",
    ],
  },
  {
    id: "14-asking-a-name", title: "Asking a conversational partner's name",
    description: "Basic questions asking Lexi to identify itself by name.",
    intent: "ask-name", domain: "conversation", purpose: "state Lexi's name", tone: "warm",
    left: ["What is your name", "What should I call you", "Could you tell me your name", "May I ask your name", "Who am I speaking with", "How should I address you", "Would you introduce yourself", "Can you remind me of your name"],
    right: ["?", " again?", " in this conversation?", " here?", " please?", " before we begin?", " so I know?", " for clarity?", " in a few words?", " right now?"],
    responses: [
      "My name is Lexi Language.",
      "You can call me Lexi.",
      "I am Lexi Language, Alphaine's deterministic language prototype.",
    ],
  },
  {
    id: "15-apologies", title: "Making apologies",
    description: "Common ways a speaker apologizes for an ordinary conversational mistake.",
    intent: "apology", domain: "conversation", purpose: "acknowledge an apology", tone: "warm",
    left: ["I'm sorry", "I apologize", "Please forgive me", "That was my mistake", "I want to say sorry", "I owe you an apology", "I did not mean to cause trouble", "I regret what happened"],
    right: ["for being late.", "for the confusion.", "for interrupting.", "for misunderstanding you.", "for the mistake.", "for speaking too quickly.", "for forgetting.", "for the inconvenience.", "for changing the plan.", "for not being clear."],
    responses: [
      "Thank you for apologizing. We can continue from here.",
      "Your apology is acknowledged.",
      "I understand that you are apologizing, and we can move forward.",
    ],
  },
  {
    id: "16-accepting-apologies", title: "Accepting apologies",
    description: "Reassuring replies that accept an apology and continue the exchange.",
    intent: "accept-apology", domain: "conversation", purpose: "recognize acceptance of an apology", tone: "warm",
    left: ["That's okay", "No problem", "I accept your apology", "Do not worry", "It is all right", "We can move on", "Thanks for saying sorry", "I understand"],
    right: ["about the delay.", "about the confusion.", "about the interruption.", "about the misunderstanding.", "about the mistake.", "this time.", "and appreciate the apology.", "so let us continue.", "and there are no hard feelings.", "because mistakes happen."],
    responses: [
      "Thank you. I understand that the apology has been accepted.",
      "Understood. The conversation can continue.",
      "That acceptance is clear; we can move to the next point.",
    ],
  },
  {
    id: "17-acknowledgements", title: "Acknowledging information",
    description: "Short turns showing that information was heard or understood.",
    intent: "acknowledgement", domain: "conversation", purpose: "recognize understanding", tone: "neutral",
    left: ["I understand", "Got it", "That makes sense", "I see", "Understood", "I follow you", "That is clear", "I have noted"],
    right: ["now.", "the main point.", "what you mean.", "the explanation.", "the instructions.", "the difference.", "the next step.", "your answer.", "the context.", "that detail."],
    responses: [
      "Good. The point has been acknowledged.",
      "Understood. We can continue when you are ready.",
      "Thank you for confirming that the explanation was clear.",
    ],
  },
  {
    id: "18-agreement", title: "Expressing agreement",
    description: "Everyday language for agreeing with an idea or proposed direction.",
    intent: "agreement", domain: "conversation", purpose: "recognize agreement", tone: "neutral",
    left: ["I agree", "That sounds right", "I think so too", "We are on the same page", "That works for me", "I share that view", "Yes, that makes sense", "I support that approach"],
    right: ["about the main point.", "on this issue.", "with that explanation.", "about the next step.", "with the proposed plan.", "on the basic idea.", "with your conclusion.", "about how to proceed.", "with that interpretation.", "on what matters most."],
    responses: [
      "Your agreement is clear.",
      "Understood. You support the stated point.",
      "I recognize that you agree with that direction.",
    ],
  },
  {
    id: "19-disagreement", title: "Expressing respectful disagreement",
    description: "Polite ways to disagree without ending the conversation.",
    intent: "disagreement", domain: "conversation", purpose: "recognize disagreement", tone: "cautious",
    left: ["I disagree", "I do not think so", "I see it differently", "I'm not convinced", "That does not seem right", "I have another view", "I cannot agree", "I respectfully disagree"],
    right: ["about the main point.", "on this issue.", "with that explanation.", "about the next step.", "with the proposed plan.", "on the basic idea.", "with that conclusion.", "about how to proceed.", "with that interpretation.", "on what matters most."],
    responses: [
      "Your disagreement is clear. You can state the specific point you would change.",
      "Understood. A different view has been expressed.",
      "I recognize the disagreement and can compare the competing statements if you provide them.",
    ],
  },
  {
    id: "20-clarification-requests", title: "Requests for clarification",
    description: "Questions asking for an unclear statement to be made more precise.",
    intent: "clarification-request", domain: "conversation", purpose: "ask what needs clarification", tone: "precise",
    left: ["Could you clarify", "Can you explain", "What do you mean by", "Please make clearer", "Could you be more specific about", "I need clarification about", "Would you clarify", "Can you unpack"],
    right: ["that point?", "the last sentence?", "what happens next?", "the main idea?", "that word?", "the difference?", "your conclusion?", "the instructions?", "the example?", "the context?"],
    responses: [
      "Please identify the exact word or point that needs clarification, and I will match it against my recorded contexts.",
      "I can clarify a recorded topic. Name the part that is unclear.",
      "Tell me which statement you want explained more precisely.",
    ],
  },
  {
    id: "21-repetition-requests", title: "Requests for repetition",
    description: "Common requests to repeat or restate information.",
    intent: "repetition-request", domain: "conversation", purpose: "offer a bounded restatement", tone: "neutral",
    left: ["Could you repeat", "Please say again", "Can you restate", "Would you repeat", "I need to hear again", "Please go over", "Could you tell me again", "Can you repeat more slowly"],
    right: ["the answer?", "the last point?", "that sentence?", "the instructions?", "the main idea?", "the example?", "the explanation?", "the question?", "what you just said?", "the important part?"],
    responses: [
      "I can restate a recorded answer when you name the topic you want repeated.",
      "Tell me which topic to repeat, and I will retrieve the closest recorded response.",
      "I can repeat the relevant point after you identify it.",
    ],
  },
  {
    id: "22-confirmation-questions", title: "Confirmation questions",
    description: "Questions checking whether an interpretation or next step is correct.",
    intent: "confirmation-question", domain: "conversation", purpose: "request a precise proposition", tone: "precise",
    left: ["Did you mean", "Are you saying", "Is it correct", "Can you confirm", "Am I right that", "Should I understand", "Is the idea", "Do I have this right:"],
    right: ["that we should continue?", "that this is the main point?", "that the answer is limited?", "that the first step comes next?", "that the two ideas differ?", "that this example belongs here?", "that the instruction is complete?", "that no other action is needed?", "that this wording is accurate?", "that I understood correctly?"],
    responses: [
      "I can confirm only a specific recorded claim. State the proposition directly if you want a yes-or-no check.",
      "Your message asks for confirmation; the exact claim must be compared with the available context.",
      "Please state the point as a complete claim so I can check it without guessing.",
    ],
  },
  {
    id: "23-simple-requests", title: "Simple conversational requests",
    description: "Polite requests for basic explanation and presentation actions.",
    intent: "simple-request", domain: "conversation", purpose: "identify a requested action", tone: "neutral",
    left: ["Please", "Could you", "Can you", "Would you", "I would like you to", "I need you to", "Kindly", "When you can, please"],
    right: ["explain that simply.", "give one example.", "summarize the main point.", "show the next step.", "use shorter words.", "list the basic ideas.", "describe the difference.", "state the answer directly.", "help me begin.", "make the instructions clearer."],
    responses: [
      "I recognize the requested action. I can perform it when the topic exists in my recorded contexts.",
      "That is a clear request. Provide the topic, and I will use the closest supported response.",
      "The request is understood; I still need a supported topic to answer without inventing information.",
    ],
  },
  {
    id: "24-permission-requests", title: "Asking permission",
    description: "Basic questions requesting permission to take an ordinary action.",
    intent: "permission-request", domain: "conversation", purpose: "recognize a request for permission", tone: "neutral",
    left: ["May I", "Can I", "Could I", "Would it be okay if I", "Do you mind if I", "Is it all right to", "Am I allowed to", "Would you permit me to"],
    right: ["ask another question?", "start again?", "change the subject?", "take a short break?", "give an example?", "explain my view?", "check one detail?", "continue the conversation?", "use a different word?", "return to the earlier point?"],
    responses: [
      "Yes, you may continue with that conversational action.",
      "That is fine within this conversation.",
      "You may proceed. I will respond within the contexts I support.",
    ],
  },
  {
    id: "25-offers-to-help", title: "Offering help",
    description: "Ways a speaker offers practical help in a conversation.",
    intent: "offer-help", domain: "conversation", purpose: "acknowledge an offer of help", tone: "warm",
    left: ["Can I help", "May I help", "Would you like help", "Do you need help", "I can help", "Let me help", "I'd be happy to help", "Is there a way I can help"],
    right: ["with that task?", "with the next step?", "with the explanation?", "with the list?", "with checking the details?", "with organizing the ideas?", "with finding the mistake?", "with the example?", "with the instructions?", "with anything else?"],
    responses: [
      "Thank you for offering to help.",
      "Your offer is appreciated.",
      "I recognize the offer of help. You can continue by stating what you want to contribute.",
    ],
  },
  {
    id: "26-invitations", title: "Making invitations",
    description: "Everyday invitations to shared activities.",
    intent: "invitation", domain: "conversation", purpose: "respond to an invitation without claiming physical participation", tone: "warm",
    left: ["Would you like to", "Do you want to", "Can you", "Will you", "How about we", "Why don't we", "I'd like to invite you to", "Would you be interested in"],
    right: ["talk for a while?", "work through an example?", "review the main idea?", "continue this discussion?", "explore another topic?", "practice a conversation?", "look at the next question?", "compare two sentences?", "solve a language problem?", "begin a new topic?"],
    responses: [
      "I can participate in that activity here through supported text conversation.",
      "Yes, we can do that within this chat and the contexts I have learned.",
      "I can join the text-based part of that activity.",
    ],
  },
  {
    id: "27-accepting-invitations", title: "Accepting invitations",
    description: "Positive replies accepting an invitation or proposed activity.",
    intent: "accept-invitation", domain: "conversation", purpose: "recognize acceptance of an invitation", tone: "warm",
    left: ["Yes, I'd like to", "That sounds good; let's", "I'd be happy to", "Sure, we can", "Count me in; let's", "I accept; let's", "That would be nice; let's", "Yes, I can"],
    right: ["talk for a while.", "work through an example.", "review the main idea.", "continue the discussion.", "explore another topic.", "practice a conversation.", "look at the next question.", "compare two sentences.", "solve the language problem.", "begin a new topic."],
    responses: [
      "The invitation has been accepted.",
      "Understood. You would like to take part.",
      "Your acceptance is clear, so the proposed activity can begin.",
    ],
  },
  {
    id: "28-declining-invitations", title: "Declining invitations",
    description: "Polite replies declining an invitation or proposed activity.",
    intent: "decline-invitation", domain: "conversation", purpose: "recognize a declined invitation", tone: "warm",
    left: ["No thank you, I cannot", "I'd rather not", "I appreciate it, but I cannot", "Maybe another time; I cannot", "Thank you, but I'll pass on", "That sounds nice, but I cannot", "I have to decline; I cannot", "Sorry, I am not able to"],
    right: ["talk right now.", "work through the example.", "review the main idea.", "continue the discussion.", "explore another topic.", "practice the conversation.", "look at the next question.", "compare the sentences.", "solve the problem now.", "begin a new topic."],
    responses: [
      "Understood. The invitation has been politely declined.",
      "That is fine; you do not want to take part right now.",
      "Your decision is clear, and no participation is assumed.",
    ],
  },
  {
    id: "29-preference-questions", title: "Asking about preferences",
    description: "Simple either-or questions about a conversational partner's preferences.",
    intent: "preference-question", domain: "conversation", purpose: "answer preference questions without claiming feelings", tone: "neutral",
    left: ["Do you prefer", "Which do you prefer,", "Would you rather choose", "What do you like better,", "If you had to choose, would it be", "Is your preference", "Which option would you select,", "Between the two, do you favor"],
    right: ["short answers or detailed ones?", "questions or statements?", "examples or definitions?", "simple words or technical terms?", "one topic or several topics?", "formal language or casual language?", "lists or paragraphs?", "direct replies or explanations?", "practice or review?", "speed or completeness?"],
    responses: [
      "I do not have personal preferences, but I can follow the response style you request.",
      "I do not experience preference. You can tell me which option to use.",
      "Either option can be treated as an instruction when it is supported by my recorded contexts.",
    ],
  },
  {
    id: "30-expressing-likes", title: "Expressing likes",
    description: "Basic positive preference statements about everyday topics.",
    intent: "express-like", domain: "conversation", purpose: "acknowledge a stated like", tone: "warm",
    left: ["I like", "I really like", "I enjoy", "I am fond of", "I appreciate", "One thing I like is", "I have a preference for", "I'm interested in"],
    right: ["reading books.", "learning languages.", "quiet mornings.", "clear explanations.", "helpful examples.", "walking outside.", "listening to music.", "solving puzzles.", "trying new food.", "meeting new people."],
    responses: [
      "I understand that you like that activity or quality.",
      "Your positive preference has been noted in this turn.",
      "That statement clearly expresses something you enjoy.",
    ],
  },
  {
    id: "31-expressing-dislikes", title: "Expressing dislikes",
    description: "Basic negative preference statements about everyday topics.",
    intent: "express-dislike", domain: "conversation", purpose: "acknowledge a stated dislike", tone: "neutral",
    left: ["I dislike", "I do not like", "I really don't enjoy", "I am not fond of", "I would rather avoid", "One thing I dislike is", "I have no preference for", "I'm uncomfortable with"],
    right: ["unclear instructions.", "very loud places.", "waiting without information.", "confusing explanations.", "rushed decisions.", "wasting time.", "repeating the same mistake.", "unnecessary arguments.", "being interrupted.", "missing important details."],
    responses: [
      "I understand that you dislike that situation or quality.",
      "Your negative preference is clear in this turn.",
      "That statement identifies something you would rather avoid.",
    ],
  },
  {
    id: "32-positive-feelings", title: "Expressing positive feelings",
    description: "Everyday statements describing pleasant emotional states.",
    intent: "positive-feeling", domain: "conversation", purpose: "acknowledge a positive feeling", tone: "warm",
    left: ["I feel", "I'm feeling", "Today I feel", "Right now I'm", "This makes me feel", "I have been feeling", "At the moment I'm", "I want to say that I feel"],
    right: ["happy.", "calm.", "excited.", "hopeful.", "relieved.", "grateful.", "confident.", "proud.", "comfortable.", "cheerful."],
    responses: [
      "I understand that you are describing a positive feeling.",
      "Thank you for sharing how you feel.",
      "Your message communicates a positive emotional state.",
    ],
  },
  {
    id: "33-negative-feelings", title: "Expressing difficult feelings",
    description: "Everyday statements describing unpleasant emotional states.",
    intent: "negative-feeling", domain: "conversation", purpose: "acknowledge a difficult feeling without diagnosis", tone: "cautious",
    left: ["I feel", "I'm feeling", "Today I feel", "Right now I'm", "This makes me feel", "I have been feeling", "At the moment I'm", "I want to say that I feel"],
    right: ["sad.", "worried.", "frustrated.", "confused.", "lonely.", "disappointed.", "nervous.", "tired.", "overwhelmed.", "uncertain."],
    responses: [
      "I understand that you are describing a difficult feeling.",
      "Thank you for stating how you feel. I can acknowledge it, though I cannot diagnose its cause.",
      "Your message communicates an unpleasant emotional state.",
    ],
  },
  {
    id: "34-compliments", title: "Giving compliments",
    description: "Friendly compliments about a response or conversational quality.",
    intent: "compliment", domain: "conversation", purpose: "accept a compliment", tone: "warm",
    left: ["That explanation was", "Your answer was", "You were", "This explanation is", "I think your response is", "The way you explained that was", "Your help has been", "I found that answer"],
    right: ["helpful.", "clear.", "thoughtful.", "useful.", "easy to follow.", "well organized.", "precise.", "interesting.", "better than I expected.", "exactly what I needed."],
    responses: [
      "Thank you for the compliment.",
      "I appreciate the positive feedback.",
      "Thank you. I am glad the recorded response matched what you needed.",
    ],
  },
  {
    id: "35-congratulations", title: "Offering congratulations",
    description: "Common ways to congratulate someone on an achievement.",
    intent: "congratulations", domain: "conversation", purpose: "recognize congratulations", tone: "warm",
    left: ["Congratulations", "Well done", "Great job", "I'm happy for you", "You did it", "That is wonderful news", "You should be proud", "Please accept my congratulations"],
    right: ["on finishing the task!", "on reaching your goal!", "on the good result!", "on completing the project!", "on making progress!", "on passing the test!", "on learning something new!", "on solving the problem!", "on your achievement!", "on a job well done!"],
    responses: [
      "Thank you. I recognize the congratulatory message.",
      "The congratulations are warmly acknowledged.",
      "Thank you for expressing congratulations.",
    ],
  },
  {
    id: "36-encouragement", title: "Giving encouragement",
    description: "Supportive language encouraging someone to continue an effort.",
    intent: "encouragement", domain: "conversation", purpose: "recognize supportive encouragement", tone: "warm",
    left: ["Keep going with", "You can handle", "Do not give up on", "Take your time with", "I believe you can finish", "Stay focused on", "You're making progress with", "Keep trying to complete"],
    right: ["the task.", "the next step.", "the difficult part.", "your practice.", "the project.", "the explanation.", "the problem.", "your learning.", "the final details.", "what you started."],
    responses: [
      "Thank you for the encouragement.",
      "That message expresses clear support to continue.",
      "The supportive intent is understood and appreciated.",
    ],
  },
  {
    id: "37-small-talk", title: "Basic small talk",
    description: "Low-stakes questions that open casual conversation with Lexi.",
    intent: "small-talk", domain: "conversation", purpose: "handle casual questions without invented experiences", tone: "warm",
    left: ["How is your day going", "Are you having a good day", "What have you been doing", "Has your day been busy", "Are things going well", "How are things with you", "What is new with you", "Have you had an interesting day"],
    right: ["?", " so far?", " today?", " right now?", " at the moment?", " in this conversation?", " on your side?", " before we continue?", " if I may ask?", " lately?"],
    responses: [
      "I do not experience a day, but my deterministic response pipeline is available for this conversation.",
      "I do not have personal experiences. I am ready to continue matching your text with recorded contexts.",
      "Nothing happens to me between turns, but the current Lexi engine is ready.",
    ],
  },
];

function detectMode(input) {
  if (input.trim().endsWith("!")) return "exclamative";
  if (input.trim().endsWith("?")) return "interrogative";
  if (/^(explain|describe|define|show|tell|give|help|please|kindly|keep|take|stay)\b/i.test(input)) return "imperative";
  return "declarative";
}

function keywordsFor(input) {
  return [...new Set(input.toLowerCase().match(/[a-z]+/g) ?? [])]
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

function buildPage(page) {
  const inputs = page.left.flatMap((left) =>
    page.right.map((right) => `${left}${/^[\s?.!,;:]/.test(right) ? "" : " "}${right}`),
  );
  const entries = inputs.map((input, index) => ({
    id: `${page.id}-${String(index + 1).padStart(3, "0")}`,
    intent: page.intent,
    input,
    response: page.responses[index % page.responses.length],
    keywords: keywordsFor(input),
    mode: detectMode(input),
    context: { domain: page.domain, purpose: page.purpose, tone: page.tone },
  }));

  return {
    schemaVersion: 1,
    page: { id: page.id, title: page.title, description: page.description, language: "en" },
    entries,
  };
}

await mkdir(outputDirectory, { recursive: true });

for (const page of pages) {
  const target = path.join(outputDirectory, `${page.id}.json`);
  await writeFile(target, `${JSON.stringify(buildPage(page), null, 2)}\n`, "utf8");
}

const examples = pages.reduce((sum, page) => sum + page.left.length * page.right.length, 0);
console.log(`Generated ${pages.length} basic-conversation pages with ${examples} examples (${examples * 2} paired sentences).`);
