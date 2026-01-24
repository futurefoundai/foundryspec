---
id: COMP_RuleEngine
title: Rule Engine Documentation
description: A comprehensive guide to the FoundrySpec Rule Engine and YAML configuration.
---

# FoundrySpec Rule Engine Documentation

The Rule Engine allows you to enforce structural, syntax, and metadata integrity across your documentation codebase using YAML configuration files.

## How it works

The Rule Engine processes rules in several phases for every file (`asset`) in your project.

> [!IMPORTANT]
> **Synthetic Architecture**: Files like `root.mermaid` and category index files (e.g., `personas/personas.mermaid`) are **synthetically generated** by the Build Manager. You should not create these manually in your `docs/` directory, as they will be ignored or overwritten to ensure consistent project navigation.

1.  **Phase 1: Loading**: Rules and Hub definitions are loaded from system defaults and local config.
2.  **Phase 2: Targeting**: Determines if a rule applies to a specific file based on path or ID.
3.  **Phase 3: Execution**: Validates syntax, metadata, and structure.
4.  **Phase 4: Traceability**: Validates the global project graph (linkage).
5.  **Phase 5: Enforcement**: Logs warnings or fails the build on errors.

---

## YAML Structure

The configuration consists of a `rules` list. The previously separate `hub` section has been merged into the rules logic to ensure strict alignment between folder governance and architectural structure.

### `rules` (Array)

Each rule object defines how to validate a specific set of files or nodes, and optionally defines their role in the Hub.

| Field         | Type   | Description                                                                   |
| :------------ | :----- | :---------------------------------------------------------------------------- |
| `id`          | string | Unique identifier for the rule.                                               |
| `name`        | string | Human-readable name.                                                          |
| `description` | string | Rationale for the rule, displayed in build errors.                            |
| `level`       | enum   | Scope of validation: `project`, `folder`, `file`, or `node`.                  |
| `target`      | object | **Required.** Defines which files are affected (see [Targeting](#targeting)). |
| `type`        | enum   | `structural`, `syntax`, `metadata`, or `traceability`.                        |
| `enforcement` | enum   | `error` (stops build) or `warning` (logs to console).                         |
| `checks`      | object | **Required.** The specific validations to perform.                            |
| `hub`         | object | **(New)** Defines this folder as a specialized Category in the Hub.           |

#### Targeting

Rules are applied if _any_ target condition matches:

- `idPrefix`: Matches the `id` field in a file's frontmatter (e.g., `PER_`).
- `pathPattern`: Matches the file path using glob-like patterns (e.g., `personas/**/*.mermaid`).

---

### Governance Policies

FoundrySpec enforces strict architectural governance to prevent project drift.

#### 1. Folder Registry Policy

Every directory within your `docs/` folder must be explicitly defined in your configuration via a Rule.

- **Allowed**: Folders targeted by a rule with a `hub` definition (e.g., `personas`).
- **System Exemptions**: `footnotes` and `others` are automatically allowed.
- **Violation**: The build will **FAIL** if it detects any "rogue" folder (e.g., `docs/temp_notes`) that is not registered.

#### 2. ID Governance Policy

To ensure consistent referencing, file IDs must strictly match the architectural intent of their folder.

- **Mechanism**: If a rule targets a folder (e.g., `requirements/`) and defines an `idPrefix` (e.g., `REQ_`), all files in that folder **MUST** have an ID starting with `REQ_`.
- **Violation**: The build will **FAIL** if a file's ID does not match the mandatory prefix for its location.

#### 3. Footnote Policy

- **Location**: Markdown (`.md`) files must reside in a `footnotes/` subdirectory.
- **Linking**: Linked automatically by filename matching diagram nodes.

#### 4. Filename Consistency Policy

For semantic clarity, the physical filename must match its internal ID.

- **Mechanism**: `basename(filename)` must equal `id`.
- **Example**: ID `REQ_Login` must be in a file named `REQ_Login.mermaid` (or `REQ_Login.md`).
- **Violation**: The build will **FAIL** if the filename and ID do not match.

---

## Example Rule

A complete rule that governs a folder, enforces syntax, AND registers it in the Hub.

```yaml
- id: persona-gate
  name: Persona Architecture Gate
  level: folder
  description: 'Personas must be mindmaps with Role, Description, and Goals.'
  target:
    idPrefix: PER_
    pathPattern: 'personas/*.mermaid'
  type: structural
  enforcement: error
  checks:
    mermaidType: mindmap
    requiredExtension: mermaid
    requiredFrontmatter: [title, description, id]
    requiredNodes: [Role, Description, Goals]
  hub:
    id: GRP_Personas
    title: Personas
```

_Note how `hub` defines the category title, while `target.idPrefix` ("PER_") automatically sets the ID Governance policy for this category.\_

---

## Command Reference

### `add <category>`

Launches the Governance Wizard to bootstrap a new category with a starter diagram and a corresponding rule.

### `remove <category>`

The inverse of `add`. Cleans up a category by removing its governance rule from global storage and deleting its documentation directory.
