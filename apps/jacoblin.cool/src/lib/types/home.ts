import type { PromptChip } from '$lib/types/chat';

export type DeepDivePrompt = {
    id: string;
    targetItemId: string;
    label: string;
    prompt: string;
};

export type ResearchQuestionCard = {
    id: string;
    title: string;
    question: string;
    whyItMatters: string;
    currentDirection: string;
};

export type PublicationHighlight = {
    id: string;
    title: string;
    authors: string;
    venue: string;
    year: number;
    citations: number;
    impact: string;
    summary: string;
    url: string;
    tags: string[];
};

export type FeaturedProject = {
    id: string;
    name: string;
    description: string;
    url: string;
    language: string;
    stars: number;
    updatedAt: string;
};

export type ProfileMetricsSnapshot = {
    github: {
        followers: number;
        publicRepos: number;
        totalStars: number;
        topRepo: {
            name: string;
            stars: number;
            url: string;
        };
        refreshedAt: string;
    };
    huggingface: {
        models: number;
        spaces: number;
        totalModelDownloads: number;
        topModel: {
            id: string;
            downloads: number;
        };
        topSpace: {
            id: string;
            likes: number;
        };
        refreshedAt: string;
    };
    scholar: {
        profileUrl: string;
        citations: number;
        hIndex: number;
        i10Index: number;
        topics: string[];
    };
};

export type HomeSectionPayload = {
    metrics: ProfileMetricsSnapshot;
    researchQuestions: ResearchQuestionCard[];
    publications: PublicationHighlight[];
    projects: FeaturedProject[];
};

export type HomeSectionConfig = {
    id: string;
    rootNodeId: string;
    variant: 'research-cards' | 'publication-rail' | 'project-rail';
    maxItems: number;
    eyebrow: string;
    heading: string;
    description: string;
    ctaLabel: string;
};

export type HomeUiConfig = {
    sections: Record<string, HomeSectionConfig>;
};

export type ChatContentConfig = {
    taglines: string[];
    promptChips: PromptChip[];
    deepDivePromptsByItemId: Record<string, DeepDivePrompt>;
};

export type HomeApiResponse = {
    contentVersion: string;
    dynamicRevisions: Record<string, string>;
    homePayload: HomeSectionPayload;
    homeUi: HomeUiConfig;
    chatConfig: ChatContentConfig;
};
