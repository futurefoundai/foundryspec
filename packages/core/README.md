# @foundryspec/core

**The Core Engine for Intent Driven Development (IDD)**

`@foundryspec/core` is the foundational package for the FoundrySpec ecosystem. It provides the CLI, architectural probe, scaffolding engine, and documentation hub generator that powers the FoundrySpec workflow.

## 🚀 Features

- **Architectural Probe**: Detects drift between your Mermaid-based specifications (foundryspec) and your actual codebase.
- **Scaffolding**: Generates boilerplate code, diagrams, and project structures based on your defined architecture.
- **Documentation Hub**: Builds a static, interactive documentation site for your project, visualizing your architecture, requirements, and user journeys.
- **CLI**: A powerful command-line interface to manage your IDD workflow.

## 📦 Installation

This package is typically installed globally or as a dev dependency in your project.

### Global Installation

```bash
npm install -g @foundryspec/core
```

### Local Project Installation

```bash
npm install --save-dev @foundryspec/core
```

## 🛠 Usage

Once installed, you can use the `foundryspec` command.

### Initialize a new project

```bash
foundryspec init
```

### Serve the Documentation Hub

```bash
foundryspec serve --background --port <port_number>
```

### Probe for Architectural Drift

```bash
foundryspec probe
```

### Scaffold Components

```bash
foundryspec init <project_name>
```

## 📚 Documentation

For full documentation, please visit the [FoundrySpec Documentation Hub](https://foundryspec.com) (Coming Soon).

## 📄 License

AGPL-3.0-only
