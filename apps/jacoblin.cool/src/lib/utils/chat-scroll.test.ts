import { describe, expect, it } from 'vitest';
import { createChatScrollController } from './chat-scroll';

const setup = (height = 1000, viewportHeight = 400) => {
    const frames = new Map<number, FrameRequestCallback>();
    const states: { following: boolean; overflowing: boolean }[] = [];
    const scrolls: ScrollToOptions[] = [];
    let frameId = 0;
    const viewport = {
        scrollTop: Math.max(0, height - viewportHeight),
        scrollHeight: height,
        clientHeight: viewportHeight,
        scrollTo(options: ScrollToOptions) {
            scrolls.push(options);
            if (options.behavior === 'smooth') return;
            viewport.scrollTop = Math.max(
                0,
                Math.min(options.top ?? 0, viewport.scrollHeight - viewport.clientHeight)
            );
        }
    };
    const controller = createChatScrollController({
        viewport,
        onStateChange: (state) => states.push(state),
        requestFrame: (callback) => {
            frames.set(++frameId, callback);
            return frameId;
        },
        cancelFrame: (id) => {
            frames.delete(id);
        }
    });
    const flush = () => {
        const pending = Array.from(frames.values());
        frames.clear();
        pending.forEach((callback) => callback(0));
    };
    const scrollManually = (top: number) => {
        viewport.scrollTop = top;
        controller.scrolled();
    };
    return { controller, viewport, frames, states, scrolls, flush, scrollManually };
};

describe('conversation scroll intent', () => {
    it('coalesces status/delta updates without losing the pin for a new turn from old history', () => {
        const test = setup();
        test.controller.update('first');
        test.flush();
        test.scrollManually(120);
        expect(test.states.at(-1)?.following).toBe(false);

        test.viewport.scrollHeight += 300;
        test.controller.update('second');
        expect(test.states.at(-1)?.following).toBe(true);
        test.controller.update('second');
        test.viewport.scrollHeight += 100;
        test.controller.update('second');
        expect(test.frames.size).toBe(1);
        test.flush();
        expect(test.viewport.scrollTop).toBe(1000);
    });

    it('lets an upward wheel cancel a queued streaming pin before the browser scrolls', () => {
        const test = setup();
        test.controller.update('first');
        test.controller.wheel(-30);
        test.scrollManually(570);
        test.flush();
        expect(test.scrolls).toEqual([]);
        expect(test.states.at(-1)?.following).toBe(false);
        expect(test.viewport.scrollTop).toBe(570);
    });

    it('keeps the bottom visible on viewport-only resize and delayed content growth', () => {
        const test = setup();
        test.controller.update('first');
        test.flush();
        test.viewport.clientHeight = 200;
        test.controller.resized();
        test.flush();
        expect(test.viewport.scrollTop).toBe(800);
        test.viewport.scrollHeight += 240;
        test.controller.resized();
        test.flush();
        expect(test.viewport.scrollTop).toBe(1040);
    });

    it('preserves an older reading position when content or viewport dimensions change', () => {
        const test = setup();
        test.controller.update('first');
        test.flush();
        test.scrollManually(140);
        test.viewport.scrollHeight += 200;
        test.viewport.clientHeight = 250;
        test.controller.resized();
        test.controller.update('first');
        test.flush();
        expect(test.viewport.scrollTop).toBe(140);
        expect(test.states.at(-1)?.following).toBe(false);
    });

    it('keeps following when a smaller scroll range clamps the browser to its new bottom', () => {
        const test = setup();
        test.controller.update('first');
        test.flush();
        test.viewport.scrollHeight = 900;
        test.viewport.scrollTop = 500;
        test.controller.scrolled();
        expect(test.states.at(-1)?.following).toBe(true);
        test.controller.resized();
        test.flush();
        expect(test.viewport.scrollTop).toBe(500);
    });

    it.each([1300, 900])(
        'preserves a scrollbar move upward while content height changes to %i',
        (height) => {
            const test = setup();
            test.controller.update('first');
            test.flush();
            test.viewport.scrollHeight = height;
            test.controller.update('first');
            // Native scrollbar movement can arrive without DOM pointer/wheel/key events.
            test.scrollManually(450);
            test.controller.resized();
            test.flush();
            expect(test.states.at(-1)?.following).toBe(false);
            expect(test.viewport.scrollTop).toBe(450);
        }
    );

    it.each(['ArrowUp', 'PageUp', 'Home', ' '])(
        'pauses for upward keyboard navigation: %s',
        (key) => {
            const test = setup();
            test.controller.update('first');
            test.controller.keydown(key, key === ' ');
            test.flush();
            expect(test.scrolls).toEqual([]);
            expect(test.states.at(-1)?.following).toBe(false);
        }
    );

    it('pauses as a touch gesture starts scrolling toward older messages', () => {
        const test = setup();
        test.controller.update('first');
        test.controller.touchStarted(160);
        test.controller.touchMoved(190);
        test.flush();
        expect(test.scrolls).toEqual([]);
        expect(test.states.at(-1)?.following).toBe(false);
    });

    it('resumes following only when a reader returns to the bottom', () => {
        const test = setup();
        test.controller.update('first');
        test.flush();
        test.scrollManually(100);
        test.scrollManually(590);
        expect(test.states.at(-1)?.following).toBe(false);
        test.scrollManually(600);
        expect(test.states.at(-1)?.following).toBe(true);
        test.viewport.scrollHeight += 100;
        test.controller.update('first');
        test.flush();
        expect(test.viewport.scrollTop).toBe(700);
    });

    it('keeps short histories free of a jump control and scroll containment', () => {
        const test = setup(250, 400);
        test.controller.update('first');
        test.controller.wheel(-40);
        test.controller.keydown('Home', false);
        test.flush();
        expect(test.states.at(-1)).toEqual({ following: true, overflowing: false });
        expect(test.viewport.scrollTop).toBe(0);
    });

    it('supports an explicit instant jump for reduced motion or streaming', () => {
        const test = setup();
        test.scrollManually(100);
        test.controller.jumpToLatest(false);
        expect(test.scrolls.at(-1)).toEqual({ top: 600, behavior: 'instant' });
        expect(test.states.at(-1)?.following).toBe(true);
    });

    it('stops an in-progress smooth jump when the reader scrolls upward', () => {
        const test = setup();
        test.scrollManually(100);
        test.controller.jumpToLatest(true);
        expect(test.scrolls.at(-1)).toEqual({ top: 600, behavior: 'smooth' });
        test.scrollManually(260);
        expect(test.states.at(-1)?.following).toBe(true);
        test.controller.wheel(-20);
        expect(test.scrolls.at(-1)).toEqual({ top: 260, behavior: 'instant' });
        expect(test.states.at(-1)?.following).toBe(false);
        test.viewport.scrollHeight += 100;
        test.controller.resized();
        test.flush();
        expect(test.viewport.scrollTop).toBe(260);
    });

    it('cancels pending work when the conversation leaves the page', () => {
        const test = setup();
        test.controller.update('first');
        test.controller.destroy();
        test.flush();
        expect(test.scrolls).toEqual([]);
    });
});
