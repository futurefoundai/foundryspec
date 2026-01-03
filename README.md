# FoundrySpec 🚀

**FoundrySpec** is a powerful CLI-driven documentation engine designed for **Human-AI Collaborative System Analysis & Design**. It scaffolds, builds, and deploys premium, interactive architectural documentation that aims for **Zero-Question Implementation readiness**.

## ✨ Features

- **AI-First Workflows**: Bundled instructions for AI agents to follow "Exhaustive Discovery" cycles.
- **C4-Derived Scaffolding**: Automatically creates an exhaustive directory structure based on C4 modeling.
- **Interactive Hub**: Generates a stunning static documentation hub with Mermaid.js panning and zooming.
- **Built-in Server**: Locally serve your documentation hub with a single command.
- **Versioning Management**: Effortlessly upgrade local project templates and workflows as the engine evolves.
- **Distributed Specs**: Support for `pull` and `sync` commands to manage documentation across multiple repositories.
- **Auto-Deployment**: Built-in command to scaffold GitHub Actions for GitHub Pages deployment.

## 🛠️ Installation & Usage

### Option 1: Global Installation
```bash
npm install -g @futurefoundaihq/foundryspec
foundryspec init
```

### Option 2: Run via npx (No install required)
```bash
npx @futurefoundaihq/foundryspec init
```

## 🚀 Getting Started

### 1. Initialize a new project
```bash
foundryspec init "My Project Name"
cd foundryspec
```

### 2. Add a new category
```bash
foundryspec add "Security Audit"
```

### 3. Build & Serve the documentation
```bash
foundryspec build
foundryspec serve
```

### 4. Upgrade local project
If you've updated the global tool, you can refresh your project's core files:
```bash
foundryspec upgrade
```

### 5. Deploy to GitHub Pages
```bash
foundryspec deploy
```

## 🤖 Commands

| Command | Description |
| :--- | :--- |
| `init [name]` | Scaffold a new project. Defaults to `foundryspec/` folder. |
| `add <category>` | Add a new documentation category (creates folder and updates config). |
| `build` | Generate the static documentation hub in the `dist/` folder. |
| `serve` | Run a local static server to view your documentation hub. |
| `upgrade` | Refresh local project templates and workflows from latest engine. |
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
