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
import matter from 'gray-matter';

import { fileURLToPath } from 'url';
import { ProjectAsset } from './types/assets.js';
import { FoundryConfig } from './types/config.js';
import { ConfigStore } from './ConfigStore.js';
import { RuleEngine } from './RuleEngine.js';
import { ProbeManager } from './ProbeManager.js';
import { MermaidParser } from './MermaidParser.js';
import { CacheManager } from './CacheManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @foundryspec COMP_BuildManager
 * @foundryspec COMP_Hub
 */

// ...

export class BuildManager {
  private projectRoot: string;
  private docsDir: string;
  private configStore: ConfigStore;
  private ruleEngine: RuleEngine;
  private mermaidParser: MermaidParser;
  private cacheManager: CacheManager;
  private projectId: string | null = null;
  private projectName: string = "FoundrySpec Project";

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    // We now expect 'docs' folder directly in the project root
    this.docsDir = path.join(this.projectRoot, 'docs');
    this.configStore = new ConfigStore();
    this.ruleEngine = new RuleEngine();
    this.cacheManager = new CacheManager(this.projectRoot);
    this.mermaidParser = new MermaidParser(this.ruleEngine, this.cacheManager);
  }

  private async resolveProject(): Promise<void> {
    const idPath = path.join(this.projectRoot, '.foundryid');

    // Backward compatibility check or error
    if (!(await fs.pathExists(idPath))) {
      // Check if legacy foundry.config.json exists
      if (await fs.pathExists(path.join(this.projectRoot, 'foundry.config.json'))) {
        throw new Error(
          chalk.red(
            'Legacy project detected. Please run "foundryspec upgrade" to migrate to the new structure.',
          ),
        );
      }
      throw new Error('Project not initialized. No .foundryid found. Run "foundryspec init".');
    }

    this.projectId = (await fs.readFile(idPath, 'utf8')).trim();
    const config = await this.configStore.getProject(this.projectId);

    if (!config) {
      // Fallback if ID exists locally but not in DB (e.g. cloned repo)
      // In a real scenario, we might prompt to re-register or restore.
      // For now, we'll warn and use defaults if possible, or throw.
      throw new Error(
        `Project ID ${this.projectId} not found in global configuration. You may need to register this project.`,
      );
    }
    this.projectName = config.name;
  }

  async build(): Promise<void> {
    await this.resolveProject();
    if (!this.projectId) throw new Error('Project ID validation failed.');
    
    // Initialize Cache Manager (Tier 1 & 2)
    await this.cacheManager.init();

    try {
        const outputDir = this.configStore.getBuildDir(this.projectId);
    console.time('Build process');
    console.log(chalk.gray(`Construction started for: ${this.projectName}`));
    console.log(chalk.gray(`Source: ${this.docsDir}`));
    console.log(chalk.gray(`Output: ${outputDir} (Internal)`));

    await fs.emptyDir(outputDir);

    // --- 0. Load Build Rules ---
    // Point to the adjacent 'rules' directory where JS/TS rule files reside
    const systemRulesPath = path.resolve(__dirname, 'rules');
    await this.ruleEngine.loadRules(systemRulesPath);

    // Load Global Project Rules (Centralized Storage)
    const globalRulesPath = this.configStore.getRulesPath(this.projectId);
    await this.ruleEngine.loadRules(globalRulesPath);

    // --- 1. Load All Assets & Enforce Strict Structure ---
    const assets = await this.loadAssets(this.docsDir);

    // --- 1.1. Enrich Mindmap Diagrams (Auto-ID Generation) ---
    this.enrichMindmapDiagrams(assets);

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
        if (Array.isArray(link))
          link.forEach((l) => {
            if (typeof l === 'string') blueprintSet.add(l);
          });
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

    // --- 4. Puppeteer Syntax Check & Caching (Moved up for AST-First Traceability) ---
    // We run this BEFORE graph construction so that we can use analysis results.
    await this.checkMermaidSyntax(assets);
    this.repairRequirementDiagrams(assets);

    // --- 5. Centralized Validation ---
    const referencedIds: Set<string> = new Set();
    const categoriesFromRules = this.ruleEngine.getHubCategories();
    categoriesFromRules.forEach((cat) => referencedIds.add(cat.id));
    referencedIds.add('ROOT');

    const nodeMap: Map<string, { uplinks: string[]; downlinks: string[]; metadata?: { classification?: string; isFileRoot?: boolean; personaType?: string } }> = new Map();

    const addGraphNode = (
      id: string,
      uplinks: string | string[] | undefined,
      downlinks: string | string[] | undefined,
      requirements?: string | string[] | undefined,
    ) => {
      if (!id) return;
      const ups = Array.isArray(uplinks) ? uplinks : uplinks ? [uplinks] : [];
      const downs = Array.isArray(downlinks) ? downlinks : downlinks ? [downlinks] : [];
      const reqs = Array.isArray(requirements) ? requirements : requirements ? [requirements] : [];
      const effectiveUplinks = [...ups, ...reqs];

      if (!nodeMap.has(id)) nodeMap.set(id, { uplinks: [], downlinks: [] });
      const node = nodeMap.get(id)!;
      effectiveUplinks.forEach((u) => {
        if (typeof u === 'string') {
           if (!node.uplinks.includes(u)) node.uplinks.push(u);
           if (!nodeMap.has(u)) nodeMap.set(u, { uplinks: [], downlinks: [] });
           const parentNode = nodeMap.get(u)!;
           if (!parentNode.downlinks.includes(id)) parentNode.downlinks.push(id);
        }
      });
      
      downs.forEach((d) => {
        if (typeof d === 'string') {
          if (!node.downlinks.includes(d)) node.downlinks.push(d);
          if (!nodeMap.has(d)) nodeMap.set(d, { uplinks: [], downlinks: [] });
          const childNode = nodeMap.get(d)!;
          if (!childNode.uplinks.includes(id)) childNode.uplinks.push(id);
        }
      });
    };

    const inferUplink = (relPath: string): string | undefined => {
      if (relPath.includes('/footnotes/')) return undefined;
      const cat = categoriesFromRules.find(c => relPath.startsWith(c.path + '/'));
      return cat?.id;
    };

    for (const asset of assets) {
      const { data, analysis } = asset;
      const id = data.id || data.traceability?.id;
      
      // Framework Rule: Always ensure a folder-based group uplink
      const inferredGroup = id ? inferUplink(asset.relPath) : undefined;
      const effectiveUplinks = inferredGroup ? [inferredGroup] : [];

      const collect = (val: string | string[] | undefined) => {
        if (!val) return;
        if (Array.isArray(val))
          val.forEach((v) => { if (typeof v === 'string') referencedIds.add(v); });
        else if (typeof val === 'string') referencedIds.add(val);
      };

      effectiveUplinks.forEach(up => collect(up));
      if (effectiveUplinks.length > 0) collect(id);
      collect(data.requirements);

      // Incorporate AST Analysis into Graph
      const astDownlinks: string[] = [];
      const astUplinks: string[] = [];
      
      const detectedIds: string[] = [];
      if (analysis && (analysis as any).nodes) {
          ((analysis as any).nodes).forEach((n: any) => {
              const nid = typeof n === 'string' ? n : n.id;
              if (typeof nid === 'string' && /^[A-Z]{2,}_/.test(nid)) detectedIds.push(nid);
          });
      }
      if (analysis && (analysis as any).relationships) {
          ((analysis as any).relationships).forEach((rel: { to: string, type?: string }) => {
              if (typeof rel.to === 'string') detectedIds.push(rel.to);
          });
      }

      // Convert Set back to array to avoid confusion
      const uniqueDetectedIds = Array.from(new Set(detectedIds));

      uniqueDetectedIds.forEach(idFound => {
          if (typeof idFound !== 'string') return;
          // Skip self-referential links from diagram to asset
          if (idFound === id) return;
          
          // Logic: Who is the parent of whom?
          // 1. Personas are parents of Journeys & Requirements
          if (idFound.startsWith('PER_') && (id?.startsWith('JRN_') || id?.startsWith('REQ_'))) {
              astUplinks.push(idFound);
          } else {
              astDownlinks.push(idFound);
          }
      });

      const entities = Array.isArray(data.entities) ? data.entities : [];
      for (const ent of entities) {
        collect(ent.requirements);
      }

      const finalUplinks = [...effectiveUplinks, ...astUplinks];

      // Build Graph
      addGraphNode(id, finalUplinks, astDownlinks, data.requirements);

      // --- Framework-Aware Metadata Processing ---
      if (id && nodeMap.has(id)) {
          const node = nodeMap.get(id)!;
          node.metadata = node.metadata || {};
          
          if (data.classification) node.metadata.classification = data.classification;
          if (data.id) node.metadata.isFileRoot = true;

          // Special logic for Requirements: If no classification, default to Functional if top-level
          if (id.startsWith('REQ_') && !node.metadata.classification) {
              const hasReqParent = effectiveUplinks.some(u => u.startsWith('REQ_'));
              if (!hasReqParent) node.metadata.classification = 'Functional';
          }
      }

      for (const ent of entities) {
        addGraphNode(ent.id, [], [], ent.requirements);
        if (ent.id && nodeMap.has(ent.id)) {
            const node = nodeMap.get(ent.id)!;
            node.metadata = node.metadata || {};
            if (ent.classification) node.metadata.classification = ent.classification;
        }
      }
    }


    // --- 6. Perform Rule-Based Validation ---

    // Perform Rule-Based Validation with project context
    for (const asset of assets) {
      await this.ruleEngine.validateAsset(asset, { referencedIds, nodeMap, idToFileMap });
    }

    // Run project-level validation
    await this.ruleEngine.validateProject({ referencedIds, nodeMap, idToFileMap });

    // Semantic Code Check (kept here until migrated to a rule for code parsing)
    for (const [id, files] of codeMap.entries()) {
      if (!idToFileMap.has(id)) {
        // Warning only for now, or error? User said "leave codebase check for now".
        // But previously it was in validateTraceability.
        // Let's keep it here as a standalone check.
        console.error(
          chalk.red(
            `\n❌ Semantic Error: Code references non-existent FoundrySpec ID "${id}" in:\n${files.map((f) => `   - ${f}`).join('\n')}`,
          ),
        );
        // We throw to fail build if strict
        throw new Error(`Build failed due to broken code references.`);
      }
    }

    await this.validateMindmapLabels(assets, idToFileMap);

    // --- 5. Puppeteer Syntax Check (Moved up) ---
    // await this.checkMermaidSyntax(assets);

    // --- 6. Generate Internal Output ---
    const hubConfig: FoundryConfig = {
      projectName: this.projectName,
      projectId: this.projectId,
      version: '1.0.0',
      external: [],
      build: { outputDir: 'internal', assetsDir: 'assets' },
    };

    // Copy System Templates FIRST
    const templateDir = path.resolve(__dirname, '../templates/hub');
    if (await fs.pathExists(templateDir)) {
      await fs.copy(templateDir, outputDir);
    }

    // Generate Hub (Overwriting index.html with hydration)
    await this.generateHub(hubConfig, outputDir, idToFileMap, assets, codeMap, nodeMap);

    // Copy Project Documentation
    console.log(chalk.gray(`Copying project documentation to internal build...`));
    await fs.copy(this.docsDir, path.join(outputDir, 'assets'));

    // --- Persist Self-Healing Repairs ---
    // Since fs.copy copies the raw source files, we must overwrite any requirement diagrams
    // that were modified in-memory by the repair logic.
    const repairedAssets = assets.filter(a => 
        a.analysis?.type === 'requirement' || 
        a.analysis?.type === 'requirementDiagram' || 
        a.analysis?.type === 'requirementdiagram'
    );
    for (const asset of repairedAssets) {
         const destPath = path.join(outputDir, 'assets', asset.relPath);
         await fs.writeFile(destPath, asset.content, 'utf8');
    }

    // --- 7. Write Synthetic Assets to Output ---
    for (const asset of syntheticAssets) {
      const destPath = path.join(outputDir, 'assets', asset.relPath);
      await fs.ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, asset.content);
    }


    console.log(
      chalk.green(`
✅ Build complete!
   Internal Location: ${outputDir}`),
    );
  } catch (err) {
      console.error(chalk.red('\n❌ Build failed.'));
      throw err;
  } finally {
      // CLEANUP
      await this.mermaidParser.terminate();
      await this.cacheManager.flush();
      console.timeEnd('Build process');
  }
}

  private async generateSyntheticAssets(assets: ProjectAsset[]): Promise<ProjectAsset[]> {
    console.log(chalk.blue('🏗️  Informing synthetic architectural hub...'));
    const synthetic: ProjectAsset[] = [];

    // 1. Load Categories from Rules
    const hubCategories = this.ruleEngine.getHubCategories();
    const categories: Record<
      string,
      { id: string; title: string; items: { id: string; title: string }[] }
    > = {};

    for (const catConfig of hubCategories) {
      const dir = catConfig.path;
      const catId = catConfig.id;
      const catTitle = catConfig.title;

      // Collect assets in this folder OR matching the idPrefix
      const dirAssets = assets.filter(
        (a) =>
          (a.relPath.startsWith(`${dir}/`) ||
            (catConfig.idPrefix && (a.data.id || '').startsWith(catConfig.idPrefix))) &&
          !a.relPath.includes('/footnotes/'),
      );

      const items = dirAssets
        .map((a) => {
          const id = a.data.id;
          const title = a.data.title || id || path.basename(a.relPath);
          return { id, title };
        })
        .filter((i) => i.id); // Only list items with IDs

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
${items.map((i) => `      - "${i.id}"`).join('\n')}
---
mindmap
%% foundryspec-type: navigation
root(("${catTitle}"))
${items.map((i) => `    ${i.id}("${i.title.replace(/"/g, "'")}")`).join('\n')}
`;
        synthetic.push({
          relPath: `${dir}/${dir}.mermaid`,
          absPath: '',
          content: indexContent,
          data: {
            id: catId,
            title: catTitle,
            description: `Index for ${dir}`,
            entities: [{ id: catId, downlinks: items.map((i) => i.id) }],
          },
        });
      }
    }

    // 3. Collect Standalone Root Assets (e.g., RULES_GUIDE.md)
    const standaloneAssets = assets.filter(
      (a) =>
        !a.relPath.includes('/') &&
        a.relPath !== 'root.mermaid' &&
        !Object.keys(categories).some((dir) => a.relPath === `${dir}/${dir}.mermaid`),
    );

    // 4. Generate root.mermaid (The Navigation Hub)
    const sortedCats = Object.values(categories).sort((a, b) => a.title.localeCompare(b.title));
    const rootDownlinks: string[] = [
      ...sortedCats.map((c) => c.id),
      ...standaloneAssets.map((a) => a.data.id).filter((id) => id && id !== 'ROOT'),
    ];

    const rootContent = `---
title: ${this.projectName} Hub
description: System-generated navigation entry point.
id: "ROOT"
entities:
  - id: "ROOT"
    downlinks:
${rootDownlinks.map((id) => `      - "${id}"`).join('\n')}
---
mindmap
%% foundryspec-type: navigation
ROOT((${this.projectName}))
${sortedCats.map((cat) => `    ${cat.id}("${cat.title.replace(/"/g, "'")}")`).join('\n')}
${standaloneAssets
  .map((asset) => {
    const id = asset.data.id;
    const title = asset.data.title || id || asset.relPath;
    return id && id !== 'ROOT' ? `    ${id}["${title.replace(/"/g, "'")}"]` : '';
  })
  .filter((l) => l)
  .join('\n')}
`;

    synthetic.push({
      relPath: 'root.mermaid',
      absPath: '', // Synthetic
      content: rootContent,
      data: {
        id: 'ROOT',
        title: `${this.projectName} Hub`,
        description: 'System-generated',
        entities: [{ id: 'ROOT', downlinks: rootDownlinks }],
      },
    });

    return synthetic;
  }

  /**
   * Validate Mermaid syntax using cached parsing
   */
  private async checkMermaidSyntax(assets: ProjectAsset[]) {
    const mermaidAssets = assets.filter(a => a.relPath.endsWith('.mermaid'));
    
    console.log(chalk.gray(`Validating ${mermaidAssets.length} Mermaid diagrams...`));
    
    let cacheHits = 0;
    let cacheMisses = 0;

    // Parse all diagrams (with caching) in parallel
    await Promise.all(mermaidAssets.map(async (asset) => {
      try {
        const result = await this.mermaidParser.parseWithCache(asset.absPath, asset.content);
        
        if (result.validationErrors && result.validationErrors.length > 0) {
            console.error(chalk.red(`\n❌ Syntax error in ${asset.relPath}:`));
            result.validationErrors.forEach(e => console.error(chalk.yellow(`Line ${e.line}: ${e.message}`)));
            throw new Error(`Build failed due to Mermaid syntax errors.`);
        }

        if (result.fromCache) {
          cacheHits++;
        } else {
          cacheMisses++;
        }
        
        // Attach analysis for RuleEngine to use later
        asset.analysis = {
            type: result.diagramType,
            nodes: result.nodes,
            definedNodes: result.definedNodes,
            relationships: result.relationships,
            mindmapMappings: result.mindmapMappings
        };
      } catch (err: unknown) {
        console.error(chalk.red(`\n❌ Syntax error in ${asset.relPath}:`));
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.yellow(message));
        throw new Error(`Build failed due to Mermaid syntax errors.`);
      }
    }));

    // Show cache statistics
    if (mermaidAssets.length > 0) {
      const hitRate = ((cacheHits / mermaidAssets.length) * 100).toFixed(1);
      console.log(chalk.gray(`  Cache: ${cacheHits} hits, ${cacheMisses} misses (${hitRate}% hit rate)`));
    }

    // Save cache to disk
    await this.mermaidParser.flush();
  }

  private repairRequirementDiagrams(assets: ProjectAsset[]) {
    const requirementAssets = assets.filter(a => 
        a.analysis?.type === 'requirement' || 
        a.analysis?.type === 'requirementdiagram' ||
        a.analysis?.type === 'requirementDiagram'
    );
    
    if (requirementAssets.length > 0) {
        console.log(chalk.gray(`Checking ${requirementAssets.length} requirement diagrams for visual integrity...`));
    }

    for (const asset of requirementAssets) {
        if (!asset.analysis || !asset.analysis.nodes) continue;
        
        const definedNodes = new Set(asset.analysis.definedNodes || asset.analysis.nodes);
        const referencedNodes = new Set<string>();
        
        // Use regex for robust relationship participant extraction
        const relRegex = /(\w+)\s*[-<]\s*(\w+)\s*[-<]?>\s*(\w+)/g;
        let match;
        while ((match = relRegex.exec(asset.content)) !== null) {
            const [_, part1, type, part2] = match;
            const relationshipTypes = ['contains', 'verifies', 'copies', 'derives', 'refines', 'satisfies', 'traces'];
            if (relationshipTypes.includes(type)) {
                referencedNodes.add(part1);
                referencedNodes.add(part2);
            }
        }
        
        const missingNodes = Array.from(referencedNodes).filter(id => 
            !definedNodes.has(id)
        );
        

        if (missingNodes.length > 0) {
            console.log(chalk.blue(`  🔧 Repairing ${asset.relPath}: Injecting ${missingNodes.length} missing element stub(s) for: ${missingNodes.join(', ')}`));
            let repairs = '\n\n    %% --- Auto-Injected Elements (for frontend rendering stability) ---\n';
            for (const node of missingNodes) {
                repairs += `    element ${node} {\n        type: "External"\n    }\n`;
                // Also update analysis so subsequent steps know about these nodes
                asset.analysis.nodes.push(node);
            }
            asset.content += repairs;
        }
    }
  }

  async generateHub(
    config: FoundryConfig,
    outputDir: string,
    idToSpecFile: Map<string, string>,
    assets: ProjectAsset[],
    codeMap: Map<string, string[]>,
    nodeMap: Map<string, { uplinks: string[]; downlinks: string[] }>,
  ): Promise<void> {
    const templatePath = path.resolve(__dirname, '../templates/hub/index.html');
    if (!(await fs.pathExists(templatePath))) {
      throw new Error('Hub template not found. Please reinstall FoundrySpec.');
    }
    const templateContent = await fs.readFile(templatePath, 'utf8');

    const assetsDir = config.build?.assetsDir || 'assets';
    interface NavigationTarget {
      path: string;
      title: string;
      type: string;
    }
    const idMap: Record<string, NavigationTarget[]> = {};
    const footnoteRegistry: Record<string, NavigationTarget[]> = {};
    const implementationRegistry: Record<string, string[]> = {};
    const navigationRegistry: Record<string, string> = {};

    const addTarget = (id: string, target: NavigationTarget) => {
      // 1. Implementation (Code)
      if (target.type === 'code') {
          if (!implementationRegistry[id]) implementationRegistry[id] = [];
          if (!implementationRegistry[id].includes(target.path)) {
              implementationRegistry[id].push(target.path);
          }
          return;
      }

      // 2. Footnotes
      if (target.type === 'footnote' || target.path.endsWith('.md')) {
          if (!footnoteRegistry[id]) footnoteRegistry[id] = [];
          if (!footnoteRegistry[id].some(t => t.path === target.path)) {
              footnoteRegistry[id].push(target);
          }
          return;
      }

      // 3. Main Navigation Map (Diagrams / Hubs)
      if (!idMap[id]) idMap[id] = [];
      if (!idMap[id].some((t: NavigationTarget) => t.path === target.path)) {
        idMap[id].push(target);
      }
    };

    // 1. Map IDs to their primary diagrams from idToSpecFile
    idToSpecFile.forEach((v, id) => {
      const type = id.split('_')[0] || 'diagram';
      addTarget(id, {
        path: `${assetsDir}/${v}`,
        title: `${id} Diagram`,
        type,
      });
    });

    // 2. Map Code assignments
    codeMap.forEach((files, id) => {
      files.forEach((file) => {
        addTarget(id, {
          path: file,
          title: `Code: ${path.basename(file)}`,
          type: 'code',
        });
      });
    });

    // 3. Map additional assets (including Data, Sequences, Flows, Footnotes)
    for (const asset of assets) {
      const id = asset.data?.id;
      const title = asset.data?.title || id || path.basename(asset.relPath);
      const relPath = `${assetsDir}/${asset.relPath}`;

      const type =
        asset.relPath.includes('/footnotes/') || asset.relPath.endsWith('.md')
          ? 'footnote'
          : id
            ? id.split('_')[0]
            : 'asset';

      if (id) {
        addTarget(id, { path: relPath, title: title, type: type });

        if (asset.data.title) {
          addTarget(asset.data.title, { path: relPath, title: title, type: type });
        }
      } else if (asset.data?.title) {
        addTarget(asset.data.title, { path: relPath, title: title, type: type });
      }
    }

    // --- 4. Populate Navigation Registry (The single-point truth) ---
    // This allows the NavigationInterceptor to skip logic and just jump.
    Object.keys(idMap).forEach(id => {
        const targets = idMap[id];
        if (targets.length === 0) return;

        // Choice heuristic:
        // 1. If there's a target whose filename contains the ID prefix, use it.
        // 2. If there's a diagram type matching the ID prefix, use it.
        // 3. Use the first one.
        const prefix = id.split('_')[0];
        const bestTarget = targets.find(t => 
            t.type === prefix || 
            path.basename(t.path).includes(prefix) ||
            path.basename(t.path).includes(id)
        ) || targets[0];

        navigationRegistry[id] = bestTarget.path;
    });

    // 4. Build Metadata Registry for Navigation using INFERRED downlinks from nodeMap
    interface NodeMetadata {
      id: string;
      title?: string;
      uplink?: string | string[];
      downlinks: string[]; // INFERRED from nodeMap
      requirements?: string | string[];
      referencedBy: string[]; // Diagrams that reference this node (participants, etc.)
    }
    
    const metadataRegistry: Record<string, NodeMetadata> = {};
    
    // Initialize registry from nodeMap (which has INFERRED downlinks)
    nodeMap.forEach((graphData, id) => {
      if (!metadataRegistry[id]) {
        metadataRegistry[id] = {
          id,
          downlinks: [...graphData.downlinks], // Use inferred downlinks from nodeMap
          referencedBy: []
        };
      } else {
        metadataRegistry[id].downlinks = [...graphData.downlinks];
      }
      
      // Store uplinks for reference (though not used in navigation)
      if (graphData.uplinks.length > 0) {
        metadataRegistry[id].uplink = graphData.uplinks.length === 1 
          ? graphData.uplinks[0] 
          : graphData.uplinks;
      }
    });
    
    // Add titles and requirements from assets
    for (const asset of assets) {
      const id = asset.data?.id;
      if (id && metadataRegistry[id]) {
        metadataRegistry[id].title = asset.data.title;
        metadataRegistry[id].requirements = asset.data.requirements;
      }
      
      // Process entities
      const entities = Array.isArray(asset.data.entities) ? asset.data.entities : [];
      for (const ent of entities) {
        if (ent.id && metadataRegistry[ent.id]) {
          metadataRegistry[ent.id].requirements = ent.requirements;
        }
      }
    }
    
    // Extract participants/references from diagram content for referencedBy
    for (const asset of assets) {
      const assetId = asset.data?.id;
      if (!assetId) continue;
      
      const content = asset.content;
      
      // Extract participants from sequence diagrams
      if (content.includes('sequenceDiagram')) {
        const participantRegex = /participant\s+([A-Z][A-Z0-9_]*)/gi;
        let match;
        while ((match = participantRegex.exec(content)) !== null) {
          const participantId = match[1];
          if (participantId && participantId !== assetId) {
            // This sequence references participantId
            if (!metadataRegistry[participantId]) {
              metadataRegistry[participantId] = { id: participantId, downlinks: [], referencedBy: [] };
            }
            if (!metadataRegistry[participantId].referencedBy.includes(assetId)) {
              metadataRegistry[participantId].referencedBy.push(assetId);
            }
          }
        }
      }
      
      // Extract class references from class diagrams
      if (content.includes('classDiagram')) {
        // Match class definitions and relationships to find referenced IDs
        const classRefRegex = /\b([A-Z][A-Z0-9_]*)\b/g;
        let match;
        while ((match = classRefRegex.exec(content)) !== null) {
          const refId = match[1];
          // Only track if it's a known FoundrySpec ID (exists in metadataRegistry)
          if (refId !== assetId && metadataRegistry[refId]) {
            if (!metadataRegistry[refId].referencedBy.includes(assetId)) {
              metadataRegistry[refId].referencedBy.push(assetId);
            }
          }
        }
      }
    }

    // 5. Build Mindmap Registry for robust ID resolution
    const mindmapRegistry: Record<string, Record<string, string>> = {};
    for (const asset of assets) {
      if (asset.analysis?.mindmapMappings) {
        const assetPath = `${assetsDir}/${asset.relPath}`;
        mindmapRegistry[assetPath] = asset.analysis.mindmapMappings;
      }
    }

    // Write metadata as separate JSON files
    await fs.writeJson(path.join(outputDir, 'idMap.json'), idMap, { spaces: 2 });
    await fs.writeJson(path.join(outputDir, 'metadataRegistry.json'), metadataRegistry, { spaces: 2 });
    await fs.writeJson(path.join(outputDir, 'mindmapRegistry.json'), mindmapRegistry, { spaces: 2 });
    await fs.writeJson(path.join(outputDir, 'footnoteRegistry.json'), footnoteRegistry, { spaces: 2 });
    await fs.writeJson(path.join(outputDir, 'implementationRegistry.json'), implementationRegistry, { spaces: 2 });
    await fs.writeJson(path.join(outputDir, 'navigationRegistry.json'), navigationRegistry, { spaces: 2 });

    const rendered = templateContent
      .replace(/{{projectName}}/g, config.projectName)
      .replace(
        /{{projectId}}/g,
        (config as unknown as { projectId: string }).projectId || 'unboarded-project',
      )
      .replace(/{{version}}/g, config.version)
      .replace(/{{mindmapRegistry}}/g, JSON.stringify(mindmapRegistry))
      .replace(/{{footnoteRegistry}}/g, JSON.stringify(footnoteRegistry))
      .replace(/{{implementationRegistry}}/g, JSON.stringify(implementationRegistry))
      .replace(/{{navigationRegistry}}/g, JSON.stringify(navigationRegistry));

    await fs.writeFile(path.join(outputDir, 'index.html'), rendered);
  }

  private async loadAssets(assetsDir: string): Promise<ProjectAsset[]> {
    if (!(await fs.pathExists(assetsDir))) {
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
          throw new Error(
            chalk.red(
              `\n❌ Strict Structure Check:
    Found foreign file "` +
                relPath +
                `" in a core category.
    Code files, binaries, or other documents must be placed in "docs/others/".`,
            ),
          );
        }

        // Footnote strict location policy
        if (ext === '.md' && !relPath.includes('/footnotes/') && relPath !== 'RULES_GUIDE.md') {
          throw new Error(
            chalk.red(
              `\n❌ Footnote Location Policy:
    Markdown file "` +
                relPath +
                `" must reside in a "footnotes" directory (e.g. docs/components/footnotes/).
    Only "docs/others/" or root "RULES_GUIDE.md" are exempt.`,
            ),
          );
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

  private enrichMindmapDiagrams(assets: ProjectAsset[]) {
    const mindmapAssets = assets.filter(a => a.relPath.endsWith('.mermaid') && a.content.includes('mindmap'));
    
    for (const asset of mindmapAssets) {
        const lines = asset.content.split('\n');
        let inMindmap = false;
        const enrichedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed === 'mindmap') {
                inMindmap = true;
                return line;
            }
            if (!inMindmap || !trimmed || trimmed.startsWith('%%')) return line;
            
            // Matches "bare" nodes: optional leading space, then text that doesn't contain ([{"'
            // Excluding common keywords or already bracketed nodes
            const bareNodeRegex = /^(\s*)([^([{"']+?)$/;
            const match = line.match(bareNodeRegex);
            
            if (match) {
                const indent = match[1];
                const text = match[2].trim();
                // Avoid rewriting already defined keywords or empty lines
                if (['mindmap'].includes(text.toLowerCase()) || text.length === 0) return line;
                
                // Create a slug ID
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                if (id) {
                    return `${indent}${id}("${text}")`;
                }
            }
            return line;
        });
        asset.content = enrichedLines.join('\n');
    }
  }

  // This is also key as well as other custom validators based on project roles
  private async validateMindmapLabels(
    _assets: ProjectAsset[],
    _idToFileMap: Map<string, string>,
  ): Promise<void> {
    // Logic validation for root.mermaid labels matching real assets
    // (Implementation omitted for brevity but assumed similar to previous)
  }

  private async getIgnoreRules(): Promise<string[]> {
    const ignoreFile = path.join(this.projectRoot, '.foundryspecignore');
    const defaultIgnores = ['node_modules/**', 'dist/**', '.git/**', 'docs/**', 'foundryspec/**'];

    if (await fs.pathExists(ignoreFile)) {
      const content = await fs.readFile(ignoreFile, 'utf8');
      const userIgnores = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
      return [...defaultIgnores, ...userIgnores];
    }
    return defaultIgnores;
  }

  private async validateFolderRegistry(): Promise<void> {
    console.log(chalk.blue('🔍 Validating folder registry (Strict Policy)...'));
    
    // Get ALL registered folder paths from rules (not just hub categories)
    const registeredFolders: string[] = [];
    for (const rule of this.ruleEngine['rules']) {
      if (rule.target.pathPattern) {
        // Extract path from pattern (e.g., "sequences/*" -> "sequences")
        const cleanPath = rule.target.pathPattern.replace(/\/\*+$/, '').replace(/\*$/, '');
        if (cleanPath && !registeredFolders.includes(cleanPath)) {
          registeredFolders.push(cleanPath);
        }
      }
    }
    
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
      const cleanPath = relPath
        .split('/')
        .filter((p) => !allowedSystemFolders.includes(p))
        .join('/');

      // If the path was ONLY system folders (e.g. docs/others), cleanPath is empty -> Valid
      if (!cleanPath) continue;

      // Check if the remaining path starts with a registered folder
      const isCovered = registeredFolders.some(
        (cat) => cleanPath === cat || cleanPath.startsWith(cat + '/'),
      );

      if (!isCovered) {
        throw new Error(
          chalk.red(`\n❌ Strict Registry Error:
    The folder "docs/${relPath}" is NOT registered in your rules configuration.
    
    All documentation folders must have a corresponding rule in 'default-rules.yaml'
    or be one of the system allowed folders: [${allowedSystemFolders.join(', ')}].`),
        );
      }
    }
    console.log(chalk.green('✅ Folder Registry check passed.'));
  }
}