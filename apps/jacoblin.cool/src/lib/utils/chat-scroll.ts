type ScrollViewport = Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'> & {
    scrollTo: (options: ScrollToOptions) => void;
};

type ScrollState = { following: boolean; overflowing: boolean };

type ScrollControllerOptions = {
    viewport: ScrollViewport;
    onStateChange: (state: ScrollState) => void;
    requestFrame: (callback: FrameRequestCallback) => number;
    cancelFrame: (id: number) => void;
};

const BOTTOM_TOLERANCE = 2;

/** Keep follow intent separate from layout changes that alter the distance to the bottom. */
export const createChatScrollController = ({
    viewport,
    onStateChange,
    requestFrame,
    cancelFrame
}: ScrollControllerOptions) => {
    const measure = () => ({
        top: viewport.scrollTop,
        height: viewport.scrollHeight,
        viewportHeight: viewport.clientHeight
    });
    let previous = measure();
    let following = true;
    let overflowing = previous.height - previous.viewportHeight > BOTTOM_TOLERANCE;
    let pendingFrame: number | null = null;
    let lastTurnId: string | null = null;
    let touchY: number | null = null;
    let smoothScrolling = false;
    let destroyed = false;

    const emit = () => onStateChange({ following, overflowing });
    const setFollowing = (next: boolean) => {
        if (following === next) return;
        following = next;
        emit();
    };
    const updateOverflow = () => {
        const next = viewport.scrollHeight - viewport.clientHeight > BOTTOM_TOLERANCE;
        if (overflowing !== next) {
            overflowing = next;
            emit();
        }
        if (!overflowing) setFollowing(true);
    };
    const cancelPendingFrame = () => {
        if (pendingFrame === null) return;
        cancelFrame(pendingFrame);
        pendingFrame = null;
    };
    const pinToBottom = (smooth = false) => {
        smoothScrolling = smooth;
        viewport.scrollTo({
            top: Math.max(0, viewport.scrollHeight - viewport.clientHeight),
            behavior: smooth ? 'smooth' : 'instant'
        });
        previous = measure();
    };
    const schedulePin = () => {
        if (!following || pendingFrame !== null || destroyed) return;
        pendingFrame = requestFrame(() => {
            pendingFrame = null;
            // A wheel/touch/key event may have changed intent since this frame was queued.
            if (!destroyed && following) pinToBottom();
        });
    };
    const pauseFollowing = () => {
        updateOverflow();
        if (!overflowing) return;
        setFollowing(false);
        cancelPendingFrame();
        if (smoothScrolling) {
            viewport.scrollTo({ top: viewport.scrollTop, behavior: 'instant' });
            smoothScrolling = false;
        }
    };

    emit();

    return {
        update(turnId: string | null) {
            updateOverflow();
            if (turnId !== null && turnId !== lastTurnId) {
                lastTurnId = turnId;
                // Set intent synchronously: later status updates cannot cancel a new turn's pin.
                setFollowing(true);
            }
            schedulePin();
        },
        resized() {
            updateOverflow();
            schedulePin();
        },
        scrolled() {
            const current = measure();
            updateOverflow();
            const atBottom =
                current.height - current.viewportHeight - current.top <= BOTTOM_TOLERANCE;
            if (atBottom) {
                // A smaller scroll range can clamp scrollTop upward to the new maximum.
                setFollowing(true);
                smoothScrolling = false;
            } else if (current.top < previous.top - 1) {
                // Real upward scrolling still counts when a streamed chunk changes the height.
                pauseFollowing();
            }
            previous = current;
        },
        wheel(deltaY: number) {
            if (deltaY < 0) pauseFollowing();
        },
        keydown(key: string, shiftKey: boolean) {
            if (
                key === 'ArrowUp' ||
                key === 'PageUp' ||
                key === 'Home' ||
                (key === ' ' && shiftKey)
            ) {
                pauseFollowing();
            }
        },
        touchStarted(clientY: number) {
            touchY = clientY;
        },
        touchMoved(clientY: number) {
            if (touchY !== null && clientY > touchY + 1) pauseFollowing();
            touchY = clientY;
        },
        touchEnded() {
            touchY = null;
        },
        scrollbarPressed() {
            pauseFollowing();
        },
        jumpToLatest(smooth: boolean) {
            cancelPendingFrame();
            setFollowing(true);
            pinToBottom(smooth);
        },
        destroy() {
            destroyed = true;
            cancelPendingFrame();
        }
    };
};

export type ChatScrollController = ReturnType<typeof createChatScrollController>;
