# FoundrySpec ⚙️

**The Intent-Driven Development (IDD) Infrastructure for AI-Human Synergy.**

FoundrySpec is not just a documentation tool; it is **Active Architectural Infrastructure**. It serves as the **Single Source of Truth (SSoT)** for system intent, providing a high-fidelity context layer that both **Humans and AI Agents** use to build, validate, and evolve complex software without architectural drift.

---

## 🚀 The IDD Advantage

In the era of AI-assisted engineering, traditional documentation is a liability—it's often stale, unstructured, and disconnected from the code. FoundrySpec pivots the workflow to **Intent-First**:

- 🧠 **Common Context Layer:** A machine-readable and human-beautiful bridge (Mermaid + Markdown) that ensures AI Agents and developers are always looking at the same map.
- 🛡️ **Architectural Governance:** Active enforcement via GitOps hooks. If the code drifts from the design, the build fails.
- 📡 **Automated Design Probes:** Continuous monitoring of implementation markers to ensure 100% traceability from requirement to source code.
- 🗺️ **Active Discovery Hub:** A dynamic, multi-destination exploration environment that synthesizes complex system relationships into an intuitive navigation hub.
- ⚡ **Zero-Latency Feedback:** Hot-reloading documentation that lives _inside_ your dev loop, not in a separate wiki.

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
 * @foundryspec REQ_UserAuthentication
 */
export class AuthService { ... }
```

When you run `foundryspec probe` (triggered automatically via pre-commit hooks), the engine verifies that every piece of high-level intent in your diagrams has a corresponding implementation footprint.

---

## 🤖 AI-Human Orchestration

FoundrySpec is optimized for **Collaborative Engineering**:

1.  **For Humans:** A beautiful, searchable exploration hub with "Implementation Traceability" boxes for every requirement.
2.  **For AI Agents:** A structured, predictable file layout and CLI that allows agents to understand project context instantly, reducing hallucinations and onboarding time.
3.  **For the System:** A set of codified rules (`default-rules.yaml`) that define the boundaries, data models, and sequences that the software _must_ adhere to.

---

## 🏗️ Getting Started with IDD

### Installation

```bash
npm install -g @futurefoundaihq/foundryspec
```

### Initialize and Govern

```bash
# Initialize project and install GitOps hooks
foundryspec init "Project Name"
cd project-name
foundryspec build

# Code with intent
git commit -m "feat: implement auth" # Triggers architectural probe
```

---

## 📜 License & Vision

Distributed under the **GNU Affero General Public License v3.0 (AGPLv3)**.
FoundrySpec is built to mitigate **Architectural Inertia** and empower the next generation of intent-governed software systems.

**Define the Intent. Govern the Implementation. Build with FoundrySpec.**
