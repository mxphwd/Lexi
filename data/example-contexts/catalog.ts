import greetings from "./01-greetings.json";
import identity from "./02-identity.json";
import origin from "./03-alphaine-origin.json";
import mechanism from "./04-mechanical-pipeline.json";
import comparison from "./05-ai-comparison.json";
import contextModule from "./06-context-module.json";
import searchModule from "./07-search-module.json";
import connectModule from "./08-connect-module.json";
import structureModule from "./09-structure-module.json";
import capabilities from "./10-capabilities.json";
import limitations from "./11-limitations.json";
import dialogue from "./12-dialogue-basics.json";
import introductions from "./13-introductions.json";
import askingAName from "./14-asking-a-name.json";
import apologies from "./15-apologies.json";
import acceptingApologies from "./16-accepting-apologies.json";
import acknowledgements from "./17-acknowledgements.json";
import agreement from "./18-agreement.json";
import disagreement from "./19-disagreement.json";
import clarificationRequests from "./20-clarification-requests.json";
import repetitionRequests from "./21-repetition-requests.json";
import confirmationQuestions from "./22-confirmation-questions.json";
import simpleRequests from "./23-simple-requests.json";
import permissionRequests from "./24-permission-requests.json";
import offersToHelp from "./25-offers-to-help.json";
import invitations from "./26-invitations.json";
import acceptingInvitations from "./27-accepting-invitations.json";
import decliningInvitations from "./28-declining-invitations.json";
import preferenceQuestions from "./29-preference-questions.json";
import expressingLikes from "./30-expressing-likes.json";
import expressingDislikes from "./31-expressing-dislikes.json";
import positiveFeelings from "./32-positive-feelings.json";
import negativeFeelings from "./33-negative-feelings.json";
import compliments from "./34-compliments.json";
import congratulations from "./35-congratulations.json";
import encouragement from "./36-encouragement.json";
import smallTalk from "./37-small-talk.json";
import askingTheTime from "./38-asking-the-time.json";
import statingTheTime from "./39-stating-the-time.json";
import askingTheDate from "./40-asking-the-date.json";
import statingADate from "./41-stating-a-date.json";
import morningRoutines from "./42-morning-routines.json";
import eveningRoutines from "./43-evening-routines.json";
import mealPlanning from "./44-meal-planning.json";
import orderingFood from "./45-ordering-food.json";
import requestingDrinks from "./46-requesting-drinks.json";
import studyActivities from "./47-study-activities.json";
import classroomHelp from "./48-classroom-help.json";
import workUpdates from "./49-work-updates.json";
import taskPlanning from "./50-task-planning.json";
import scheduling from "./51-scheduling.json";
import shoppingAvailability from "./52-shopping-availability.json";
import priceQuestions from "./53-price-questions.json";
import quantityRequests from "./54-quantity-requests.json";
import travelPlanning from "./55-travel-planning.json";
import transportQuestions from "./56-transport-questions.json";
import directionRequests from "./57-direction-requests.json";
import locationQuestions from "./58-location-questions.json";
import weatherQuestions from "./59-weather-questions.json";
import clothingConsiderations from "./60-clothing-considerations.json";
import householdChores from "./61-household-chores.json";
import sleepRoutines from "./62-sleep-routines.json";
import type { ContextPage } from "@/lib/lexi/types";

const contextPages = [
  greetings,
  identity,
  origin,
  mechanism,
  comparison,
  contextModule,
  searchModule,
  connectModule,
  structureModule,
  capabilities,
  limitations,
  dialogue,
  introductions,
  askingAName,
  apologies,
  acceptingApologies,
  acknowledgements,
  agreement,
  disagreement,
  clarificationRequests,
  repetitionRequests,
  confirmationQuestions,
  simpleRequests,
  permissionRequests,
  offersToHelp,
  invitations,
  acceptingInvitations,
  decliningInvitations,
  preferenceQuestions,
  expressingLikes,
  expressingDislikes,
  positiveFeelings,
  negativeFeelings,
  compliments,
  congratulations,
  encouragement,
  smallTalk,
  askingTheTime,
  statingTheTime,
  askingTheDate,
  statingADate,
  morningRoutines,
  eveningRoutines,
  mealPlanning,
  orderingFood,
  requestingDrinks,
  studyActivities,
  classroomHelp,
  workUpdates,
  taskPlanning,
  scheduling,
  shoppingAvailability,
  priceQuestions,
  quantityRequests,
  travelPlanning,
  transportQuestions,
  directionRequests,
  locationQuestions,
  weatherQuestions,
  clothingConsiderations,
  householdChores,
  sleepRoutines,
] as ContextPage[];

export default contextPages;
