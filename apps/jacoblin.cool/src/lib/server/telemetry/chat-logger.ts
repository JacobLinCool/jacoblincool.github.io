type ChatLogLevel = 'info' | 'warn' | 'error';

type GeminiUsageSummary = {
    promptTokenCount: number | null;
    candidatesTokenCount: number | null;
    totalTokenCount: number | null;
    thoughtsTokenCount: number | null;
    toolUsePromptTokenCount: number | null;
};

type ChatLogPayload = Record<string, unknown>;

const toOptionalNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const toErrorPayload = (error: unknown) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message
        };
    }

    return {
        name: 'Error',
        message: String(error)
    };
};

export const summarizeGeminiUsage = (
    usage: Record<string, unknown> | null | undefined
): GeminiUsageSummary | null => {
    if (!usage) {
        return null;
    }

    return {
        promptTokenCount: toOptionalNumber(usage.promptTokenCount),
        candidatesTokenCount: toOptionalNumber(usage.candidatesTokenCount),
        totalTokenCount: toOptionalNumber(usage.totalTokenCount),
        thoughtsTokenCount: toOptionalNumber(usage.thoughtsTokenCount),
        toolUsePromptTokenCount: toOptionalNumber(usage.toolUsePromptTokenCount)
    };
};

const writeStructuredLog = (level: ChatLogLevel, event: string, payload: ChatLogPayload) => {
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;

    sink({
        ts: new Date().toISOString(),
        scope: 'chat',
        level,
        event,
        ...payload
    });
};

export const logChatInfo = (event: string, payload: ChatLogPayload) => {
    writeStructuredLog('info', event, payload);
};

export const logChatWarn = (event: string, payload: ChatLogPayload) => {
    writeStructuredLog('warn', event, payload);
};

export const logChatError = (event: string, payload: ChatLogPayload) => {
    writeStructuredLog('error', event, payload);
};

export const createChatErrorLogPayload = (error: unknown, payload: ChatLogPayload = {}) => ({
    ...payload,
    error: toErrorPayload(error)
});
