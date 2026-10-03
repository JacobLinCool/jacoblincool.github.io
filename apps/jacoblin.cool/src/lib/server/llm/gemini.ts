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
    thought?: boolean;
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
    signal?: AbortSignal;
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

    for (const part of incoming.parts) {
        const previous = merged.parts.at(-1);
        if (
            previous &&
            typeof part.text === 'string' &&
            typeof previous.text === 'string' &&
            !part.functionCall &&
            !previous.functionCall &&
            !part.thoughtSignature &&
            !previous.thoughtSignature &&
            part.thought === previous.thought
        ) {
            previous.text += part.text;
        } else {
            // GenerateContent emits complete function calls. Signed parts must retain
            // their exact boundaries when replayed on the next tool round.
            merged.parts.push(cloneJson(part));
        }
    }

    return merged;
};

export const extractGeminiFunctionCalls = (content: GeminiContent | null | undefined) =>
    (content?.parts ?? [])
        .map((part) => part.functionCall)
        .filter((call): call is GeminiFunctionCall => Boolean(call?.name));

export const geminiContentToText = (content: GeminiContent | null | undefined) =>
    (content?.parts ?? [])
        .filter((part) => !part.thought)
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
    return `${baseUrl}/models/${model}:${method}${suffix}`;
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
    toolMode = 'AUTO',
    signal
}: SharedGenerateArgs): Promise<{
    content: GeminiContent | null;
    finishReason: string | null;
    usage: Record<string, unknown> | null;
}> => {
    const response = await fetchFn(buildGeminiUrl(config, 'generateContent'), {
        method: 'POST',
        signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
            : AbortSignal.timeout(60_000),
        headers: {
            'x-goog-api-key': config.geminiApiKey!,
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
        throw new Error(`Gemini request failed (${response.status}).`);
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
    signal,
    onTextDelta
}: StreamGenerateArgs): Promise<{
    content: GeminiContent | null;
    finishReason: string | null;
    usage: Record<string, unknown> | null;
}> => {
    const response = await fetchFn(buildGeminiUrl(config, 'streamGenerateContent'), {
        method: 'POST',
        signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
            : AbortSignal.timeout(60_000),
        headers: {
            'x-goog-api-key': config.geminiApiKey!,
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
        throw new Error(`Gemini stream request failed (${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let mergedContent: GeminiContent | null = null;
    let finishReason: string | null = null;
    let usage: Record<string, unknown> | null = null;

    const processBlock = async (block: string) => {
        const data = extractDataLines(block).join('\n');
        if (!data || data === '[DONE]') return;
        let parsed: GeminiGenerateContentResponse;
        try {
            parsed = JSON.parse(data) as GeminiGenerateContentResponse;
        } catch {
            throw new Error('Gemini returned malformed stream data.');
        }
        if (!parsed || typeof parsed !== 'object' || 'error' in parsed) {
            throw new Error('Gemini returned invalid stream data.');
        }
        if (parsed.usageMetadata) usage = parsed.usageMetadata;
        const candidate = parsed.candidates?.[0];
        if (!candidate) return;
        if (candidate.finishReason) finishReason = candidate.finishReason;
        mergedContent = mergeGeminiContent(mergedContent, candidate.content);
        // Forward raw deltas: trimming accumulated text loses spaces at chunk boundaries.
        for (const part of candidate.content?.parts ?? []) {
            if (part.text && !part.thought) await onTextDelta(part.text);
        }
    };

    try {
        while (true) {
            signal?.throwIfAborted();
            const { done, value } = await reader.read();
            signal?.throwIfAborted();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            // Normalize complete CRLF pairs, including pairs split across network chunks.
            buffer = buffer.replace(/\r\n/g, '\n');
            const { completeBlocks, remainder } = parseEventBlocks(buffer);
            buffer = remainder;
            for (const block of completeBlocks) await processBlock(block);
            if (done) {
                if (buffer.trim()) await processBlock(buffer);
                break;
            }
        }
        if (finishReason !== 'STOP') {
            throw new Error(
                finishReason
                    ? `Gemini did not complete the response (${finishReason}).`
                    : 'Gemini stream ended before completion.'
            );
        }
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }

    return {
        content: mergedContent,
        finishReason,
        usage
    };
};
