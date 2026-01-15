---
description: How to generate and update Mermaid diagrams
---

As an AI agent, use this workflow to create technical visualizations that comply with FoundrySpec's strict validation engine:

1.  **Context Discovery**: Before drawing, ask the user about boundaries, actors, and data flows.
2.  **Select Category**: Determine if it's Discovery, Context, Boundaries, Components, etc.
3.  **Define Diagram Type**: Use `graph`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `journey`, or `requirementDiagram`.
4.  **Add Frontmatter (CRITICAL)**: You MUST start the file with a YAML block:
    ```mermaid
    ---
    title: [Clear Title]
    description: [Concise description of the diagram's purpose]
    ---
    ```
5.  **Robustness Check**: Ask: "Does this diagram raise more questions than it answers?".
6.  **Save & Link**:
    *   Save the `.mermaid` file to the category folder (e.g., `assets/components/my-component.mermaid`).
    *   **Link it:** Find a parent diagram (usually in `root.mermaid` or `assets/architecture/`) and add a `click` event or link to your new file so it is not an orphan.
    *   Example: `click MyComponent "assets/components/my-component.mermaid"`
7.  **Validate**: Run `foundryspec build` to ensure no syntax errors or orphaned files.