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
] as ContextPage[];

export default contextPages;
