# FoundrySpec AI Agent Guide 🤖

## Introduction

**FoundrySpec** is a documentation engine designed for **Human-AI Collaborative System Analysis & Design**. Whether working on **Greenfield** (new) or **Brownfield** (existing) projects, your goal is to achieve **Zero-Question Implementation readiness**. This means the documentation you generate or read should be so exhaustive that a developer (or another agent) can implement the system without needing to ask for further clarification.

## Core Concepts

- **Graph-Based Documentation**: The documentation is a directed graph starting from a single entry point: `root.mermaid`. All other diagrams must be reachable from this root to be included in the build (No Orphan Policy).
- **Frontmatter Enforcement**: All `.mermaid` files MUST include a YAML frontmatter block with `title` and `description` fields.
- **Discovery-First**: Every feature starts with Discovery (Personas, Journeys, Requirements) before Architecture or Code.
- **Zero-Question Implementation**: Strive for maximum detail in your specs.

### The Four Persona Types

To achieve complete system understanding, you must identify four distinct types of personas. Each drives specific layers of the system design:

1.  **The End-User Persona ("The Actor")**

    - **Definition**: Traditional personas who interact with the UI or API to achieve goals.
    - **Examples**: The Shopper, The Data Scientist, The IoT Device Owner.
    - **Traceability Impact**: Drives **L3 Component** design (UX, Latency, Accessibility).

2.  **The Stakeholder Persona ("The Influencer")**

    - **Definition**: People who don't use the software but define its success constraints.
    - **Examples**: The CTO (cost), The Product Manager (time-to-market).
    - **Traceability Impact**: Drives **L1 Context** (e.g., "Serverless to minimize overhead").

3.  **The Regulatory Persona ("The Guardian")**

    - **Definition**: External bodies or legal frameworks that "act" through audits and compliance.
    - **Examples**: GDPR/CCPA, SOC2 Auditor, HIPAA.
    - **Traceability Impact**: Drives **L2 Boundaries** (e.g., "Database isolation in EU region").

4.  **The System Persona ("The Proxy")**
    - **Definition**: External systems that impose requirements on your system.
    - **Examples**: Legacy Mainframes, Payment Gateways.
    - **Traceability Impact**: Drives **L3 Interfaces** (e.g., "Must support XML for legacy compat").

## Project Structure

A standard FoundrySpec project (initialized with `init`) follows a generic **L0-L3 Layered Model**:

- `root.mermaid`: The **mandatory** entry point. It visualizes the hierarchy below.
- `assets/`: The heart of the documentation.
  - `discovery/`: **L0**. Personas, Journeys, Requirements.
  - `context/`: **L1**. System Context and high-level strategy.
  - `boundaries/`: **L2**. Technical boundaries and communication.
  - `components/`: **L3**. Detailed component breakdowns and specifications.
  - **Peripherals**:
    - `sequences/`: Interaction flows.
    - `states/`: State machine logic.
    - `data/`: ER diagrams and schema.
    - `design/`: UI/UX mocks and wireframes.
    - `security/`: Threat models.
    - `deployment/`: Infrastructure.
    - `integration/`: External API specs.
- `foundry.config.json`: Configuration for the project structure.
- `package.json`: Project dependencies and scripts.
- `dist/`: Generated static site (do not edit manually).

## 📝 Critical Rules for Agents

### 1. Frontmatter is Mandatory

Every `.mermaid` file you create MUST have this header:

```mermaid
---
title: My Diagram Title
description: A concise description of what this diagram represents.
---
graph TD
  ...
```

### 2. No Orphan Policy

The build engine traces links starting from `root.mermaid`. If a file is not linked, it will cause a **Build Error**.

- **Link Syntax (Mermaid):** `click NodeID "assets/path/to/diagram.mermaid"`
- **Link Syntax (Markdown):** `[Link Text](assets/path/to/diagram.mermaid)`

### 3. Root Entry-Point Isolation

`root.mermaid` is a high-level map. It MUST NOT reference "leaf" nodes (individual personas, requirements, or features) directly. It must strictly link to **Architectural Entry Points** (Groups or Overviews).

- **Allowed Root Targets**: `PER_Group`, `REQ_Group`, `COMP_Overview`, `FEAT_Group`, `JOUR_Flow`, etc.
- **Forbidden Root Targets**: Individual IDs like `PER_EndUser` or `FEAT_Auth`.

### 4. The Discovery Phase

Do not skip Discovery. Always ensure `assets/discovery/personas.mermaid`, `assets/discovery/journeys.mermaid`, and `assets/discovery/requirements.mermaid` are updated before proposing architectural changes.

## Command Reference

You can invoke the FoundrySpec CLI using `foundryspec` (if installed globally) or via the locally scaffolded scripts.

| Command                         | Description                                                            |
| :------------------------------ | :--------------------------------------------------------------------- |
| `foundryspec init [name]`       | Scaffold a new project.                                                |
| `foundryspec add <category>`    | Add a new documentation category.                                      |
| `foundryspec build`             | Generate the static documentation hub into `dist/`.                    |
| `foundryspec serve`             | Serve the documentation locally (typically http://localhost:3000).     |
| `foundryspec upgrade`           | Upgrade local project templates and workflows.                         |
| `foundryspec pull <url> <path>` | Pull specs from an external git repo.                                  |
| `foundryspec sync`              | Synchronize all configured external specs.                             |
| `foundryspec deploy`            | Scaffold a GitHub Actions workflow for deployment.                     |
| `foundryspec changes [-d N]`    | Generate a report of recent spec changes.                              |
| `foundryspec help`              | Display this guide.                                                    |
| `foundryspec help workflows`    | List available AI agent workflows.                                     |
| `foundryspec help <workflow>`   | Display a specific workflow (e.g., `foundryspec help design-feature`). |

## 📐 Mandatory Spec Metadata

To maintain architectural integrity, every spec file MUST include these top-level frontmatter fields:

1.  **`id`**: A unique stable identifier (e.g., `PER_User`, `REQ_Login`, `COMP_Auth`).
2.  **`uplink`**: (Optional) The ID of the parent asset in the documentation graph.
3.  **`downlinks`**: (Optional) An array of child IDs.
4.  **`requirements`**: (Required for Components/Features) An array of granular `REQ_` IDs that this asset implements.
5.  **`entities`**: (Optional) A list of internal IDs defined within this file.

### 📝 Footnote Policy (Markdown Rules)

Markdown files (`.md`) are NOT first-class architectural citizens. They serve exclusively as **Footnotes** to diagrams.

1.  **Directory**: All `.md` files must live in a `footnotes/` subdirectory relative to the diagram they supplement.
2.  **Surgical Addressing**: A footnote's `id` MUST match an existing node ID defined OR linked in a `.mermaid` blueprint.
3.  **Directory Isolation**: A footnote can ONLY target IDs referenced in blueprints within its own parent directory.
4.  **Enforcement**: The build will fail if an `.md` file is misplaced, addresses a non-existent ID, or violates directory isolation.

```yaml
---
id: "COMP_Group"
title: "Scaffold Manager Details"
description: "Supplementary implementation notes."
uplink: "requirements.mermaid"
---
```

## ⛓️ Semantic Traceability (Spec <-> Code)

FoundrySpec bridges the gap between documentation and implementation. **To save token counts, AI Agents do not need to manually verify traceability.** Simply provide the correct IDs in your diagrams and implementation markers; the **FoundrySpec Build Engine** will automatically validate the graph and alert you to any breaks.

### 1. The @foundryspec Marker
... (rest of markers) ...

## 🛠️ Zero-Question Readiness Checklist

The "Zero-Question" metric is satisfied when your documentation passes this objective checklist:

1.  **Actor Alignment**: Does every feature link back to a `PER_` Persona?
2.  **Boundary Integrity**: Are all cross-boundary communications (L2) labeled with a protocol (e.g., gRPC, REST)?
3.  **State Completeness**: Does every complex data object have a corresponding `stateDiagram`?
4.  **Interface Clarity**: Do L3 Components define their public methods/interfaces?
5.  **Build Pass**: Does `foundryspec build` pass with zero "Orphan" or "Path Integrity" errors?

## Agent Instructions

1.  **Focus on Intent**: Your primary job is to capture architectural intent. Let the build tool handle the validation.
2.  **Optional Footnotes**: Do not feel compelled to create `footnotes/` folders or `.md` files unless a diagram node is too complex to be self-explanatory.
3.  **Greenfield vs. Brownfield**:
    - **Greenfield**: Use the `design-feature` workflow to scaffold new logic.
    - **Brownfield**: Map existing code to IDs first, then use `foundryspec changes` to identify gaps.
