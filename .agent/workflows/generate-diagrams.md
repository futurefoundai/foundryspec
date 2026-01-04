---
description: How to generate and update Mermaid diagrams
---

As an AI agent, use this workflow to create or refine technical visualizations:

1.  **Context Discovery**: Before drawing, ask the user about boundaries, actors, and data flows to ensure you don't miss hidden complexities.
2.  **Select Category**: Determine where the diagram belongs (Architecture, Components, Sequences, States).
3.  **Define Diagram Type**:
    - `graph TD/LR` for Architecture and Components.
    - `sequenceDiagram` for logic flows.
    - `stateDiagram-v2` for state machines.
4.  **Draft Mermaid Code**: Write clear, well-commented Mermaid syntax.
5.  **Link to Footnotes**: For complex nodes that require detailed logic or state descriptions, use `click NodeID "/footnotes/CATEGORY/NodeId.md"`.
    - `CATEGORY` should be the folder name (e.g., `architecture`).
    - Create individual markdown files in `assets/CATEGORY/footnotes/NodeId.md`.
6.  **Robustness Check**: Ask: "Does this diagram raise more questions than it answers?". If yes, ask those questions to the user and refine.
7.  **Save File**: Write the `.mermaid` file (e.g., `specs/architecture/context.mermaid`).
