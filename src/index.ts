#!/usr/bin/env node
/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 * For the full license text, see the LICENSE file in the root directory.
 *
 * COMMERCIAL USE:
 * Companies wishing to use this software in proprietary/closed-source environments
 * must obtain a separate license from FutureFoundAI.
 * See LICENSE-COMMERCIAL.md for details.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

// Import managers using .js extension for ESM compatibility
import { ScaffoldManager } from './ScaffoldManager.js';
import { BuildManager } from './BuildManager.js';
import { GitManager } from './GitManager.js';
import { FileChange } from './types/git.js';
import { ProbeManager } from './ProbeManager.js';
import { ConfigStore } from './ConfigStore.js';

/**
 * @foundryspec COMP_CLI
 * TODO: We are no longer going to support Legacy foundry.config.json anymore
 * Finds the project root by searching for .foundryid or legacy foundry.config.json.
 */
async function findProjectRoot(startDir: string): Promise<string> {
    // Naive check for now: assumes command running in root
    // TODO: Recursive implementation if needed. 
    // For now, strict root execution is safer to avoid confusion.
    return startDir; 
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.join(__dirname, '../package.json'));

const program = new Command();
const store = new ConfigStore();

program
    .name('foundryspec')
    .description('Documentation engine for human-AI collaborative system analysis and design')
    .version(packageJson.version);

// --- CORE COMMANDS ---

program
    .command('init')
    .description('Scaffold a new FoundrySpec documentation project')
    .argument('[project-name]', 'Name of the project', 'My Spec Project')
    .action(async (projectName: string) => {
        console.log(chalk.blue(`\n🚀 Initializing FoundrySpec project: ${projectName}...`));
        try {
            const scaffold = new ScaffoldManager(projectName);
            await scaffold.init();
            console.log(chalk.green(`\n✅ Project "${projectName}" initialized successfully!`));
            console.log(chalk.cyan(`\nNext steps:`));
            console.log(`  foundryspec build`);
            console.log(`  foundryspec serve`);
            console.log(`  foundryspec serve`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Error during initialization:'), msg);
            process.exit(1);
        }
    });

program
    .command('probe')
    .description('Analyze the project for drift between Spec and Implementation')
    .action(async () => {
        try {
            const root = await findProjectRoot(process.cwd());
            const prober = new ProbeManager(root);
            await prober.runProbe();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Probe failed:'), msg);
            process.exit(1);
        }
    });

program
    .command('serve')
    .description('Locally serve the generated documentation hub')
    .option('-p, --port <number>', 'Port to use', '3000')
    .action(async (options: { port: string }) => {
        try {
            const root = await findProjectRoot(process.cwd());
            const builder = new BuildManager(root);
            await builder.serve(options.port);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Serve failed:'), msg);
        }
    });

program
    .command('build')
    .description('Generate the static documentation hub')
    .action(async () => {
        console.log(chalk.blue('\n🛠️  Building documentation hub...'));
        try {
            const root = await findProjectRoot(process.cwd());
            const builder = new BuildManager(root);
            await builder.build();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Build failed:'), msg);
            process.exit(1);
        }
    });

// --- CONFIGURATION COMMANDS ---

program
    .command('config')
    .description('Manage project configuration (show, set)')
    .argument('<action>', 'Action to perform: show, set')
    .argument('[key]', 'Config key (e.g., name)')
    .argument('[value]', 'Value to set')
    .action(async (action, key, value) => {
        try {
            const root = process.cwd();
            const idPath = path.join(root, '.foundryid');
            if (!await fs.pathExists(idPath)) {
                throw new Error('No .foundryid found. Run this command in the project root.');
            }
            const id = (await fs.readFile(idPath, 'utf8')).trim();

            if (action === 'show') {
                const config = await store.getProject(id);
                console.log(JSON.stringify(config, null, 2));
            } else if (action === 'set') {
                if (!key || !value) throw new Error('Usage: config set <key> <value>');
                await store.updateProject(id, { [key]: value });
                console.log(chalk.green(`✅ Updated ${key} to "${value}" for project ${id}.`));
            } else {
                console.log(chalk.yellow('Unknown action. Use "show" or "set".'));
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Config error:'), msg);
        }
    });

program
    .command('comments')
    .description('Manage internal comments (dump, import)')
    .argument('<action>', 'Action to perform: dump, import')
    .argument('[file]', 'File path for import')
    .action(async (action, file) => {
        try {
            const root = process.cwd();
            const idPath = path.join(root, '.foundryid');
            if (!await fs.pathExists(idPath)) throw new Error('No .foundryid found.');
            const id = (await fs.readFile(idPath, 'utf8')).trim();
            const commentsPath = store.getCommentsPath(id);

            if (action === 'dump') {
                if (await fs.pathExists(commentsPath)) {
                    const content = await fs.readFile(commentsPath, 'utf8');
                    console.log(content);
                } else {
                    console.log('{}'); // Empty JSON
                }
            } else if (action === 'import') {
                if (!file) throw new Error('Usage: comments import <file>');
                const source = path.resolve(file);
                if (!await fs.pathExists(source)) throw new Error(`File not found: ${source}`);
                
                await fs.ensureDir(path.dirname(commentsPath));
                await fs.copy(source, commentsPath);
                console.log(chalk.green(`✅ Comments imported from ${file}`));
            } else {
                console.log(chalk.yellow('Unknown action. Use "dump" or "import".'));
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Comments error:'), msg);
        }
    });

// --- MANAGEMENT COMMANDS ---

program
    .command('upgrade')
    .description('Update local project templates and workflows')
    .action(async () => {
        console.log(chalk.blue('\n🆙 Upgrading local FoundrySpec project...'));
        try {
            const scaffold = new ScaffoldManager();
            await scaffold.upgrade();
            console.log(chalk.green('\n✅ Project upgraded successfully!'));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Upgrade failed:'), msg);
        }
    });

program
    .command('add')
    .description('Add a new documentation category')
    .argument('<category>', 'Name of the category (e.g., architecture, boundaries)')
    .action(async (category: string) => {
        console.log(chalk.blue(`\n📂 Adding category: ${category}...`));
        try {
            const root = process.cwd();
            const idPath = path.join(root, '.foundryid');
            if (!await fs.pathExists(idPath)) throw new Error('No .foundryid found. Run in project root.');
            const id = (await fs.readFile(idPath, 'utf8')).trim();
            
            const config = await store.getProject(id);
            if (!config) throw new Error('Project not found in store.');

            const catSlug = category.toLowerCase().replace(/\s+/g, '-');
            
            // Update Store
            const categories = config.categories || [];
            if (!categories.find(c => c.path === catSlug)) {
                categories.push({
                    name: category,
                    path: catSlug,
                    description: `Documentation for ${category}`
                });
                await store.updateProject(id, { categories });
            }

            // Create Directory
            await fs.ensureDir(path.join(root, 'docs', catSlug));
            console.log(chalk.green(`✅ Category "${category}" added and registered.`));

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Failed to add category:'), msg);
        }
    });

program
    .command('pull')
    .description('Incorporate external specs from a Git repository')
    .argument('<url>', 'Remote Git repository URL')
    .argument('<path>', 'Local path to store the specs')
    .action(async (url: string, targetPath: string) => {
        try {
            const gitMan = new GitManager();
            await gitMan.pull(url, targetPath);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Pull failed:'), msg);
        }
    });

program
    .command('sync')
    .description('Synchronize all external specs')
    .action(async () => {
        try {
            const gitMan = new GitManager();
            await gitMan.sync();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Sync failed:'), msg);
        }
    });

program
    .command('deploy')
    .description('Scaffold GitHub Actions for automatic deployment')
    .action(async () => {
        console.log(chalk.blue('\n🚀 Scaffolding deployment pipeline...'));
        try {
            const workflowDir = path.join(process.cwd(), '.github/workflows');
            await fs.ensureDir(workflowDir);
            const workflowContent = `name: Deploy Docs
on:
  push:
    branches: [ main ]
permissions:
  contents: write
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g foundryspec
      - run: foundryspec build
      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist  # TODO: Update this for internal builds when deployment logic is finalized
`;
            // NOTE: Deploying from 'dist' assumes 'foundryspec build' outputs to a local folder.
            // With internal builds, deployment workflow needs rethinking.
            // User likely wants to deploy the INTERNALLY built site.
            // Current 'foundryspec build' outputs to ~/.foundryspec/builds/<id>/
            // CI implementation will need to know where to find it or 'build' needs a --local-dist option for CI.
            // For now, we'll keep it as is, but this is a Known Issue.
            
            await fs.writeFile(path.join(workflowDir, 'deploy-docs.yml'), workflowContent);
            console.log(chalk.green('\n✅ GitHub Actions workflow created at .github/workflows/deploy-docs.yml'));
            console.log(chalk.yellow('⚠️  Note: With the new internal build system, you may need to adjust your CI to locate the build output.'));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Deployment scaffolding failed:'), msg);
        }
    });

// TODO: This implementation for changes is not satisfactory yet, it needs to be replanned and redone
program
    .command('changes')
    .description('Generate a report of recent spec changes and implementation tasks')
    .option('-d, --days <number>', 'Number of days to look back', '7')
    .action(async (options: { days: string }) => {
        console.log(chalk.blue(`\n🔍 Analyzing spec changes over the last ${options.days} days...`));
        try {
            const gitMan = new GitManager();
            const days = parseInt(options.days, 10);
            const changes = await gitMan.getSpecChanges(days);

            if (changes.length === 0) {
                console.log(chalk.yellow('\nNo changes found in the assets/ directory.'));
                return;
            }

            let report = `# FoundrySpec Change Report (Last ${days} days)\n\n`;
            report += `This report identifies design changes that may require implementation updates in the codebase.\n\n`;

            for (const item of changes as FileChange[]) {
                const fileName = path.basename(item.file);
                const isMermaid = fileName.endsWith('.mermaid');
                
                report += `## [${isMermaid ? 'DIAGRAM' : 'DETAIL'}] ${item.file}\n`;
                report += `- **Latest Intent**: ${item.commits[0].message}\n`;
                report += `- **Last Modified**: ${new Date(item.commits[0].date).toLocaleDateString()}\n`;
                report += `\n`;
            }

            console.log(chalk.cyan('--- BEGIN REPORT ---\n'));
            console.log(report);
            console.log(chalk.cyan('--- END REPORT ---'));

            const reportPath = path.join(process.cwd(), '.foundryspec_changes.md');
            await fs.writeFile(reportPath, report);
            console.log(chalk.gray(`\nReport also saved to: ${reportPath}`));

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Failed to generate changes report:'), msg);
        }
    });

// This help command needs to be redone as we are moving towards phased changes strictly following the SDLC
program
    .command('help')
    .description('Display the AI Agent Guide or Workflows. Usage: help [topic] (topic: agent, workflows, or <workflow-name>)')
    .argument('[topic]', 'Topic to display: "agent" (default), "workflows", or a specific workflow filename', 'agent')
    .action(async (topic: string) => {
        try {
            const templateDir = path.join(__dirname, '../templates');
            
            if (topic === 'workflows') {
                const workflowsDir = path.join(templateDir, 'workflows');
                if (await fs.pathExists(workflowsDir)) {
                    const files = await fs.readdir(workflowsDir);
                    console.log(chalk.blue('\nAvailable Workflows:'));
                    files.forEach(f => console.log(`- ${f}`));
                    console.log(chalk.gray('\nRun "foundryspec help <workflow-name>" to view a specific workflow.'));
                } else {
                    console.log(chalk.yellow('No workflows found in templates.'));
                }
                return;
            }

            if (topic === 'agent') {
                const guidePath = path.join(templateDir, 'FOUNDRYSPEC_AGENT_GUIDE.md');
                if (await fs.pathExists(guidePath)) {
                    console.log(await fs.readFile(guidePath, 'utf8'));
                } else {
                    console.log(chalk.yellow('FOUNDRYSPEC_AGENT_GUIDE.md not found in templates.'));
                }
                return;
            }

            const workflowPath = path.join(templateDir, 'workflows', topic);
            let finalPath = '';
            if (await fs.pathExists(workflowPath)) {
                finalPath = workflowPath;
            } else if (await fs.pathExists(workflowPath + '.md')) {
                finalPath = workflowPath + '.md';
            }

            if (finalPath) {
                console.log(await fs.readFile(finalPath, 'utf8'));
            } else {
                console.log(chalk.red(`\n❌ Topic "${topic}" not found.`));
                console.log(chalk.gray('Available topics: agent, workflows'));
            }

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(chalk.red('\n❌ Failed to display help:'), msg);
        }
    });

program.parse();
