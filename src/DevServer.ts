/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import * as http from 'http';
import serveHandler from 'serve-handler';
import { ConfigStore } from './ConfigStore.js';
import { BuildManager } from './BuildManager.js';

// @foundryspec/start COMP_DevServer
export class DevServer {
    private projectRoot: string;
    private docsDir: string;
    private configStore: ConfigStore;
    private buildManager: BuildManager;
    private projectId: string | null = null;

    constructor(projectRoot: string = process.cwd()) {
        this.projectRoot = path.resolve(projectRoot);
        this.docsDir = path.join(this.projectRoot, 'docs');
        this.configStore = new ConfigStore();
        this.buildManager = new BuildManager(this.projectRoot);
    }

    private async resolveProject(): Promise<void> {
        const idPath = path.join(this.projectRoot, '.foundryid');
        if (!await fs.pathExists(idPath)) {
            throw new Error('Project not initialized. No .foundryid found. Run "foundryspec init".');
        }
        this.projectId = (await fs.readFile(idPath, 'utf8')).trim();
    }

    async serve(port: number | string = 3000): Promise<void> {
        await this.resolveProject();
        if (!this.projectId) throw new Error("Project ID validation failed.");

        const outputDir = this.configStore.getBuildDir(this.projectId);
        
        // Initial Build Check
        if (!await fs.pathExists(outputDir) || !await fs.pathExists(path.join(outputDir, 'index.html'))) {
            console.log(chalk.yellow(`\n⚠️  Internal build not found. Building now...`));
            await this.buildManager.build();
        }

        // File Watcher
        console.log(chalk.cyan(`👀 Watching for changes in ${this.docsDir}...`));
        let isBuilding = false;
        
        // Use recursive watch (simple native implementation)
        // For production robustness, chokidar handles edge cases better, but fs.watch is standard lib.
        fs.watch(this.docsDir, { recursive: true }, async (eventType, filename) => {
             if (filename && !isBuilding && !filename.startsWith('.')) {
                 isBuilding = true;
                 console.log(chalk.blue(`\n🔄 Change detected in ${filename}. Rebuilding...`));
                 try { await this.buildManager.build(); } 
                 catch (err: unknown) { 
                     const msg = err instanceof Error ? err.message : String(err);
                     console.error(chalk.red(`\n❌ Rebuild failed: ${msg}`)); 
                 } 
                 finally { isBuilding = false; }
             }
        });

        // HTTP Server
        const server = http.createServer(async (req, res) => {
            // API: Comments
            if (req.url === '/api/comments' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', async () => {
                    try {
                        const payload = JSON.parse(body);
                        const commentsPath = this.configStore.getCommentsPath(this.projectId!);
                        
                        let registry: Record<string, unknown[]> = {};
                        if (await fs.pathExists(commentsPath)) registry = await fs.readJson(commentsPath);
                        
                        const key = payload.compositeKey;
                        if (!registry[key]) registry[key] = [];
                        registry[key].push(payload);
                        await fs.writeJson(commentsPath, registry, { spaces: 2 });
                        res.writeHead(200); res.end(JSON.stringify({ status: 'ok' }));
                    } catch { res.writeHead(500); res.end('Error'); }
                });
                return;
            }

            // API: Sync Check
             if (req.url === '/api/sync' && req.method === 'GET') {
                const commentsPath = this.configStore.getCommentsPath(this.projectId!);
                const stats = await fs.pathExists(commentsPath) ? await fs.stat(commentsPath) : { mtimeMs: 0 };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ lastModified: stats.mtimeMs }));
                return;
             }

            return serveHandler(req, res, { public: outputDir });
        });

        server.listen(Number(port), () => {
            console.log(chalk.green(`\n🚀 Documentation Hub live at: http://localhost:${port}`));
        });
    }
}
// @foundryspec/end
