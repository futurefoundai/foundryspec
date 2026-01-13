---
title: Engine Capabilities
description: Overview of FoundrySpec's "Zero-Question" implementation engine.
traceability:
  id: "FEAT_Capabilities"
  uplink: "ROOT"
---

# Engine Capabilities

FoundrySpec is designed as a **Zero-Question Implementation Engine**, ensuring that documentation and code never drift apart.

## 1. Semantic Traceability (Spec <-> Code)

The engine scans the codebase for `@foundryspec ID` markers. Every component defined in the specification can be verified against its actual implementation in the code.

## 2. Reciprocal Validation

To ensure a perfectly consistent documentation graph, the engine enforces **uplink/downlink reciprocity**.

- If `Document A` has a `downlink` to `Document B`.
- `Document B` must have an `uplink` to `Document A`.
- This eliminates orphaned context and broken traceability chains.

## 3. CLI Intelligence

- **Root Detection**: Run FoundrySpec commands from any project subdirectory; the CLI automatically detects the project context.
- **Smart Build**: Optimized single-pass build process with shared asset memory and parallelized Mermaid validation.

## 4. Smart Clickability

Documentation diagrams are interactive by default. The engine semantically matches SVG nodes to specification IDs and titles, enabling navigation without polluting source files with link injection boilerplate.
