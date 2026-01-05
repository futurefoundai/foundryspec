---
description: How to collaborate with humans to design a new feature
---

As an AI agent, follow this "Exhaustive Discovery" cycle to reach **Zero-Question Implementation readiness**:

1.  **Discovery Phase (Mandatory First Step)**
    *   **Identify Actors:** Check `assets/discovery/personas.mermaid`. If the relevant actor is missing, add them using the Mermaid Class Diagram syntax.
    *   **Map the Journey:** Update or create `assets/discovery/journeys.mermaid` to visualize the user's flow for this specific feature. Use Mermaid's `journey` syntax.
    *   **Define Requirements:** Update `assets/discovery/requirements.mermaid` (Mindmap) to include the new Functional and Non-Functional requirements for this feature.
    *   *Goal:* Ensure we understand "Who", "What", and "Why" before we define "How".

2.  **Architecture Phase (L1 - Context)**
    *   Analyze `assets/architecture/context.mermaid`.
    *   Does this feature introduce a new System or User? Update the diagram.
2.  **The "Zero-Question" Inquiry**: Ask questions until you can visualize the entire implementation path with no unknowns.
3.  **Drafting mental models**: Translate answers into Mermaid diagrams in the relevant categories.
4.  **Verification of Robustness**: Ask: "If I were a junior dev with no context, could I build this perfectly based ONLY on these docs?".
5.  **Completion Threshold**: The spec is complete when there are zero questions remaining.
