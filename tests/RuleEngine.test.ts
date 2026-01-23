import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleEngine } from '../src/RuleEngine';
import { ProjectAsset } from '../src/types/assets';
import fs from 'fs-extra';
vi.mock('fs-extra');

describe('RuleEngine', () => {
    let engine: RuleEngine;

    beforeEach(() => {
        engine = new RuleEngine();
        vi.clearAllMocks();
    });

    it('should identify rule violations in assets', async () => {
        const mockYaml = `
rules:
  - id: test-rule
    name: Test Rule
    target:
      idPrefix: TEST_
    type: structural
    enforcement: error
    checks:
      mermaidType: mindmap
      requiredNodes: [NodeA]
`;
        vi.mocked(fs.pathExists).mockResolvedValue(true as never);
        vi.mocked(fs.readFile).mockResolvedValue(mockYaml as never);

        await engine.loadRules('mock/path');

        const invalidAsset: ProjectAsset = {
            relPath: 'test.mermaid',
            absPath: '/abs/test.mermaid',
            content: 'mindmap\n  root\n    NodeB',
            data: { id: 'TEST_1', title: 'Test', description: 'Test' }
        };

        expect(() => engine.validateAsset(invalidAsset)).toThrow('Build failed due to rule violations.');

        const validAsset: ProjectAsset = {
            relPath: 'test.mermaid',
            absPath: '/abs/test.mermaid',
            content: 'mindmap\n  root\n    NodeA',
            data: { id: 'TEST_1', title: 'Test', description: 'Test' }
        };

        expect(() => engine.validateAsset(validAsset)).not.toThrow();
    });

    it('should respect enforcement levels', async () => {
         const mockYaml = `
rules:
  - id: warn-rule
    name: Warn Rule
    target:
      idPrefix: WARN_
    type: syntax
    enforcement: warning
    checks:
      mermaidType: mindmap
`;
        vi.mocked(fs.pathExists).mockResolvedValue(true as never);
        vi.mocked(fs.readFile).mockResolvedValue(mockYaml as never);

        await engine.loadRules('mock/path');

        const invalidAsset: ProjectAsset = {
            relPath: 'warn.mermaid',
            absPath: '/abs/warn.mermaid',
            content: 'graph TD',
            data: { id: 'WARN_1', title: 'Warn', description: 'Warn' }
        };

        // Should NOT throw because it's a warning
        expect(() => engine.validateAsset(invalidAsset)).not.toThrow();
    });

    it('should use specialized analyzers for Sequence diagrams', async () => {
        const mockYaml = `
rules:
  - id: seq-rule
    name: Sequence Rule
    target:
      idPrefix: JRN_
    type: structural
    enforcement: error
    checks:
      mermaidType: sequenceDiagram
      requiredNodes: [User, System]
`;
        vi.mocked(fs.pathExists).mockResolvedValue(true as never);
        vi.mocked(fs.readFile).mockResolvedValue(mockYaml as never);

        await engine.loadRules('mock/path');

        const invalidAsset: ProjectAsset = {
            relPath: 'journey.mermaid',
            absPath: '/abs/journey.mermaid',
            content: 'sequenceDiagram\n  actor User\n  User->>System: Login',
            data: { id: 'JRN_1', title: 'Journey', description: 'Journey' }
        };

        // Missing 'System' actor/participant definition
        expect(() => engine.validateAsset(invalidAsset)).toThrow('Build failed due to rule violations.');

        const validAsset: ProjectAsset = {
            relPath: 'journey.mermaid',
            absPath: '/abs/journey.mermaid',
            content: 'sequenceDiagram\n  actor User\n  participant System\n  User->>System: Login',
            data: { id: 'JRN_1', title: 'Journey', description: 'Journey' }
        };

        expect(() => engine.validateAsset(validAsset)).not.toThrow();
    });

    it('should use specialized analyzers for Requirement diagrams', async () => {
        const mockYaml = `
rules:
  - id: req-rule
    name: Requirement Rule
    target:
      idPrefix: REQ_
    type: structural
    enforcement: error
    checks:
      mermaidType: requirementDiagram
      requiredNodes: [FunctionalReq]
`;
        vi.mocked(fs.pathExists).mockResolvedValue(true as never);
        vi.mocked(fs.readFile).mockResolvedValue(mockYaml as never);

        await engine.loadRules('mock/path');

        const invalidAsset: ProjectAsset = {
            relPath: 'req.mermaid',
            absPath: '/abs/req.mermaid',
            content: 'requirementDiagram\n  requirement OtherReq { id: "1" }',
            data: { id: 'REQ_1', title: 'Req', description: 'Req' }
        };

        expect(() => engine.validateAsset(invalidAsset)).toThrow('Build failed due to rule violations.');

        const validAsset: ProjectAsset = {
            relPath: 'req.mermaid',
            absPath: '/abs/req.mermaid',
            content: 'requirementDiagram\n  functionalRequirement FunctionalReq { id: "1" }',
            data: { id: 'REQ_1', title: 'Req', description: 'Req' }
        };

        expect(() => engine.validateAsset(validAsset)).not.toThrow();
    });
});
