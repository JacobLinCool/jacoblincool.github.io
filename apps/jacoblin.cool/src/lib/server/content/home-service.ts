import {
    buildProfileMetrics,
    getHomeDynamicTargets,
    resolveDynamicTarget
} from '$lib/server/content/dynamic-sync';
import { getStaticHomeProjection, getStaticScholarProfile } from '$lib/server/content/home-adapter';
import { getStaticKnowledgeRegistry } from '$lib/server/content/knowledge-registry';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { EXTERNAL_TOOL_CONFIG } from '$lib/server/tools/external-tool-config';
import type { HomeApiResponse } from '$lib/types/home';
import type { Firestore } from 'fires2rest';

export const getHomeApiPayload = async (
    db: Firestore,
    fetchFn: typeof fetch,
    config: RuntimeConfig
): Promise<HomeApiResponse> => {
    const [{ homePayload, homeUi, chatConfig }, scholar] = await Promise.all([
        Promise.resolve(getStaticHomeProjection()),
        Promise.resolve(getStaticScholarProfile())
    ]);

    const [githubSnapshot, huggingfaceSnapshot] = await Promise.all(
        getHomeDynamicTargets(config).map((target) =>
            resolveDynamicTarget({
                db,
                fetchFn,
                config,
                externalToolConfig: EXTERNAL_TOOL_CONFIG,
                target
            })
        )
    );

    const metrics = buildProfileMetrics(githubSnapshot, huggingfaceSnapshot, scholar);
    const registry = getStaticKnowledgeRegistry();

    return {
        contentVersion: registry.version,
        dynamicRevisions: {
            [`${githubSnapshot.source}:${githubSnapshot.entityKey}`]: githubSnapshot.revision,
            [`${huggingfaceSnapshot.source}:${huggingfaceSnapshot.entityKey}`]:
                huggingfaceSnapshot.revision
        },
        homePayload: {
            researchQuestions: homePayload.researchQuestions,
            publications: homePayload.publications,
            projects: homePayload.projects,
            metrics
        },
        homeUi,
        chatConfig
    };
};
