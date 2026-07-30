import { everydayWorldTopics } from "./everyday-world";
import { languageHumanitiesTopics } from "./language-humanities";
import { lexiTopics } from "./lexi";
import { mathematicsComputingTopics } from "./mathematics-computing";
import { naturalScienceTopics } from "./natural-science";
import { dv6TechnicalTopics } from "./dv6-technical";

export const knowledgeTopics = [
  ...mathematicsComputingTopics,
  ...naturalScienceTopics,
  ...languageHumanitiesTopics,
  ...everydayWorldTopics,
  ...lexiTopics,
  ...dv6TechnicalTopics,
];
