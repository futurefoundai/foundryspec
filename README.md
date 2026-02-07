# FoundrySpec ⚙️

**The Intent-Driven Development (IDD) Infrastructure for AI-Human Synergy.**

FoundrySpec is an infrastructure for **Intent Driven Development (IDD)**. In IDD, every line of code, interaction, and system behavior must be traceable back to a specific **Intent** derived from a verified **Identity**. It serves as the **Single Source of Truth (SSoT)** for system intent, providing a high-fidelity context layer that both **Humans and AI Agents** use to build, validate, and evolve complex software without architectural drift.

---

## 🚀 The IDD Advantage

In the era of AI-assisted engineering, traditional documentation is a liability—it's often stale, unstructured, and disconnected from the code. FoundrySpec pivots the workflow to **Intent-First**:

- 🧠 **Common Context Layer:** A machine-readable and human-beautiful bridge (Mermaid + Markdown) that ensures AI Agents and developers are always looking at the same map.
- 🛡️ **Architectural Governance:** Active enforcement via GitOps hooks. If the code drifts from the design, the build fails.
- 📡 **Automated Design Probes:** Continuous monitoring of implementation markers to ensure 100% traceability from requirement to source code.
- 🗺️ **Active Discovery Hub:** A dynamic, multi-destination exploration environment that synthesizes complex system relationships into an intuitive navigation hub.
- ⚡ **Zero-Latency Feedback:** Hot-reloading documentation that lives _inside_ your dev loop, not in a separate wiki.

## 📚 The 4 Layers of FoundrySpec Documentation

FoundrySpec organizes documentation into four distinct layers of abstraction to ensure complete traceability:

### 1. The Identity Layer (Who & Why)

The foundation of the system. Code cannot exist without a specialized Persona driving its necessity.

- **Personas (`docs/personas/`)**: The roots of the graph (e.g., Actor, Influencer, Guardian, Proxy).

### 2. The Intent Layer (What)

The translation of Identity into actionable requirements and user journeys.

- **Journeys (`docs/journeys/`)**: High-level sequences showing how personals interact to achieve goals.
- **Requirements (`docs/requirements/`)**: Atomic, testable statements of need.

### 3. The Structural Layer (Where)

The architecture that fulfills the Intent.

- **Context (`docs/context/`)**: Where the system lives (L1).
- **Boundaries (`docs/boundaries/`)**: The system's internal world (L2).
- **Components (`docs/components/`)**: The implementation units (L3).

### 4. The Behavioral and Information Layer (How)

The dynamic interactions and data structure.

- **Behavior**: Detailed Sequence/State Diagrams showing _how_ a Component executes Intent.
- **Information**: Entity Relationship Diagrams (ERD) defining data models.
- **Artifacts**: `sequenceDiagram`, `stateDiagram`, `erDiagram` linked in other specs.

---

## 🛠️ The FoundrySpec Toolchain

FoundrySpec provides the infrastructure to manage the entire lifecycle of architectural intent:

| Command   | Infrastructure Role                                                |
| :-------- | :----------------------------------------------------------------- |
| `init`    | Scaffold a new IDD project with architectural guardrails.          |
| `probe`   | **Active Drift Detection**: Scan code vs. spec for alignment.      |
| `build`   | Synthesize the Living Digital Twin and validate graph integrity.   |
| `serve`   | Launch the interactive Hub with real-time intent visualization.    |
| `changes` | Generate AI-ready impact reports for pending architectural shifts. |
| `deploy`  | Automate governance via CI/CD (GitHub Actions).                    |
| `sync`    | Federated Design: Synchronize intent across multiple repositories. |

---

## 🔗 Intent-to-Code Traceability

FoundrySpec forces a hard link between your design and your codebase. Use **Implementation Markers** to gate your architectural integrity:

```typescript
/**
 * @foundryspec/start REQ_UserAuthentication
 */
export class AuthService { ... }
// @foundryspec/end
```

When you run `foundryspec probe` (triggered automatically via pre-commit hooks), the engine verifies that every piece of high-level intent in your diagrams has a corresponding implementation footprint.

---

## 🤖 AI-Human Orchestration

FoundrySpec is optimized for **Collaborative Engineering**:

1.  **For Humans:** A beautiful, searchable exploration hub with "Implementation Traceability" boxes for every requirement.
2.  **For AI Agents:** A structured, predictable file layout and CLI that allows agents to understand project context instantly.
3.  **For the System:** A set of codified rules (`default-rules.yaml`) that define the boundaries, data models, and sequences that the software _must_ adhere to.

### 🔌 AI Agent Integration (MCP)

For seamless integration with LLMs (like Claude Desktop) and IDEs, use the dedicated MCP Server package.

#### 1. Global Installation (Recommended)

```bash
npm install -g @foundryspec/mcp-server
```

**Configuring Claude Desktop:**

```json
{
  "mcpServers": {
    "foundryspec": {
      "command": "foundryspec-mcp-server"
    }
  }
}
```

_Note: By default, the server runs in the current directory. To specify a project root, add `"args": ["/path/to/project"]`._

#### 2. Local Installation

```bash
npm install --save-dev @foundryspec/mcp-server
```

**Configuring Claude Desktop:**

```json
{
  "mcpServers": {
    "foundryspec": {
      "command": "npx",
      "args": ["-y", "@foundryspec/mcp-server"]
    }
  }
}
```

This separate package bridges your local FoundrySpec environment with Agentic tools, allowing them to run probes, read specs, and analyze architecture directly.

---

## 🏗️ Getting Started with IDD

### Installation

```bash
npm install -g @foundryspec/core
```

### Initialize and Govern

```bash
# Initialize project and install GitOps hooks
foundryspec init "Project Name"
foundryspec build

# Code with intent
git commit -m "feat: implement auth" # Triggers architectural probe
```

---

## 📜 License & Vision

Distributed under the **GNU Affero General Public License v3.0 (AGPLv3)**.
FoundrySpec is built to mitigate **Architectural Inertia** and empower the next generation of intent-governed software systems.

**Define the Intent. Govern the Implementation. Build with FoundrySpec.**
