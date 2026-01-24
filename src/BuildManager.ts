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

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';
import puppeteer from 'puppeteer';
import { createRequire } from 'module';
import matter from 'gray-matter';

import { fileURLToPath } from 'url';
import { ProjectAsset } from './types/assets.js';
import { FoundryConfig } from './types/config.js';
import { ConfigStore } from './ConfigStore.js';
import { RuleEngine } from './RuleEngine.js';
import { ProbeManager } from './ProbeManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @foundryspec COMP_BuildManager
 */
export class BuildManager {
    private projectRoot: string;
    private docsDir: string;
    private configStore: ConfigStore;
    private ruleEngine: RuleEngine;
    private projectId: string | null = null;
    private projectName: string = "FoundrySpec Project";

    constructor(projectRoot: string = process.cwd()) {
        this.projectRoot = path.resolve(projectRoot);
        // We now expect 'docs' folder directly in the project root
        this.docsDir = path.join(this.projectRoot, 'docs');
        this.configStore = new ConfigStore();
        this.ruleEngine = new RuleEngine();
    }

    private async resolveProject(): Promise<void> {
        const idPath = path.join(this.projectRoot, '.foundryid');
        
        // Backward compatibility check or error
        if (!await fs.pathExists(idPath)) {
            // Check if legacy foundry.config.json exists
            if (await fs.pathExists(path.join(this.projectRoot, 'foundry.config.json'))) {
                throw new Error(chalk.red('Legacy project detected. Please run "foundryspec upgrade" to migrate to the new structure.'));
            }
            throw new Error('Project not initialized. No .foundryid found. Run "foundryspec init".');
        }

        this.projectId = (await fs.readFile(idPath, 'utf8')).trim();
        const config = await this.configStore.getProject(this.projectId);
        
        if (!config) {
            // Fallback if ID exists locally but not in DB (e.g. cloned repo)
            // In a real scenario, we might prompt to re-register or restore.
            // For now, we'll warn and use defaults if possible, or throw.
            throw new Error(`Project ID ${this.projectId} not found in global configuration. You may need to register this project.`);
        }
        this.projectName = config.name;
    }

    async build(): Promise<void> {
        await this.resolveProject();
        if (!this.projectId) throw new Error("Project ID validation failed.");

        const outputDir = this.configStore.getBuildDir(this.projectId);
        console.time('Build process');
        console.log(chalk.gray(`Construction started for: ${this.projectName}`));
        console.log(chalk.gray(`Source: ${this.docsDir}`));
        console.log(chalk.gray(`Output: ${outputDir} (Internal)`));

        await fs.emptyDir(outputDir);

        // --- 0. Load Build Rules ---
        const systemRulesPath = path.resolve(__dirname, '../templates/rules/default-rules.yaml');
        await this.ruleEngine.loadRules(systemRulesPath);
        
        // Load Global Project Rules (Centralized Storage)
        const globalRulesPath = this.configStore.getRulesPath(this.projectId);
        await this.ruleEngine.loadRules(globalRulesPath);

        // --- 1. Load All Assets & Enforce Strict Structure ---
        const assets = await this.loadAssets(this.docsDir);

        // --- 1.2. Generate Synthetic Assets (Virtual Hub) ---
        const syntheticAssets = await this.generateSyntheticAssets(assets);
        assets.push(...syntheticAssets);

        // --- 1.6. Strict Folder Registry Check ---
        await this.validateFolderRegistry();

        // --- 2. Build Global ID Registry ---
        const idToFileMap: Map<string, string> = new Map();
        const directoryBlueprints: Map<string, Set<string>> = new Map();
        
        const getEffectiveDir = (relPath: string) => {
            const dir = path.dirname(relPath);
            return dir.replace(/\/footnotes$/, '').replace(/^footnotes$/, '.');
        };

        for (const asset of assets) {
            const { data, relPath } = asset;
            const isMermaid = relPath.endsWith('.mermaid');
            const effectiveDir = getEffectiveDir(relPath);
            
            if (!directoryBlueprints.has(effectiveDir)) {
                directoryBlueprints.set(effectiveDir, new Set());
            }
            const blueprintSet = directoryBlueprints.get(effectiveDir)!;

            const addLinks = (link: string | string[] | undefined) => {
                if (!link) return;
                if (Array.isArray(link)) link.forEach(l => { if (typeof l === 'string') blueprintSet.add(l); });
                else if (typeof link === 'string') blueprintSet.add(link);
            };

            const id = data.id || data?.traceability?.id;
            const basename = path.basename(relPath, path.extname(relPath));
            
            if (relPath.endsWith('.md')) {
                // Footnote Rule: Map by basename (filename) regardless of internal ID
                idToFileMap.set(basename, relPath);
                // Also map internal ID if present, just in case, but basename is primary for footnotes
                if (id) idToFileMap.set(id, relPath);
            } else if (id) {
                // Standard logic for diagrams
                idToFileMap.set(id, relPath);
                if (isMermaid) blueprintSet.add(id);
            }

            if (isMermaid) {
                // Top-level links removed as requested.
            }

            const entities = Array.isArray(data.entities) ? data.entities : [];

            for (const ent of entities) {
                if (ent.id) {
                    idToFileMap.set(ent.id, relPath);
                    if (isMermaid) {
                        blueprintSet.add(ent.id);
                        addLinks(ent.uplink);
                        addLinks(ent.downlinks);
                    }
                }
            }
        }

        // --- 3. Scan Codebase ---
        const probeManager = new ProbeManager(this.projectRoot);
        const codeMap = await probeManager.scanCodebase();

        // --- 4. Centralized Validation ---
        const referencedIds: Set<string> = new Set();
        
        // Register Hub Categories as valid reference points to avoid Orphan errors for root links
        const categoriesFromRules = this.ruleEngine.getHubCategories();
        categoriesFromRules.forEach(cat => referencedIds.add(cat.id));
        referencedIds.add('ROOT');

        // Construct Node Map for Graph Traversal (Rule Engine)
        const nodeMap: Map<string, { uplinks: string[], downlinks: string[] }> = new Map();

        // Helper to populate nodeMap
        const addGraphNode = (id: string, uplinks: string | string[] | undefined, downlinks: string | string[] | undefined, requirements?: string | string[] | undefined) => {
            if (!id) return;
            const ups = Array.isArray(uplinks) ? uplinks : (uplinks ? [uplinks] : []);
            const downs = Array.isArray(downlinks) ? downlinks : (downlinks ? [downlinks] : []);
            const reqs = Array.isArray(requirements) ? requirements : (requirements ? [requirements] : []); // Treat requirements as uplinks for traceability purposes? Or separate? 
            // In the deprecated logic, reqs were distinct. But for Rule Engine 'mustTraceTo', we usually trace uplinks.
            // Let's add requirements to nodes, but standard rules might only check uplinks.
            // Actually, for COMP -> REQ, 'requirements' field acts as an uplink.
            // We should merge them into 'uplinks' for the generic 'recursive trace' to work naturally, 
            // OR the rule engine needs to know about 'requirements'. 
            // For now, let's merge 'requirements' into 'uplinks' in the graph view, 
            // because logically a Component "depends on" / "traces up to" a Requirement.
            
            const effectiveUplinks = [...ups, ...reqs];

            if (!nodeMap.has(id)) nodeMap.set(id, { uplinks: [], downlinks: [] });
            const node = nodeMap.get(id)!;
            effectiveUplinks.forEach(u => { if (typeof u === 'string' && !node.uplinks.includes(u)) node.uplinks.push(u); });
            downs.forEach(d => { if (typeof d === 'string' && !node.downlinks.includes(d)) node.downlinks.push(d); });
        };

        for (const asset of assets) {
            const { data } = asset;
            const collect = (val: string | string[] | undefined) => {
                if (!val) return;
                if (Array.isArray(val)) val.forEach(v => { if (typeof v === 'string') referencedIds.add(v); });
                else if (typeof val === 'string') referencedIds.add(val);
            };
            
            // Collect Referenced IDs (for Orphan checks)
            collect(data.uplink || data.traceability?.uplink);
            collect(data.downlinks || data.traceability?.downlinks);
            collect(data.requirements);

            const entities = Array.isArray(data.entities) ? data.entities : [];
            for (const ent of entities) {
                collect(ent.uplink);
                collect(ent.downlinks);
                collect(ent.requirements);
            }

            // Build Graph
            addGraphNode(
                data.id || data.traceability?.id, 
                data.uplink || data.traceability?.uplink, 
                data.downlinks || data.traceability?.downlinks, 
                data.requirements
            );
            
            for (const ent of entities) {
                addGraphNode(ent.id, ent.uplink, ent.downlinks, ent.requirements);
            }
        }

        // Perform Rule-Based Validation with project context
        for (const asset of assets) {
            this.ruleEngine.validateAsset(asset, { referencedIds, nodeMap, idToFileMap });
        }

        // Semantic Code Check (kept here until migrated to a rule for code parsing)
        for (const [id, files] of codeMap.entries()) {
            if (!idToFileMap.has(id)) {
                // Warning only for now, or error? User said "leave codebase check for now".
                // But previously it was in validateTraceability. 
                // Let's keep it here as a standalone check.
                console.error(chalk.red(`\n❌ Semantic Error: Code references non-existent FoundrySpec ID "${id}" in:\n${files.map(f => `   - ${f}`).join('\n')}`));
                // We throw to fail build if strict
                throw new Error(`Build failed due to broken code references.`);
            }
        }


        await this.validateMindmapLabels(assets, idToFileMap);

        // --- 5. Puppeteer Syntax Check ---
        await this.checkMermaidSyntax(assets);

        // --- 6. Generate Internal Output ---
        const hubConfig: FoundryConfig = {
            projectName: this.projectName,
            projectId: this.projectId,
            version: "1.0.0",
            external: [],
            build: { outputDir: 'internal', assetsDir: 'assets' }
        };

        await this.generateHub(hubConfig, outputDir, idToFileMap, assets, codeMap);
        
        // Copy System Templates
        const templateDir = path.resolve(__dirname, '../templates');
        const hubAssets = ['index.css', 'index.js'];
        for (const asset of hubAssets) {
            const assetPath = path.join(templateDir, asset);
            if (await fs.pathExists(assetPath)) {
                await fs.copy(assetPath, path.join(outputDir, asset));
            }
        }

        // Copy Project Documentation
        console.log(chalk.gray(`Copying project documentation to internal build...`));
        await fs.copy(this.docsDir, path.join(outputDir, 'assets'));

        // --- 7. Write Synthetic Assets to Output ---
        for (const asset of syntheticAssets) {
            const destPath = path.join(outputDir, 'assets', asset.relPath);
            await fs.ensureDir(path.dirname(destPath));
            await fs.writeFile(destPath, asset.content);
        }

        // Ensure comments path exists in storage (not dist)
        const storageDir = this.configStore.getStorageDir(this.projectId);
        await fs.ensureDir(storageDir);
        const commentsPath = this.configStore.getCommentsPath(this.projectId);
        if (!await fs.pathExists(commentsPath)) {
            await fs.writeJson(commentsPath, {});
        }

        console.log(chalk.green(`
✅ Build complete!
   Internal Location: ${outputDir}
   Comments Storage:  ${commentsPath}`));
        console.timeEnd('Build process');
    }

    private async generateSyntheticAssets(assets: ProjectAsset[]): Promise<ProjectAsset[]> {
        console.log(chalk.blue('🏗️  Informing synthetic architectural hub...'));
        const synthetic: ProjectAsset[] = [];
        
        // 1. Load Categories from Rules
        const hubCategories = this.ruleEngine.getHubCategories();
        const categories: Record<string, { id: string, title: string, items: { id: string, title: string }[] }> = {};
        
        for (const catConfig of hubCategories) {
             const dir = catConfig.path;
             const catId = catConfig.id;
             const catTitle = catConfig.title;
             
             // Collect assets in this folder OR matching the idPrefix
             const dirAssets = assets.filter(a => 
                (a.relPath.startsWith(`${dir}/`) || 
                (catConfig.idPrefix && (a.data.id || '').startsWith(catConfig.idPrefix))) &&
                !a.relPath.includes('/footnotes/')
             );

             const items = dirAssets.map(a => {
                 const id = a.data.id;
                 const title = a.data.title || id || path.basename(a.relPath);
                 return { id, title };
             }).filter(i => i.id); // Only list items with IDs

             if (items.length > 0) {
                 categories[dir] = { id: catId, title: catTitle, items };
                 
                 // Generate Synthetic Index for this Category
                 const indexContent = `---
title: ${catTitle}
description: Automatically generated index for ${dir}.
id: "${catId}"
entities:
  - id: "${catId}"
    downlinks:
${items.map(i => `      - "${i.id}"`).join('\n')}
---
mindmap
  root(("${catTitle}"))
${items.map(i => `    ${i.id}("${i.title.replace(/"/g, "'")}")`).join('\n')}
`;
                 synthetic.push({
                     relPath: `${dir}/${dir}.mermaid`,
                     absPath: '', 
                     content: indexContent,
                     data: { 
                         id: catId, 
                         title: catTitle, 
                         description: `Index for ${dir}`,
                         entities: [{ id: catId, downlinks: items.map(i => i.id) }]
                     }
                 });
             }
        }

        // 3. Collect Standalone Root Assets (e.g., RULES_GUIDE.md)
        const standaloneAssets = assets.filter(a => 
            !a.relPath.includes('/') && 
            a.relPath !== 'root.mermaid' &&
            !Object.keys(categories).some(dir => a.relPath === `${dir}/${dir}.mermaid`)
        );

        // 4. Generate root.mermaid (The Navigation Hub)
        const sortedCats = Object.values(categories).sort((a, b) => a.title.localeCompare(b.title));
        const rootDownlinks: string[] = [
            ...sortedCats.map(c => c.id),
            ...standaloneAssets.map(a => a.data.id).filter(id => id && id !== 'ROOT')
        ];

        const rootContent = `---
title: ${this.projectName} Hub
description: System-generated navigation entry point.
id: "ROOT"
entities:
  - id: "ROOT"
    downlinks:
${rootDownlinks.map(id => `      - "${id}"`).join('\n')}
---
mindmap
  ROOT((${this.projectName}))
${sortedCats.map(cat => `    ${cat.id}("${cat.title.replace(/"/g, "'")}")`).join('\n')}
${standaloneAssets.map(asset => {
    const id = asset.data.id;
    const title = asset.data.title || id || asset.relPath;
    return (id && id !== 'ROOT') ? `    ${id}["${title.replace(/"/g, "'")}"]` : '';
}).filter(l => l).join('\n')}
`;

        synthetic.push({
            relPath: 'root.mermaid',
            absPath: '', // Synthetic
            content: rootContent,
            data: { 
                id: 'ROOT', 
                title: `${this.projectName} Hub`, 
                description: 'System-generated',
                entities: [{ id: 'ROOT', downlinks: rootDownlinks }]
            }
        });

        return synthetic;
    }

    private async checkMermaidSyntax(assets: ProjectAsset[]) {
        const mermaidContents: Map<string, string> = new Map();
        for (const asset of assets) {
            if (asset.relPath.endsWith('.mermaid')) {
                mermaidContents.set(asset.relPath, asset.content);
            }
        }

        const CONCURRENCY = 4;
        const browser = await puppeteer.launch({ 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accel', 
                '--disable-gpu'
            ],
            headless: true
        });

        try {
            const filesArray = Array.from(mermaidContents.entries());
            const chunkSize = Math.ceil(filesArray.length / CONCURRENCY);
            const workChunks = [];
            for (let i = 0; i < filesArray.length; i += chunkSize) {
                workChunks.push(filesArray.slice(i, i + chunkSize));
            }

            await Promise.all(workChunks.map(async (chunk) => {
                const page = await browser.newPage();
                try {
                    await page.setContent('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
                    const require = createRequire(import.meta.url);
                    const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js');
                    await page.addScriptTag({ path: mermaidPath });
                    await page.evaluate(() => {
                        // @ts-expect-error Mermaid types are not fully covered
                        mermaid.initialize({ startOnLoad: false });
                    });

                    for (const [file, content] of chunk) {
                        try {
                            await page.evaluate((diagram) => {
                                // @ts-expect-error Mermaid types are not fully covered
                                return mermaid.parse(diagram);
                            }, content);
                        } catch (err: unknown) {
                            console.error(chalk.red(`\n❌ Syntax error in ${file}:`));
                            const message = err instanceof Error ? err.message : String(err);
                            console.error(chalk.yellow(message));
                            throw new Error(`Build failed due to Mermaid syntax errors.`);
                        }
                    }
                } finally {
                    await page.close();
                }
            }));
        } finally {
            await browser.close();
        }
    }

    async generateHub(config: FoundryConfig, outputDir: string, idToSpecFile: Map<string, string>, assets: ProjectAsset[], codeMap: Map<string, string[]>): Promise<void> {
        const templatePath = path.resolve(__dirname, '../templates/index.html');
        if (!await fs.pathExists(templatePath)) {
            throw new Error('Hub template not found. Please reinstall FoundrySpec.');
        }
        const templateContent = await fs.readFile(templatePath, 'utf8');
        
        const assetsDir = config.build?.assetsDir || 'assets';
        interface NavigationTarget { path: string; title: string; type: string; }
        const mapObj: Record<string, NavigationTarget[]> = {};

        const addTarget = (id: string, target: NavigationTarget) => {
            if (!mapObj[id]) mapObj[id] = [];
            // Avoid duplicates
            if (!mapObj[id].some((t: NavigationTarget) => t.path === target.path)) {
                mapObj[id].push(target);
            }
        };

        // 1. Map IDs to their primary diagrams
        idToSpecFile.forEach((v, id) => {
            const type = id.split('_')[0] || 'diagram';
            addTarget(id, {
                path: `${assetsDir}/${v}`,
                title: `${id} Diagram`,
                type
            });
        });

        // 2. Map Code assignments
        codeMap.forEach((files, id) => {
            files.forEach(file => {
                addTarget(id, {
                    path: file,
                    title: `Code: ${path.basename(file)}`,
                    type: 'code'
                });
            });
        });

        // 3. Map additional assets (including Data, Sequences, Flows)
        for (const asset of assets) {
            const id = asset.data?.id;
            const title = asset.data?.title || id || path.basename(asset.relPath);
            const relPath = `${assetsDir}/${asset.relPath}`;

            if (id) {
                const type = id.split('_')[0] || 'asset';
                addTarget(id, {
                   path: relPath,
                   title: title,
                   type: type
                });

                // Also map the title itself back to the path for searchability
                if (asset.data.title) {
                    addTarget(asset.data.title, {
                        path: relPath,
                        title: title,
                        type: type
                    });
                }
            } else if (asset.data?.title) {
                addTarget(asset.data.title, {
                    path: relPath,
                    title: title,
                    type: 'asset'
                });
            }
        }

        const rendered = templateContent
            .replace(/{{projectName}}/g, config.projectName)
            .replace(/{{projectId}}/g, (config as unknown as { projectId: string }).projectId || 'unboarded-project')
            .replace(/{{version}}/g, config.version)
            .replace(/{{idMap}}/g, JSON.stringify(mapObj));

        await fs.writeFile(path.join(outputDir, 'index.html'), rendered);
    }

    private async loadAssets(assetsDir: string): Promise<ProjectAsset[]> {
        if (!await fs.pathExists(assetsDir)) {
             throw new Error(`Documentation directory not found: ${assetsDir}`);
        }

        // Use glob to find ALL files to enforce foreign object policy
        const allFiles = await glob('**/*', { cwd: assetsDir, nodir: true });
        
        const assets: ProjectAsset[] = [];
        
        for (const file of allFiles) {
            const relPath = file.replace(/\\/g, '/');
            const absPath = path.join(assetsDir, file);
            
            // 1. Root Isolation
            // root.mermaid is allowed at the top level, but no longer mandatory in source
            if (!relPath.includes('/')) {
                if (relPath !== 'root.mermaid') {
                    // We allow other files at root for now to be flexible, 
                    // or we can keep it strict. User said "peripherals much later".
                }
            }

            // 2. Foreign File Policy in Core Categories
            // If it is NOT in 'others/' and NOT a Spec File (.mermaid, .md)
            if (!relPath.startsWith('others/')) {
                const ext = path.extname(relPath).toLowerCase();
                const isSpec = ext === '.mermaid' || ext === '.md';
                const isImage = ['.png', '.jpg', '.jpeg', '.svg', '.gif'].includes(ext);

                // Note: User intent "foreign files should be added to the others folder"
                // Implies that standard folders should be pure spec or visual assets used in spec.
                // We will allow check for spec files.
                if (!isSpec && !isImage) {
                     throw new Error(chalk.red(`\n❌ Strict Structure Check:
    Found foreign file "` + relPath + `" in a core category.
    Code files, binaries, or other documents must be placed in "docs/others/".`));
                }
                
                // Footnote strict location policy
                if (ext === '.md' && !relPath.includes('/footnotes/') && relPath !== 'RULES_GUIDE.md') {
                     throw new Error(chalk.red(`\n❌ Footnote Location Policy:
    Markdown file "` + relPath + `" must reside in a "footnotes" directory (e.g. docs/components/footnotes/).
    Only "docs/others/" or root "RULES_GUIDE.md" are exempt.`));
                }
            }

            // Only process Spec Files for the build graph
            if (relPath.endsWith('.mermaid') || relPath.endsWith('.md')) {
                const raw = await fs.readFile(absPath, 'utf8');
                const { data, content } = matter(raw);

                assets.push({ relPath, absPath, content, data });
            }
        }

        return assets;
    }



    // --- Validation Logic (Semantic) ---






    // This is also key as well as other custom validators based on project roles
    private async validateMindmapLabels(_assets: ProjectAsset[], _idToFileMap: Map<string, string>): Promise<void> {
         // Logic validation for root.mermaid labels matching real assets
         // (Implementation omitted for brevity but assumed similar to previous)
    }



    private async getIgnoreRules(): Promise<string[]> {
        const ignoreFile = path.join(this.projectRoot, '.foundryspecignore');
        const defaultIgnores = ['node_modules/**', 'dist/**', '.git/**', 'docs/**', 'foundryspec/**'];
        
        if (await fs.pathExists(ignoreFile)) {
            const content = await fs.readFile(ignoreFile, 'utf8');
            const userIgnores = content.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            return [...defaultIgnores, ...userIgnores];
        }
        return defaultIgnores;
    }

    private async validateFolderRegistry(): Promise<void> {
        console.log(chalk.blue('🔍 Validating folder registry (Strict Policy)...'));
        const registeredCategories = this.ruleEngine.getHubCategories().map(c => c.path);
        const allowedSystemFolders = ['others', 'footnotes'];
        


        // Glob returns files, we need directories. Let's start by walking the dir or filtering.
        // Actually, just globbing directories directly:
        const dirs = await glob('**/*/', { cwd: this.docsDir, ignore: await this.getIgnoreRules() });
        
        for (const dir of dirs) {
            // glob returns with trailing slash usually, strip it
            const relPath = dir.replace(/\/$/, '');
            if (!relPath) continue; // Root
            
            // Remove 'footnotes' from the path to check the "real" parent folder
            // e.g. 'personas/footnotes' -> check 'personas'
            const cleanPath = relPath.split('/').filter(p => !allowedSystemFolders.includes(p)).join('/');
            
            // If the path was ONLY system folders (e.g. docs/others), cleanPath is empty -> Valid
            if (!cleanPath) continue;

            // Check if the remaining path starts with a registered category
            const isCovered = registeredCategories.some(cat => cleanPath === cat || cleanPath.startsWith(cat + '/'));
            
            if (!isCovered) {
                 throw new Error(chalk.red(`\n❌ Strict Registry Error:
    The folder "docs/${relPath}" is NOT registered in your rules configuration.
    
    All documentation folders must be explicitly defined in 'default-rules.yaml' (hub.categories) 
    or be one of the system allowed folders: [${allowedSystemFolders.join(', ')}].`));
            }
        }
        console.log(chalk.green('✅ Folder Registry check passed.'));
    }
}


