---
description: How to safely translate FoundrySpec documentation into code
---

As an AI agent, follow this **"No Spec, No Code"** workflow to ensure the implementation perfectly matches the design.

# Phase 1: Pre-Flight Check
**Objective:** Verify that the feature is fully designed before writing a single line of code.

1.  **Locate Requirements:**
    *   Find the feature in `assets/discovery/requirements.mermaid`.
    *   *Check:* Is the requirement linked to a component?

2.  **Verify Architecture:**
    *   Check for the existence of detailed Component diagrams in `assets/components/`.
    *   Check for Sequence diagrams in `assets/sequences/` covering the main success and error scenarios.
    *   *Rule:* If the diagrams are missing, vague, or use generic names (e.g., "Service", "Manager"), **STOP**. Switch to the `design-feature` workflow to complete the spec.

# Phase 2: Spec-to-Code Mapping
**Objective:** Create code artifacts that mirror the documentation 1:1.

1.  **Scaffold Structure:**
    *   Create classes/modules in `src/` that match the **exact names** of the participants in the Component/Sequence diagrams.
    *   Do not invent new public methods that are not in the diagrams.

2.  **Define Contracts:**
    *   Create interfaces/types based on the data definitions in `assets/data/`.
    *   Use the messages in the Sequence diagrams to define function signatures.

# Phase 3: Behavior Implementation
**Objective:** Code the logic.

1.  **Follow the Sequence:**
    *   Implement methods by following the arrows in the Sequence diagram from top to bottom.
    *   Ensure calls to dependencies match the interactions shown.

2.  **State Management:**
    *   If `assets/states/` exists for this component, ensure the code enforces those state transitions and valid states.

# Phase 4: Verification (The Loop)
**Objective:** Ensure code and spec remain in sync.

1.  **Spec-Driven Testing:**
    *   Write a test case for every scenario in the Sequence diagram.
    *   Use the `assets/discovery/journeys.mermaid` to define integration test flows.

2.  **Drift Control:**
    *   **IF** you find a technical limitation or better approach while coding:
        1.  **PAUSE** the implementation.
        2.  **UPDATE** the relevant Mermaid diagram to reflect the new reality.
        3.  **RESUME** coding only after the spec is updated.

# Final Quality Gate
Before finishing, run `foundryspec build` to ensure no documentation links were broken and the spec remains valid.
