/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class FlowchartAnalyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        const relationships: { from: string; to: string; label?: string }[] = [];
        const linkRegex = /^\s*([\w-]+)\s*(?:-->|--)\s*(?:\|(.*)\|)?\s*([\w-]+)/gm;
        const nodeDefRegex = /^\s*([\w-]+)(?:\[.*\]|\(.*\)|{{.*}}|\[\[.*\]\])?/gm;

        let match;
        while ((match = nodeDefRegex.exec(content)) !== null) {
            if (!['graph', 'flowchart', 'subgraph', 'end'].includes(match[1].toLowerCase())) {
                nodes.push(match[1]);
            }
        }
        while ((match = linkRegex.exec(content)) !== null) {
            relationships.push({ from: match[1], to: match[3], label: match[2] });
        }
        // Unique nodes
        const uniqueNodes = Array.from(new Set(nodes));
        return { nodes: uniqueNodes, relationships, type: 'flowchart' };
    }
}
