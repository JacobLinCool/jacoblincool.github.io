import {
    geminiContentToText,
    generateGeminiContent,
    type GeminiContent
} from '$lib/server/llm/gemini';
import {
    listConversationMessages,
    type ConversationHandle,
    type StoredConversationMessage
} from '$lib/server/repos/conversation-repository';
import type { RuntimeConfig } from '$lib/server/runtime-env';
import type { Firestore } from 'fires2rest';

export const DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS = 32_000;

const CARRYOVER_SUMMARY_MAX_CHARS = 2_400;
const CARRYOVER_TRANSCRIPT_ENTRY_MAX_CHARS = 600;

const clampText = (value: string, maxChars: number) => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
};

const toGeminiContent = (message: StoredConversationMessage): GeminiContent => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }]
});

export const estimateTextTokens = (value: string) => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return 0;
    }

    return Math.max(1, Math.ceil(normalized.length / 4) + 8);
};

export const shouldRollOverConversation = (
    conversation: ConversationHandle,
    contextLimitTokens = DEFAULT_CONVERSATION_CONTEXT_LIMIT_TOKENS
) => conversation.contextTokenCount >= contextLimitTokens;

const formatTranscriptMessage = (message: StoredConversationMessage) => {
    const speaker = message.role === 'assistant' ? 'Assistant' : 'User';
    return `${speaker}: ${clampText(message.content, CARRYOVER_TRANSCRIPT_ENTRY_MAX_CHARS)}`;
};

const buildCarryoverPrompt = ({
    locale,
    existingCarryoverSummary,
    messages
}: {
    locale: string;
    existingCarryoverSummary: string | null;
    messages: StoredConversationMessage[];
}) => {
    const languageInstruction =
        locale === 'zh-tw'
            ? 'Write the carryover note in Traditional Chinese.'
            : 'Write the carryover note in the user language when clear, otherwise use English.';

    const transcript = messages.map(formatTranscriptMessage).join('\n');

    return [
        "Create a compact handoff note for the next conversation chapter on Jacob Lin's website.",
        'Only use the provided conversation history. Do not invent new facts or infer long-term personal traits.',
        'Preserve four things: main topics already covered, concrete points already explained, open threads worth continuing, and any explicit short-answer preference stated in the conversation.',
        'Keep it concise and structured for internal use. Use plain text with short labeled lines, not a long essay.',
        'Target 6 to 10 short lines total.',
        languageInstruction,
        existingCarryoverSummary
            ? `Earlier carryover note:\n${existingCarryoverSummary}`
            : 'Earlier carryover note:\n(none)',
        `Current conversation transcript:\n${transcript}`
    ].join('\n\n');
};

export const loadConversationMemory = async (
    db: Firestore,
    conversation: ConversationHandle
): Promise<{
    carryoverSummary: string | null;
    contents: GeminiContent[];
    recentMessages: StoredConversationMessage[];
    totalFinalizedMessages: number;
}> => {
    const allMessages = await listConversationMessages(db, conversation.conversationId);
    const finalizedMessages = allMessages.filter((message) => message.final);

    return {
        carryoverSummary: conversation.carryoverSummary,
        contents: finalizedMessages.map(toGeminiContent),
        recentMessages: finalizedMessages,
        totalFinalizedMessages: finalizedMessages.length
    };
};

export const generateCarryoverSummary = async ({
    db,
    fetchFn,
    config,
    locale,
    conversation
}: {
    db: Firestore;
    fetchFn: typeof fetch;
    config: RuntimeConfig;
    locale: string;
    conversation: ConversationHandle;
}) => {
    const allMessages = await listConversationMessages(db, conversation.conversationId);
    const finalizedMessages = allMessages.filter((message) => message.final);

    if (finalizedMessages.length === 0) {
        return conversation.carryoverSummary;
    }

    const completion = await generateGeminiContent({
        fetchFn,
        config,
        systemInstruction:
            'You write precise carryover notes for multi-turn conversations. Produce only the note itself.',
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: buildCarryoverPrompt({
                            locale,
                            existingCarryoverSummary: conversation.carryoverSummary,
                            messages: finalizedMessages
                        })
                    }
                ]
            }
        ],
        toolMode: 'NONE'
    });

    const summary = clampText(geminiContentToText(completion.content), CARRYOVER_SUMMARY_MAX_CHARS);
    if (!summary) {
        throw new Error('Gemini returned an empty carryover summary.');
    }

    return summary;
};
