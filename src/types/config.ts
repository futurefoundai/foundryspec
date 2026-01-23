/**
 * © 2026 FutureFoundAI. All rights reserved.
 *
 * This software is distributed under the GNU Affero General Public License v3.0 (AGPLv3).
 */

export interface ExternalSpec {
    remote: string;
    target: string;
    branch: string;
}

export interface ProjectConfig {
    id: string;
    name: string;
    version: string;
    created: string;
    lastBuild?: string;
    external?: ExternalSpec[];
    categories: Array<{
        name: string;
        path: string;
        description: string;
    }>;
}

export interface GlobalStore {
    projects: Record<string, ProjectConfig>;
}

export interface BuildConfig {
    outputDir: string;
    assetsDir: string;
}

export interface FoundryConfig {
    projectName: string;
    projectId: string;
    version: string;
    external: ExternalSpec[];
    categories?: { name: string; path: string; description?: string }[];
    build: BuildConfig;
}
