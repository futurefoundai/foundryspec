# FoundrySpec 🚀

**FoundrySpec** is a powerful CLI-driven documentation engine designed for **Human-AI Collaborative System Design**. It scaffolds, builds, and deploys premium, interactive architectural documentation that aims for **Zero-Question Implementation readiness**.

## ✨ Features

- **AI-First Workflows**: Bundled instructions for AI agents to follow "Exhaustive Discovery" cycles.
- **C4-Derived Scaffolding**: Automatically creates an exhaustive directory structure based on C4 modeling.
- **Interactive Hub**: Generates a stunning static documentation hub with Mermaid.js panning and zooming.
- **Distributed Specs**: Support for `pull` and `sync` commands to manage documentation across multiple repositories (Git submodule style).
- **Auto-Deployment**: Built-in command to scaffold GitHub Actions for GitHub Pages deployment.

## 🛠️ Installation & Usage

### Option 1: Global Installation
```bash
npm install -g @futurefoundaihq/foundryspec
foundryspec init my-docs
```

### Option 2: Run via npx (No install required)
```bash
npx @futurefoundaihq/foundryspec init my-docs
```

## 🚀 Getting Started

### 1. Initialize a new project
```bash
foundryspec init my-awesome-docs
cd my-awesome-docs
```

### 2. Add a new category
```bash
foundryspec add "Security Audit"
```

### 3. Build the documentation
```bash
foundryspec build
```

### 4. Deploy to GitHub Pages
```bash
foundryspec deploy
```

## 🤖 Commands

| Command | Description |
| :--- | :--- |
| `init <name>` | Scaffold a new documentation project. |
| `add <category>` | Add a new documentation category (creates folder and updates config). |
| `build` | Generate the static documentation hub in the `dist/` folder. |
| `pull <url> <path>` | Incorporate external specs from a remote Git repository. |
| `sync` | Synchronize all configured external specs. |
| `deploy` | Scaffold GitHub Actions for automatic deployment. |

## 📐 Exhaustive Categories

FoundrySpec projects are designed to cover:
- **Architecture** (Context)
- **Containers** (L2)
- **Components** (L3)
- **Sequences** (Dynamic)
- **States** (Behavior)
- **Data** (Schema)
- **Security** (Trust)
- **Deployment** (Infra)
- **Integration** (Contracts)

## 📄 License

ISC
