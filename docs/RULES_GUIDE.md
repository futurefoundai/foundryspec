---
title: Rule Engine Documentation
description: A comprehensive guide to the FoundrySpec Rule Engine and YAML configuration.
id: RULES-GUIDE
---

# FoundrySpec Rule Engine Documentation

The Rule Engine allows you to enforce structural, syntax, and metadata integrity across your documentation codebase using YAML configuration files.

## How it works

The Rule Engine processes rules in three phases for every file (`asset`) in your project:

1.  **Targeting**: Determines if a rule should run on a specific file.
2.  **Execution**: Validates the file against syntax, metadata, and structural requirements.
3.  **Enforcement**: Reports warnings or terminates the build on errors.

---

## YAML Structure

The rules file consists of two main sections: `rules` and `hub`.

### 1. `rules` (Array)

Each rule object defines how to validate a specific set of files.

| Field         | Type   | Description                                                                   |
| :------------ | :----- | :---------------------------------------------------------------------------- |
| `id`          | string | Unique identifier for the rule.                                               |
| `name`        | string | Human-readable name.                                                          |
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
  target:
    idPrefix: PER_
    pathPattern: 'personas/*.mermaid'
  type: structural
  enforcement: error
  checks:
    mermaidType: mindmap
    requiredFrontmatter: [title, description, id]
    requiredNodes: [Role, Goals]
```
