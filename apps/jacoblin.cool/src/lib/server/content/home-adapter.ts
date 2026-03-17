import {
    collectDescendantItemIds,
    getStaticKnowledgeRegistry,
    getStaticSiteUiConfig,
    type KnowledgeItem
} from '$lib/server/content/knowledge-registry';
import type {
    ChatContentConfig,
    FeaturedProject,
    HomeSectionPayload,
    HomeUiConfig,
    ProfileMetricsSnapshot,
    PublicationHighlight,
    ResearchQuestionCard
} from '$lib/types/home';
import { applySpecialOccasionPromptChips } from '@jacoblincool/agent';

const invariant = (condition: unknown, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
};

const getBodySectionText = (item: KnowledgeItem, sectionId: string): string => {
    const section = item.body.find((entry) => entry.id === sectionId);
    if (!section?.text) {
        throw new Error(`Missing body section "${sectionId}" on item ${item.id}`);
    }
    return section.text;
};

const getStringAttribute = (item: KnowledgeItem, key: string): string => {
    const value = item.attributes[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Missing string attribute "${key}" on ${item.id}`);
    }
    return value;
};

const getNumberAttribute = (item: KnowledgeItem, key: string): number => {
    const value = item.attributes[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Missing number attribute "${key}" on ${item.id}`);
    }
    return value;
};

const getStringArrayAttribute = (item: KnowledgeItem, key: string): string[] => {
    const value = item.attributes[key];
    if (!Array.isArray(value)) {
        throw new Error(`Missing array attribute "${key}" on ${item.id}`);
    }
    const strings = value.filter(
        (entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0
    );
    if (strings.length !== value.length) {
        throw new Error(`Invalid string array attribute "${key}" on ${item.id}`);
    }
    return strings;
};

const getRequiredLink = (item: KnowledgeItem, kind: string): string => {
    const link = item.links.find((entry) => entry.kind === kind);
    if (!link?.url) {
        throw new Error(`Missing "${kind}" link on ${item.id}`);
    }
    return link.url;
};

const requireRegistryItem = (
    itemsById: Record<string, KnowledgeItem>,
    itemId: string
): KnowledgeItem => {
    const item = itemsById[itemId];
    if (!item) {
        throw new Error(`Unknown knowledge item: ${itemId}`);
    }
    return item;
};

const toResearchQuestionCard = (item: KnowledgeItem): ResearchQuestionCard => {
    invariant(
        item.type === 'research-question',
        `Expected research-question item, got ${item.type} (${item.id})`
    );
    return {
        id: item.id,
        title: item.title,
        question: getBodySectionText(item, 'question'),
        whyItMatters: getBodySectionText(item, 'why-it-matters'),
        currentDirection: getBodySectionText(item, 'current-direction')
    };
};

const toPublicationHighlight = (item: KnowledgeItem): PublicationHighlight => {
    invariant(
        item.type === 'publication',
        `Expected publication item, got ${item.type} (${item.id})`
    );
    return {
        id: item.id,
        title: item.title,
        authors: getStringAttribute(item, 'authors'),
        venue: getStringAttribute(item, 'venue'),
        year: getNumberAttribute(item, 'year'),
        citations: getNumberAttribute(item, 'citations'),
        impact: getBodySectionText(item, 'contribution'),
        summary: getBodySectionText(item, 'summary'),
        url: getRequiredLink(item, 'paper'),
        tags: item.tags
    };
};

const toFeaturedProject = (item: KnowledgeItem): FeaturedProject => {
    invariant(item.type === 'project', `Expected project item, got ${item.type} (${item.id})`);
    return {
        id: item.id,
        name: item.title,
        description: item.summary,
        url: getRequiredLink(item, 'repository'),
        language: getStringAttribute(item, 'language'),
        stars: getNumberAttribute(item, 'stars'),
        updatedAt: getStringAttribute(item, 'updatedAt')
    };
};

export const getStaticScholarProfile = (): ProfileMetricsSnapshot['scholar'] => {
    const registry = getStaticKnowledgeRegistry();
    const scholarItem = requireRegistryItem(registry.itemsById, registry.metricsProfileItemId);
    invariant(
        scholarItem.type === 'profile',
        `Metrics profile item must be profile type: ${scholarItem.id}`
    );

    return {
        profileUrl: getStringAttribute(scholarItem, 'profileUrl'),
        citations: getNumberAttribute(scholarItem, 'citations'),
        hIndex: getNumberAttribute(scholarItem, 'hIndex'),
        i10Index: getNumberAttribute(scholarItem, 'i10Index'),
        topics: getStringArrayAttribute(scholarItem, 'topics')
    };
};

export const getStaticHomeProjection = (): {
    homePayload: Omit<HomeSectionPayload, 'metrics'>;
    homeUi: HomeUiConfig;
    chatConfig: ChatContentConfig;
} => {
    return getStaticHomeProjectionForDate(new Date());
};

export const getStaticHomeProjectionForDate = (
    now: Date
): {
    homePayload: Omit<HomeSectionPayload, 'metrics'>;
    homeUi: HomeUiConfig;
    chatConfig: ChatContentConfig;
} => {
    const registry = getStaticKnowledgeRegistry();
    const siteUi = getStaticSiteUiConfig();

    const requireDeepDiveBinding = (itemId: string) => {
        const prompt = registry.deepDivePromptByItemId[itemId];
        invariant(prompt, `Missing deep dive prompt binding for item ${itemId}`);
        return prompt;
    };

    const researchSection = registry.homepageSectionBindings.research;
    const publicationSection = registry.homepageSectionBindings.publications;
    const projectSection = registry.homepageSectionBindings.projects;

    invariant(researchSection, 'Missing homepage research section binding.');
    invariant(publicationSection, 'Missing homepage publications section binding.');
    invariant(projectSection, 'Missing homepage projects section binding.');

    const researchQuestions = collectDescendantItemIds(registry, researchSection.rootNodeId)
        .slice(0, researchSection.maxItems)
        .map((itemId) => {
            requireDeepDiveBinding(itemId);
            return toResearchQuestionCard(requireRegistryItem(registry.itemsById, itemId));
        });

    const publications = collectDescendantItemIds(registry, publicationSection.rootNodeId)
        .slice(0, publicationSection.maxItems)
        .map((itemId) => {
            requireDeepDiveBinding(itemId);
            return toPublicationHighlight(requireRegistryItem(registry.itemsById, itemId));
        });

    const projects = collectDescendantItemIds(registry, projectSection.rootNodeId)
        .slice(0, projectSection.maxItems)
        .map((itemId) => {
            requireDeepDiveBinding(itemId);
            return toFeaturedProject(requireRegistryItem(registry.itemsById, itemId));
        });

    return {
        homePayload: {
            researchQuestions,
            publications,
            projects
        },
        homeUi: {
            sections: siteUi.homepage.sections
        },
        chatConfig: {
            taglines: siteUi.chat.taglines,
            promptChips: applySpecialOccasionPromptChips(siteUi.chat.promptChips, now),
            deepDivePromptsByItemId: siteUi.chat.deepDivePromptByItemId
        }
    };
};
