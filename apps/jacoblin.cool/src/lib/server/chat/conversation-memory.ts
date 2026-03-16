import type { GeminiContent, GeminiPart } from '$lib/server/llm/gemini';
import {
    listConversationMessages,
    updateConversationMemorySummary,
    type ConversationHandle,
    type StoredConversationMessage
} from '$lib/server/repos/conversation-repository';
import type { Firestore } from 'fires2rest';

const SUMMARY_THRESHOLD = 12;
const RECENT_MESSAGE_LIMIT = 8;
const SUMMARY_LINE_LIMIT = 10;
const SUMMARY_ENTRY_MAX_CHARS = 220;
const SUMMARY_TOTAL_MAX_CHARS = 2800;

const clampText = (value: string, maxChars: number) => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
};

const toGeminiParts = (message: StoredConversationMessage): GeminiPart[] => {
    if (message.role === 'assistant' && Array.isArray(message.parts) && message.parts.length > 0) {
        return message.parts as GeminiPart[];
    }

    return [{ text: message.content }];
};

const toGeminiContent = (message: StoredConversationMessage): GeminiContent => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: toGeminiParts(message)
});

export const summarizeConversationMessages = (messages: StoredConversationMessage[]) => {
    const recentSummaryLines = messages.slice(-SUMMARY_LINE_LIMIT).map((message) => {
        const speaker = message.role === 'assistant' ? 'Assistant' : 'User';
        return `- ${speaker}: ${clampText(message.content, SUMMARY_ENTRY_MAX_CHARS)}`;
    });

    const summary = [`Earlier conversation summary:`, ...recentSummaryLines].join('\n');
    return clampText(summary, SUMMARY_TOTAL_MAX_CHARS);
};

export const loadConversationMemory = async (
    db: Firestore,
    conversation: ConversationHandle
): Promise<{
    memorySummary: string | null;
    recentContents: GeminiContent[];
    recentMessages: StoredConversationMessage[];
    totalFinalizedMessages: number;
}> => {
    const allMessages = await listConversationMessages(db, conversation.conversationId);
    const finalizedMessages = allMessages.filter((message) => message.final);
    const recentMessages = finalizedMessages
        .filter((message) => message.seq > conversation.summarySeq)
        .slice(-RECENT_MESSAGE_LIMIT);

    return {
        memorySummary: conversation.memorySummary,
        recentContents: recentMessages.map(toGeminiContent),
        recentMessages,
        totalFinalizedMessages: finalizedMessages.length
    };
};

export const compactConversationMemory = async (
    db: Firestore,
    conversation: ConversationHandle
): Promise<{ memorySummary: string | null; summarySeq: number }> => {
    const allMessages = await listConversationMessages(db, conversation.conversationId);
    const finalizedMessages = allMessages.filter((message) => message.final);

    if (finalizedMessages.length <= SUMMARY_THRESHOLD) {
        await updateConversationMemorySummary(db, conversation.conversationId, null, 0);
        return {
            memorySummary: null,
            summarySeq: 0
        };
    }

    const summaryCutoff = finalizedMessages.length - RECENT_MESSAGE_LIMIT;
    const summarizedMessages = finalizedMessages.slice(0, summaryCutoff);
    const summarySeq = summarizedMessages.at(-1)?.seq ?? 0;
    const memorySummary = summarizeConversationMessages(summarizedMessages);

    await updateConversationMemorySummary(
        db,
        conversation.conversationId,
        memorySummary,
        summarySeq
    );

    return {
        memorySummary,
        summarySeq
    };
};
