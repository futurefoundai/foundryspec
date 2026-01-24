import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { GitManager } from '../GitManager.js';
import { FileChange } from '../types/git.js';

export function registerGitOpsCommands(program: Command, findProjectRoot: (dir: string) => Promise<string>) {
    program
        .command('gitops')
        .description('Manage GitOps integration and enforcement policies')
        .argument('<action>', 'Action to perform (install, ci)')
        .action(async (action: string) => {
            try {
                const root = await findProjectRoot(process.cwd());
                const gitManager = new GitManager(root);
                
                if (action === 'install') {
                    await gitManager.installHooks();
                } else if (action === 'ci') {
                    await gitManager.installCI();
                } else {
                    console.error(chalk.red(`Unknown action: ${action}`));
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ GitOps action failed:'), msg);
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
                
                await fs.writeFile(path.join(workflowDir, 'deploy-docs.yml'), workflowContent);
                console.log(chalk.green('\n✅ GitHub Actions workflow created at .github/workflows/deploy-docs.yml'));
                console.log(chalk.yellow('⚠️  Note: With the new internal build system, you may need to adjust your CI to locate the build output.'));
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Deployment scaffolding failed:'), msg);
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
}
