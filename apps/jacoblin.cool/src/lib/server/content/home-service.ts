import type { Firestore } from 'fires2rest';
import type { HomeApiResponse } from '$lib/types/home';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { getPublishedContent } from '$lib/server/repos/content-repository';
import { getToolPolicy } from '$lib/server/repos/tool-policy-repository';
import {
    buildProfileMetrics,
    getHomeDynamicTargets,
    resolveDynamicTarget
} from '$lib/server/content/dynamic-sync';

export const getHomeApiPayload = async (
    db: Firestore,
    fetchFn: typeof fetch,
    config: RuntimeConfig,
    locale: string
): Promise<HomeApiResponse> => {
    const [published, policy] = await Promise.all([
        getPublishedContent(db, locale),
        getToolPolicy(db)
    ]);

    const [githubSnapshot, huggingfaceSnapshot] = await Promise.all(
        getHomeDynamicTargets(config).map((target) =>
            resolveDynamicTarget({
                db,
                fetchFn,
                config,
                policy,
                target
            })
        )
    );

    const metrics = buildProfileMetrics(
        githubSnapshot,
        huggingfaceSnapshot,
        published.bundle.home.scholar
    );

    return {
        contentVersion: published.versionId,
        dynamicRevisions: {
            [`${githubSnapshot.source}:${githubSnapshot.entityKey}`]: githubSnapshot.revision,
            [`${huggingfaceSnapshot.source}:${huggingfaceSnapshot.entityKey}`]:
                huggingfaceSnapshot.revision
        },
        homePayload: {
            researchQuestions: published.bundle.home.researchQuestions,
            publications: published.bundle.home.publications,
            projects: published.bundle.home.projects,
            demos: published.bundle.home.demos,
            nextSteps: published.bundle.home.nextSteps,
            metrics
        },
        chatConfig: published.bundle.chat
    };
};
