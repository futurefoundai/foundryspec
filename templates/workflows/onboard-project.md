---
description: How to onboard an existing project that does not use FoundrySpec
---

As an AI agent, follow this "Discovery-Reverse" workflow to bring architectural order to an existing (unboarded) codebase:

1.  **Codebase Analysis (Phase 1)**
    *   **Scout the Territory:** Read `package.json`, `README.md`, and scan the directory structure.
    *   **Identify Core Tech:** Determine the primary language, framework, and infrastructure (e.g., Docker, Serverless, K8s).
    *   **Goal:** Build a mental model of what the project *is* before trying to document it.

2.  **Scaffold the Intent (Phase 2)**
    *   Run `foundryspec init` if not already done.
    *   **Create Personas:** Based on your scan, identify at least one End-User (`PER_EndUser`) and one Stakeholder (`PER_Stakeholder`).
    *   **Define Boundaries (L2):** Map the high-level folders or services to a `technical-boundaries.mermaid` diagram.

3.  **Traceability Bridge (Phase 3)**
    *   **Map Components (L3):** Identify the 3-5 most critical files or modules.
    *   **Propose Markers:** Identify where `@foundryspec` markers should be placed in the source code to link to your new diagrams.
    *   **Documentation First:** Do NOT touch the source code yet. Only propose the markers in your response.

4.  **Validation (Phase 4)**
    *   Run `foundryspec build`.
    *   **Fix Graph Breaches:** Ensure every new diagram is reachable from the auto-generated **Root Hub**.
    *   **No Orphan Policy:** If you identified a feature in the code but haven't documented its requirement, add it to a requirement diagram in `docs/discovery/requirements/`.

5.  **Audit & Review**
    *   Present the **FoundrySpec Hub** to the user.
    *   The project is considered "Onboarded" once `foundryspec build` passes and the user confirms the L2 Boundaries match reality.
