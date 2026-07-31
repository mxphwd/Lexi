# Semantic Module

The Semantic Module converts an English request into a typed `SemanticQuery`.
It records the question kind, relation, resolved subjects, requested object or
ability, condition, quantity, time, answer style, negation, confidence, and
parsing evidence.

Add specific relation detectors before broad definition detectors. Every new
frame needs a successful test and a collision test showing that a similar but
unsupported request does not route to the graph.
