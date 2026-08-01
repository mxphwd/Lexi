export type Dv8CuratedBenchmarkCase = {
  id: string;
  category: "reasoning" | "precision";
  prompt: string;
  includes?: readonly string[];
  excludes?: readonly string[];
  intent?: string;
};

/**
 * Hand-written failure cases are kept separate from parser frames. These are
 * ordinary questions and adversarial variations that DV7 mishandled.
 */
export const dv8CuratedBlindCases: readonly Dv8CuratedBenchmarkCase[] = [
  { id: "habitat-wild", category: "reasoning", prompt: "Where would I find penguins in the wild?", includes: ["Southern Hemisphere"] },
  { id: "inverse-inventor", category: "reasoning", prompt: "Name the person who came up with the telephone.", includes: ["Alexander Graham Bell"] },
  { id: "symbol-paraphrase", category: "reasoning", prompt: "What is oxygen represented as?", includes: ["symbol", "O"] },
  { id: "numeric-comparison", category: "reasoning", prompt: "Which is larger, Earth or Mars?", includes: ["Earth", "larger"] },
  { id: "condition-false", category: "reasoning", prompt: "Can a bee produce honey if it is a penguin?", includes: ["No"] },
  { id: "condition-true", category: "reasoning", prompt: "Can a bee produce honey if it is a honey bee species?", includes: ["Yes"] },
  { id: "condition-negated", category: "reasoning", prompt: "Can a bee produce honey if it is not a honey bee species?", includes: ["No"] },
  { id: "negated-ability", category: "reasoning", prompt: "Can a penguin not fly?", includes: ["Yes", "cannot fly"] },
  { id: "negative-taxonomy", category: "reasoning", prompt: "Is a cat a reptile?", includes: ["No", "not classified"] },
  { id: "numeric-ask-true", category: "reasoning", prompt: "Does a spider have 8 legs?", includes: ["Yes", "8 legs"] },
  { id: "numeric-ask-false", category: "reasoning", prompt: "Does a spider have 10 legs?", includes: ["No"] },
  { id: "inverse-capital", category: "reasoning", prompt: "Which country has Paris as its capital?", includes: ["France"] },
  { id: "inverse-actor", category: "reasoning", prompt: "What did Alexander Graham Bell invent?", includes: ["telephone"] },
  { id: "two-hop-region", category: "reasoning", prompt: "Which cities are capitals of countries in Asia?", includes: ["Tokyo", "Seoul"] },
  { id: "aggregate-region", category: "reasoning", prompt: "How many countries are in Asia?", includes: ["recorded count"] },
  { id: "quantifier-all", category: "reasoning", prompt: "Do all birds fly?", includes: ["No", "Not every"] },
  { id: "quantifier-any", category: "reasoning", prompt: "Are any reptiles mammals?", includes: ["No"] },
  { id: "temporal-abstention", category: "precision", prompt: "What was the capital of Japan in 1900?", includes: ["do not have"], excludes: ["Tokyo is the capital"] },
  { id: "unsupported-song", category: "precision", prompt: "What is the favorite song of a spider?", includes: ["does not map"], excludes: ["favorite song is"] },
  { id: "unsupported-phone", category: "precision", prompt: "What is the shoe size of the Sun?", includes: ["does not map"], excludes: ["shoe size is"] },
  { id: "translation-bounded", category: "reasoning", prompt: "Translate hello into Spanish.", includes: ["hola"] },
  { id: "conversion", category: "reasoning", prompt: "Convert 5 kilometers to meters.", includes: ["5000 meters"] },
  { id: "sort", category: "reasoning", prompt: "Sort 9, 2, and 5 in ascending order.", includes: ["2, 5, 9"] },
  { id: "summary", category: "reasoning", prompt: "Summarize: Plants use sunlight to make sugars. They release oxygen during the process.", includes: ["Plants use sunlight"] },
] as const;
