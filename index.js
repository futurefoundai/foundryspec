#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

// Managers
// We'll create these files next
// import { ScaffoldManager } from './src/ScaffoldManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.join(__dirname, 'package.json'));

const program = new Command();

program
    .name('foundryspec')
    .description('Documentation engine for human-AI collaborative system design')
    .version(packageJson.version);

program
    .command('init')
    .description('Scaffold a new FoundrySpec documentation project')
    .argument('<project-name>', 'Name of the project directory')
    .action(async (projectName) => {
        console.log(chalk.blue(`\n🚀 Initializing FoundrySpec project: ${projectName}...`));
        try {
            // Implement init logic here or call ScaffoldManager
            const { ScaffoldManager } = await import('./src/ScaffoldManager.js');
            const scaffold = new ScaffoldManager(projectName);
            await scaffold.init();
            console.log(chalk.green(`\n✅ Project ${projectName} scaffolded successfully!`));
            console.log(chalk.cyan(`\nNext steps:`));
            console.log(`  cd ${projectName}`);
            console.log(`  foundryspec build`);
        } catch (err) {
            console.error(chalk.red('\n❌ Error during initialization:'), err.message);
            process.exit(1);
        }
    });

program
    .command('add')
    .description('Add a new documentation category')
    .argument('<category>', 'Name of the category (e.g., architecture, containers)')
    .action(async (category) => {
        console.log(chalk.blue(`\n📂 Adding category: ${category}...`));
        try {
            const configPath = path.join(process.cwd(), 'foundry.config.json');
            if (!await fs.pathExists(configPath)) throw new Error('Not in a FoundrySpec project.');

            const config = await fs.readJson(configPath);
            const catSlug = category.toLowerCase().replace(/\s+/g, '-');

            if (config.categories.find(c => c.path === catSlug)) {
                console.log(chalk.yellow(`Category "${category}" already exists.`));
                return;
            }

            config.categories.push({
                name: category,
                path: catSlug,
                description: `Documentation for ${category}`
            });

            await fs.ensureDir(path.join(process.cwd(), 'assets', catSlug));
            await fs.writeJson(configPath, config, { spaces: 2 });
            console.log(chalk.green(`\n✅ Category "${category}" added successfully.`));
        } catch (err) {
            console.error(chalk.red('\n❌ Failed to add category:'), err.message);
        }
    });

program
    .command('pull')
    .description('Incorporate external specs from a Git repository')
    .argument('<url>', 'Remote Git repository URL')
    .argument('<path>', 'Local path to store the specs')
    .action(async (url, targetPath) => {
        try {
            const { GitManager } = await import('./src/GitManager.js');
            const gitMan = new GitManager();
            await gitMan.pull(url, targetPath);
        } catch (err) {
            console.error(chalk.red('\n❌ Pull failed:'), err.message);
        }
    });

program
    .command('sync')
    .description('Synchronize all external specs')
    .action(async () => {
        try {
            const { GitManager } = await import('./src/GitManager.js');
            const gitMan = new GitManager();
            await gitMan.sync();
        } catch (err) {
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
        } catch (err) {
            console.error(chalk.red('\n❌ Deployment scaffolding failed:'), err.message);
        }
    });

program
    .command('build')
    .description('Generate the static documentation hub')
    .action(async () => {
        console.log(chalk.blue('\n🛠️  Building documentation hub...'));
        try {
            const { BuildManager } = await import('./src/BuildManager.js');
            const builder = new BuildManager();
            await builder.build();
        } catch (err) {
            console.error(chalk.red('\n❌ Build failed:'), err.message);
            process.exit(1);
        }
    });

program.parse();
