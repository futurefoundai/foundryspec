---
title: Scaffold Manager
description: Core component for project initialization and template management.
traceability:
  id: "COMP_Scaffold"
  uplink:
    - "BND_App"
    - "ROOT"
---

# Scaffold Manager (L3)

## Overview

The `ScaffoldManager` is the core component responsible for initializing new FoundrySpec projects and managing the standard category templates.

### Key Logic

- **Initialization**: Generates the standard `foundryspec/` folder structure.
- **Traceability Injection**: Automatically adds base frontmatter to new assets to ensure "Zero-Question" connectivity from the start.

## Traceability

- **ID:** `COMP_Scaffold`
- **Uplink:** Satisfies Boundary [`BND_App`](../boundaries/technical-boundaries.mermaid)

## Interface

...
