import {
    buildProfileMetrics,
    getHomeDynamicTargets,
    resolveDynamicTarget
} from '$lib/server/content/dynamic-sync';
import { getStaticHomeProjection, getStaticScholarProfile } from '$lib/server/content/home-adapter';
import { getStaticKnowledgeRegistry } from '$lib/server/content/knowledge-registry';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import { EXTERNAL_TOOL_CONFIG } from '$lib/server/tools/external-tool-config';
import type {
    HomeApiResponse,
    HomeDynamicMetricsPayload,
    HomeMetricsStreamResult,
    HomeStaticPayload
} from '$lib/types/home';
import type { Firestore } from 'fires2rest';

export const getHomeStaticPayload = (): HomeStaticPayload => {
    const { homePayload, homeUi, chatConfig } = getStaticHomeProjection();
    const registry = getStaticKnowledgeRegistry();

    return {
        contentVersion: registry.version,
        homePayload,
        homeUi,
        chatConfig
    };
};

export const getHomeMetricsPayload = async (
    db: Firestore,
    fetchFn: typeof fetch,
    config: RuntimeConfig
): Promise<HomeDynamicMetricsPayload> => {
    const scholar = getStaticScholarProfile();

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

    return {
        dynamicRevisions: {
            [`${githubSnapshot.source}:${githubSnapshot.entityKey}`]: githubSnapshot.revision,
            [`${huggingfaceSnapshot.source}:${huggingfaceSnapshot.entityKey}`]:
                huggingfaceSnapshot.revision
        },
        metrics: buildProfileMetrics(githubSnapshot, huggingfaceSnapshot, scholar)
    };
};

export const streamHomeMetrics = (
    db: Firestore,
    fetchFn: typeof fetch,
    config: RuntimeConfig
): Promise<HomeMetricsStreamResult> =>
    getHomeMetricsPayload(db, fetchFn, config)
        .then((data) => ({
            status: 'ready' as const,
            data
        }))
        .catch((error) => {
            console.error({
                scope: 'home',
                level: 'error',
                event: 'home_metrics_stream_failed',
                error: error instanceof Error ? error.message : 'Unknown home metrics failure'
            });

            return {
                status: 'error' as const,
                message: 'Live metrics are temporarily unavailable.'
            };
        });

export const getHomeApiPayload = async (
    db: Firestore,
    fetchFn: typeof fetch,
    config: RuntimeConfig
): Promise<HomeApiResponse> => {
    const [staticHome, dynamicHome] = await Promise.all([
        Promise.resolve(getHomeStaticPayload()),
        getHomeMetricsPayload(db, fetchFn, config)
    ]);

    return {
        contentVersion: staticHome.contentVersion,
        dynamicRevisions: dynamicHome.dynamicRevisions,
        homePayload: {
            ...staticHome.homePayload,
            metrics: dynamicHome.metrics
        },
        homeUi: staticHome.homeUi,
        chatConfig: staticHome.chatConfig
    };
};
