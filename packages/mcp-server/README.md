# @foundryspec/mcp-server

**FoundrySpec MCP Server**

This package provides a compliant Model Context Protocol (MCP) server for FoundrySpec, enabling AI agents and other tools to dynamically discover and execute FoundrySpec CLI commands.

## 🚀 Features

- **Dynamic Discovery**: Automatically inspects the installed `foundryspec` CLI to expose available commands as MCP tools.
- **Seamless Integration**: Allows any MCP-compliant client (like Claude Desktop or IDE extensions) to interact with your FoundrySpec projects.
- **Zero Configuration**: Works out of the box by leveraging your existing FoundrySpec installation.

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

## 📚 Documentation

For full documentation, please visit the [FoundrySpec Documentation Hub](https://foundryspec.com).

## 📄 License

AGPL-3.0-only
