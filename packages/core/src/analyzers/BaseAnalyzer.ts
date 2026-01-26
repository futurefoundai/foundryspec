/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

export interface DiagramAnalysis {
    nodes: string[];
    relationships: { from: string; to: string; label?: string }[];
    type: string;
}

export abstract class DiagramAnalyzer {
    abstract analyze(content: string): DiagramAnalysis;
}
