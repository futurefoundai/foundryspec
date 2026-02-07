#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { program } from 'commander';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

// --- Configuration State ---
let projectRoot = process.cwd();

// --- CLI Discovery Helpers ---

interface DiscoveredCommand {
  name: string; // e.g. "init", "work_list"
  cliPath: string[]; // e.g. ["init"], ["work", "list"]
  description: string;
  args: CommandArg[];
}

interface CommandArg {
  name: string;
  required: boolean;
}

async function runCliHelp(args: string[] = []): Promise<string> {
  // We assume 'foundryspec' is in the PATH or we use the one linked in the workspace if possible?
  // For robustness in this dev environment, we might want to use the absolute path to the executable if we can find it.
  // But strictly speaking, if installed globally or locally standard 'foundryspec' should work.
  // Let's try 'foundryspec' first.
  try {
    const { stdout } = await execAsync(`foundryspec ${args.join(' ')} --help`, { cwd: projectRoot });
    return stdout;
  } catch (error: any) {
    // Fallback? or just return stderr if it's a help command that errored?
    // Some CLIs exit 1 on help.
    return error.stdout || error.message;
  }
}

function parseArguments(argsStr: string): CommandArg[] {
  const args: CommandArg[] = [];
  // Regex to match <arg> or [arg]
  const regex = /([<[])([\w-]+)([>\]])/g;
  let match;
  while ((match = regex.exec(argsStr)) !== null) {
    args.push({
      name: match[2],
      required: match[1] === '<'
    });
  }
  return args;
}

function parseHelpOutput(output: string, parentPath: string[] = []): DiscoveredCommand[] {
  const commands: DiscoveredCommand[] = [];
  const lines = output.split('\n');
  let inCommandsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Commands:')) {
      inCommandsSection = true;
      continue;
    }
    
    if (inCommandsSection && trimmed) {
      if (trimmed.startsWith('Options:')) break; // End of commands

      // Parse line: "command <arg> [opt]   Description..."
      // We look for the double space separator usually used by Commander
      // But wrapping might mess this up.
      // Heuristic: First word is command name. 
      const parts = trimmed.split(/\s{2,}/); // Split by 2+ spaces
      
      if (parts.length >= 2) {
        const usage = parts[0].trim();
        const description = parts[1].trim();
        
        const usageParts = usage.split(' ');
        const name = usageParts[0];
        const argsStr = usageParts.slice(1).join(' ');
        
        commands.push({
            name: [...parentPath, name].join('_'),
            cliPath: [...parentPath, name],
            description,
            args: parseArguments(argsStr)
        });
      }
    }
  }
  return commands;
}

async function discoverTools(): Promise<DiscoveredCommand[]> {
    // 1. Get root commands
    const rootHelp = await runCliHelp();
    const rootCommands = parseHelpOutput(rootHelp);
    
    const allCommands: DiscoveredCommand[] = [];

    // 2. Recursively check each command for subcommands
    for (const cmd of rootCommands) {
        // Try getting help for this command to see if it has subcommands
        // We do this by checking if the help output contains "Commands:"
        // This is a generic way to find subcommands without hardcoding.
        try {
            const cmdHelp = await runCliHelp([...cmd.cliPath]);
            // Heuristic: If help output has "Commands:", it's a container.
            if (cmdHelp.includes('Commands:')) {
                const subCommands = parseHelpOutput(cmdHelp, [...cmd.cliPath]);
                // If we found subcommands, add those INSTEAD of the container command
                // (or should we add both? Usually container commands aren't directly useful if they just show help)
                // For now, let's add the subcommands.
                if (subCommands.length > 0) {
                     allCommands.push(...subCommands);
                     // OPTIONAL: We could recurse even deeper here if needed
                     // by calling discoverTools recursively or extracting this logic.
                     // For now, 2 levels (root -> subcommand) covers 99% of CLI apps including ours.
                } else {
                    // It said "Commands:" but parse found none? Fallback to adding the command itself.
                    allCommands.push(cmd);
                }
            } else {
                // No "Commands:" section, so it's a leaf command.
                allCommands.push(cmd);
            }
        } catch (error) {
            // If getting help fails, assume it's valid leaf command (or just add it anyway)
            allCommands.push(cmd);
        }
    }
    
    return allCommands;
}


// --- Server Setup ---

// @foundryspec/start COMP_MCP_Server
const server = new McpServer({
  name: 'foundryspec-mcp-server',
  version: '0.0.1',
});
// ... rest of implementation (using simplified markers for the probe)
// @foundryspec/end COMP_MCP_Server

// --- Dynamic Tool Registration ---

async function registerTools() {
    console.error('Discovering FoundrySpec CLI commands...');
    const commands = await discoverTools();
    console.error(`Found ${commands.length} commands.`);

    for (const cmd of commands) {
        const toolName = `foundry_${cmd.name}`;
        
        // Build Zod Schema
        const schemaShape: any = {};
        
        // Add arguments
        cmd.args.forEach(arg => {
            if (arg.required) {
                schemaShape[arg.name] = z.string().describe(`Required argument: ${arg.name}`);
            } else {
                schemaShape[arg.name] = z.string().optional().describe(`Optional argument: ${arg.name}`);
            }
        });

        // Add standard options that every command might need
        schemaShape['cwd'] = z.string().optional().describe('Directory to run the command in (defaults to project root)');
        schemaShape['flags'] = z.array(z.string()).optional().describe('Additional flags (e.g. --json, --all)');

        server.registerTool(
            toolName,
            {
                description: cmd.description,
                inputSchema: schemaShape // Zod will infer this structure
            },
            async (args: any) => {
                const commandArgs = [...cmd.cliPath];
                
                // Map named args back to positional args for the CLI
                // This is a bit tricky because parsed args order matters.
                // We rely on the `cmd.args` array order.
                for (const argDef of cmd.args) {
                    if (args[argDef.name]) {
                        commandArgs.push(args[argDef.name]);
                    }
                }
                
                // Add any extra flags
                if (args.flags) {
                    commandArgs.push(...args.flags);
                }

                const cwd = args.cwd ? path.resolve(args.cwd) : projectRoot;
                const fullCommand = `foundryspec ${commandArgs.join(' ')}`;
                
                console.error(`Executing: ${fullCommand} in ${cwd}`);
                
                try {
                    const { stdout, stderr } = await execAsync(fullCommand, { cwd });
                     return {
                        content: [
                            { type: 'text' as const, text: stdout || stderr || 'Command executed successfully (no output)' }
                        ]
                    };
                } catch (error: any) {
                     return {
                        isError: true,
                        content: [
                            { type: 'text' as const, text: `Error executing command:\n${error.message}\n${error.stdout}\n${error.stderr}` }
                        ]
                    };
                }
            }
        );
    }
}


async function main() {
  program
    .name('foundryspec-mcp-server')
    .description('MCP Server for FoundrySpec')
    .argument('[root]', 'Project root directory (defaults to current working directory)')
    .action(async (root) => {
        if (root) {
            projectRoot = path.resolve(root);
        }
        
        // Dynamic discovery happens at startup
        await registerTools();
        
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error(`FoundrySpec MCP Server running on stdio (root: ${projectRoot})`);
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
