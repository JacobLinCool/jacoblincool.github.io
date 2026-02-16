import { browser } from '$app/environment';
import { createAudioStub } from '$lib/services/audio-stub';
import { DEFAULT_PROMPT_CHIPS, streamAssistantReply } from '$lib/services/chat-stub';
import { notificationStore } from '$lib/stores/notification.svelte';
import type { BackgroundEventType } from '$lib/types/background';
import type {
    AudioUiState,
    ChatMessage,
    ChatRole,
    ConversationStage,
    PromptChip
} from '$lib/types/chat';

const BASE_BACKGROUND_NODE_COUNT = 200;
const TYPING_ACTIVATION_RATIO = 1 / BASE_BACKGROUND_NODE_COUNT;
const SUBMIT_ACTIVATION_RATIO = 0.05;
const STREAM_ACTIVATION_RATIO = 0.02;

type ChatState = {
    messages: ChatMessage[];
    promptChips: PromptChip[];
    composer: string;
    isStreaming: boolean;
    conversationStage: ConversationStage;
    typingStrength: number;
    submitPulse: number;
    interactionTick: number;
    backgroundEventId: number;
    backgroundEventType: BackgroundEventType;
    backgroundEventStrength: number;
    audio: AudioUiState;
};

class ChatStore {
    static instance: ChatStore | null = null;
    state = $state<ChatState>({
        messages: [],
        promptChips: DEFAULT_PROMPT_CHIPS,
        composer: '',
        isStreaming: false,
        conversationStage: 'idle',
        typingStrength: 0,
        submitPulse: 0,
        interactionTick: 0,
        backgroundEventId: 0,
        backgroundEventType: 'idle',
        backgroundEventStrength: 0,
        audio: { state: 'idle', messageId: null }
    });

    private readonly audioController = createAudioStub((nextState) => {
        this.state.audio = nextState;
    });

    private submitPulseTimeout: ReturnType<typeof setTimeout> | null = null;

    static getInstance() {
        ChatStore.instance ??= new ChatStore();
        return ChatStore.instance;
    }

    setComposer(value: string) {
        const previousValue = this.state.composer;
        this.state.composer = value;
        this.state.typingStrength = Math.min(1, value.trim().length / 72);

        if (value !== previousValue) {
            this.state.interactionTick += 1;
            this.emitBackgroundEvent('typing', TYPING_ACTIVATION_RATIO);
        }
    }

    async submitComposer() {
        await this.submitPrompt(this.state.composer);
    }

    async submitChipPrompt(prompt: string) {
        this.state.composer = prompt;
        this.state.typingStrength = Math.min(1, prompt.trim().length / 72);
        await this.submitPrompt(prompt);
    }

    async submitPrompt(rawPrompt: string) {
        const prompt = rawPrompt.trim();
        if (!prompt || this.state.isStreaming) {
            return;
        }

        if (this.state.conversationStage === 'idle') {
            this.state.conversationStage = 'active';
        }

        this.pushMessage('user', prompt, 'done');
        this.state.composer = '';
        this.state.typingStrength = 0;
        this.audioController.stop();
        this.triggerSubmitPulse();
        this.emitBackgroundEvent('submit', SUBMIT_ACTIVATION_RATIO);

        const assistantId = this.pushMessage('assistant', '', 'streaming');
        this.state.isStreaming = true;

        try {
            for await (const chunk of streamAssistantReply(prompt)) {
                this.patchMessage(assistantId, (message) => {
                    message.content += chunk;
                });
                this.state.interactionTick += 1;
                this.emitBackgroundEvent('stream', STREAM_ACTIVATION_RATIO);
            }
            this.patchMessage(assistantId, (message) => {
                message.status = 'done';
            });
        } catch (error) {
            this.patchMessage(assistantId, (message) => {
                message.content = 'I hit a temporary issue while thinking. Please try again.';
                message.status = 'done';
            });
            notificationStore.error(
                error instanceof Error ? error.message : 'Unable to stream response.'
            );
        } finally {
            this.state.isStreaming = false;
        }
    }

    async copyMessage(messageId: string) {
        const target = this.state.messages.find((message) => message.id === messageId);
        if (!target?.content.trim()) {
            return;
        }

        if (!browser || !navigator.clipboard) {
            notificationStore.warning('Clipboard is unavailable in this environment.');
            return;
        }

        try {
            await navigator.clipboard.writeText(target.content);
            notificationStore.success('Copied to clipboard.');
        } catch {
            notificationStore.error('Unable to copy this message.');
        }
    }

    toggleAudio(messageId: string) {
        const target = this.state.messages.find((message) => message.id === messageId);
        if (!target || target.role !== 'assistant' || target.status !== 'done') {
            return;
        }

        this.audioController.toggle(messageId);
    }

    private emitBackgroundEvent(type: BackgroundEventType, strength: number) {
        this.state.backgroundEventId += 1;
        this.state.backgroundEventType = type;
        this.state.backgroundEventStrength = strength;
    }

    private triggerSubmitPulse() {
        this.state.submitPulse += 1;
        this.state.interactionTick += 1;

        if (this.submitPulseTimeout) {
            clearTimeout(this.submitPulseTimeout);
        }

        this.submitPulseTimeout = setTimeout(() => {
            this.state.submitPulse = Math.max(0, this.state.submitPulse - 1);
        }, 500);
    }

    private pushMessage(role: ChatRole, content: string, status: ChatMessage['status']) {
        const id = this.createMessageId();
        const message: ChatMessage = {
            id,
            role,
            content,
            status,
            createdAt: Date.now()
        };

        this.state.messages = [...this.state.messages, message];
        return id;
    }

    private patchMessage(messageId: string, patcher: (message: ChatMessage) => void) {
        this.state.messages = this.state.messages.map((message) => {
            if (message.id !== messageId) {
                return message;
            }

            const updated: ChatMessage = { ...message };
            patcher(updated);
            return updated;
        });
    }

    private createMessageId() {
        const randomPart =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2, 12);

        return `msg-${randomPart}`;
    }
}

export const chatStore = ChatStore.getInstance();
