---
id: RULES-GUIDE
title: Rule Engine Documentation
description: A comprehensive guide to the FoundrySpec Rule Engine and YAML configuration.
entities:
  - id: RULES-GUIDE
    uplink: ROOT
---

# FoundrySpec Rule Engine Documentation

The Rule Engine allows you to enforce structural, syntax, and metadata integrity across your documentation codebase using YAML configuration files.

## How it works

The Rule Engine processes rules in several phases for every file (`asset`) in your project.

> [!IMPORTANT]
> **Synthetic Architecture**: Files like `root.mermaid` and category index files (e.g., `personas/personas.mermaid`) are **synthetically generated** by the Build Manager. You should not create these manually in your `docs/` directory, as they will be ignored or overwritten to ensure consistent project navigation.

1.  **Phase 1: Loading**: Rules are loaded from system defaults and local config.
2.  **Phase 2: Targeting**: Determines if a rule applies to a specific file based on path or ID.
3.  **Phase 3: Execution**: Validates syntax, metadata, and structure.
4.  **Phase 4: Traceability**: Validates the global project graph (linkage).
5.  **Phase 5: Enforcement**: Logs warnings or fails the build on errors.

---

## YAML Structure

The rules file consists of two main sections: `rules` and `hub`.

### 1. `rules` (Array)

Each rule object defines how to validate a specific set of files or nodes.

| Field         | Type   | Description                                                                   |
| :------------ | :----- | :---------------------------------------------------------------------------- |
| `id`          | string | Unique identifier for the rule.                                               |
| `name`        | string | Human-readable name.                                                          |
| `description` | string | **(New)** Rationale for the rule, displayed in build errors.                  |
| `level`       | enum   | **(New)** Scope of validation: `project`, `folder`, `file`, or `node`.        |
| `target`      | object | **Required.** Defines which files are affected (see [Targeting](#targeting)). |
| `type`        | enum   | `structural`, `syntax`, `metadata`, or `traceability`.                        |
| `enforcement` | enum   | `error` (stops build) or `warning` (logs to console).                         |
| `checks`      | object | **Required.** The specific validations to perform (see [Checks](#checks)).    |

#### Targeting

Rules are applied if _any_ target condition matches:

- `idPrefix`: Matches the `id` field in a file's frontmatter (e.g., `PER_`).
- `pathPattern`: Matches the file path using glob-like patterns (e.g., `personas/**/*.mermaid`).

#### Checks

| Field                 | Type     | Description                                                             |
| :-------------------- | :------- | :---------------------------------------------------------------------- |
| `mermaidType`         | string   | The required Mermaid diagram type (e.g., `mindmap`, `sequenceDiagram`). |
| `requiredExtension`   | string   | The required file extension (e.g., `mermaid`, `md`).                    |
| `requiredFrontmatter` | string[] | List of keys that MUST exist in the Markdown/Mermaid frontmatter.       |
| `requiredNodes`       | string[] | Specific nodes or labels that must exist in the visual diagram content. |
| `traceability`        | object   | Validation for project-wide links (e.g., `mustBeLinked: true`).         |

> [!IMPORTANT]
> **Node-Centric Traceability**: FoundrySpec has transitioned to a 100% entity-centric model. Relationships like `uplink` and `downlinks` are now **node-dependent**, not file-dependent. To ensure your documentation remains traceable, you must define all connections within the `entities` block in your frontmatter.

### Document Structure Example

```yaml
---
id: 'MY_DOC_ID'
title: 'My Document'
entities:
  - id: 'NODE_01'
    uplink: 'PARENT_ID'
    downlinks: ['CHILD_01', 'CHILD_02']
    requirements: ['REQ_01']
---
```

---

### 2. `hub` (Object)

Defines how the FoundrySpec Documentation Hub organizes your content.

#### `categories` (Array)

| Field      | Type   | Description                                                    |
| :--------- | :----- | :------------------------------------------------------------- |
| `id`       | string | Unique category ID.                                            |
| `title`    | string | Display name in the Navigation Hub.                            |
| `path`     | string | The directory where this category's files are stored.          |
| `idPrefix` | string | (Optional) Prefix used to auto-group files into this category. |

---

## Example Rule

```yaml
- id: persona-gate
  name: Persona Architecture Gate
  level: folder
  description: 'Personas must be mindmaps with Role, Description, and Goals to support consistent user modeling.'
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
```
