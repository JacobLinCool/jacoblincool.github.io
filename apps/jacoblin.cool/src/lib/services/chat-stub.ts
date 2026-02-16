import { siteConfig } from '$lib/config/site';
import type { PromptChip } from '$lib/types/chat';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const DEFAULT_PROMPT_CHIPS: PromptChip[] = [...siteConfig.chat.promptChips];

const trimForContext = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildWarmReply = (rawInput: string) => {
    const input = trimForContext(rawInput);
    const lc = input.toLowerCase();

    for (const { keywords, reply } of siteConfig.chat.warmReplies) {
        if (keywords.some((kw) => lc.includes(kw))) {
            return reply;
        }
    }

    return siteConfig.chat.fallbackReply;
};

const splitIntoChunks = (text: string) => {
    const chunks = text.match(/\S+\s*/g) ?? [text];
    return chunks;
};

export const streamAssistantReply = async function* (userInput: string): AsyncGenerator<string> {
    const fullReply = buildWarmReply(userInput);
    const chunks = splitIntoChunks(fullReply);

    for (const chunk of chunks) {
        await delay(28 + Math.random() * 52);
        yield chunk;
    }
};
