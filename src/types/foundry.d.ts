export interface BuildConfig {
    outputDir: string;
    assetsDir: string;
}

export interface ExternalSpec {
    remote: string;
    target: string;
    branch?: string;
}

export interface FoundryConfig {
    projectName: string;
    projectId: string;
    version: string;
    external: ExternalSpec[];
    categories?: { name: string; path: string; description?: string }[];
    build: BuildConfig;
}

export interface ProjectAsset {
    relPath: string;
    absPath: string;
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any; // Frontmatter data is loosely typed
}