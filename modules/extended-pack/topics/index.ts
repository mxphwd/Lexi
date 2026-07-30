import { everydayWorldTopics } from "./everyday-world";
import { languageHumanitiesTopics } from "./language-humanities";
import { lexiTopics } from "./lexi";
import { mathematicsComputingTopics } from "./mathematics-computing";
import { naturalScienceTopics } from "./natural-science";

export const knowledgeTopics = [
  ...mathematicsComputingTopics,
  ...naturalScienceTopics,
  ...languageHumanitiesTopics,
  ...everydayWorldTopics,
  ...lexiTopics,
];
