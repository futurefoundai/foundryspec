/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

import { DiagramAnalyzer, DiagramAnalysis } from './BaseAnalyzer.js';

export class MindmapAnalyzer extends DiagramAnalyzer {
    analyze(content: string): DiagramAnalysis {
        const nodes: string[] = [];
        // Extract nodes: handle both "id" and "id((label))" or "id(label)" formats
        const nodeRegex = /^\s*([\w-]+)(?:\((?:\((?:.*)\)|(?:.*))\))?/gm;
        let match;
        while ((match = nodeRegex.exec(content)) !== null) {
            if (match[1] && !['mindmap', 'root'].includes(match[1].toLowerCase())) {
                nodes.push(match[1]);
            }
        }
        return { nodes, relationships: [], type: 'mindmap' };
    }
}
