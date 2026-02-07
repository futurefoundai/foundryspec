# FoundrySpec AI Agent Guide 🤖

## Intent Driven Development (IDD) with FoundrySpec

FoundrySpec is an infrastructure for **Intent Driven Development (IDD)**. In IDD, every line of code, interaction, and system behavior must be traceable back to a specific **Intent** derived from a verified **Identity**.

Your goal as an agent is to construct and validate the system through four distinct layers of abstraction.

### 1. The Identity Layer (Who & Why)

The foundation of the system. Code cannot exist without a specialized Persona driving its necessity.

*   **Personas**: The roots of the graph, residing in `docs/personas/`.
    *   **The Actor**: End-users. Drives UX and features.
    *   **The Influencer**: Business stakeholders. Drives constraints.
    *   **The Guardian**: Regulators/Security. Drives compliance.
    *   **The Proxy**: External systems. Drives interface contracts.
*   **Artifacts**: `mindmap` files defining Role, Description, and Goals.

### 2. The Intent Layer (What)

The translation of Identity into actionable requirements and user journeys.

*   **Journeys**: High-level sequences in `docs/journeys/` showing how Personas interact with the system to achieve Goals.
*   **Requirements (REQ)**: Atomic, testable statements of need in `docs/requirements/`.
*   **Traceability**: Every Structural element must trace back to a `REQ_ID`.

### 3. The Structural Layer (Where)

The architecture that fulfills the Intent.

*   **Context (L1)**: Where the system lives. It defines the system's interaction with the external environment (Users and External Systems). Resides in `docs/context/`.
*   **Boundaries (L2)**: The system's internal world. These are the logical divisions of software (e.g., Frontend, Backend, Database) that accommodate specific responsibilities. Resides in `docs/boundaries/`.
*   **Components (L3)**: The implementation units within boundaries (e.g., Services, Controllers, Stores). Resides in `docs/components/`.
*   **Artifacts**: 
    *   L1 (Context) & L2 (Boundaries): `flowchart` (e.g., `graph TD`)
    *   L3 (Components): STRICTLY `classDiagram`

### 4. The Behavioral and Information Layer (How)

The dynamic interactions and data structure.

*   **Behavior**: Detailed Sequence Diagrams and State Charts showing *how* a Component executes Intent.
*   **Information**: Entity Relationship Diagrams (ERD) defining the data models.
*   **Artifacts**: `sequenceDiagram`, `stateDiagram`, `erDiagram` (often linked as footnotes or support files).

## 📝 Critical Rules for Agents

1.  **Traceability is Law**: You cannot implement a Component (Structural) without a Requirement (Intent) driven by a Persona (Identity).
2.  **Zero-Question Readiness**: Specs must be exhaustive.
3.  **Frontmatter Enforcement**: All spec files MUST have `id`, `title`, and `description`.
