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
import { ServiceContainer } from './di/ServiceContainer.js';
import { IStorageProvider } from './interfaces/IStorageProvider.js';
import { ICommentSystem } from './interfaces/ICommentSystem.js';




// @foundryspec/start COMP_DevServer
export class DevServer {
    private projectRoot: string;
    private docsDir: string;
    private configStore: ConfigStore;
    private buildManager: BuildManager;
    private projectId: string | null = null;
    private container: ServiceContainer;

    constructor(projectRoot: string = process.cwd(), container: ServiceContainer) {
        this.projectRoot = path.resolve(projectRoot);
        this.docsDir = path.join(this.projectRoot, 'docs');
        this.container = container;
        this.configStore = container.resolve<ConfigStore>('ConfigStore');
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
        
        // Initialize Services via DI Container
        // Plugins may have registered alternative implementations
        const storageDir = this.configStore.getStorageDir(this.projectId);
        const storageFactory = this.container.resolve<(dir: string) => IStorageProvider>('IStorageProvider');
        const storage = storageFactory(storageDir);
        
        const commentFactory = this.container.resolve<(storage: IStorageProvider) => ICommentSystem>('ICommentSystem');
        const commentSystem = commentFactory(storage);

        // Initial Build Check
        if (!await fs.pathExists(outputDir) || !await fs.pathExists(path.join(outputDir, 'index.html'))) {
            console.log(chalk.yellow(`\n⚠️  Internal build not found. Building now...`));
            await this.buildManager.build();
        }

        // File Watcher
        console.log(chalk.cyan(`👀 Watching for changes in ${this.docsDir}...`));
        let isBuilding = false;
        
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
            // Interceptor: foundry.comments.json (Internal Storage Mapping)
            // Legacy / File Access for Frontend (until Frontend uses API)
            // We can serve the file from storage provider
            if (req.url && req.url.includes('foundry.comments.json')) {
                try {
                    // For LocalSystem, we can read the file directly or use storage.read
                    // But listComments returns array, frontend expects Registry Object locally probably?
                    // The frontend code loads "foundry.comments.json".
                    // If we use LocalCommentSystem with 'comments.json', we can read raw content.
                    const raw = await storage.readJson('comments.json').catch(() => ({}));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(raw));
                } catch {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end('{}');
                }
                return;
            }

            // API: Comments (Create)
            if (req.url === '/api/comments' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', async () => {
                    try {
                        const payload = JSON.parse(body);
                        await commentSystem.addComment(payload);
                        res.writeHead(200); res.end(JSON.stringify({ status: 'ok' }));
                    } catch (err) { 
                        console.error(err);
                        res.writeHead(500); res.end('Error'); 
                    }
                });
                return;
            }

            // API: Comments (Resolve/Delete)
            if (req.url === '/api/comments/resolve' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', async () => {
                    try {
                        const { id } = JSON.parse(body); // We only need ID really
                        // Or handle delete
                        await commentSystem.resolveComment(id, 'user'); // 'user' is placeholder
                        res.writeHead(200); res.end(JSON.stringify({ status: 'ok' }));
                    } catch { res.writeHead(500); res.end('Error'); }
                });
                return;
            }

            // API: Sync Check
            if (req.url === '/api/sync' && req.method === 'GET') {
                 const commentsPath = path.join(storageDir, 'comments.json');
                 const worksPath = path.join(storageDir, 'works.json');
                 const commentStats = await fs.pathExists(commentsPath) ? await fs.stat(commentsPath) : { mtimeMs: 0 };
                 const workStats = await fs.pathExists(worksPath) ? await fs.stat(worksPath) : { mtimeMs: 0 };
                 // Return the latest modification time of either file
                 const lastModified = Math.max(commentStats.mtimeMs, workStats.mtimeMs);

                 res.writeHead(200, { 'Content-Type': 'application/json' });
                 res.end(JSON.stringify({ lastModified }));
                 return;
            }

            // API: Works (Get JSON)
            if (req.url && req.url.includes('foundry.works.json')) {
                try {
                    const raw = await storage.readJson('works.json').catch(() => []);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(raw));
                } catch {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end('[]');
                }
                return;
            }

            // API: Works (Create/Update)
            if (req.url === '/api/works' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', async () => {
                    try {
                        const payload = JSON.parse(body);
                        const works = await storage.readJson('works.json').catch(() => []) as any[];
                        
                        // Check if it's a new work or a reply
                        if (payload.compositeKey) { // It's a reply or update to existing work logic if we follow comment pattern, but here payload is likely the work item itself or a message
                             // Simplified logic: If payload has 'taskId' it's a reply/update? 
                             // Let's assume payload is the Work Item or Message.
                             // Actually, let's align with the frontend implementation plan.
                             // Frontend will send the updated work item or a new work item?
                             // Let's assume implementation will Append to a list.
                        }
                        
                        // Simple Logic: Read, Find/Replace or Push, Write.
                        // If payload has an ID that exists, update it. Else push.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const index = works.findIndex((w: any) => w.id === payload.id);
                        if (index !== -1) {
                            works[index] = payload;
                        } else {
                            works.push(payload);
                        }
                        
                        await storage.writeJson('works.json', works);
                        res.writeHead(200); res.end(JSON.stringify({ status: 'ok' }));
                    } catch (err) { 
                        console.error(err);
                        res.writeHead(500); res.end('Error'); 
                    }
                });
                return;
            }

             // API: Works (Resolve)
            if (req.url === '/api/works/resolve' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', async () => {
                    try {
                        const { id } = JSON.parse(body);
                        const works = await storage.readJson('works.json').catch(() => []) as any[];
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const work = works.find((w: any) => w.id === id);
                        if (work) {
                            work.status = 'done';
                            await storage.writeJson('works.json', works);
                        }
                        res.writeHead(200); res.end(JSON.stringify({ status: 'ok' }));
                    } catch { res.writeHead(500); res.end('Error'); }
                });
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
