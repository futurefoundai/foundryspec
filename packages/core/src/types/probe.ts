/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

export interface ProbeResult {
    id: string;
    type: 'MISSING_IMPL' | 'ORPHAN_SPEC' | 'DRIFT';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    file?: string;
}
