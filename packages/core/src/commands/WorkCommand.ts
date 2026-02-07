
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ConfigStore } from '../ConfigStore.js';

export function registerWorkCommands(program: Command, configStore: ConfigStore) {
    const work = program.command('work')
        .description('Manage global work items (tasks/discussions)');

    work.command('list')
        .description('List work items (default: unresolved)')
        .option('-a, --all', 'Show all works including resolved ones')
        .action(async (options) => {
            const projectId = await getProjectId();
            if (!projectId) return;
            const storageDir = configStore.getStorageDir(projectId);
            const worksPath = path.join(storageDir, 'works.json');

            if (!await fs.pathExists(worksPath)) {
                console.log(chalk.gray('No works found.'));
                return;
            }

            const works = await fs.readJson(worksPath);
            const filtered = options.all ? works : works.filter((w: any) => w.status !== 'done');

            if (filtered.length === 0) {
                console.log(chalk.gray('No works found matching criteria.'));
                return;
            }

            console.log(chalk.bold(`\n📋 Works (${filtered.length})`));
            filtered.forEach((w: any) => {
                const icon = w.status === 'done' ? '✅' : '⭕';
                console.log(`\n${icon} [ID: ${chalk.cyan(w.id)}] ${chalk.bold(w.title)}`);
                console.log(`   Status: ${w.status}`);
                console.log(`   Created: ${new Date(w.createdAt).toLocaleString()}`);
                if (w.messages && w.messages.length > 0) {
                    const lastMsg = w.messages[w.messages.length - 1];
                    console.log(`   Last message (${lastMsg.author}): ${chalk.gray(lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : ''))}`);
                }
            });
            
            console.log(chalk.yellow('\nCommands:'));
            console.log(`  Reply:   ${chalk.green('foundryspec work reply <id> <message>')}`);
            console.log(`  Resolve: ${chalk.green('foundryspec work resolve <id>')}`);
        });

    work.command('reply <id> <message>')
        .description('Reply to a work item')
        .action(async (id, message) => {
             const projectId = await getProjectId();
            if (!projectId) return;
            const storageDir = configStore.getStorageDir(projectId);
            const worksPath = path.join(storageDir, 'works.json');

            if (!await fs.pathExists(worksPath)) {
                console.log(chalk.red('No works found.'));
                return;
            }

            const works = await fs.readJson(worksPath);
            const work = works.find((w: any) => w.id === id);

            if (!work) {
                console.log(chalk.red(`Work item '${id}' not found.`));
                return;
            }

            work.messages.push({
                id: Math.random().toString(36).substr(2, 9),
                author: 'AI Agent', // Or CLI User
                content: message,
                timestamp: new Date().toISOString()
            });

            await fs.writeJson(worksPath, works, { spaces: 2 });
            console.log(chalk.green(`Reply sent to ${id}.`));
        });

    work.command('resolve <id>')
        .description('Mark a work item as done')
        .action(async (id) => {
             const projectId = await getProjectId();
            if (!projectId) return;
            const storageDir = configStore.getStorageDir(projectId);
            const worksPath = path.join(storageDir, 'works.json');

            if (!await fs.pathExists(worksPath)) {
                console.log(chalk.red('No works found.'));
                return;
            }

            const works = await fs.readJson(worksPath);
            const work = works.find((w: any) => w.id === id);

            if (!work) {
                console.log(chalk.red(`Work item '${id}' not found.`));
                return;
            }

            work.status = 'done';
            await fs.writeJson(worksPath, works, { spaces: 2 });
            console.log(chalk.green(`Work item ${id} resolved.`));
        });
}

async function getProjectId(): Promise<string | null> {
    const idPath = path.join(process.cwd(), '.foundryid');
    if (!await fs.pathExists(idPath)) {
        console.error(chalk.red('Project not initialized. Run inside a foundryspec project.'));
        return null;
    }
    return (await fs.readFile(idPath, 'utf8')).trim();
}
