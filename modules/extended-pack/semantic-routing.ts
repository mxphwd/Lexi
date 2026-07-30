type SemanticModifier = {
  id: string;
  pattern: RegExp;
};

const semanticModifiers: SemanticModifier[] = [
  { id: "semantic-actually", pattern: /\s+actually$/ },
  { id: "semantic-really", pattern: /\s+really$/ },
  { id: "semantic-exactly", pattern: /\s+exactly$/ },
  { id: "semantic-itself", pattern: /\s+itself$/ },
  { id: "semantic-overall", pattern: /\s+overall$/ },
  { id: "semantic-in-general", pattern: /\s+in general$/ },
  { id: "semantic-at-core", pattern: /\s+at its core$/ },
  { id: "semantic-basic-level", pattern: /\s+on a basic level$/ },
  { id: "semantic-as-concept", pattern: /\s+as a concept$/ },
  { id: "semantic-as-field", pattern: /\s+as a field$/ },
  { id: "semantic-as-subject", pattern: /\s+as a subject$/ },
  { id: "semantic-as-system", pattern: /\s+as a system$/ },
  { id: "semantic-in-practice", pattern: /\s+in practice$/ },
  { id: "semantic-in-theory", pattern: /\s+in theory$/ },
  { id: "semantic-from-scratch", pattern: /\s+from scratch$/ },
  { id: "semantic-for-beginners", pattern: /\s+for beginners$/ },
  { id: "semantic-for-beginner", pattern: /\s+for a beginner$/ },
  { id: "semantic-in-computing", pattern: /\s+in computing$/ },
  { id: "semantic-in-science", pattern: /\s+in science$/ },
  { id: "semantic-in-technology", pattern: /\s+in technology$/ },
  { id: "semantic-simple-words", pattern: /\s+in simple words$/ },
  { id: "semantic-technical-terms", pattern: /\s+in technical terms$/ },
  { id: "semantic-normally", pattern: /\s+normally$/ },
  { id: "semantic-today", pattern: /\s+today$/ },
];

export function prepareSemanticTarget(value: string): {
  target: string;
  appliedFeatures: string[];
} {
  let target = value.trim();
  const appliedFeatures: string[] = [];

  for (const modifier of semanticModifiers) {
    if (!modifier.pattern.test(target)) continue;
    target = target.replace(modifier.pattern, "").trim();
    appliedFeatures.push(modifier.id);
  }

  return { target, appliedFeatures };
}

export const semanticRoutingFeatureCount = semanticModifiers.length;
