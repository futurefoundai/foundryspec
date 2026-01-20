---
id: "COMP_Group"
title: Scaffold Manager
description: Core component for project initialization and template management.
requirements:
  - "REQ_NonFunctional"
uplink:
  - "COMP_Overview"
  - "ROOT"
  - "GRP_Requirements"
---

## Overview

The `ScaffoldManager` is the core component responsible for initializing new FoundrySpec projects and managing the standard category templates.

### Key Logic

- **Initialization**: Generates the standard `docs/` folder structure (Discovery, Context, Boundaries, Components).
- **Atomic Architecture**: Scaffolds individual, self-contained Mindmaps for Personas (e.g., `PER_EndUser.mermaid`) instead of monolithic lists.
- **Traceability Injection**: Automatically adds base frontmatter to new assets to ensure "Zero-Question" connectivity from the start.

## Implementation Details

The scaffold logic ensures that all new documentation assets are built with the correct metadata standard:

1.  Top-level `id` for identity.
2.  `uplink` for graph connectivity to parent nodes.
3.  **Visual Structure**: Pre-populates Mindmaps with required validation branches (Role, Goals, Description).