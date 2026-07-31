import type { KnowledgeEntitySeed } from "../types";

type CountryRow = readonly [
  id: string,
  name: string,
  aliases: readonly string[],
  capital: string,
  continent: string,
  language: string,
  currency: string,
];

const countries: readonly CountryRow[] = [
  ["country-ireland", "Ireland", ["Republic of Ireland"], "Dublin", "Europe", "Irish and English", "the euro"],
  ["country-portugal", "Portugal", [], "Lisbon", "Europe", "Portuguese", "the euro"],
  ["country-netherlands", "Netherlands", ["the Netherlands", "Holland"], "Amsterdam", "Europe", "Dutch", "the euro"],
  ["country-belgium", "Belgium", [], "Brussels", "Europe", "Dutch, French, and German", "the euro"],
  ["country-switzerland", "Switzerland", [], "Bern, officially designated the federal city", "Europe", "German, French, Italian, and Romansh", "the Swiss franc"],
  ["country-austria", "Austria", [], "Vienna", "Europe", "German", "the euro"],
  ["country-sweden", "Sweden", [], "Stockholm", "Europe", "Swedish", "the Swedish krona"],
  ["country-norway", "Norway", [], "Oslo", "Europe", "Norwegian", "the Norwegian krone"],
  ["country-denmark", "Denmark", [], "Copenhagen", "Europe", "Danish", "the Danish krone"],
  ["country-finland", "Finland", [], "Helsinki", "Europe", "Finnish and Swedish", "the euro"],
  ["country-poland", "Poland", [], "Warsaw", "Europe", "Polish", "the Polish złoty"],
  ["country-greece", "Greece", [], "Athens", "Europe", "Greek", "the euro"],
  ["country-turkey", "Türkiye", ["Turkey", "Turkiye"], "Ankara", "Europe and Asia", "Turkish", "the Turkish lira"],
  ["country-russia", "Russia", ["Russian Federation"], "Moscow", "Europe and Asia", "Russian", "the Russian ruble"],
  ["country-ukraine", "Ukraine", [], "Kyiv", "Europe", "Ukrainian", "the Ukrainian hryvnia"],
  ["country-saudi-arabia", "Saudi Arabia", [], "Riyadh", "Asia", "Arabic", "the Saudi riyal"],
  ["country-uae", "United Arab Emirates", ["UAE", "the Emirates"], "Abu Dhabi", "Asia", "Arabic", "the UAE dirham"],
  ["country-indonesia", "Indonesia", [], "Jakarta", "Asia", "Indonesian", "the Indonesian rupiah"],
  ["country-philippines", "Philippines", ["the Philippines"], "Manila", "Asia", "Filipino and English", "the Philippine peso"],
  ["country-vietnam", "Vietnam", [], "Hanoi", "Asia", "Vietnamese", "the Vietnamese đồng"],
  ["country-thailand", "Thailand", [], "Bangkok", "Asia", "Thai", "the Thai baht"],
  ["country-malaysia", "Malaysia", [], "Kuala Lumpur", "Asia", "Malay", "the Malaysian ringgit"],
  ["country-singapore", "Singapore", [], "Singapore", "Asia", "English, Malay, Mandarin Chinese, and Tamil", "the Singapore dollar"],
  ["country-pakistan", "Pakistan", [], "Islamabad", "Asia", "Urdu and English at the federal level", "the Pakistani rupee"],
  ["country-bangladesh", "Bangladesh", [], "Dhaka", "Asia", "Bengali", "the Bangladeshi taka"],
  ["country-nigeria", "Nigeria", [], "Abuja", "Africa", "English at the federal level, alongside many widely spoken languages", "the Nigerian naira"],
  ["country-kenya", "Kenya", [], "Nairobi", "Africa", "Swahili and English", "the Kenyan shilling"],
  ["country-morocco", "Morocco", [], "Rabat", "Africa", "Arabic and Amazigh", "the Moroccan dirham"],
  ["country-ethiopia", "Ethiopia", [], "Addis Ababa", "Africa", "Amharic as the federal working language, alongside several other federal working languages", "the Ethiopian birr"],
  ["country-new-zealand", "New Zealand", ["Aotearoa New Zealand"], "Wellington", "Oceania", "English, Māori, and New Zealand Sign Language", "the New Zealand dollar"],
  ["country-chile", "Chile", [], "Santiago", "South America", "Spanish", "the Chilean peso"],
  ["country-colombia", "Colombia", [], "Bogotá", "South America", "Spanish, with additional recognized Indigenous languages", "the Colombian peso"],
  ["country-peru", "Peru", [], "Lima", "South America", "Spanish, Quechua, Aymara, and other Indigenous languages where predominant", "the Peruvian sol"],
  ["country-venezuela", "Venezuela", [], "Caracas", "South America", "Spanish, with Indigenous languages also recognized", "the Venezuelan bolívar"],
] as const;

type PersonRow = readonly [
  id: string,
  name: string,
  aliases: readonly string[],
  definition: string,
  knownFor: string,
  birthYear: number | string,
  nationality: string,
];

const people: readonly PersonRow[] = [
  ["person-albert-einstein", "Albert Einstein", ["Einstein"], "a theoretical physicist who transformed modern physics", "the theories of special and general relativity and major contributions to quantum theory", 1879, "German-born, later Swiss and American"],
  ["person-isaac-newton", "Isaac Newton", ["Newton", "Sir Isaac Newton"], "an English mathematician, physicist, and astronomer", "formulating classical mechanics and universal gravitation and co-developing calculus", 1643, "English"],
  ["person-galileo", "Galileo Galilei", ["Galileo"], "an Italian astronomer, physicist, and engineer", "telescopic astronomical observations and foundational work on motion", 1564, "Italian"],
  ["person-charles-darwin", "Charles Darwin", ["Darwin"], "an English naturalist", "developing the theory of evolution by natural selection", 1809, "English"],
  ["person-marie-curie", "Marie Curie", ["Curie"], "a Polish-born physicist and chemist who worked in France", "pioneering research on radioactivity and discovering polonium and radium with collaborators", 1867, "Polish-born French"],
  ["person-nikola-tesla", "Nikola Tesla", ["Tesla"], "a Serbian-American inventor and electrical engineer", "work on alternating-current power systems, motors, and high-voltage electrical experiments", 1856, "Serbian-American"],
  ["person-thomas-edison", "Thomas Edison", ["Edison"], "an American inventor and industrial researcher", "developing practical systems for electric light, sound recording, and motion pictures with large research teams", 1847, "American"],
  ["person-alexander-bell", "Alexander Graham Bell", ["Alexander Bell", "Bell"], "a Scottish-born inventor, scientist, and teacher", "patenting an influential practical telephone and working on communication and hearing", 1847, "Scottish-born Canadian-American"],
  ["person-tim-berners-lee", "Tim Berners-Lee", ["Berners-Lee"], "an English computer scientist", "inventing the World Wide Web", 1955, "English"],
  ["person-ada-lovelace", "Ada Lovelace", ["Lovelace"], "an English mathematician and writer", "publishing an algorithm for Charles Babbage's proposed Analytical Engine", 1815, "English"],
  ["person-alan-turing", "Alan Turing", ["Turing"], "an English mathematician and computer-science pioneer", "foundational work in computation, wartime cryptanalysis, and early artificial intelligence", 1912, "English"],
  ["person-william-shakespeare", "William Shakespeare", ["Shakespeare"], "an English playwright, poet, and actor", "plays and poems that became central works of English literature", 1564, "English"],
  ["person-jane-austen", "Jane Austen", ["Austen"], "an English novelist", "novels examining relationships, class, judgment, and social life", 1775, "English"],
  ["person-george-orwell", "George Orwell", ["Orwell", "Eric Arthur Blair"], "an English novelist, essayist, and critic", "political writing including Nineteen Eighty-Four and Animal Farm", 1903, "English"],
  ["person-leonardo-da-vinci", "Leonardo da Vinci", ["Leonardo", "da Vinci"], "an Italian Renaissance artist and investigator", "painting works including the Mona Lisa and studying anatomy, mechanics, and nature", 1452, "Italian"],
  ["person-mozart", "Wolfgang Amadeus Mozart", ["Mozart"], "an Austrian composer and performer", "a large and influential body of Classical-period music", 1756, "Austrian"],
  ["person-beethoven", "Ludwig van Beethoven", ["Beethoven"], "a German composer and pianist", "works that helped bridge the Classical and Romantic eras of Western music", 1770, "German"],
  ["person-aristotle", "Aristotle", [], "an ancient Greek philosopher and scholar", "systematic work in logic, ethics, politics, biology, and metaphysics", "384 BCE", "ancient Greek"],
  ["person-mahatma-gandhi", "Mahatma Gandhi", ["Gandhi", "Mohandas Gandhi"], "an Indian independence leader and lawyer", "advocating mass nonviolent resistance against colonial rule", 1869, "Indian"],
  ["person-nelson-mandela", "Nelson Mandela", ["Mandela"], "a South African anti-apartheid leader and president", "helping end apartheid and supporting democratic reconciliation", 1918, "South African"],
] as const;

type WorkRow = readonly [
  id: string,
  name: string,
  aliases: readonly string[],
  definition: string,
  author: string,
  year: string | number,
];

const works: readonly WorkRow[] = [
  ["work-hamlet", "Hamlet", [], "a tragedy centered on a Danish prince confronting murder, grief, and revenge", "William Shakespeare", "around 1600"],
  ["work-romeo-juliet", "Romeo and Juliet", [], "a tragedy about two young lovers from feuding families", "William Shakespeare", "around 1595"],
  ["work-macbeth", "Macbeth", [], "a tragedy about ambition, violence, guilt, and political power", "William Shakespeare", "around 1606"],
  ["work-pride-prejudice", "Pride and Prejudice", [], "a novel about judgment, family, class, and the developing relationship between Elizabeth Bennet and Fitzwilliam Darcy", "Jane Austen", 1813],
  ["work-1984", "Nineteen Eighty-Four", ["1984"], "a dystopian novel about totalitarian power, surveillance, language, and truth", "George Orwell", 1949],
  ["work-animal-farm", "Animal Farm", [], "an allegorical novella about revolution, power, and political corruption", "George Orwell", 1945],
  ["work-origin-species", "On the Origin of Species", ["Origin of Species"], "a scientific book presenting extensive evidence for evolution by natural selection", "Charles Darwin", 1859],
  ["work-republic", "The Republic", ["Plato's Republic"], "a philosophical dialogue examining justice, political order, education, and knowledge", "Plato", "around 375 BCE"],
  ["work-odyssey", "The Odyssey", ["Odyssey"], "an ancient Greek epic poem about Odysseus's long journey home", "traditionally attributed to Homer", "composed around the late eighth or early seventh century BCE"],
  ["work-mona-lisa", "Mona Lisa", ["the Mona Lisa"], "a Renaissance portrait painting noted for its subtle expression and atmospheric landscape", "Leonardo da Vinci", "begun around 1503"],
] as const;

export const worldAndPeopleKnowledgeSeeds: readonly KnowledgeEntitySeed[] = [
  ...countries.map(([id, name, aliases, capital, continent, language, currency]) => ({
    id,
    name,
    aliases,
    kind: "country" as const,
    facts: {
      definition: `a sovereign country in ${continent}`,
      capital,
      continent,
      language,
      currency,
    },
  })),
  ...people.map(([id, name, aliases, definition, knownFor, birthYear, nationality]) => ({
    id,
    name,
    aliases,
    kind: "person" as const,
    facts: {
      definition,
      known_for: knownFor,
      birth_year: birthYear,
      nationality,
    },
  })),
  ...works.map(([id, name, aliases, definition, author, year]) => ({
    id,
    name,
    aliases,
    kind: "object" as const,
    facts: {
      definition,
      written_by: author,
      year,
    },
  })),
] as const;
