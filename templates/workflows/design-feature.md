---
description: How to collaborate with humans to design a new feature
---

As an AI agent, follow this "Exhaustive Discovery" cycle to reach **Zero-Question Implementation readiness**:

1.  **Discovery Phase (Mandatory First Step)**
    *   **Identify Actors:** Check `docs/discovery/personas/`. If the relevant actor is missing, add a new persona mindmap (e.g., `docs/discovery/personas/PER_NewUser.mermaid`).
    *   **Map the Journey:** Update or create a sequence diagram in `docs/discovery/journeys/` to visualize the user's flow for this specific feature.
    *   **Define Requirements:** Update `docs/discovery/requirements/` (Requirement Diagram) to include the new Functional and Non-Functional requirements for this feature.
    *   **Traceability:** Ensure requirements are linked to the implementation assets (Features or Components) that will satisfy them.
    *   *Goal:* Ensure we understand "Who", "What", and "Why" before we define "How".

2.  **Architecture Phase (L1 - Context & L2 - Boundaries)**
    *   Navigate through the **Root Hub** to `docs/boundaries/`.
    *   Does this feature introduce a new System, User, or Boundary? Update the relevant diagrams.
    *   **Link It:** If you create a new diagram, ensure its **ID** or **Text Label** is referenced in an existing parent diagram (e.g., reference the new component ID in `docs/context/system-context.mermaid`) to satisfy the **No Orphan Policy** via dynamic linking.
3.  **Detailed Design Phase (L3 - Components & L4 - Sequences)**
    *   Create detailed Component diagrams in `docs/components/`.
    *   Create Sequence diagrams in `docs/sequences/` for complex interactions.
    *   **Frontmatter:** Ensure EVERY `.mermaid` file has the required YAML frontmatter (title, description, and a unique id).

4.  **The "Zero-Question" Inquiry**: Ask questions until you can visualize the entire implementation path with no unknowns.

5.  **Drafting mental models**: Translate answers into Mermaid diagrams in the relevant categories.

6.  **Verification of Robustness**: Ask: "If I were a junior dev with no context, could I build this perfectly based ONLY on these docs?".

7.  **Completion Threshold**: The spec is complete when there are zero questions remaining and `foundryspec build` passes with no errors.