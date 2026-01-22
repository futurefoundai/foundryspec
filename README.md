# FoundrySpec 🛠️

**The Documentation Engine for AI-Human Collaborative System Design.**

FoundrySpec is not just a documentation tool; it is a **Living Digital Twin** of your system's architectural intent. Designed for the era of AI-assisted engineering, FoundrySpec ensures that your documentation remains the **Single Source of Truth (SSoT)**—a centralized, authoritative reference point that both humans and AI Agents can trust to avoid data fragmentation and drift.

---

## 🚀 Why FoundrySpec?

In a world of rapid AI development, traditional documentation fails because it is **unstructured, ambiguous, and stale**. This leads to AI hallucinations, context fragmentation, and architectural decay.

FoundrySpec solves this by providing:

- 🤖 **AI-First Design:** Optimized for LLM context windows. Structured, machine-readable specifications (Mermaid + Markdown).
- 🗺️ **Discovery-First Workflow:** Mandates a "Discovery Phase" (Personas, Journeys, Requirements) before a single line of code is written.
- 🔗 **Zero-Question Traceability:** Link high-level requirements directly to code components using implementation markers.
- ⚡ **Zero-Config Auto-Discovery:** Automated category management and project-wide graph validation.
- 👀 **Hot-Reload Dev Experience:** Real-time feedback loop. Edit your diagrams and see changes instantly in the Documentation Hub.

---

## 🛠️ CLI Commands

FoundrySpec provides a comprehensive toolset for managing your documentation lifecycle:

| Command   | Description                                                           |
| :-------- | :-------------------------------------------------------------------- |
| `init`    | Scaffold a new FoundrySpec documentation project.                     |
| `build`   | Generate the static documentation hub with full graph validation.     |
| `serve`   | Locally serve the documentation hub with hot-reloading.               |
| `add`     | Add a new documentation category (e.g., `foundryspec add security`).  |
| `changes` | Generate a report of recent spec changes and implementation tasks.    |
| `deploy`  | Scaffold GitHub Actions for automatic deployment to GH Pages.         |
| `pull`    | Incorporate external specs from a Git repository.                     |
| `sync`    | Synchronize all external specs from remote repositories.              |
| `upgrade` | Update local project templates and workflows to the latest standards. |
| `help`    | Display the AI Agent Guide or specific workflow instructions.         |

---

## 🧠 Dynamic Documentation Engine

FoundrySpec now features a **Dynamic Root Infrastructure**.

- **Auto-Discovery:** The build engine automatically scans your `docs/` folder. Each top-level directory becomes a category in the Root Hub.
- **Synthetic Indexing:** If you don't provide an index file (e.g., `context/context.mermaid`), FoundrySpec generates one for you, listing all diagrams in that folder.
- **Discovery Hub:** The `discovery` folder is special. It automatically collects and aggregates your Personas, Requirements, and Journeys into a central view.

## ⚙️ Configuration

FoundrySpec is **Zero-Config** by default.

- **Project Identity:** A `.foundryid` file is generated on `init`. Do not delete this.
- **Global Config:** Your projects and external references are managed in `~/.foundryspec/projects.json`.
- **No more Config Files:** We have deprecated `foundry.config.json` in favor of this global, managed approach.

## 🚀 Getting Started

### Installation

```bash
npm install -g @futurefoundaihq/foundryspec
```

### Initialize a New Project

```bash
foundryspec init "My Awesome Project"
cd foundryspec
foundryspec build   # Generates your static Documentation Hub
foundryspec serve   # Starts the local preview server
```

## 🖋️ The Footnote Policy (Optional)

Footnotes are **not compulsory**. They are supplemental assets used only when a diagram node requires deeper prose or technical specification.

1. **Diagrams First:** All architectural nodes are defined in `.mermaid` files.
2. **Markdown as Supplement:** If you choose to add detail, `.md` files must reside in a `footnotes/` subdirectory.
3. **Strict Addressing:** A footnote's `id` must match a node ID in its parent directory's diagrams.

---

## 🔗 Implementation Markers

Bridge the gap between design and code. While the AI focuses on intent, the **FoundrySpec Build Engine** handles the heavy lifting of traceability validation. Add markers to your code to link it to the spec:

```typescript
/**
 * @foundryspec REQ_UserAuthentication
 */
export class AuthService { ... }
```

Run `foundryspec build` to validate that all code markers resolve to existing IDs in your documentation.

---

## 🤖 For AI Agents (Jules, Gemini, etc.)

FoundrySpec provides a **Structured Context Layer**. When working in a FoundrySpec-enabled repository:

1.  **Consult Discovery:** Understand the user's intent and personas.
2.  **Verify Traceability:** Check which requirements your task satisfies.
3.  **Align with Architecture:** Ensure your implementation matches the Boundary and Component diagrams.
4.  **Sync Design:** Use `foundryspec changes` to identify what parts of the code need updating after a design change.

---

## 📜 License

Distributed under the **GNU Affero General Public License v3.0 (AGPLv3)**.
Commercial use requires a separate license from **FutureFoundAI**.

---

**Build the future. Document with Intent. Use FoundrySpec.**
