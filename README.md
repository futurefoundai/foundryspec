# FoundrySpec 🛠️

**The Documentation Engine for AI-Human Collaborative System Design.**

FoundrySpec is not just a documentation tool; it is a **Living Digital Twin** of your system's architectural intent. Designed for the era of AI-assisted engineering, FoundrySpec ensures that your documentation remains the **Single Source of Truth (SSoT)**—a centralized, authoritative reference point that both humans and AI Agents can trust to avoid data fragmentation and drift.

---

## 🚀 Why FoundrySpec?

In a world of rapid AI development, traditional documentation fails because it is **unstructured, ambiguous, and stale**. This leads to AI hallucinations, context fragmentation, and architectural decay.

FoundrySpec solves this by providing:

*   🤖 **AI-First Design:** Optimized for LLM context windows. No prose-heavy fluff—just structured, machine-readable specifications (Mermaid + Markdown).
*   🗺️ **Discovery-First Workflow:** Mandates a "Discovery Phase" (Personas, Journeys, Requirements) before a single line of code is written.
*   🔗 **Zero-Question Traceability:** Link high-level requirements directly to code components. Achieve "Zero-Question Implementation" readiness.
*   ⚡ **Zero-Config Auto-Discovery:** Simply create a folder in `assets/`, and the engine handles the rest. No configuration bloat.
*   👀 **Hot-Reload Dev Experience:** Real-time feedback loop. Edit your diagrams and see the changes instantly in the Documentation Hub.

---

## 🛠️ Core Features

### 1. The Discovery Layer (L0)
Define the **Who, What, and Why** before the **How**.
*   **Personas:** Identify your system's actors using Mermaid Class Diagrams.
*   **User Journeys:** Map workflows with visual journey maps.
*   **Requirement Diagrams:** Rigorous SysML-style requirement tracking.

### 2. The C4 Architectural Hub (L1-L3)
A layered approach to system understanding:
*   **L1 (Context):** High-level system landscape.
*   **L2 (Containers):** Technical boundaries and services.
*   **L3 (Components):** Internal module logic and method-level detail.

### 3. Dynamic Sequences & States (L4)
Capture the behavior of your system:
*   **Sequences:** Visualize complex logic flows across components.
*   **State Machines:** Document data lifecycles and project states.

### 4. Deep-Link Footnotes
Bridge the gap between diagrams and detail. Click any node in a diagram to jump into a deep-dive Markdown specification.

---

## 🚦 Getting Started

### Installation
```bash
npm install -g @futurefoundaihq/foundryspec
```

### Initialize a New Project (Greenfield)
```bash
foundryspec init "My Awesome Project"
cd foundryspec
foundryspec serve
```

### Onboard an Existing Project (Brownfield)
```bash
foundryspec upgrade
foundryspec build
```

### 🤖 Onboarding your AI Agent
The best way to get an AI Agent (like Gemini, Jules, or Claude) started is to simply tell it:
> "Run `foundryspec help` to understand the system architecture and our design-driven workflow."

---

## 🤖 For AI Agents (Jules, Gemini, etc.)

FoundrySpec provides you with a **Structured Context Layer**. When working in a FoundrySpec-enabled repository:
1.  **Consult Discovery:** Understand the user's intent and personas.
2.  **Verify Traceability:** Check which requirements your task satisfies.
3.  **Align with Architecture:** Ensure your implementation matches the Container and Component diagrams perfectly.
4.  **Build & Validate:** Use `foundryspec build` to check for broken links or syntax errors before committing.

---

## 📜 License
Distributed under the GNU General Public License v3.0 (GPLv3).
Commercial use requires a separate license from **FutureFoundAI**.

---

**Build the future. Document with Intent. Use FoundrySpec.**