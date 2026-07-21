import type { SentenceAnalysis } from "@/lib/lexi/types";

type IntentRule = {
  intent: string;
  any: string[];
  all?: string[];
  weight: number;
};

const rules: IntentRule[] = [
  { intent: "greeting", any: ["hello", "hi", "hey", "greetings"], weight: 0.98 },
  { intent: "gratitude", any: ["thanks", "thank", "appreciate"], weight: 0.96 },
  { intent: "farewell", any: ["bye", "goodbye", "farewell"], weight: 0.96 },
  { intent: "wellbeing", any: ["feeling", "doing", "today"], all: ["how"], weight: 0.84 },
  { intent: "identity", any: ["who", "what"], all: ["lexi"], weight: 0.88 },
  { intent: "origin", any: ["alphaine", "origin", "created", "name"], weight: 0.83 },
  { intent: "mechanism", any: ["work", "mechanism", "process", "pipeline"], weight: 0.86 },
  { intent: "compare-ai", any: ["ai", "llm", "chatgpt", "prediction", "token"], weight: 0.89 },
  {
    intent: "context-module",
    any: ["module", "interpret", "understand", "meaning", "confidence", "explain"],
    all: ["context"],
    weight: 0.9,
  },
  { intent: "search-module", any: ["search", "retrieve", "lookup", "find"], weight: 0.85 },
  { intent: "connect-module", any: ["connect", "combine", "join", "link"], weight: 0.85 },
  { intent: "structure-module", any: ["structure", "grammar", "sentence", "clause"], weight: 0.85 },
  { intent: "capabilities", any: ["can", "capable", "feature", "ability"], weight: 0.8 },
  { intent: "limitations", any: ["limit", "mistake", "wrong", "hallucinate"], weight: 0.87 },
  { intent: "definition", any: ["define", "definition", "mean", "meaning"], weight: 1.12 },
  { intent: "synonym", any: ["synonym", "synonyms", "similar", "alternative", "thesaurus"], weight: 1.16 },
  { intent: "help", any: ["help", "guide", "start"], weight: 0.76 },
  { intent: "introduction", any: ["my name", "call me", "i go by", "introduce myself"], weight: 0.96 },
  { intent: "ask-name", any: ["your name", "call you", "address you", "speaking with"], weight: 0.98 },
  { intent: "apology", any: ["sorry", "apologize", "apology", "regret", "forgive"], weight: 0.97 },
  { intent: "accept-apology", any: ["that is okay", "no problem", "accept your apology", "do not worry", "move on", "no hard feelings"], weight: 0.94 },
  { intent: "acknowledgement", any: ["understand", "understood", "got it", "makes sense", "i see", "follow you", "noted"], weight: 0.9 },
  { intent: "agreement", any: ["agree", "same page", "sounds right", "think so too", "works for me", "support that"], weight: 0.93 },
  { intent: "disagreement", any: ["disagree", "not convinced", "see it differently", "cannot agree", "another view"], weight: 0.95 },
  { intent: "clarification-request", any: ["clarify", "clarification", "more specific", "more clearly", "make clearer", "what do you mean", "unpack"], weight: 1.04 },
  { intent: "repetition-request", any: ["repeat", "restate", "say again", "tell me again", "go over"], weight: 1.02 },
  { intent: "confirmation-question", any: ["confirm", "did you mean", "are you saying", "am i right", "have this right"], weight: 0.98 },
  { intent: "permission-request", any: ["may i", "could i", "okay if i", "mind if i", "allowed to", "all right to", "permit me"], weight: 0.96 },
  { intent: "offer-help", any: ["can i help", "may i help", "would you like help", "do you need help", "let me help", "happy to help"], weight: 1.04 },
  { intent: "invitation", any: ["would you like to", "do you want to", "how about we", "why do not we", "invite you", "interested in"], weight: 0.94 },
  { intent: "accept-invitation", any: ["count me in", "i accept", "i would like to", "happy to", "that would be nice"], weight: 0.9 },
  { intent: "decline-invitation", any: ["rather not", "another time", "i will pass", "have to decline", "not able to"], weight: 0.94 },
  { intent: "preference-question", any: ["do you prefer", "which do you prefer", "rather choose", "like better", "your preference", "do you favor"], weight: 0.96 },
  { intent: "express-like", any: ["i like", "i enjoy", "fond of", "preference for", "interested in"], weight: 0.9 },
  { intent: "express-dislike", any: ["i dislike", "do not like", "do not enjoy", "not fond of", "rather avoid", "uncomfortable with"], weight: 0.94 },
  { intent: "positive-feeling", any: ["happy", "calm", "excited", "hopeful", "relieved", "grateful", "confident", "proud", "comfortable", "cheerful"], all: ["feel"], weight: 0.96 },
  { intent: "negative-feeling", any: ["sad", "worried", "frustrated", "confused", "lonely", "disappointed", "nervous", "tired", "overwhelmed", "uncertain", "anxious"], all: ["feel"], weight: 0.96 },
  { intent: "compliment", any: ["answer was", "response is", "response was", "explanation is", "explained that", "help has been", "found that answer"], weight: 0.94 },
  { intent: "congratulations", any: ["congratulations", "well done", "great job", "you did it", "wonderful news", "proud of you"], weight: 0.98 },
  { intent: "encouragement", any: ["keep going", "do not give up", "take your time", "stay focused", "making progress", "keep trying"], weight: 0.94 },
  { intent: "small-talk", any: ["your day", "things with you", "new with you", "interesting day"], weight: 0.92 },
  { intent: "ask-time", any: ["what time", "current time", "tell me the time", "know the time", "check the time"], weight: 1.02 },
  { intent: "state-time", any: ["the time is", "meeting starts at", "appointment is at", "begin at"], weight: 0.94 },
  { intent: "ask-date", any: ["what is the date", "what day is it", "today's date", "current date", "calendar date"], weight: 1.02 },
  { intent: "state-date", any: ["the date is", "today is", "meeting is on", "appointment is on", "deadline is"], weight: 0.94 },
  { intent: "morning-routine", any: ["every morning", "morning routine", "after i wake", "before breakfast", "start my day", "day begins"], weight: 0.94 },
  { intent: "evening-routine", any: ["every evening", "evening routine", "after dinner", "before bed", "end my day"], weight: 0.92 },
  { intent: "meal-planning", any: ["plan a meal", "simple breakfast", "quick lunch", "easy dinner", "meal for"], weight: 0.92 },
  { intent: "food-order", any: ["bowl of soup", "vegetable sandwich", "plate of rice", "small salad", "pasta dish", "daily special", "serving of noodles"], weight: 0.9 },
  { intent: "drink-request", any: ["glass of water", "cup of tea", "small coffee", "orange juice", "cold drink", "warm drink", "coffee with milk"], weight: 0.9 },
  { intent: "study-activity", any: ["i am studying", "i am learning", "study topic", "for class", "lesson is about"], weight: 0.94 },
  { intent: "classroom-help", any: ["lesson", "homework", "exercise", "vocabulary list", "grammar rule", "assignment goal"], weight: 0.9 },
  { intent: "work-update", any: ["current task", "work update", "project outline", "meeting notes", "weekly summary"], weight: 0.9 },
  { intent: "task-planning", any: ["break down", "make a checklist", "plan today's work", "organize a task", "outline a task"], weight: 0.94 },
  { intent: "scheduling-request", any: ["schedule", "choose a time", "arrange a time", "find a time", "on the calendar"], weight: 0.98 },
  { intent: "product-availability", any: ["do you have", "store carrying", "do they sell", "looking for"], weight: 0.9 },
  { intent: "price-question", any: ["how much", "current price", "cost of", "listed price", "charge for"], weight: 0.98 },
  { intent: "quantity-request", any: ["one copy", "two tickets", "three examples", "four pages", "five items", "six bottles", "seven labels", "eight chairs", "nine cards", "ten minutes"], weight: 0.88 },
  { intent: "travel-planning", any: ["weekend trip", "day trip", "train journey", "family visit", "business trip", "city visit", "vacation", "plan a trip", "organize a trip"], weight: 0.98 },
  { intent: "transport-question", any: ["get there by", "travel there", "board", "public transportation", "airport bus"], weight: 0.94 },
  { intent: "direction-request", any: ["how do i get to", "way to", "which direction", "route should i take", "directions to"], weight: 0.98 },
  { intent: "location-question", any: ["where is", "location of", "where to find", "address of", "locate"], weight: 0.94 },
  { intent: "weather-question", any: ["weather", "raining", "sunny", "forecast", "umbrella", "storms expected"], weight: 1.02 },
  { intent: "clothing-consideration", any: ["what should i wear", "how should i dress", "special clothing", "choose clothes", "bring a jacket", "what footwear"], weight: 0.98 },
  { intent: "household-chore", any: ["next chore", "household task", "wash the dishes", "wash my clothes", "sweep the floor", "do the laundry", "take out the trash", "water the plants", "clean the house"], weight: 0.94 },
  { intent: "sleep-routine", any: ["before sleeping", "at bedtime", "sleep routine", "go to bed", "prepare for sleep", "waking habit"], weight: 0.94 },
];

export function ruleIntents(analysis: SentenceAnalysis): Map<string, number> {
  const joined = analysis.tokens.join(" ");
  const tokens = new Set(analysis.tokens);
  const scores = new Map<string, number>();

  for (const rule of rules) {
    const matches = (term: string) => term.includes(" ") ? joined.includes(term) : tokens.has(term);
    const anyMatch = rule.any.some(matches);
    const allMatch = (rule.all ?? []).every(matches);
    if (anyMatch && allMatch) scores.set(rule.intent, rule.weight);
  }

  return scores;
}
