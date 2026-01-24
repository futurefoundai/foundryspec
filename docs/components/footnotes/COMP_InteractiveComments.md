---
id: 'COMP_InteractiveComments'
title: Interactive Comments Component
description: Frontend and Backend logic for handling node-level feedback.
---

# Interactive Comments (L3)

## Overview

This component enables non-intrusive, contextual feedback loops using a right-click interaction model and visual node indicators.

## Interface (L4)

```typescript
interface CommentEntry {
  id: string; // UUID
  targetId: string; // FoundrySpec ID
  author: string;
  content: string;
  timestamp: string;
  status: 'open' | 'resolved';
}
```

## Logic Flow

1. **Indicator Injection:** During render, the Hub checks the `foundry.comments.json` registry using a **Universal Stable Identifier (USI)**.
   - **USI Format:** `[ProjectID]#[StableNodeID]@[CanonicalPath]`
   - This ensures that if a node is moved to a different diagram, its "Global" comments follow it, while "Local" comments stay anchored to the specific view.
   - The **ProjectID** is a globally unique UUID (v4) generated during `foundryspec init` using `crypto.randomUUID()`.
2. **Deterministic Resolution:** The `Click Interceptor` strictly resolves nodes to their `idMap` counterparts. Commenting is disabled for nodes that lack a stable, architectural ID.
3. **Persistence:** Comments are stored using the USI as the primary key.
