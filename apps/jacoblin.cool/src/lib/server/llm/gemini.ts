import type { RuntimeConfig } from '$lib/server/runtime-env';

type GeminiRole = 'user' | 'model';

export type GeminiFunctionDeclaration = {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
};

export type GeminiFunctionCall = {
    name?: string;
    args?: Record<string, unknown>;
    id?: string;
};

export type GeminiFunctionResponse = {
    name?: string;
    response?: Record<string, unknown>;
    id?: string;
};

export type GeminiPart = {
    text?: string;
    thoughtSignature?: string;
    functionCall?: GeminiFunctionCall;
    functionResponse?: GeminiFunctionResponse;
};

export type GeminiContent = {
    role: GeminiRole;
    parts: GeminiPart[];
};

type GeminiCandidate = {
    content?: GeminiContent;
    finishReason?: string | null;
};

type GeminiGenerateContentResponse = {
    candidates?: GeminiCandidate[];
    usageMetadata?: Record<string, unknown>;
};

type SharedGenerateArgs = {
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    systemInstruction: string;
    contents: GeminiContent[];
    functionDeclarations?: GeminiFunctionDeclaration[];
    toolMode?: 'AUTO' | 'NONE';
};

type StreamGenerateArgs = SharedGenerateArgs & {
    onTextDelta: (delta: string) => Promise<void>;
};

const parseEventBlocks = (buffer: string) => {
    const blocks = buffer.split('\n\n');
    const completeBlocks = blocks.slice(0, -1);
    const remainder = blocks.at(-1) ?? '';

    return {
        completeBlocks,
        remainder
    };
};

const extractDataLines = (block: string) => {
    const lines = block.split('\n');
    const dataLines: string[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) {
            continue;
        }

        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
        }
    }

    return dataLines;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const mergeUnknown = (base: unknown, incoming: unknown): unknown => {
    if (Array.isArray(base) || Array.isArray(incoming)) {
        return cloneJson(incoming);
    }

    if (
        base &&
        incoming &&
        typeof base === 'object' &&
        typeof incoming === 'object' &&
        !Array.isArray(base) &&
        !Array.isArray(incoming)
    ) {
        const next: Record<string, unknown> = {
            ...(base as Record<string, unknown>)
        };

        for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
            const existing = next[key];
            next[key] = existing === undefined ? cloneJson(value) : mergeUnknown(existing, value);
        }

        return next;
    }

    return cloneJson(incoming);
};

const mergeGeminiPart = (base: GeminiPart, incoming: GeminiPart): GeminiPart => {
    const merged: GeminiPart = {
        ...base
    };

    if (typeof incoming.text === 'string') {
        merged.text = `${merged.text ?? ''}${incoming.text}`;
    }

    if (typeof incoming.thoughtSignature === 'string') {
        merged.thoughtSignature = incoming.thoughtSignature;
    }

    if (incoming.functionCall) {
        merged.functionCall = merged.functionCall
            ? (mergeUnknown(merged.functionCall, incoming.functionCall) as GeminiFunctionCall)
            : cloneJson(incoming.functionCall);
    }

    if (incoming.functionResponse) {
        merged.functionResponse = merged.functionResponse
            ? (mergeUnknown(
                  merged.functionResponse,
                  incoming.functionResponse
              ) as GeminiFunctionResponse)
            : cloneJson(incoming.functionResponse);
    }

    return merged;
};

export const mergeGeminiContent = (
    base: GeminiContent | null,
    incoming: GeminiContent | null | undefined
): GeminiContent | null => {
    if (!incoming) {
        return base ? cloneJson(base) : null;
    }

    if (!base) {
        return cloneJson(incoming);
    }

    const merged: GeminiContent = {
        role: incoming.role ?? base.role,
        parts: base.parts.map((part) => cloneJson(part))
    };

    incoming.parts.forEach((part, index) => {
        const existing = merged.parts[index];
        if (!existing) {
            merged.parts[index] = cloneJson(part);
            return;
        }

        merged.parts[index] = mergeGeminiPart(existing, part);
    });

    return merged;
};

export const extractGeminiFunctionCalls = (content: GeminiContent | null | undefined) =>
    (content?.parts ?? [])
        .map((part) => part.functionCall)
        .filter((call): call is GeminiFunctionCall => Boolean(call?.name));

export const geminiContentToText = (content: GeminiContent | null | undefined) =>
    (content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();

const buildGeminiUrl = (
    config: RuntimeConfig,
    method: 'generateContent' | 'streamGenerateContent'
) => {
    if (!config.geminiApiKey) {
        throw new Error('GEMINI_API_KEY is required for chat streaming.');
    }

    const baseUrl = config.geminiApiBaseUrl.replace(/\/+$/, '');
    const model = encodeURIComponent(config.geminiModel);
    const suffix = method === 'streamGenerateContent' ? '?alt=sse' : '';
    const separator = suffix ? '&' : '?';

    return `${baseUrl}/models/${model}:${method}${suffix}${separator}key=${encodeURIComponent(config.geminiApiKey)}`;
};

const buildRequestBody = ({
    systemInstruction,
    contents,
    functionDeclarations,
    toolMode,
    config
}: Pick<
    SharedGenerateArgs,
    'systemInstruction' | 'contents' | 'functionDeclarations' | 'toolMode'
> & {
    config: RuntimeConfig;
}) => {
    const hasTools = Array.isArray(functionDeclarations) && functionDeclarations.length > 0;

    return {
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        contents,
        generationConfig: {
            maxOutputTokens: config.geminiMaxOutputTokens
        },
        ...(hasTools
            ? {
                  tools: [
                      {
                          functionDeclarations
                      }
                  ],
                  toolConfig: {
                      functionCallingConfig: {
                          mode: toolMode ?? 'AUTO'
                      }
                  }
              }
            : {})
    };
};

export const generateGeminiContent = async ({
    fetchFn,
    config,
    systemInstruction,
    contents,
    functionDeclarations,
    toolMode = 'AUTO'
}: SharedGenerateArgs): Promise<{
    content: GeminiContent | null;
    finishReason: string | null;
    usage: Record<string, unknown> | null;
}> => {
    const response = await fetchFn(buildGeminiUrl(config, 'generateContent'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(
            buildRequestBody({
                systemInstruction,
                contents,
                functionDeclarations,
                toolMode,
                config
            })
        )
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const candidate = payload.candidates?.[0];

    return {
        content: candidate?.content ? cloneJson(candidate.content) : null,
        finishReason: candidate?.finishReason ?? null,
        usage: payload.usageMetadata ?? null
    };
};

export const streamGeminiContent = async ({
    fetchFn,
    config,
    systemInstruction,
    contents,
    functionDeclarations,
    toolMode = 'NONE',
    onTextDelta
}: StreamGenerateArgs): Promise<{
    content: GeminiContent | null;
    finishReason: string | null;
    usage: Record<string, unknown> | null;
}> => {
    const response = await fetchFn(buildGeminiUrl(config, 'streamGenerateContent'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(
            buildRequestBody({
                systemInstruction,
                contents,
                functionDeclarations,
                toolMode,
                config
            })
        )
    });

    if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(`Gemini stream request failed (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let mergedContent: GeminiContent | null = null;
    let finishReason: string | null = null;
    let usage: Record<string, unknown> | null = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const { completeBlocks, remainder } = parseEventBlocks(buffer);
        buffer = remainder;

        for (const block of completeBlocks) {
            const dataLines = extractDataLines(block);
            for (const dataLine of dataLines) {
                if (!dataLine || dataLine === '[DONE]') {
                    continue;
                }

                let parsed: GeminiGenerateContentResponse;
                try {
                    parsed = JSON.parse(dataLine) as GeminiGenerateContentResponse;
                } catch {
                    continue;
                }

                if (parsed.usageMetadata && typeof parsed.usageMetadata === 'object') {
                    usage = parsed.usageMetadata;
                }

                const candidate = parsed.candidates?.[0];
                if (!candidate) {
                    continue;
                }

                if (candidate.finishReason) {
                    finishReason = candidate.finishReason;
                }

                const priorText = geminiContentToText(mergedContent);
                mergedContent = mergeGeminiContent(mergedContent, candidate.content);
                const nextText = geminiContentToText(mergedContent);
                const delta = nextText.slice(priorText.length);

                if (delta) {
                    await onTextDelta(delta);
                }
            }
        }
    }

    return {
        content: mergedContent,
        finishReason,
        usage
    };
};
