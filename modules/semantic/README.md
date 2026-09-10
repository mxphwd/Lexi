# Semantic Module

This directory retains only the semantic relation and grammar-frame definitions
consumed by the current DV12 parser plugin and seed-data types. The superseded
standalone semantic parser was removed.

Add specific relation detectors before broad definition detectors. Every new
frame needs a successful test and a collision test showing that a similar but
unsupported request does not route to the graph.
