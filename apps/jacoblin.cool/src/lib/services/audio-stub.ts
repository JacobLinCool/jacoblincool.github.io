import type { AudioUiState } from '$lib/types/chat';

export type AudioStubController = {
    getState: () => AudioUiState;
    toggle: (messageId: string) => void;
    stop: () => void;
};

export const createAudioStub = (
    onStateChange: (nextState: AudioUiState) => void
): AudioStubController => {
    let state: AudioUiState = { state: 'idle', messageId: null };
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pushState = (nextState: AudioUiState) => {
        state = nextState;
        onStateChange(state);
    };

    const stop = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        pushState({ state: 'idle', messageId: null });
    };

    const play = (messageId: string) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        pushState({ state: 'playing', messageId });
        timeoutId = setTimeout(() => {
            stop();
        }, 2400);
    };

    const toggle = (messageId: string) => {
        if (state.state === 'playing' && state.messageId === messageId) {
            stop();
            return;
        }
        play(messageId);
    };

    return {
        getState: () => state,
        toggle,
        stop
    };
};
