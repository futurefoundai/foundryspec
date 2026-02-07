import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
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
        .option('-b, --background', 'Run in background as a daemon')
        .action(async (options: { port: string, background?: boolean }) => {
            const port = options.port;
            const projectRoot = await findProjectRoot(process.cwd());
            const pidFile = path.join(projectRoot, '.foundryspec', `server-${port}.pid`);

            // Check if already running
            if (await fs.pathExists(pidFile)) {
                try {
                    const pid = parseInt((await fs.readFile(pidFile, 'utf8')).trim());
                    // Check if process exists
                    process.kill(pid, 0); 
                    console.error(chalk.red(`\n❌ Server already running on port ${port} (PID: ${pid})`));
                    console.error(chalk.yellow(`Use "foundryspec stop --port ${port}" to stop it.`));
                    process.exit(1);
                } catch {
                    // Process doesn't exist, stale PID file
                    await fs.remove(pidFile);
                }
            }

            if (options.background) {
                console.log(chalk.blue(`\nStarting FoundrySpec server on port ${port} in background...`));
                
                // Spawn detached process
                const child = spawn(process.argv[0], [process.argv[1], 'serve', '--port', port], {
                    detached: true,
                    stdio: ['ignore', 'pipe', 'pipe'], // We need stdout to wait for readiness
                    cwd: process.cwd()
                });

                if (child.stdout) {
                    child.stdout.on('data', async (data) => {
                        const output = data.toString();
                        if (output.includes('Documentation Hub live at')) {
                            console.log(chalk.green(`✅ Server running (PID: ${child.pid})`));
                            console.log(chalk.green(`🚀 Hub accessible at: http://localhost:${port}`));
                            
                            // Write PID file
                            await fs.ensureDir(path.dirname(pidFile));
                            await fs.writeFile(pidFile, child.pid?.toString() || '');
                            
                            child.unref();
                            process.exit(0);
                        }
                    });
                }

                 // Safety timeout
                setTimeout(() => {
                    console.error(chalk.red('❌ Timeout waiting for server to start. Check logs.'));
                    process.exit(1);
                }, 10000);

                return;
            }

            // Foreground Mode
            try {
                // Write PID for foreground process too (so stop command works)
                await fs.ensureDir(path.dirname(pidFile));
                await fs.writeFile(pidFile, process.pid.toString());

                // Cleanup on exit
                const cleanup = () => {
                   try { fs.removeSync(pidFile); } catch { /* ignore */ }
                };
                process.on('exit', cleanup);
                process.on('SIGINT', () => { cleanup(); process.exit(); });
                process.on('SIGTERM', () => { cleanup(); process.exit(); });

                const server = new DevServer(projectRoot, container);
                await server.serve(port);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(chalk.red('\n❌ Serve failed:'), msg);
                // Try to cleanup PID if we crash
                try { await fs.remove(pidFile); } catch { /* ignore */ }
                process.exit(1);
            }
        });

    program
        .command('stop')
        .description('Stop a running FoundrySpec server')
        .option('-p, --port <number>', 'Port to stop', '3000')
        .action(async (options: { port: string }) => {
             const port = options.port;
             const projectRoot = await findProjectRoot(process.cwd());
             const pidFile = path.join(projectRoot, '.foundryspec', `server-${port}.pid`);

             if (!await fs.pathExists(pidFile)) {
                 console.error(chalk.red(`\n❌ No server found running on port ${port}`));
                 process.exit(1);
             }

             try {
                 const pid = parseInt((await fs.readFile(pidFile, 'utf8')).trim());
                 process.kill(pid, 'SIGTERM');
                 await fs.remove(pidFile);
                 console.log(chalk.green(`\n✅ Stopped server on port ${port} (PID: ${pid})`));
             } catch (e: unknown) {
                 const msg = e instanceof Error ? e.message : String(e);
                 console.error(chalk.red(`\n❌ Failed to stop server: ${msg}`));
                 // If process doesn't exist, just remove PID file
                 await fs.remove(pidFile); 
             }
        });

    program
        .command('list-hubs')
        .description('List all running FoundrySpec documentation hubs')
        .action(async () => {
            const projectRoot = await findProjectRoot(process.cwd());
            const foundryDir = path.join(projectRoot, '.foundryspec');
            
            if (!await fs.pathExists(foundryDir)) {
                console.log(chalk.yellow('No .foundryspec directory found.'));
                return;
            }

            const files = await fs.readdir(foundryDir);
            const pidFiles = files.filter((f: string) => f.startsWith('server-') && f.endsWith('.pid'));

            if (pidFiles.length === 0) {
                console.log(chalk.yellow('No running hubs found.'));
                return;
            }

            console.log(chalk.blue('\nRunning Documentation Hubs:'));
            for (const file of pidFiles) {
                try {
                    const port = file.match(/server-(\d+)\.pid/)?.[1];
                    const pid = (await fs.readFile(path.join(foundryDir, file), 'utf8')).trim();
                    
                    // Check if process is alive
                    try {
                        process.kill(parseInt(pid), 0);
                        console.log(`- Port: ${chalk.green(port)}, PID: ${pid}`);
                    } catch {
                        console.log(`- Port: ${chalk.red(port)}, PID: ${pid} (Stale - Process not found)`);
                    }
                } catch {
                     // Ignore read errors
                }
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
