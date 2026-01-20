---
id: "FEAT_Capabilities"
title: Engine Capabilities
description: Granular details about FoundrySpec's "Zero-Question" engine.
requirements:
  - "REQ_Functional"
uplink:
  - "ROOT"
  - "GRP_Requirements"
---

FoundrySpec is designed as a **Zero-Question Implementation Engine**, ensuring that documentation and code never drift apart.

## 1. Dynamic Architectural Hub

The engine automatically synthesizes the navigation structure based on your file system.
- **Auto-Discovery**: `root.mermaid` and `personas.mermaid` are dynamically generated in the build output.
- **Zero-Boilerplate**: You no longer need to manually maintain a central index file. Simply adding a file to `docs/discovery/personas/` automatically wires it into the graph.

## 2. Visual Verification (Strict Persona Gate)

The system validates the *structure* of your diagrams, not just the metadata.
- **Mindmap Validation**: Persona files (`PER_*.mermaid`) must be valid Mermaid Mindmaps.
- **Adequacy Check**: The engine parses the diagram to ensure mandatory branches exist: **Role**, **Description**, and **Goals**. This ensures every actor is fully defined before system design begins.

## 3. Semantic Traceability (Spec <-> Code)

The engine scans the codebase for `@foundryspec ID` markers. Every component defined in the specification can be verified against its actual implementation in the code.

## 4. Reciprocal Validation

To ensure a perfectly consistent documentation graph, the engine enforces **uplink/downlink reciprocity**.
- If `Document A` has a `downlink` to `Document B`.
- `Document B` must have an `uplink` to `Document A`.

## 5. CLI Intelligence

- **Root Detection**: Run FoundrySpec commands from any project subdirectory.
- **Internal Build**: Builds are stored in `~/.foundryspec/builds/`, keeping your project clean.

## 6. Smart Clickability

Documentation diagrams are interactive by default. The engine semantically matches SVG nodes to specification IDs and titles, enabling navigation without polluting source files with link injection boilerplate.