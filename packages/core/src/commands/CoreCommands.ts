import { Command } from 'commander';
import chalk from 'chalk';
import { ScaffoldManager } from '../ScaffoldManager.js';
import { ProbeManager } from '../ProbeManager.js';
import { BuildManager } from '../BuildManager.js';
import { DevServer } from '../DevServer.js';
import { ServiceContainer } from '../di/ServiceContainer.js';

export function registerCoreCommands(
    program: Command, 
    findProjectRoot: (dir: string) => Promise<string>,
    container: ServiceContainer
) {
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
            let prober;
            try {
                const root = await findProjectRoot(process.cwd());
                prober = new ProbeManager(root);
                await prober.runProbe();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Probe failed:'), msg);
                process.exit(1);
            } finally {
                if (prober) {
                    // Accessing private for termination (or make it public in ProbeManager)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (prober as any).mermaidParser.terminate();
                }
            }
        });

    program
        .command('serve')
        .description('Locally serve the generated documentation hub')
        .option('-p, --port <number>', 'Port to use', '3000')
        .action(async (options: { port: string }) => {
            try {
                const root = await findProjectRoot(process.cwd());
                const server = new DevServer(root, container);
                await server.serve(options.port);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Serve failed:'), msg);
            }
        });

    program
        .command('build')
        .description('Generate the static documentation hub')
        .action(async () => {
            console.log(chalk.blue('\n.. Building documentation hub...'));
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
}
