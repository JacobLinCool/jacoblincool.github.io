import { browser } from '$app/environment';
import { publicFeatureFlags } from '$lib/config/public-flags';
import { createAudioStub } from '$lib/services/audio-stub';
import { streamChat } from '$lib/services/chat-api';
import { notificationStore } from '$lib/stores/notification.svelte';
import type { BackgroundEventType } from '$lib/types/background';
import type {
    AudioUiState,
    ChatMessage,
    ChatProgressEvent,
    ChatRole,
    ChatSseEvent,
    ConversationStage,
    PromptChip
} from '$lib/types/chat';
import type { ChatContentConfig } from '$lib/types/home';

const BASE_BACKGROUND_NODE_COUNT = 200;
const TYPING_ACTIVATION_RATIO = 1 / BASE_BACKGROUND_NODE_COUNT;
const SUBMIT_ACTIVATION_RATIO = 0.05;
const STREAM_ACTIVATION_RATIO = 0.02;

type ChatState = {
    messages: ChatMessage[];
    promptChips: PromptChip[];
    taglines: string[];
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
    progressEvents: ChatProgressEvent[];
    contextStatusCollapsed: boolean;
};

class ChatStore {
    static instance: ChatStore | null = null;
    state = $state<ChatState>({
        messages: [],
        promptChips: [],
        taglines: [],
        composer: '',
        isStreaming: false,
        conversationStage: 'idle',
        typingStrength: 0,
        submitPulse: 0,
        interactionTick: 0,
        backgroundEventId: 0,
        backgroundEventType: 'idle',
        backgroundEventStrength: 0,
        audio: { state: 'idle', messageId: null },
        progressEvents: [],
        contextStatusCollapsed: true
    });

    private readonly audioController = createAudioStub((nextState) => {
        this.state.audio = nextState;
    });

    private submitPulseTimeout: ReturnType<typeof setTimeout> | null = null;
    private constructor() {}

    static getInstance() {
        ChatStore.instance ??= new ChatStore();
        return ChatStore.instance;
    }

    hydrateChatConfig(config: ChatContentConfig) {
        this.state.promptChips = config.promptChips;
        this.state.taglines = config.taglines;
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
        this.state.progressEvents = [this.createProgressEvent('status', 'Collecting context...')];
        this.state.contextStatusCollapsed = true;
        this.state.composer = '';
        this.state.typingStrength = 0;
        this.audioController.stop();
        this.triggerSubmitPulse();
        this.emitBackgroundEvent('submit', SUBMIT_ACTIVATION_RATIO);

        const assistantId = this.pushMessage('assistant', '', 'streaming');
        this.state.isStreaming = true;

        try {
            await streamChat({
                message: prompt,
                locale: this.resolveLocale(),
                onEvent: (event) => {
                    this.handleSseEvent(event, assistantId);
                }
            });

            this.patchMessage(assistantId, (message) => {
                message.status = 'done';
            });
        } catch (error) {
            this.patchMessage(assistantId, (message) => {
                message.content =
                    message.content.trim() ||
                    'I hit a temporary issue while collecting verified context. Please try again.';
                message.status = 'done';
            });
            this.pushProgress(
                'error',
                error instanceof Error ? error.message : 'Unable to stream response.'
            );
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
        if (!publicFeatureFlags.chatAudioEnabled) {
            this.audioController.stop();
            return;
        }

        const target = this.state.messages.find((message) => message.id === messageId);
        if (!target || target.role !== 'assistant' || target.status !== 'done') {
            return;
        }

        this.audioController.toggle(messageId);
    }

    private handleSseEvent(event: ChatSseEvent, assistantId: string) {
        switch (event.type) {
            case 'status': {
                if (event.status === 'collecting_context') {
                    this.pushProgress('status', 'Collecting context...');
                }

                if (event.status === 'generating_answer') {
                    this.pushProgress('status', 'Generating response...');
                }

                if (event.status === 'completed') {
                    this.pushProgress('status', 'Response ready.');
                }

                break;
            }
            case 'tool_call': {
                this.pushProgress('tool_call', event.label);
                break;
            }
            case 'tool_result': {
                const label =
                    event.result === 'success'
                        ? `Loaded ${event.target}`
                        : `Failed ${event.target}`;
                this.pushProgress('tool_result', label);
                break;
            }
            case 'answer_delta': {
                this.patchMessage(assistantId, (message) => {
                    message.content += event.delta;
                });
                this.state.interactionTick += 1;
                this.emitBackgroundEvent('stream', STREAM_ACTIVATION_RATIO);
                break;
            }
            case 'done': {
                this.patchMessage(assistantId, (message) => {
                    message.status = 'done';
                });
                break;
            }
            case 'error': {
                this.pushProgress('error', event.message);
                this.patchMessage(assistantId, (message) => {
                    if (!message.content.trim()) {
                        message.content = event.message;
                    }
                    message.status = 'done';
                });
                throw new Error(event.message);
            }
        }
    }

    private pushProgress(type: ChatProgressEvent['type'], text: string) {
        const latest = this.state.progressEvents.at(-1);
        if (latest?.type === type && latest.text === text) {
            return;
        }

        const event = this.createProgressEvent(type, text);

        this.state.progressEvents = [...this.state.progressEvents, event].slice(-12);
    }

    private createProgressEvent(type: ChatProgressEvent['type'], text: string): ChatProgressEvent {
        return {
            id: `progress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            text,
            createdAt: Date.now()
        };
    }

    toggleContextStatusCollapsed() {
        this.state.contextStatusCollapsed = !this.state.contextStatusCollapsed;
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

    private resolveLocale() {
        if (!browser) {
            return 'en';
        }

        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const localeCandidate = pathParts[0]?.toLowerCase();
        if (localeCandidate === 'en' || localeCandidate === 'zh-tw') {
            return localeCandidate;
        }

        return document.documentElement.lang?.toLowerCase().startsWith('zh') ? 'zh-tw' : 'en';
    }
}

export const chatStore = ChatStore.getInstance();
