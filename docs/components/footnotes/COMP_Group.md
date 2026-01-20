---
id: "COMP_Group"
title: Scaffold Manager
description: Core component for project initialization and template management.
requirements:
  - "REQ_NonFunctional"
uplink:
  - "COMP_Overview"
  - "ROOT"
  - "REQ_Group"
---

## Overview

The `ScaffoldManager` is the core component responsible for initializing new FoundrySpec projects and managing the standard category templates.

### Key Logic

- **Initialization**: Generates the standard `foundryspec/` folder structure.
- **Traceability Injection**: Automatically adds base frontmatter to new assets to ensure "Zero-Question" connectivity from the start.

## Implementation Details

The scaffold logic ensures that all new documentation assets are built with the correct metadata standard:

1.  Top-level `id` for identity.
2.  `uplink`/`downlinks` for graph connectivity.
3.  `requirements` array for semantic justification.
