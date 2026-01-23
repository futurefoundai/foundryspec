---
id: 'COMP_ClickInterceptor'
title: Click Interceptor
description: Frontend event bus for diagram navigation and footnote activation.
entities:
  - id: 'COMP_ClickInterceptor'
    uplink: 'BND_App'
    requirements:
      - 'REQ_Functional'
---

# Click Interceptor (L3)

## Overview

The Click Interceptor is a core feature of the FoundrySpec Hub. it decouples diagram visuals from navigation logic, allowing any node in a Mermaid diagram to become an interactive link without requiring explicit `click` commands in the Mermaid source.

## How it Works

1. **Event Capture:**
   - **Click:** A global listener captures left-clicks for navigation.
   - **Context Menu:** A `contextmenu` listener captures right-clicks for node-level actions (Comments).
2. **Identification:** It crawls up the DOM from the target to find the nearest Mermaid node container.
3. **Normalization:** It extracts the node's `id` or `text` and normalizes it.
4. **Resolution:** It checks the normalized ID/Text against the project's global `idMap`.
5. **Action:**
   - **Left Click:** Navigates to a diagram or opens a footnote.
   - **Right Click:** Spawns the `FloatingMenu` for the identified ID.

## Traceability

This component is already implemented in `templates/index.js` under the `viewer.addEventListener('click', ...)` block.
