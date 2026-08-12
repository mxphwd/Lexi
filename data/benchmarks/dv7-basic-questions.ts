export type BenchmarkCategory =
  | "conversation"
  | "definition"
  | "property"
  | "classification"
  | "ability"
  | "cause-process"
  | "world-people"
  | "quantitative"
  | "reasoning"
  | "memory-reference"
  | "generated-reachability";

export type CuratedBenchmarkCase = {
  id: string;
  category: Exclude<BenchmarkCategory, "memory-reference" | "generated-reachability">;
  prompt: string;
  expectedTerms: readonly string[];
  expectedSource?: string;
};

const cases = (
  category: CuratedBenchmarkCase["category"],
  rows: Array<[string, string, readonly string[], string?]>,
): CuratedBenchmarkCase[] =>
  rows.map(([id, prompt, expectedTerms, expectedSource]) => ({
    id,
    category,
    prompt,
    expectedTerms,
    expectedSource,
  }));

/**
 * Hand-authored, ordinary-language questions. These are intentionally separate
 * from the graph seed records and parser frame registry.
 */
export const dv7CuratedBenchmark: readonly CuratedBenchmarkCase[] = [
  ...cases("conversation", [
    ["conversation-hello", "Hello!", ["hello"], "core-phrase"],
    ["conversation-thanks", "Thanks for the explanation.", ["welcome"]],
    ["conversation-goodbye", "Goodbye.", ["goodbye"]],
    ["conversation-overwhelmed", "I feel overwhelmed.", ["smallest", "action"]],
    ["conversation-clarify", "Could you clarify that?", ["sentence", "subject"]],
    ["conversation-plan", "Help me plan my day.", ["three"]],
    ["conversation-procrastinating", "I keep procrastinating.", ["five minutes"]],
    ["conversation-troubleshoot", "Help me troubleshoot.", ["expected"]],
    ["conversation-riddle", "Tell me a riddle.", ["keyboard"]],
    ["conversation-honest", "Be honest with me.", ["state"]],
  ]),
  ...cases("definition", [
    ["definition-spider", "What is a spider?", ["eight-legged", "arachnid"], "knowledge-graph"],
    ["definition-algorithm", "Explain an algorithm.", ["finite", "instructions"], "knowledge-graph"],
    ["definition-refrigerator", "What exactly is a refrigerator?", ["keeps", "cool"], "knowledge-graph"],
    ["definition-democracy", "Tell me about democracy.", ["government"], "knowledge-graph"],
    ["definition-neuron", "Define a neuron.", ["cell"], "knowledge-graph"],
    ["definition-internet", "What is the Internet?", ["network"], "knowledge-graph"],
    ["definition-photosynthesis", "Describe photosynthesis.", ["light"], "knowledge-graph"],
    ["definition-hospital", "What is a hospital?", ["healthcare"], "knowledge-graph"],
    ["definition-teacher", "Who is a teacher?", ["learning"], "knowledge-graph"],
    ["definition-moon", "What is the Moon?", ["satellite"], "knowledge-graph"],
    ["definition-matrix", "Could you explain a matrix?", ["arrangement", "values"], "knowledge-graph"],
    ["definition-contract", "What does contract mean?", ["agreement"], "knowledge-graph"],
    ["definition-byte", "What is a byte?", ["eight bits"], "knowledge-graph"],
    ["definition-museum", "What is a museum?", ["collects", "preserves"], "knowledge-graph"],
    ["definition-curie", "Who was Marie Curie?", ["physicist", "chemist"], "knowledge-graph"],
  ]),
  ...cases("property", [
    ["property-spider-legs", "How many legs does a spider have?", ["8"], "knowledge-graph"],
    ["property-bee-diet", "What do bees eat?", ["nectar", "pollen"], "knowledge-graph"],
    ["property-penguin-home", "Where do penguins live?", ["Southern Hemisphere"], "knowledge-graph"],
    ["property-cat-life", "How long do cats usually live?", ["12", "18"], "knowledge-graph"],
    ["property-apple-color", "What color can an apple be?", ["red", "green", "yellow"], "knowledge-graph"],
    ["property-sun-composition", "What is the Sun made of?", ["hydrogen", "helium"], "knowledge-graph"],
    ["property-earth-parts", "What are the main parts of Earth?", ["continents", "oceans"], "knowledge-graph"],
    ["property-mars-location", "Where is Mars in the Solar System?", ["fourth"], "knowledge-graph"],
    ["property-gold-symbol", "What is the chemical symbol for gold?", ["Au"], "knowledge-graph"],
    ["property-oxygen-number", "What is oxygen's atomic number?", ["8"], "knowledge-graph"],
    ["property-speed-formula", "What is the formula for speed?", ["distance", "time"], "knowledge-graph"],
    ["property-force-unit", "What unit measures force?", ["newtons"], "knowledge-graph"],
    ["property-refrigerator-purpose", "What does a refrigerator do?", ["food", "low temperature"], "knowledge-graph"],
    ["property-bicycle-mechanism", "How does a bicycle work?", ["pedals", "wheel"], "knowledge-graph"],
    ["property-soap-mechanism", "How does soap remove oil?", ["surfactant", "water"], "knowledge-graph"],
    ["property-brain-function", "What does the brain do?", ["information"], "knowledge-graph"],
    ["property-heart-function", "What is the function of the heart?", ["blood"], "knowledge-graph"],
    ["property-flower-parts", "What is a flower made of?", ["sepals", "petals"], "knowledge-graph"],
    ["property-plant-needs", "What does a plant need?", ["light", "water"], "knowledge-graph"],
    ["property-solar-contains", "What does the Solar System contain?", ["Sun", "planets"], "knowledge-graph"],
  ]),
  ...cases("classification", [
    ["class-cat-animal", "Is a cat an animal?", ["yes"], "knowledge-graph"],
    ["class-cat-mammal", "Is a cat a mammal?", ["yes"], "knowledge-graph"],
    ["class-penguin-bird", "Is a penguin a bird?", ["yes"], "knowledge-graph"],
    ["class-spider-animal", "Is a spider an animal?", ["yes"], "knowledge-graph"],
    ["class-bee-insect", "Is a bee an insect?", ["yes"], "knowledge-graph"],
    ["class-earth-planet", "Is Earth a planet?", ["yes"], "knowledge-graph"],
    ["class-sun-star", "Is the Sun a star?", ["yes"], "knowledge-graph"],
    ["class-apple-fruit", "Is an apple a fruit?", ["yes"], "knowledge-graph"],
    ["class-car-vehicle", "Is a car a vehicle?", ["yes"], "knowledge-graph"],
    ["class-doctor-occupation", "Is doctor an occupation?", ["yes"], "knowledge-graph"],
  ]),
  ...cases("ability", [
    ["ability-penguin-fly", "Can penguins fly?", ["no", "cannot"], "knowledge-graph"],
    ["ability-penguin-swim", "Can a penguin swim?", ["yes", "can"], "knowledge-graph"],
    ["ability-bat-fly", "Can bats fly?", ["yes", "can"], "knowledge-graph"],
    ["ability-cat-fly", "Can cats fly?", ["no", "cannot"], "knowledge-graph"],
    ["ability-elephant-jump", "Can an elephant jump?", ["no", "cannot"], "knowledge-graph"],
    ["ability-whale-underwater", "Can a whale breathe underwater?", ["no", "cannot"], "knowledge-graph"],
    ["ability-human-language", "Can humans use language?", ["yes", "can"], "knowledge-graph"],
    ["ability-bee-pollinate", "Can bees pollinate flowers?", ["yes", "can"], "knowledge-graph"],
    ["ability-earth-life", "Can Earth support known life?", ["yes", "can"], "knowledge-graph"],
    ["ability-moon-light", "Can the Moon produce its own visible light?", ["no", "cannot"], "knowledge-graph"],
  ]),
  ...cases("cause-process", [
    ["cause-sky-blue", "Why is the sky blue?", ["scatter", "wavelength"], "knowledge-graph"],
    ["cause-rain", "What causes rain?", ["cloud droplets", "gravity"], "knowledge-graph"],
    ["cause-rainbow", "How does a rainbow form?", ["light", "droplets"], "knowledge-graph"],
    ["cause-lightning", "What causes lightning?", ["charge"], "knowledge-graph"],
    ["cause-thunder", "Why does thunder happen?", ["air"], "knowledge-graph"],
    ["cause-rust", "What causes iron to rust?", ["oxygen", "moisture"], "knowledge-graph"],
    ["process-evaporation", "How does evaporation work?", ["molecules", "surface"], "knowledge-graph"],
    ["process-condensation", "What causes condensation?", ["molecules", "liquid"], "knowledge-graph"],
    ["process-digestion", "How does digestion work?", ["enzymes", "nutrients"], "knowledge-graph"],
    ["process-circulation", "How does blood circulation work?", ["heart", "blood"], "knowledge-graph"],
  ]),
  ...cases("world-people", [
    ["world-japan-capital", "What is the capital of Japan?", ["Tokyo"], "knowledge-graph"],
    ["world-sweden-capital", "Name the capital of Sweden.", ["Stockholm"], "knowledge-graph"],
    ["world-thailand-language", "What language is spoken in Thailand?", ["Thai"], "knowledge-graph"],
    ["world-portugal-currency", "What currency does Portugal use?", ["euro"], "knowledge-graph"],
    ["world-kenya-continent", "Which continent is Kenya in?", ["Africa"], "knowledge-graph"],
    ["world-canada-capital", "What is Canada's capital?", ["Ottawa"], "knowledge-graph"],
    ["people-hamlet", "Who wrote Hamlet?", ["Shakespeare"], "knowledge-graph"],
    ["people-pride", "Who wrote Pride and Prejudice?", ["Jane Austen"], "knowledge-graph"],
    ["people-web", "Who invented the World Wide Web?", ["Tim Berners-Lee"], "knowledge-graph"],
    ["people-einstein-born", "When was Albert Einstein born?", ["1879"], "knowledge-graph"],
    ["people-curie-known", "What was Marie Curie known for?", ["radioactivity"], "knowledge-graph"],
    ["people-darwin-known", "Why is Charles Darwin famous?", ["evolution", "natural selection"], "knowledge-graph"],
    ["people-turing-known", "What is Alan Turing known for?", ["computation"], "knowledge-graph"],
    ["people-austen-nationality", "What nationality was Jane Austen?", ["English"], "knowledge-graph"],
    ["people-1984-year", "When was Nineteen Eighty-Four published?", ["1949"], "knowledge-graph"],
  ]),
  ...cases("quantitative", [
    ["quantity-add", "What is 27 plus 15?", ["42"], "extended-pack"],
    ["quantity-percent", "What is 20 percent of 80?", ["16"], "extended-pack"],
    ["quantity-average", "What is the average of 2, 4, and 6?", ["4"], "extended-pack"],
    ["quantity-multiply", "What is 12 times 9?", ["108"], "extended-pack"],
    ["quantity-divide", "What is 84 divided by 7?", ["12"], "extended-pack"],
    ["quantity-rectangle", "What is the formula for the area of a rectangle?", ["length", "width"], "knowledge-graph"],
    ["quantity-circle", "What is the formula for the area of a circle?", ["radius"], "knowledge-graph"],
    ["quantity-jupiter-size", "How big is Jupiter?", ["139,820"], "knowledge-graph"],
    ["quantity-universe-size", "How large is the observable universe?", ["93 billion"], "knowledge-graph"],
    ["quantity-gold-number", "What atomic number does gold have?", ["79"], "knowledge-graph"],
  ]),
  ...cases("reasoning", [
    ["reason-sequence", "What comes next in 2, 4, 6, 8?", ["10"], "extended-pack"],
    ["reason-words", "How many words are in mechanical language model?", ["3"], "extended-pack"],
    ["reason-logic", "If all cats are mammals and Luna is a cat, is Luna a mammal?", ["yes"], "extended-pack"],
    ["reason-compare-legs", "Compare cats and birds by leg count.", ["4", "2"], "knowledge-graph"],
    ["reason-compare-diet", "Compare cats and dogs by diet.", ["meat"], "knowledge-graph"],
    ["reason-compare-definition", "What is the difference between a star and a planet?", ["star", "planet"], "knowledge-graph"],
    ["reason-inheritance-legs", "How many legs does a mammal have?", ["4"], "knowledge-graph"],
    ["reason-classification-chain", "Is a penguin an animal?", ["yes"], "knowledge-graph"],
    ["reason-part", "What is a flower part of?", ["plant"], "knowledge-graph"],
    ["reason-water-state", "What is ice made of?", ["H₂O"], "knowledge-graph"],
  ]),
] as const;

export type SessionBenchmarkScenario = {
  id: string;
  turns: ReadonlyArray<{
    prompt: string;
    expectedTerms: readonly string[];
    expectedSource?: string;
  }>;
};

export const dv7SessionBenchmark: readonly SessionBenchmarkScenario[] = [
  {
    id: "memory-name",
    turns: [
      { prompt: "My name is Mina.", expectedTerms: ["Mina"], expectedSource: "session-memory" },
      { prompt: "What is my name?", expectedTerms: ["Mina"], expectedSource: "session-memory" },
    ],
  },
  {
    id: "memory-age-location",
    turns: [
      { prompt: "I am 24 years old.", expectedTerms: ["24"], expectedSource: "session-memory" },
      { prompt: "I live in Seoul.", expectedTerms: ["Seoul"], expectedSource: "session-memory" },
      { prompt: "How old am I?", expectedTerms: ["24"], expectedSource: "session-memory" },
      { prompt: "Where do I live?", expectedTerms: ["Seoul"], expectedSource: "session-memory" },
    ],
  },
  {
    id: "memory-preference",
    turns: [
      { prompt: "I like green tea.", expectedTerms: ["green tea"], expectedSource: "session-memory" },
      { prompt: "What do I like?", expectedTerms: ["green tea"], expectedSource: "session-memory" },
    ],
  },
  {
    id: "reference-animal",
    turns: [
      { prompt: "What is a spider?", expectedTerms: ["arachnid"], expectedSource: "knowledge-graph" },
      { prompt: "Where does it live?", expectedTerms: ["terrestrial"], expectedSource: "knowledge-graph" },
      { prompt: "How many legs does it have?", expectedTerms: ["8"], expectedSource: "knowledge-graph" },
    ],
  },
  {
    id: "reference-country",
    turns: [
      { prompt: "Tell me about Portugal.", expectedTerms: ["country"], expectedSource: "knowledge-graph" },
      { prompt: "What is its capital?", expectedTerms: ["Lisbon"], expectedSource: "knowledge-graph" },
      { prompt: "What currency does it use?", expectedTerms: ["euro"], expectedSource: "knowledge-graph" },
    ],
  },
  {
    id: "previous-turn",
    turns: [
      { prompt: "What is photosynthesis?", expectedTerms: ["light"], expectedSource: "knowledge-graph" },
      { prompt: "What did I just ask?", expectedTerms: ["photosynthesis"], expectedSource: "session-memory" },
      { prompt: "What did you just say?", expectedTerms: ["previous question"], expectedSource: "session-memory" },
    ],
  },
] as const;
