# FoundrySpec MCP Server

## Overview

This is the official Model Context Protocol (MCP) server for FoundrySpec. It acts as a **dynamic discoverability layer** for the FoundrySpec CLI.

Instead of having a hardcoded list of tools, this server:

1.  **Discovers**: Runs `foundryspec --help` at startup to find available commands.
2.  **Recurses**: Inspects subcommands (like `work`, `gitops`) to find all leaf actions.
3.  **Exposes**: Dynamically registers an MCP tool for every discovered CLI command.
4.  **Executes**: When a tool is called, it executes the underlying CLI command in your project.

This ensures that the AI agent always has access to the full capabilities of your installed `foundryspec` CLI version, with zero additional maintenance.

## Prerequisites

- **FoundrySpec CLI**: Must be installed and available in your environment (`npm install -g @foundryspec/cli` or `@foundryspec/core`).
- **Node.js**: Version 18+ recommended.

## Usage

### 1. Global Installation (Recommended)

Install the server globally:

```bash
npm install -g @foundryspec/mcp-server
```

**Configuring Claude Desktop:**
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "foundryspec": {
      "command": "foundryspec-mcp-server",
      "args": ["/absolute/path/to/your/project"]
    }
  }
}
```

_Note: The `args` array is optional but recommended. If omitted, the server will default to the directory where it was launched._

### 2. Local Installation

Install locally in your project:

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

## Available Tools

The tools exposed to the agent depend on your CLI version. Common tools include:

- `foundry_init`: Initialize a new project.
- `foundry_build`: Build the documentation site.
- `foundry_probe`: Check for architectural drift.
- `foundry_work_list`: List work items.
- `foundry_work_reply`: Reply to a work item.
- `foundry_work_resolve`: Resolve a work item.
- ...and any other command listed in `foundryspec --help`!
