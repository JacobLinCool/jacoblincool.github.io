export type ExternalToolConfig = {
    timeoutMs: number;
    freshnessBySource: {
        githubUserSummaryMs: number;
        githubRepoDetailMs: number;
        huggingfaceUserSummaryMs: number;
        huggingfaceModelDetailMs: number;
        huggingfaceSpaceDetailMs: number;
    };
};

export const EXTERNAL_TOOL_CONFIG: ExternalToolConfig = {
    timeoutMs: 6500,
    freshnessBySource: {
        githubUserSummaryMs: 30 * 60 * 1000,
        githubRepoDetailMs: 10 * 60 * 1000,
        huggingfaceUserSummaryMs: 30 * 60 * 1000,
        huggingfaceModelDetailMs: 10 * 60 * 1000,
        huggingfaceSpaceDetailMs: 10 * 60 * 1000
    }
};
