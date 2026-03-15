import { FieldValue, type Firestore } from 'fires2rest';

export type ToolPolicy = {
    maxCallsPerTurn: number;
    timeoutMs: number;
    enabledTools: Array<'github' | 'huggingface'>;
    freshnessBySource: {
        githubUserSummaryMs: number;
        githubRepoDetailMs: number;
        huggingfaceUserSummaryMs: number;
        huggingfaceModelDetailMs: number;
        huggingfaceSpaceDetailMs: number;
    };
};

const DEFAULT_POLICY: ToolPolicy = {
    maxCallsPerTurn: 2,
    timeoutMs: 6500,
    enabledTools: ['github', 'huggingface'],
    freshnessBySource: {
        githubUserSummaryMs: 30 * 60 * 1000,
        githubRepoDetailMs: 10 * 60 * 1000,
        huggingfaceUserSummaryMs: 30 * 60 * 1000,
        huggingfaceModelDetailMs: 10 * 60 * 1000,
        huggingfaceSpaceDetailMs: 10 * 60 * 1000
    }
};

const TOOL_POLICY_DOC_PATH = 'tool_policies/default';

export const getToolPolicy = async (db: Firestore): Promise<ToolPolicy> => {
    const snapshot = await db.doc(TOOL_POLICY_DOC_PATH).get();
    if (!snapshot.exists) {
        await db.doc(TOOL_POLICY_DOC_PATH).set({
            ...DEFAULT_POLICY,
            updatedAt: FieldValue.serverTimestamp()
        });
        return DEFAULT_POLICY;
    }

    const raw = snapshot.data() as Partial<ToolPolicy>;

    return {
        maxCallsPerTurn:
            typeof raw.maxCallsPerTurn === 'number' && raw.maxCallsPerTurn > 0
                ? raw.maxCallsPerTurn
                : DEFAULT_POLICY.maxCallsPerTurn,
        timeoutMs:
            typeof raw.timeoutMs === 'number' && raw.timeoutMs > 0
                ? raw.timeoutMs
                : DEFAULT_POLICY.timeoutMs,
        enabledTools: Array.isArray(raw.enabledTools)
            ? raw.enabledTools.filter(
                  (tool): tool is 'github' | 'huggingface' =>
                      tool === 'github' || tool === 'huggingface'
              )
            : DEFAULT_POLICY.enabledTools,
        freshnessBySource: {
            ...DEFAULT_POLICY.freshnessBySource,
            ...(raw.freshnessBySource ?? {})
        }
    };
};
