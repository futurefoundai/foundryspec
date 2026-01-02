# FoundrySpec Integration & Data Contracts

To achieve **Zero-Question Implementation**, the data exchange formats must be strictly defined.

## 1. `foundry.config.json`
This file resides in the root of the documentation project.

```json
{
  "projectName": "String",
  "version": "String",
  "categories": [
    {
      "name": "String",
      "path": "String (relative to assets/)",
      "description": "String"
    }
  ],
  "external": [
    {
      "remote": "Git URL",
      "target": "Local Path",
      "branch": "String (default: main)"
    }
  ],
  "build": {
    "outputDir": "String (default: 'dist')",
    "assetsDir": "String (default: 'assets')"
  }
}
```

## 2. `diagrams.json` (Category Index)
Generated during `foundryspec build`. Resides in each category folder.

```json
[
  {
    "title": "String (Parsed from filename or frontmatter)",
    "description": "String (Parsed from frontmatter or comment)",
    "file": "String (filename.mermaid)",
    "type": "Enum [architecture, containers, components, sequences, states, data, security, deployment, integration]",
    "updatedAt": "ISO8601 String"
  }
]
```
