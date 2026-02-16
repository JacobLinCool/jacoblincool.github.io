export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
    status: 'streaming' | 'done';
    createdAt: number;
};

export type PromptChip = {
    id: string;
    label: string;
    prompt: string;
};

export type AudioUiState = {
    state: 'idle' | 'playing';
    messageId: string | null;
};

export type ConversationStage = 'idle' | 'active';
