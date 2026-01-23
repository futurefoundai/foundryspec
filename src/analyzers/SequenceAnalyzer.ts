/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class SequenceAnalyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        const relationships: { from: string; to: string; label?: string }[] = [];
        const actorRegex = /^\s*(?:actor|participant)\s+([\w-]+)/gm;
        const arrowRegex = /^\s*([\w-]+)\s*->>\s*([\w-]+)\s*:\s*(.*)/gm;

        let match;
        while ((match = actorRegex.exec(content)) !== null) {
            nodes.push(match[1]);
        }
        while ((match = arrowRegex.exec(content)) !== null) {
            relationships.push({ from: match[1], to: match[2], label: match[3] });
        }
        return { nodes, relationships, type: 'sequence' };
    }
}
