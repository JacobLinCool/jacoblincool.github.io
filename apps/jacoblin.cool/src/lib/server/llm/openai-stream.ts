import type { RuntimeConfig } from '$lib/server/runtime-env';

type StreamArgs = {
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    systemPrompt: string;
    userPrompt: string;
    onDelta: (delta: string) => Promise<void>;
};

type OpenAiStreamChunk = {
    choices?: Array<{
        delta?: {
            content?: string;
        };
        finish_reason?: string | null;
    }>;
    usage?: Record<string, unknown>;
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

export const streamOpenAiChatCompletion = async ({
    fetchFn,
    config,
    systemPrompt,
    userPrompt,
    onDelta
}: StreamArgs): Promise<{ text: string; usage: Record<string, unknown> | null }> => {
    if (!config.openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required for chat streaming.');
    }

    const response = await fetchFn(config.openaiApiUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.openaiApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: config.openaiChatModel,
            stream: true,
            max_completion_tokens: config.openaiMaxCompletionTokens,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        })
    });

    if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(`OpenAI stream request failed (${response.status}): ${errorText}`);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();

    let buffer = '';
    let output = '';
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
                if (dataLine === '[DONE]') {
                    continue;
                }

                let parsed: OpenAiStreamChunk;
                try {
                    parsed = JSON.parse(dataLine) as OpenAiStreamChunk;
                } catch {
                    continue;
                }

                if (parsed.usage && typeof parsed.usage === 'object') {
                    usage = parsed.usage;
                }

                const delta = parsed.choices?.[0]?.delta?.content;
                if (!delta) {
                    continue;
                }

                output += delta;
                await onDelta(delta);
            }
        }
    }

    return {
        text: output,
        usage
    };
};
