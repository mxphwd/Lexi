import type { KnowledgeEntitySeed } from "../types";

type ElementRow =
  | readonly [
      id: string,
      name: string,
      symbol: string,
      atomicNumber: number,
      definition: string,
    ]
  | readonly [
      id: string,
      name: string,
      aliases: readonly string[],
      symbol: string,
      atomicNumber: number,
      definition: string,
    ];

const elements: readonly ElementRow[] = [
  ["element-helium", "helium", "He", 2, "a light, chemically unreactive noble gas"],
  ["element-lithium", "lithium", "Li", 3, "a soft, light alkali metal"],
  ["element-nitrogen", "nitrogen", "N", 7, "a nonmetallic element that forms most of Earth's atmosphere"],
  ["element-sodium", "sodium", "Na", 11, "a soft, reactive alkali metal"],
  ["element-magnesium", "magnesium", "Mg", 12, "a light alkaline-earth metal used by living cells and many alloys"],
  ["element-aluminium", "aluminium", "Al", 13, "a light, corrosion-resistant metal; it is called aluminum in American English"],
  ["element-silicon", "silicon", "Si", 14, "a metalloid central to silicate minerals and semiconductor technology"],
  ["element-phosphorus", "phosphorus", "P", 15, "a reactive nonmetal essential to DNA, ATP, and bones"],
  ["element-sulfur", "sulfur", "S", 16, "a yellow nonmetal present in many minerals and biological molecules"],
  ["element-chlorine", "chlorine", "Cl", 17, "a reactive halogen that commonly forms chloride compounds"],
  ["element-potassium", "potassium", "K", 19, "a reactive alkali metal whose ions are essential in living cells"],
  ["element-calcium", "calcium", "Ca", 20, "an alkaline-earth metal important in bones, shells, signaling, and minerals"],
  ["element-titanium", "titanium", "Ti", 22, "a strong, light, corrosion-resistant metal"],
  ["element-chromium", "chromium", "Cr", 24, "a hard metal used in stainless steel and protective coatings"],
  ["element-manganese", "manganese", "Mn", 25, "a metal used in steelmaking and required in trace amounts by living organisms"],
  ["element-cobalt", "cobalt", "Co", 27, "a metal used in alloys, pigments, batteries, and vitamin B12"],
  ["element-nickel", "nickel", "Ni", 28, "a corrosion-resistant metal used in alloys and batteries"],
  ["element-zinc", "zinc", "Zn", 30, "a metal used for corrosion protection and required by many enzymes"],
  ["element-mercury", "mercury element", ["quicksilver"], "Hg", 80, "a toxic metallic element that is liquid near room temperature"],
  ["element-lead", "lead element", ["lead metal"], "Pb", 82, "a dense toxic metal historically used in many products"],
  ["element-uranium", "uranium", "U", 92, "a heavy radioactive element used as nuclear fuel"],
] as const;

type UnitRow = readonly [
  id: string,
  name: string,
  aliases: readonly string[],
  symbol: string,
  definition: string,
  measures: string,
];

const units: readonly UnitRow[] = [
  ["unit-metre", "metre", ["meter"], "m", "the SI base unit of length", "length"],
  ["unit-kilogram", "kilogram", ["kg"], "kg", "the SI base unit of mass", "mass"],
  ["unit-second", "second", ["seconds"], "s", "the SI base unit of time", "time"],
  ["unit-ampere", "ampere", ["amp"], "A", "the SI base unit of electric current", "electric current"],
  ["unit-kelvin", "kelvin", ["kelvins"], "K", "the SI base unit of thermodynamic temperature", "thermodynamic temperature"],
  ["unit-mole", "mole", ["mol"], "mol", "the SI base unit of amount of substance", "amount of substance"],
  ["unit-candela", "candela", ["cd"], "cd", "the SI base unit of luminous intensity", "luminous intensity"],
  ["unit-hertz", "hertz", ["Hz"], "Hz", "the SI derived unit of frequency, equal to one cycle per second", "frequency"],
  ["unit-newton", "newton", ["newtons"], "N", "the SI derived unit of force, equal to one kilogram metre per second squared", "force"],
  ["unit-joule", "joule", ["joules"], "J", "the SI derived unit of energy", "energy"],
  ["unit-watt", "watt", ["watts"], "W", "the SI derived unit of power, equal to one joule per second", "power"],
  ["unit-pascal", "pascal", ["pascals"], "Pa", "the SI derived unit of pressure, equal to one newton per square metre", "pressure"],
  ["unit-volt", "volt", ["volts"], "V", "the SI derived unit of electric potential difference", "electric potential difference"],
  ["unit-ohm", "ohm", ["ohms"], "Ω", "the SI derived unit of electrical resistance", "electrical resistance"],
  ["unit-byte", "byte", ["bytes"], "B", "a digital-information unit commonly consisting of eight bits", "digital information"],
  ["unit-bit", "bit", ["bits", "binary digit"], "bit", "a binary information unit with one of two possible values", "digital information"],
] as const;

const processes: readonly KnowledgeEntitySeed[] = [
  {
    id: "phenomenon-blue-sky",
    name: "blue sky",
    aliases: ["the sky", "sky", "sky color"],
    kind: "process",
    facts: {
      definition: "the blue appearance of the daytime sky",
      color: "blue during clear daylight, with large variation near the horizon, at sunrise, at sunset, and under clouds",
      cause: "air molecules scatter shorter visible wavelengths more strongly than longer wavelengths, and human vision perceives the resulting scattered light mainly as blue",
      mechanism: "sunlight enters the atmosphere and undergoes wavelength-dependent Rayleigh scattering",
    },
  },
  {
    id: "process-evaporation",
    name: "evaporation",
    aliases: ["evaporating"],
    kind: "process",
    facts: {
      definition: "the change of molecules from a liquid surface into gas",
      cause: "some surface molecules have enough energy to escape intermolecular attraction",
      effect: ["adds vapor to the surrounding gas", "often cools the remaining liquid"],
      mechanism: "higher-energy molecules leave the liquid surface and enter the gas phase",
    },
  },
  {
    id: "process-condensation",
    name: "condensation",
    aliases: ["condensing"],
    kind: "process",
    facts: {
      definition: "the change of a gas or vapor into a liquid",
      cause: "molecules lose enough energy for intermolecular attraction to hold them in a liquid",
      effect: ["forms liquid droplets", "releases latent heat"],
      mechanism: "cooling or compression brings molecules close enough to form the liquid phase",
    },
  },
  {
    id: "process-melting",
    name: "melting",
    aliases: ["melting point process"],
    kind: "process",
    facts: {
      definition: "the phase change from solid to liquid",
      cause: "absorbed energy disrupts enough of a solid's ordered structure for particles to move past one another",
      effect: "produces a liquid from a solid",
    },
  },
  {
    id: "process-freezing",
    name: "freezing",
    aliases: ["solidification"],
    kind: "process",
    facts: {
      definition: "the phase change from liquid to solid",
      cause: "energy leaves a liquid until particles settle into a stable solid structure",
      effect: "produces a solid from a liquid",
    },
  },
  {
    id: "process-boiling",
    name: "boiling",
    aliases: ["boil"],
    kind: "process",
    facts: {
      definition: "rapid vaporization throughout a liquid when its vapor pressure reaches the surrounding pressure",
      cause: "sufficient heating raises the liquid's vapor pressure to the ambient pressure",
      effect: "forms vapor bubbles throughout the liquid",
    },
  },
  {
    id: "process-erosion",
    name: "erosion",
    aliases: ["eroding"],
    kind: "process",
    facts: {
      definition: "the removal and transport of rock or soil by water, wind, ice, gravity, or living activity",
      cause: "moving agents apply force to loosen and carry surface material",
      effect: ["reshapes landscapes", "moves sediment"],
    },
  },
  {
    id: "process-rusting",
    name: "rusting",
    aliases: ["rust", "iron rusting"],
    kind: "process",
    facts: {
      definition: "the corrosion of iron that forms hydrated iron oxides",
      requires: ["iron", "oxygen", "water or moisture"],
      cause: "electrochemical reactions oxidize iron in the presence of oxygen and moisture",
      effect: "weakens and flakes exposed iron over time",
    },
  },
  {
    id: "process-digestion",
    name: "digestion",
    aliases: ["digesting food"],
    kind: "process",
    facts: {
      definition: "the mechanical and chemical breakdown of food into absorbable substances",
      mechanism: "movement, acid, enzymes, bile, and intestinal transport break food down and move nutrients into the body",
      purpose: "make nutrients available for absorption and use",
      has_part: ["ingestion", "mechanical breakdown", "chemical digestion", "absorption", "elimination"],
    },
  },
  {
    id: "process-blood-circulation",
    name: "blood circulation",
    aliases: ["circulation", "circulatory flow"],
    kind: "process",
    facts: {
      definition: "the continuous movement of blood through the heart and blood vessels",
      mechanism: "the heart creates pressure that drives blood through arteries, capillaries, and veins",
      purpose: "deliver oxygen and nutrients and carry heat, hormones, carbon dioxide, and wastes",
      requires: ["a pumping heart", "blood", "open blood vessels"],
    },
  },
];

const formulas: readonly KnowledgeEntitySeed[] = [
  {
    id: "quantity-speed",
    name: "speed",
    aliases: ["average speed"],
    kind: "concept",
    facts: {
      definition: "distance traveled per unit of time",
      formula: "speed = distance ÷ time",
      unit: "metres per second in SI",
    },
  },
  {
    id: "quantity-density",
    name: "density",
    aliases: ["mass density"],
    kind: "concept",
    facts: {
      definition: "mass per unit volume",
      formula: "density = mass ÷ volume",
      unit: "kilograms per cubic metre in SI",
    },
  },
  {
    id: "quantity-force",
    name: "force",
    aliases: ["force quantity", "force formula"],
    kind: "concept",
    facts: {
      definition: "a push or pull represented by a vector",
      formula: "for constant mass in elementary mechanics, net force = mass × acceleration",
      unit: "newtons in SI",
    },
  },
  {
    id: "quantity-rectangle-area",
    name: "area of a rectangle",
    aliases: ["rectangle area"],
    kind: "concept",
    facts: {
      definition: "the two-dimensional space enclosed by a rectangle",
      formula: "area = length × width",
      unit: "square units",
    },
  },
  {
    id: "quantity-circle-area",
    name: "area of a circle",
    aliases: ["circle area"],
    kind: "concept",
    facts: {
      definition: "the two-dimensional space enclosed by a circle",
      formula: "area = π × radius²",
      unit: "square units",
    },
  },
];

export const scienceKnowledgeSeeds: readonly KnowledgeEntitySeed[] = [
  ...elements.map(([id, nameOrAliases, maybeAliasesOrSymbol, maybeSymbolOrAtomic, maybeAtomicOrDefinition, maybeDefinition]) => {
    const hasAliases = Array.isArray(maybeAliasesOrSymbol);
    const name = nameOrAliases;
    const aliases = hasAliases ? maybeAliasesOrSymbol : [];
    const symbol = hasAliases ? String(maybeSymbolOrAtomic) : String(maybeAliasesOrSymbol);
    const atomicNumber = Number(hasAliases ? maybeAtomicOrDefinition : maybeSymbolOrAtomic);
    const definition = String(hasAliases ? maybeDefinition : maybeAtomicOrDefinition);
    return {
      id,
      name,
      aliases,
      kind: "material" as const,
      facts: {
        definition,
        symbol,
        atomic_number: atomicNumber,
        is_a: { value: "chemical element", entity: false },
      },
    };
  }),
  ...units.map(([id, name, aliases, symbol, definition, measures]) => ({
    id,
    name,
    aliases,
    kind: "unit" as const,
    facts: {
      definition,
      symbol,
      purpose: `measure ${measures}`,
      unit: measures,
    },
  })),
  ...processes,
  ...formulas,
] as const;
