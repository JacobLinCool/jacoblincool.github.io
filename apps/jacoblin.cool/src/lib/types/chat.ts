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

export type ChatProgressEvent = {
    id: string;
    type: 'status' | 'tool_call' | 'tool_result' | 'error';
    text: string;
    createdAt: number;
};

export type ChatSseStatusEvent = {
    type: 'status';
    status: 'collecting_context' | 'generating_answer' | 'completed';
    conversationId: string;
    detail?: string | null;
};

export type ChatSseToolCallEvent = {
    type: 'tool_call';
    tool: 'site' | 'github' | 'huggingface';
    target: string;
    label: string;
};

export type ChatSseToolResultEvent = {
    type: 'tool_result';
    tool: 'site' | 'github' | 'huggingface';
    target: string;
    label: string;
    result: 'success' | 'failed';
    revision?: string;
    error?: string;
};

export type ChatSseAnswerDeltaEvent = {
    type: 'answer_delta';
    delta: string;
};

export type ChatSseDoneEvent = {
    type: 'done';
    conversationId: string;
};

export type ChatSseErrorEvent = {
    type: 'error';
    message: string;
};

export type ChatSseEvent =
    | ChatSseStatusEvent
    | ChatSseToolCallEvent
    | ChatSseToolResultEvent
    | ChatSseAnswerDeltaEvent
    | ChatSseDoneEvent
    | ChatSseErrorEvent;
