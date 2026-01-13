#!/usr/bin/env node
/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU General Public License v3.0 (GPLv3).
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

/**
 * Finds the project root by searching upwards for foundry.config.json or a foundryspec/ folder.
 * Returns the directory containing foundry.config.json.
 */
async function findProjectRoot(startDir: string): Promise<string> {
    let current = path.resolve(startDir);
    while (true) {
        // Option A: Current directory contains foundry.config.json directly
        if (await fs.pathExists(path.join(current, 'foundry.config.json'))) {
            return current;
        }
        // Option B: Current directory has a foundryspec folder with a config
        const subConfig = path.join(current, 'foundryspec', 'foundry.config.json');
        if (await fs.pathExists(subConfig)) {
            return path.join(current, 'foundryspec');
        }

        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return startDir; // Fallback
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.join(__dirname, '../package.json'));

const program = new Command();

program
    .name('foundryspec')
    .description('Documentation engine for human-AI collaborative system analysis and design')
    .version(packageJson.version);

program
    .command('init')
    .description('Scaffold a new FoundrySpec documentation project')
    .argument('[project-name]', 'Name of the project', 'My Spec Project')
    .action(async (projectName: string) => {
        console.log(chalk.blue(`\n🚀 Initializing FoundrySpec project: ${projectName}...`));
        try {
            const scaffold = new ScaffoldManager(projectName);
            await scaffold.init();
            console.log(chalk.green(`\n✅ Project "${projectName}" scaffolded successfully in "foundryspec/" folder!`));
            console.log(chalk.cyan(`\nNext steps:`));
            console.log(`  cd foundryspec`);
            console.log(`  foundryspec build`);
            console.log(`  foundryspec serve`);
        } catch (err: any) {
            console.error(chalk.red('\n❌ Error during initialization:'), err.message);
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
        } catch (err: any) {
            console.error(chalk.red('\n❌ Serve failed:'), err.message);
        }
    });

program
    .command('upgrade')
    .description('Update local project templates and workflows')
    .action(async () => {
        console.log(chalk.blue('\n🆙 Upgrading local FoundrySpec project...'));
        try {
            const scaffold = new ScaffoldManager();
            await scaffold.upgrade();
            console.log(chalk.green('\n✅ Project upgraded successfully!'));
        } catch (err: any) {
            console.error(chalk.red('\n❌ Upgrade failed:'), err.message);
        }
    });

program
    .command('add')
    .description('Add a new documentation category')
    .argument('<category>', 'Name of the category (e.g., architecture, boundaries)')
    .action(async (category: string) => {
        console.log(chalk.blue(`\n📂 Adding category: ${category}...`));
        try {
            const root = await findProjectRoot(process.cwd());
            const configPath = path.join(root, 'foundryspec', 'foundry.config.json');
            if (!await fs.pathExists(configPath)) {
                 // Try if config is in root
                 const altConfig = path.join(root, 'foundry.config.json');
                 if (!await fs.pathExists(altConfig)) throw new Error('Not in a FoundrySpec project.');
            }

            const activeConfigPath = await fs.pathExists(path.join(root, 'foundryspec', 'foundry.config.json')) 
                ? path.join(root, 'foundryspec', 'foundry.config.json')
                : path.join(root, 'foundry.config.json');

            const config = await fs.readJson(activeConfigPath);
            const catSlug = category.toLowerCase().replace(/\s+/g, '-');
            
            if (!config.categories) config.categories = [];

            if (config.categories.find((c: any) => c.path === catSlug)) {
                console.log(chalk.yellow(`Category "${category}" already exists.`));
                return;
            }

            config.categories.push({
                name: category,
                path: catSlug,
                description: `Documentation for ${category}`
            });

            const assetsBase = path.join(path.dirname(activeConfigPath), 'assets');
            await fs.ensureDir(path.join(assetsBase, catSlug));
            await fs.writeJson(activeConfigPath, config, { spaces: 2 });
            console.log(chalk.green(`\n✅ Category "${category}" added successfully.`));
        } catch (err: any) {
            console.error(chalk.red('\n❌ Failed to add category:'), err.message);
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
        } catch (err: any) {
            console.error(chalk.red('\n❌ Pull failed:'), err.message);
        }
    });

program
    .command('sync')
    .description('Synchronize all external specs')
    .action(async () => {
        try {
            const gitMan = new GitManager();
            await gitMan.sync();
        } catch (err: any) {
            console.error(chalk.red('\n❌ Sync failed:'), err.message);
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
          folder: dist
`;
            await fs.writeFile(path.join(workflowDir, 'deploy-docs.yml'), workflowContent);
            console.log(chalk.green('\n✅ GitHub Actions workflow created at .github/workflows/deploy-docs.yml'));
        } catch (err: any) {
            console.error(chalk.red('\n❌ Deployment scaffolding failed:'), err.message);
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
        } catch (err: any) {
            console.error(chalk.red('\n❌ Build failed:'), err.message);
            process.exit(1);
        }
    });

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

            for (const item of changes as any[]) {
                const fileName = path.basename(item.file);
                const isMermaid = fileName.endsWith('.mermaid');
                const catName = item.file.split('/')[1] || 'General';

                report += `## [${isMermaid ? 'DIAGRAM' : 'DETAIL'}] ${item.file}\n`;
                report += `- **Latest Intent**: ${item.commits[0].message}\n`;
                report += `- **Last Modified**: ${new Date(item.commits[0].date).toLocaleDateString()}\n`;

                if (isMermaid) {
                    report += `- **Implementation Suggestion**: Review the architectural changes in \`${fileName}\` and ensure the corresponding services/logic in the codebase are synchronized with these updates.\n`;
                } else {
                    report += `- **Implementation Suggestion**: The detail file \`${fileName}\` has been updated. Verify if the business logic or contract described matches the current implementation.\n`;
                }
                report += `\n`;
            }

            console.log(chalk.cyan('--- BEGIN REPORT ---\n'));
            console.log(report);
            console.log(chalk.cyan('--- END REPORT ---'));

            // Optionally write to a file for agents to read easily
            const reportPath = path.join(process.cwd(), '.foundryspec_changes.md');
            await fs.writeFile(reportPath, report);
            console.log(chalk.gray(`\nReport also saved to: ${reportPath}`));

        } catch (err: any) {
            console.error(chalk.red('\n❌ Failed to generate changes report:'), err.message);
        }
    });

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

            // Check if it matches a workflow file
            const workflowPath = path.join(templateDir, 'workflows', topic);
            // Try exact match or with .md extension
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

        } catch (err: any) {
            console.error(chalk.red('\n❌ Failed to display help:'), err.message);
        }
    });

program.parse();
