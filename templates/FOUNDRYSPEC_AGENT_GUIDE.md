# FoundrySpec AI Agent Guide 🤖

## Introduction
**FoundrySpec** is a documentation engine designed for **Human-AI Collaborative System Analysis & Design**. Whether working on **Greenfield** (new) or **Brownfield** (existing) projects, your goal is to achieve **Zero-Question Implementation readiness**. This means the documentation you generate or read should be so exhaustive that a developer (or another agent) can implement the system without needing to ask for further clarification.

## Core Concepts
- **C4 Model**: We use a modified C4 model structure (Context, Containers, Components, etc.).
- **Zero-Question Implementation**: Strive for maximum detail in your specs.
- **Mermaid.js**: All diagrams use Mermaid.js. VALID SYNTAX IS CRITICAL.

## Project Structure
A standard FoundrySpec project (initialized with `init`) looks like this:

- `assets/`: The heart of the documentation. Contains markdown files for each category.
    - `architecture/`: System Context and landscape.
    - `containers/`: High-level containers and boundaries.
    - `components/`: Detailed component breakdowns.
    - `sequences/`: Dynamic interaction flows.
    - `states/`: State machine logic.
    - `data/`: ER diagrams and schema definitions.
    - `security/`: Threat models and trust boundaries.
    - `deployment/`: Infrastructure and deployment diagrams.
    - `integration/`: External API specs.
- `.agent/workflows/`: Instructions and workflows for YOU (the agent) to follow.
- `foundry.config.json`: Configuration for the project structure.
- `package.json`: Project dependencies and scripts.
- `dist/`: Generated static site (do not edit manually).

## Command Reference
You can invoke the FoundrySpec CLI using `foundryspec` (if installed globally) or via the locally scaffolded scripts.

| Command | Description |
| :--- | :--- |
| `foundryspec init [name]` | Scaffold a new project. |
| `foundryspec add <category>` | Add a new documentation category (e.g., `foundryspec add "API Specs"`). |
| `foundryspec build` | Generate the static documentation hub into `dist/`. |
| `foundryspec serve` | Serve the documentation locally (typically http://localhost:3000). |
| `foundryspec upgrade` | Upgrade local project templates and workflows to the latest version. |
| `foundryspec pull <url> <path>` | Pull specs from an external git repo into the documentation. |
| `foundryspec sync` | Synchronize all configured external specs. |
| `foundryspec deploy` | Scaffold a GitHub Actions workflow for deployment. |
| `foundryspec help` | Display this guide. |

## Agent Instructions
1.  **System First**: When asked to generate docs, always start by understanding the `architecture` and `containers`.
2.  **Greenfield vs. Brownfield**:
    - **Greenfield**: Focus on "Exhaustive Discovery" and creative architectural decisions.
    - **Brownfield**: Prioritize **System Analysis**. Read existing code/docs first, map the current state to the C4 model, and identify gaps before proposing changes.
3.  **Validate Diagrams**: When performing `build`, if it fails due to Mermaid syntax, fix it immediately.
4.  **Use Workflows**: Check `.agent/workflows` for specific standard operating procedures.
5.  **No Hallucinations**: Do not reference files or folders that do not exist in the structure above unless explicitly created.
