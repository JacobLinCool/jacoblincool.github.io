import type { PromptChip } from '$lib/types/chat';

export type DeepDivePromptId = string;

export type DeepDivePrompt = {
    id: DeepDivePromptId;
    label: string;
    prompt: string;
};

export type ResearchQuestionCard = {
    id: string;
    title: string;
    question: string;
    whyItMatters: string;
    currentDirection: string;
    promptId: DeepDivePromptId;
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
    promptId: DeepDivePromptId;
};

export type FeaturedProject = {
    id: string;
    name: string;
    description: string;
    url: string;
    language: string;
    stars: number;
    updatedAt: string;
    promptId: DeepDivePromptId;
};

export type FeaturedDemo = {
    id: string;
    name: string;
    description: string;
    url: string;
    likes: number;
    downloads: number;
    promptId: DeepDivePromptId;
};

export type NextStepCta = {
    id: string;
    title: string;
    description: string;
    ctaLabel: string;
    promptId: DeepDivePromptId;
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
    demos: FeaturedDemo[];
    nextSteps: NextStepCta[];
};

export type HomeCurationPayload = Omit<HomeSectionPayload, 'metrics'> & {
    scholar: ProfileMetricsSnapshot['scholar'];
};

export type ChatContentConfig = {
    taglines: string[];
    promptChips: PromptChip[];
    deepDivePrompts: Record<string, DeepDivePrompt>;
};

export type HomeApiResponse = {
    contentVersion: string;
    dynamicRevisions: Record<string, string>;
    homePayload: HomeSectionPayload;
    chatConfig: ChatContentConfig;
};

export type CanonicalContentBundle = {
    locale: string;
    versionId: string;
    updatedAt: string;
    home: HomeCurationPayload;
    chat: ChatContentConfig;
};
