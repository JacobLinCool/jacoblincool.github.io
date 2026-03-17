export type ExternalToolConfig = {
    timeoutMs: number;
    freshnessBySource: {
        githubUserSummaryMs: number;
        githubRepoDetailMs: number;
        githubRepoCatalogMs: number;
        huggingfaceUserSummaryMs: number;
        huggingfaceModelDetailMs: number;
        huggingfaceSpaceDetailMs: number;
    };
};

export const DEFAULT_EXTERNAL_TOOL_CONFIG: ExternalToolConfig = {
    timeoutMs: 6500,
    freshnessBySource: {
        githubUserSummaryMs: 30 * 60 * 1000,
        githubRepoDetailMs: 10 * 60 * 1000,
        githubRepoCatalogMs: 10 * 60 * 1000,
        huggingfaceUserSummaryMs: 30 * 60 * 1000,
        huggingfaceModelDetailMs: 10 * 60 * 1000,
        huggingfaceSpaceDetailMs: 10 * 60 * 1000
    }
};

export const EXTERNAL_TOOL_CONFIG: ExternalToolConfig = DEFAULT_EXTERNAL_TOOL_CONFIG;
