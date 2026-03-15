import { type Firestore } from 'fires2rest';
import type { HomeCurationPayload } from '$lib/types/home';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { getPublishedContent } from '$lib/server/repos/content-repository';
import { resolveDynamicTarget, type DynamicTarget } from '$lib/server/content/dynamic-sync';
import type { DynamicSnapshotRecord } from '$lib/server/repos/dynamic-snapshot-repository';
import type { ToolPolicy } from '$lib/server/repos/tool-policy-repository';
import {
    getEntityKeyFromGithubUrl,
    getEntityKeyFromHuggingFaceUrl
} from '$lib/server/content/dynamic-sync';

type ToolEventHandler = (event: {
    type: 'tool_call_started' | 'tool_call_succeeded' | 'tool_call_failed';
    tool: 'github' | 'huggingface';
    entityKey: string;
    revision?: string;
    error?: string;
}) => Promise<void>;

type ContextBuilderInput = {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    policy: ToolPolicy;
    locale: string;
    query: string;
    onToolEvent?: ToolEventHandler;
};

export type ContextBundle = {
    id: string;
    contentVersion: string;
    locale: string;
    refs: string[];
    dynamicRevisions: Record<string, string>;
    contextText: string;
    dynamicSnapshots: DynamicSnapshotRecord[];
};

type KnowledgeEntry = {
    ref: string;
    tags: string[];
    text: string;
};

const normalize = (value: string) => value.toLowerCase().trim();

const tokenize = (value: string) =>
    normalize(value)
        .split(/[^a-z0-9_\-/]+/)
        .filter((token) => token.length >= 2);

const buildKnowledgeEntries = (home: HomeCurationPayload): KnowledgeEntry[] => {
    const entries: KnowledgeEntry[] = [];

    for (const item of home.researchQuestions) {
        entries.push({
            ref: `research:${item.id}`,
            tags: [item.id, item.title, item.promptId],
            text: `${item.title}\n${item.question}\n${item.whyItMatters}\n${item.currentDirection}`
        });
    }

    for (const item of home.publications) {
        entries.push({
            ref: `publication:${item.id}`,
            tags: [item.id, item.title, item.venue, ...item.tags, item.promptId],
            text: `${item.title}\n${item.authors}\n${item.venue}\n${item.impact}\n${item.summary}`
        });
    }

    for (const item of home.projects) {
        entries.push({
            ref: `project:${item.id}`,
            tags: [item.id, item.name, item.language, item.promptId],
            text: `${item.name}\n${item.description}\n${item.url}\nstars=${item.stars}`
        });
    }

    for (const item of home.demos) {
        entries.push({
            ref: `demo:${item.id}`,
            tags: [item.id, item.name, item.promptId],
            text: `${item.name}\n${item.description}\n${item.url}\nlikes=${item.likes}\ndownloads=${item.downloads}`
        });
    }

    for (const item of home.nextSteps) {
        entries.push({
            ref: `next_step:${item.id}`,
            tags: [item.id, item.title, item.promptId],
            text: `${item.title}\n${item.description}`
        });
    }

    entries.push({
        ref: 'scholar:profile',
        tags: ['scholar', ...home.scholar.topics],
        text: `Citations=${home.scholar.citations}\nH-index=${home.scholar.hIndex}\ni10-index=${home.scholar.i10Index}\nTopics=${home.scholar.topics.join(', ')}`
    });

    return entries;
};

const selectRelevantEntries = (home: HomeCurationPayload, query: string): KnowledgeEntry[] => {
    const entries = buildKnowledgeEntries(home);
    const queryTokens = new Set(tokenize(query));

    if (queryTokens.size === 0) {
        return entries.slice(0, 8);
    }

    const scored = entries
        .map((entry) => {
            const tokenPool = tokenize(`${entry.tags.join(' ')} ${entry.text}`);
            let score = 0;
            for (const token of tokenPool) {
                if (queryTokens.has(token)) {
                    score += 1;
                }
            }
            return { entry, score };
        })
        .sort((left, right) => right.score - left.score);

    const selected = scored.filter((item) => item.score > 0).slice(0, 10).map((item) => item.entry);
    return selected.length > 0 ? selected : entries.slice(0, 8);
};

const createDynamicTargets = (
    home: HomeCurationPayload,
    query: string,
    config: RuntimeConfig
): DynamicTarget[] => {
    const text = normalize(query);
    const targets: DynamicTarget[] = [];

    const asksGithubSummary =
        text.includes('github') ||
        text.includes('star') ||
        text.includes('follower') ||
        text.includes('repo') ||
        text.includes('repository');

    const asksHuggingFaceSummary =
        text.includes('huggingface') ||
        text.includes('space') ||
        text.includes('model') ||
        text.includes('download');

    if (asksGithubSummary) {
        targets.push({
            kind: 'github_user_summary',
            source: 'github',
            entityKey: `user:${config.githubUser.toLowerCase()}`
        });
    }

    if (asksHuggingFaceSummary) {
        targets.push({
            kind: 'huggingface_user_summary',
            source: 'huggingface',
            entityKey: `user:${config.huggingfaceUser.toLowerCase()}`
        });
    }

    for (const project of home.projects) {
        const repoEntityKey = getEntityKeyFromGithubUrl(project.url);
        if (!repoEntityKey) {
            continue;
        }

        const projectTokens = tokenize(`${project.name} ${repoEntityKey}`);
        if (!projectTokens.some((token) => text.includes(token))) {
            continue;
        }

        targets.push({
            kind: 'github_repo_detail',
            source: 'github',
            entityKey: repoEntityKey
        });
    }

    for (const demo of home.demos) {
        const parsed = getEntityKeyFromHuggingFaceUrl(demo.url);
        if (!parsed) {
            continue;
        }

        const demoTokens = tokenize(`${demo.name} ${parsed.id}`);
        if (!demoTokens.some((token) => text.includes(token))) {
            continue;
        }

        if (parsed.type === 'space') {
            targets.push({
                kind: 'huggingface_space_detail',
                source: 'huggingface',
                entityKey: parsed.id
            });
        } else {
            targets.push({
                kind: 'huggingface_model_detail',
                source: 'huggingface',
                entityKey: parsed.id
            });
        }
    }

    const deduped = new Map<string, DynamicTarget>();
    for (const target of targets) {
        deduped.set(`${target.kind}:${target.entityKey}`, target);
    }

    return [...deduped.values()];
};

const buildContextText = (
    query: string,
    entries: KnowledgeEntry[],
    dynamicSnapshots: DynamicSnapshotRecord[]
) => {
    const staticSection = entries
        .map((entry) => `### ${entry.ref}\n${entry.text}`)
        .join('\n\n');

    const dynamicSection = dynamicSnapshots
        .map(
            (snapshot) =>
                `### dynamic:${snapshot.source}:${snapshot.entityKey} (revision=${snapshot.revision})\n${JSON.stringify(snapshot.payload, null, 2)}`
        )
        .join('\n\n');

    return [
        'You are Jacob Lin website assistant.',
        'Use grounded content first. If extra knowledge is used, explicitly mark it as supplemental in prose.',
        'Do not invent unverifiable metrics or project details.',
        `User query:\n${query}`,
        `\n[GROUNDING_STATIC]\n${staticSection}`,
        dynamicSection ? `\n[GROUNDING_DYNAMIC]\n${dynamicSection}` : ''
    ]
        .filter(Boolean)
        .join('\n\n');
};

const createContextBundleId = () => `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const buildContextBundle = async (input: ContextBuilderInput): Promise<ContextBundle> => {
    const published = await getPublishedContent(input.db, input.locale);
    const relevantEntries = selectRelevantEntries(published.bundle.home, input.query);

    const candidateTargets = createDynamicTargets(published.bundle.home, input.query, input.config).slice(
        0,
        input.policy.maxCallsPerTurn
    );

    const dynamicSnapshots: DynamicSnapshotRecord[] = [];
    for (const target of candidateTargets) {
        const snapshot = await resolveDynamicTarget({
            db: input.db,
            fetchFn: input.fetchFn,
            config: input.config,
            policy: input.policy,
            target,
            onToolEvent: input.onToolEvent
        });
        dynamicSnapshots.push(snapshot);
    }

    const dynamicRevisions: Record<string, string> = {};
    for (const snapshot of dynamicSnapshots) {
        dynamicRevisions[`${snapshot.source}:${snapshot.entityKey}`] = snapshot.revision;
    }

    const contextText = buildContextText(input.query, relevantEntries, dynamicSnapshots);
    const bundleId = createContextBundleId();

    await input.db.doc(`context_bundles/${bundleId}`).set({
        id: bundleId,
        contentVersion: published.versionId,
        locale: published.locale,
        refs: relevantEntries.map((entry) => entry.ref),
        dynamicRevisions,
        contextText,
        createdAt: new Date().toISOString()
    });

    return {
        id: bundleId,
        contentVersion: published.versionId,
        locale: published.locale,
        refs: relevantEntries.map((entry) => entry.ref),
        dynamicRevisions,
        contextText,
        dynamicSnapshots
    };
};
