import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { ScaffoldManager } from '../src/ScaffoldManager';
import { BuildManager } from '../src/BuildManager';

// Utils
const TEST_DIR = path.resolve(__dirname, 'tmp_scaffold_test');
const MOCK_HOME = path.resolve(TEST_DIR, 'mock_home');

describe('Scaffold & Build Verification', () => {

    // Store original implementations to restore later if needed (though restoreAllMocks handles it)
    const originalCwd = process.cwd;
    
    beforeEach(async () => {
        await fs.emptyDir(TEST_DIR);
        await fs.ensureDir(MOCK_HOME);
        
        // Mock process.cwd() to return TEST_DIR
        vi.spyOn(process, 'cwd').mockReturnValue(TEST_DIR);

        // Mock os.homedir() to return MOCK_HOME (to isolate ConfigStore)
        vi.spyOn(os, 'homedir').mockReturnValue(MOCK_HOME);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        // Clean up
        if (await fs.pathExists(TEST_DIR)) {
            await fs.remove(TEST_DIR);
        }
    });

    it('should scaffold a new project and build it successfully without errors', async () => {
        // 1. Initialize Scaffold
        console.log('Scaffolding new project in:', TEST_DIR);
        const scaffolder = new ScaffoldManager('Test Integration Project');
        
        // init() uses process.cwd() which is mocked to TEST_DIR
        await scaffolder.init();

        // 2. Verify basic files exist
        const docsDir = path.join(TEST_DIR, 'docs');
        
        // Verify scaffold structure and critical files
        const coreReqPath = path.join(docsDir, 'requirements/REQ_Core.mermaid');
        expect(await fs.pathExists(coreReqPath)).toBe(true);
        expect(await fs.pathExists(path.join(docsDir, 'context/CTX_Main.mermaid'))).toBe(true);
        expect(await fs.pathExists(path.join(TEST_DIR, '.foundryid'))).toBe(true);
        expect(await fs.pathExists(path.join(TEST_DIR, '.gitignore'))).toBe(true);

        // Verify .foundryspec (global config) was created in MOCK_HOME
        const globalConfigPath = path.join(MOCK_HOME, '.foundryspec/projects.json');
        expect(await fs.pathExists(globalConfigPath)).toBe(true);

        const projectId = (await fs.readFile(path.join(TEST_DIR, '.foundryid'), 'utf8')).trim();
        expect(projectId).toBeTruthy();

        // 3. Initialize Build Manager
        // BuildManager will read .foundryid from cwd (mocked) and verify against config in mock home.
        const builder = new BuildManager(TEST_DIR); 

        // 4. Run Build
        console.log('Building project...');
        // The build method throws if validation fails.
        // We expect it to PASS since we just verified/fixed the templates.
        await expect(builder.build()).resolves.not.toThrow();
        
        // 5. Verify Build Output
        // The build output goes to ~/.foundryspec/builds/<id> (MOCK_HOME)
        const buildOutputDir = path.join(MOCK_HOME, '.foundryspec/builds', projectId);
        expect(await fs.pathExists(buildOutputDir)).toBe(true);
        expect(await fs.pathExists(path.join(buildOutputDir, 'assets'))).toBe(true);
        expect(await fs.pathExists(path.join(buildOutputDir, 'index.html'))).toBe(true);
        // Verify key assets were copied
        expect(await fs.pathExists(path.join(buildOutputDir, 'assets/root.mermaid'))).toBe(true);
        expect(await fs.pathExists(path.join(buildOutputDir, 'assets/requirements/REQ_Core.mermaid'))).toBe(true);
        
        // Verify HUB Integrity (Refactored location)
        expect(await fs.pathExists(path.join(buildOutputDir, 'index.css'))).toBe(true);
        expect(await fs.pathExists(path.join(buildOutputDir, 'index.js'))).toBe(true);
        
        // Verify index.html contains critical UI elements
        const indexHtml = await fs.readFile(path.join(buildOutputDir, 'index.html'), 'utf8');
        expect(indexHtml).toContain('id="footnote-sidebar"'); // Footnote sidebar
        expect(indexHtml).toContain('id="menu-state"');       // State support
        
        // Verify index.js contains key functions
        const indexJs = await fs.readFile(path.join(buildOutputDir, 'index.js'), 'utf8');
        expect(indexJs).toContain('function openFootnoteSidebar');
        expect(indexJs).toContain('function appendPrompt');
    }, 60000); // Increased timeout for build
});
