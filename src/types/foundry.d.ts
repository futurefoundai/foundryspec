export interface BuildConfig {
    outputDir: string;
    assetsDir: string;
}

export interface FoundryConfig {
    projectName: string;
    projectId: string;
    version: string;
    external: any[];
    build: BuildConfig;
}

export interface ProjectAsset {
    relPath: string;
    absPath: string;
    content: string;
    data: any;
}