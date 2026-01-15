---
description: How to collaborate with humans to design a new feature
---

As an AI agent, follow this "Exhaustive Discovery" cycle to reach **Zero-Question Implementation readiness**:

1.  **Discovery Phase (Mandatory First Step)**
    *   **Identify Actors:** Check `assets/discovery/personas.mermaid`. If the relevant actor is missing, add them using the Mermaid Class Diagram syntax.
    *   **Map the Journey:** Update or create `assets/discovery/journeys.mermaid` to visualize the user's flow for this specific feature. Use Mermaid's `journey` syntax.
    *   **Define Requirements:** Update `assets/discovery/requirements.mermaid` (Requirement Diagram) to include the new Functional and Non-Functional requirements for this feature.
    *   **Traceability:** Ensure requirements are linked to the components that will satisfy them.
    *   *Goal:* Ensure we understand "Who", "What", and "Why" before we define "How".

2.  **Architecture Phase (L1 - Context & L2 - Boundaries)**
*   Analyze `root.mermaid` and follow links to `assets/boundaries/`.
*   Does this feature introduce a new System, User, or Boundary? Update the relevant diagrams.
*   **Link It:** If you create a new diagram, ensure it is linked from an existing parent diagram (e.g., link `assets/boundaries/new-service.mermaid` from `assets/context/system-context.mermaid`) to satisfy the **No Orphan Policy**.
3.  **Detailed Design Phase (L3 - Components & L4 - Sequences)**
    *   Create detailed Component diagrams in `assets/components/`.
    *   Create Sequence diagrams in `assets/sequences/` for complex interactions.
    *   **Frontmatter:** Ensure EVERY `.mermaid` file has the required YAML frontmatter (title & description).

4.  **The "Zero-Question" Inquiry**: Ask questions until you can visualize the entire implementation path with no unknowns.

5.  **Drafting mental models**: Translate answers into Mermaid diagrams in the relevant categories.

6.  **Verification of Robustness**: Ask: "If I were a junior dev with no context, could I build this perfectly based ONLY on these docs?".

7.  **Completion Threshold**: The spec is complete when there are zero questions remaining and `foundryspec build` passes with no errors.