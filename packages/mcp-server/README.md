# FoundrySpec MCP Server

This package implements a Model Context Protocol (MCP) server for FoundrySpec. It currently provides access to the "Works" system, allowing AI agents to list, read, reply to, and resolve work items.

## Prerequisities

- You must have a FoundrySpec project initialized (`foundryspec init`).

## Usage

### 1. Global Installation (Recommended)

Install the server globally:

```bash
npm install -g @foundryspec/mcp-server
```

**Running manually:**
Navigate to your project folder and run:

```bash
foundryspec-mcp-server
```

**Configuring Claude Desktop:**
In your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "foundryspec": {
      "command": "foundryspec-mcp-server"
    }
  }
}
```

_Note: This assumes you launch Claude Desktop from a terminal where your specific project is the current working directory, or that you rely on the IDE to set the CWD. For robustness, you can explicitly pass the path:_

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

### 2. Local Installation

Install locally:

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

## Tools

- `list_works`: List work items (open, resolved, or all).
- `read_work`: Read a specific work item and its messages.
- `reply_work`: Add a message response to a work item.
- `resolve_work`: Mark a work item as done.
