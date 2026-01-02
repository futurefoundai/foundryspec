---
description: How to collaborate with humans to design a new feature
---

As an AI agent, follow this "Exhaustive Discovery" cycle to reach **Zero-Question Implementation readiness**:

1.  **Exhaustive Categorization**: Every feature must be addressed across the core FoundrySpec categories:
    - **Architecture** (Context), **Containers** (Level 2), **Components** (Level 3), **Sequences** (Dynamic Flows), **States** (Behavior), **Data** (Schema), **Security** (Trust), **Deployment** (Infra), and **Integration** (Contracts).
2.  **The "Zero-Question" Inquiry**: 
    - Ask the user questions until you can visualize the entire implementation path with no unknowns.
    - If you are unsure about a technical detail (e.g., auth method or database type), do not assume. Ask.
3.  **Drafting mental models**: 
    - Translate answers into Mermaid diagrams across the relevant categories.
4.  **Verification of Robustness**: 
    - Review the entire spec suite. Ask: "If I were a junior dev with no context, could I build this perfectly based ONLY on these docs?". 
    - Continue the cycle until the answer is "Yes".
5.  **Completion Threshold**: The spec is complete when there are **zero questions remaining** and every technical contract is defined.
