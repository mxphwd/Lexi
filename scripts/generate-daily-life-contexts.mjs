import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.join(process.cwd(), "data", "example-contexts");
const stopWords = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from", "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "this", "to", "we", "with", "you", "your"]);

const pages = [
  {
    id: "38-asking-the-time", title: "Asking the time", intent: "ask-time", tone: "neutral",
    description: "Questions asking for the current or local time.", purpose: "state the lack of a live clock source",
    left: ["What time is it", "Could you tell me the time", "Do you know the time", "Can you give me the current time", "What is the local time", "May I ask what time it is", "Please tell me the time", "Would you check the time"],
    right: ["?", " now?", " right now?", " where I am?", " in my area?", " at the moment?", " today?", " please?", " before we continue?", " as precisely as you can?"],
    responses: ["I do not have a live clock source in this corpus, so I cannot safely state the current time.", "Please check your device clock for the current local time.", "A current time requires a live clock and location, which this recorded context does not provide."],
  },
  {
    id: "39-stating-the-time", title: "Stating a time", intent: "state-time", tone: "neutral",
    description: "Statements that provide a time for conversational reference.", purpose: "acknowledge a supplied time without claiming persistence",
    left: ["The time is", "It is", "The meeting starts at", "I will arrive at", "Let us begin at", "The appointment is at", "Please remember the stated time is", "For this example, use"],
    right: ["seven o'clock.", "eight thirty.", "nine in the morning.", "ten fifteen.", "noon.", "one in the afternoon.", "three forty-five.", "five in the evening.", "six twenty.", "midnight."],
    responses: ["I recognize the time stated in this message.", "The supplied time is clear for this turn.", "That time has been identified, though I do not retain schedules between conversations."],
  },
  {
    id: "40-asking-the-date", title: "Asking the date", intent: "ask-date", tone: "neutral",
    description: "Questions asking for the current date or day.", purpose: "state the lack of a live calendar source",
    left: ["What is the date", "What day is it", "Could you tell me today's date", "Do you know the current date", "Can you give me the date", "Which day is today", "Please tell me today's date", "Would you check the calendar date"],
    right: ["?", " today?", " right now?", " where I am?", " in my area?", " at the moment?", " this morning?", " please?", " before we continue?", " as precisely as you can?"],
    responses: ["I do not have a live calendar source in this corpus, so I cannot safely state today's date.", "Please check your device calendar for the current local date.", "A current date requires live calendar and timezone context that is not recorded here."],
  },
  {
    id: "41-stating-a-date", title: "Stating a date", intent: "state-date", tone: "neutral",
    description: "Statements that provide a date for conversational reference.", purpose: "acknowledge a supplied date without claiming persistence",
    left: ["The date is", "Today is", "The meeting is on", "I will arrive on", "Let us begin on", "The appointment is on", "For this example, the date is", "The deadline is"],
    right: ["January fifth.", "February tenth.", "March fifteenth.", "April twentieth.", "May first.", "June twelfth.", "July eighteenth.", "August twenty-third.", "September thirtieth.", "December thirty-first."],
    responses: ["I recognize the date stated in this message.", "The supplied date is clear for this turn.", "That date has been identified, though I do not maintain a calendar between conversations."],
  },
  {
    id: "42-morning-routines", title: "Morning routines", intent: "morning-routine", tone: "warm",
    description: "Statements about ordinary activities performed in the morning.", purpose: "acknowledge a morning routine",
    left: ["Every morning I", "In the morning I usually", "My morning routine is to", "After I wake up, I", "Before breakfast I", "On weekdays I", "I start my day when I", "A normal morning begins when I"],
    right: ["make the bed.", "brush my teeth.", "wash my face.", "drink a glass of water.", "eat breakfast.", "read the news.", "stretch for a few minutes.", "prepare for work.", "pack my bag.", "write a short plan."],
    responses: ["I understand that this activity is part of your morning routine.", "That statement describes an ordinary morning habit.", "Your morning activity is clear in this turn."],
  },
  {
    id: "43-evening-routines", title: "Evening routines", intent: "evening-routine", tone: "warm",
    description: "Statements about ordinary activities performed in the evening.", purpose: "acknowledge an evening routine",
    left: ["Every evening I", "In the evening I usually", "My evening routine is to", "After dinner I", "Before bed I", "On weeknights I", "I end my day when I", "A normal evening includes time to"],
    right: ["wash the dishes.", "take a shower.", "read a book.", "prepare for tomorrow.", "set an alarm.", "tidy the room.", "talk with my family.", "review the day.", "turn off the lights.", "relax for a while."],
    responses: ["I understand that this activity is part of your evening routine.", "That statement describes an ordinary evening habit.", "Your evening activity is clear in this turn."],
  },
  {
    id: "44-meal-planning", title: "Planning a meal", intent: "meal-planning", tone: "neutral",
    description: "Basic questions and requests about choosing a meal.", purpose: "request relevant dietary and ingredient constraints",
    left: ["Help me plan", "Can we choose", "I need an idea for", "What could I make for", "Please suggest the structure of", "I am deciding on", "Let us think about", "I need to prepare"],
    right: ["a simple breakfast.", "a quick lunch.", "an easy dinner.", "a light snack.", "a family meal.", "a packed lunch.", "a vegetarian meal.", "a meal with few ingredients.", "a meal for tomorrow.", "a basic weekend meal."],
    responses: ["State the available ingredients and any dietary constraints so the meal can be planned without guessing.", "A meal plan needs the ingredients, number of people, and dietary limits.", "I can recognize the meal-planning request; provide the constraints needed for a bounded suggestion."],
  },
  {
    id: "45-ordering-food", title: "Ordering food", intent: "food-order", tone: "neutral",
    description: "Common sentences used to order food in a restaurant or café.", purpose: "recognize a food order without claiming a transaction",
    left: ["I would like", "Could I have", "May I order", "Please bring me", "Can I get", "I will have", "I'd like to order", "For my order, I want"],
    right: ["a bowl of soup.", "a vegetable sandwich.", "a plate of rice.", "a small salad.", "the pasta dish.", "a piece of bread.", "the daily special.", "a serving of noodles.", "a side of vegetables.", "a simple dessert."],
    responses: ["I recognize the food order, but I cannot place a real transaction.", "That sentence clearly requests a food item.", "The requested dish is identified for this conversational example."],
  },
  {
    id: "46-requesting-drinks", title: "Requesting drinks", intent: "drink-request", tone: "neutral",
    description: "Common sentences used to request a drink.", purpose: "recognize a drink request without claiming a transaction",
    left: ["I would like", "Could I have", "May I order", "Please bring me", "Can I get", "I will have", "I'd like to order", "For my drink, I want"],
    right: ["a glass of water.", "a cup of tea.", "a small coffee.", "some orange juice.", "a cold drink.", "a warm drink.", "water without ice.", "tea without sugar.", "coffee with milk.", "another glass of water."],
    responses: ["I recognize the drink request, but I cannot place or fulfill a real order.", "That sentence clearly requests a drink.", "The requested drink is identified for this conversational example."],
  },
  {
    id: "47-study-activities", title: "Study activities", intent: "study-activity", tone: "warm",
    description: "Statements about ordinary studying and learning activities.", purpose: "acknowledge a study activity",
    left: ["I am studying", "Today I am reviewing", "I need to practice", "My lesson is about", "I am learning", "This week I am working on", "For class I am reading about", "My current study topic is"],
    right: ["basic vocabulary.", "English grammar.", "simple arithmetic.", "world history.", "introductory science.", "reading comprehension.", "sentence structure.", "geography.", "computer basics.", "writing clearly."],
    responses: ["I understand the study topic stated in this message.", "That is a clear description of your current learning activity.", "The study subject is identified for this turn."],
  },
  {
    id: "48-classroom-help", title: "Classroom help requests", intent: "classroom-help", tone: "precise",
    description: "Requests for basic help with class materials and instructions.", purpose: "ask for the exact classroom material",
    left: ["Can you help me understand", "Please explain", "I need help with", "Could you show an example of", "Can you summarize", "Please clarify", "I have a question about", "Could you walk me through"],
    right: ["this lesson?", "the homework instructions?", "the first exercise?", "this vocabulary list?", "the grammar rule?", "the reading question?", "the worked example?", "the assignment goal?", "the main concept?", "the next step?"],
    responses: ["Provide the exact lesson text or question so I can match it against supported material.", "I recognize the classroom-help request; the relevant instructions or content must be supplied.", "Please include the specific exercise or rule that needs explanation."],
  },
  {
    id: "49-work-updates", title: "Basic work updates", intent: "work-update", tone: "neutral",
    description: "Statements reporting ordinary progress on work or a project.", purpose: "acknowledge a work update",
    left: ["I have finished", "I am working on", "I have started", "I still need to complete", "Today I reviewed", "My current task is", "I made progress on", "I am waiting to begin"],
    right: ["the first task.", "the written report.", "the project outline.", "the final review.", "the meeting notes.", "the next assignment.", "the data check.", "the presentation draft.", "the customer request.", "the weekly summary."],
    responses: ["I understand the work status stated in this message.", "That is a clear update about task progress.", "The reported work stage is acknowledged for this turn."],
  },
  {
    id: "50-task-planning", title: "Planning tasks", intent: "task-planning", tone: "precise",
    description: "Requests for organizing a bounded task into manageable steps.", purpose: "request a task goal and constraints",
    left: ["Help me plan", "Can you break down", "I need steps for", "Please help me organize", "How should I begin", "Can we make a checklist for", "I want to structure", "Please outline"],
    right: ["a small project.", "today's work.", "a writing task.", "a study session.", "a room cleanup.", "a short presentation.", "a basic review.", "a simple event.", "a weekly goal.", "the next assignment."],
    responses: ["State the goal, deadline, and constraints so the task can be divided into supported steps.", "A useful task plan needs a clear outcome and the limits on time or resources.", "I recognize the planning request; provide the concrete task details needed to avoid assumptions."],
  },
  {
    id: "51-scheduling", title: "Scheduling requests", intent: "scheduling-request", tone: "precise",
    description: "Requests to arrange a time without claiming calendar access.", purpose: "request explicit scheduling constraints",
    left: ["Can we schedule", "Help me choose a time for", "I need to arrange", "Please suggest when to hold", "Let us find a time for", "I want to put on the calendar", "Could we plan the time for", "I need a schedule for"],
    right: ["a short meeting.", "a study session.", "a phone call.", "a project review.", "a lunch break.", "a practice session.", "an appointment.", "a weekly check-in.", "a planning discussion.", "the next conversation."],
    responses: ["I cannot access a live calendar. Provide the available dates, times, timezone, and duration to compare options.", "Scheduling requires explicit availability and timezone information.", "I recognize the scheduling request but cannot create a real calendar event from this corpus."],
  },
  {
    id: "52-shopping-availability", title: "Asking about product availability", intent: "product-availability", tone: "cautious",
    description: "Shopping questions asking whether an ordinary item is available.", purpose: "state the lack of live inventory",
    left: ["Do you have", "Is there", "Can I buy", "Is this store carrying", "Could you check for", "Do they sell", "Is it possible to find", "I am looking for"],
    right: ["a small notebook?", "a blue pen?", "a phone charger?", "a reusable bottle?", "a plain shirt?", "a pair of socks?", "a travel bag?", "a desk lamp?", "a basic umbrella?", "a gift card?"],
    responses: ["I cannot check live store inventory. Contact the seller or inspect its current listing.", "That is a product-availability question, but no current inventory is recorded here.", "The requested item is clear; availability requires a live source from the relevant store."],
  },
  {
    id: "53-price-questions", title: "Asking prices", intent: "price-question", tone: "cautious",
    description: "Shopping questions asking for the price of an ordinary item.", purpose: "state the lack of live pricing",
    left: ["How much is", "What does it cost to buy", "Can you tell me the price of", "What is the current price of", "How much would I pay for", "Could you check the cost of", "Do you know how much they charge for", "What is the listed price for"],
    right: ["a small notebook?", "a blue pen?", "a phone charger?", "a reusable bottle?", "a plain shirt?", "a pair of socks?", "a travel bag?", "a desk lamp?", "a basic umbrella?", "a gift card?"],
    responses: ["I cannot verify live prices. Check the seller's current listing and currency.", "That is a price question, but no current price source is present in this corpus.", "The item is identified; an accurate price requires a live seller, location, and currency."],
  },
  {
    id: "54-quantity-requests", title: "Requests with quantities", intent: "quantity-request", tone: "neutral",
    description: "Ordinary requests specifying a count or amount.", purpose: "recognize an explicitly stated quantity",
    left: ["Please give me", "I would like", "Could I have", "Can you prepare", "I need", "Please set aside", "For this example, provide", "The request is for"],
    right: ["one copy.", "two tickets.", "three examples.", "four pages.", "five items.", "six bottles.", "seven labels.", "eight chairs.", "nine cards.", "ten minutes."],
    responses: ["I recognize the quantity stated in the request, but I cannot fulfill a physical transaction.", "The requested amount is clear for this conversational example.", "That sentence contains an explicit quantity and requested item."],
  },
  {
    id: "55-travel-planning", title: "Basic travel planning", intent: "travel-planning", tone: "cautious",
    description: "Requests for organizing a trip without claiming live booking access.", purpose: "request destination and travel constraints",
    left: ["Help me plan", "I want to organize", "Can we outline", "I need a basic plan for", "Please help me prepare", "What should I consider for", "Can you make a checklist for", "I am starting to plan"],
    right: ["a weekend trip.", "a day trip.", "a train journey.", "a family visit.", "a short vacation.", "a business trip.", "an overnight stay.", "a city visit.", "an airport transfer.", "a return journey."],
    responses: ["Provide the destination, dates, budget, travelers, and constraints before planning the trip.", "I can recognize the travel-planning request but cannot verify live bookings or entry requirements from this corpus.", "A bounded travel plan needs explicit dates, locations, budget, and mobility requirements."],
  },
  {
    id: "56-transport-questions", title: "Transportation questions", intent: "transport-question", tone: "cautious",
    description: "Questions about reaching a place by common transportation modes.", purpose: "request route details and live schedule sources",
    left: ["How can I get there by", "Can I travel there using", "Is it possible to take", "Where would I board", "How long does it take by", "What should I know about taking", "Could I reach the destination on", "Which route uses"],
    right: ["bus?", "train?", "subway?", "taxi?", "bicycle?", "a local shuttle?", "a ferry?", "an airport bus?", "a rental car?", "public transportation?"],
    responses: ["Provide the origin and destination; current routes and schedules must be checked with a live transport source.", "That is a transportation question, but the locations and current schedule are not available here.", "A reliable route requires the starting point, destination, travel time, and current service information."],
  },
  {
    id: "57-direction-requests", title: "Requests for directions", intent: "direction-request", tone: "cautious",
    description: "Questions asking how to reach a common type of destination.", purpose: "request an origin and map source",
    left: ["How do I get to", "Can you show me the way to", "Which direction is", "What route should I take to", "Could you guide me to", "Where should I turn for", "How can I walk to", "Please give me directions to"],
    right: ["the station?", "the nearest exit?", "the city center?", "the library?", "the hospital?", "the airport?", "the bus stop?", "the hotel?", "the information desk?", "the main entrance?"],
    responses: ["I need your starting point and a current map source to give reliable directions.", "The destination is clear, but no origin or live map is present in this context.", "Accurate directions require a specific starting location and current route information."],
  },
  {
    id: "58-location-questions", title: "Location questions", intent: "location-question", tone: "cautious",
    description: "Questions asking where a common place or object is located.", purpose: "state the need for local or supplied location context",
    left: ["Where is", "Can you tell me the location of", "Do you know where to find", "Which way is", "How far away is", "Could you locate", "Where should I look for", "What is the address of"],
    right: ["the station?", "the nearest exit?", "the city center?", "the library?", "the hospital?", "the airport?", "the bus stop?", "the hotel?", "the information desk?", "the main entrance?"],
    responses: ["I need a city, building, or supplied map context to identify that location.", "The place is named, but its actual location is not recorded in this conversational context.", "A reliable location answer requires the relevant local context or a current map source."],
  },
  {
    id: "59-weather-questions", title: "Basic weather questions", intent: "weather-question", tone: "cautious",
    description: "Questions about current or near-term weather conditions.", purpose: "state the lack of live weather data",
    left: ["What is the weather", "Is it raining", "Will it be sunny", "How warm is it", "Is it cold outside", "What is the forecast", "Do I need an umbrella", "Are storms expected"],
    right: ["?", " today?", " right now?", " this morning?", " this afternoon?", " this evening?", " where I am?", " in my city?", " tomorrow?", " this weekend?"],
    responses: ["I do not have live weather data. Check a current forecast for your specified location.", "Weather depends on location and time, and neither a live source nor sufficient context is available here.", "That is a weather question; an accurate answer requires a current weather service."],
  },
  {
    id: "60-clothing-considerations", title: "Choosing clothing for conditions", intent: "clothing-consideration", tone: "cautious",
    description: "Questions about choosing clothing based on stated activities or conditions.", purpose: "request conditions before suggesting clothing",
    left: ["What should I wear for", "How should I dress for", "Do I need special clothing for", "Which clothes would suit", "Can you help me choose clothes for", "What kind of outfit works for", "Should I bring a jacket for", "What footwear makes sense for"],
    right: ["a rainy walk?", "a cold morning?", "a hot afternoon?", "a formal meeting?", "a casual dinner?", "a long train ride?", "an outdoor event?", "a day at work?", "a short hike?", "a windy evening?"],
    responses: ["Clothing depends on the actual weather, activity, dress code, and personal needs; provide those details first.", "The occasion is identified, but current conditions and personal requirements are needed for a bounded suggestion.", "I can recognize the clothing question without assuming live weather or a dress code."],
  },
  {
    id: "61-household-chores", title: "Household chores", intent: "household-chore", tone: "neutral",
    description: "Statements about ordinary household tasks.", purpose: "acknowledge a household task",
    left: ["I need to", "Today I will", "My next chore is to", "I have started to", "I just finished", "This afternoon I plan to", "Before I rest, I should", "The household task is to"],
    right: ["wash the dishes.", "sweep the floor.", "take out the trash.", "do the laundry.", "clean the table.", "organize the shelf.", "water the plants.", "make the bed.", "tidy the kitchen.", "put away the groceries."],
    responses: ["I understand the household task stated in this message.", "That sentence describes an ordinary household chore.", "The chore and its current status are clear for this turn."],
  },
  {
    id: "62-sleep-routines", title: "Sleep routines", intent: "sleep-routine", tone: "neutral",
    description: "Statements about ordinary non-medical bedtime and waking habits.", purpose: "acknowledge a sleep-related routine without medical advice",
    left: ["Before sleeping I", "At bedtime I usually", "My sleep routine is to", "Each night I", "Before I go to bed, I", "To prepare for sleep, I", "In the morning I usually", "My usual waking habit is to"],
    right: ["set an alarm.", "turn off the lights.", "put away my phone.", "read for a few minutes.", "close the curtains.", "prepare clothes for tomorrow.", "drink some water.", "check the room temperature.", "write down tomorrow's tasks.", "wake up at a regular time."],
    responses: ["I understand the sleep-related routine stated in this message.", "That describes an ordinary bedtime or waking habit, not a medical condition.", "The routine is clear for this turn."],
  },
];

function detectMode(input) {
  if (input.trim().endsWith("!")) return "exclamative";
  if (input.trim().endsWith("?")) return "interrogative";
  if (/^(explain|describe|define|show|tell|give|help|please)\b/i.test(input)) return "imperative";
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
  return {
    schemaVersion: 1,
    page: { id: page.id, title: page.title, description: page.description, language: "en" },
    entries: inputs.map((input, index) => ({
      id: `${page.id}-${String(index + 1).padStart(3, "0")}`,
      intent: page.intent,
      input,
      response: page.responses[index % page.responses.length],
      keywords: keywordsFor(input),
      mode: detectMode(input),
      context: { domain: "daily life", purpose: page.purpose, tone: page.tone },
    })),
  };
}

await mkdir(outputDirectory, { recursive: true });
for (const page of pages) {
  await writeFile(path.join(outputDirectory, `${page.id}.json`), `${JSON.stringify(buildPage(page), null, 2)}\n`, "utf8");
}

const examples = pages.reduce((sum, page) => sum + page.left.length * page.right.length, 0);
console.log(`Generated ${pages.length} daily-life pages with ${examples} examples (${examples * 2} paired sentences).`);
