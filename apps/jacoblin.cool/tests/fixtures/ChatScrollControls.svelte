<script lang="ts">
    // Imported only by scripts/inspect-chat-scroll.mjs; never part of the production homepage.
    import { chatStore } from '$lib/stores/chat.svelte';
    import type { ChatMessage, ChatProgressEvent } from '$lib/types/chat';
    import { onMount, tick } from 'svelte';

    let sequence = 0;
    let chunks = 0;
    let scenario = 'idle';
    let timer: ReturnType<typeof setInterval> | null = null;
    const epoch = Date.UTC(2026, 0, 1);
    const paragraph = (number: number, label = 'Fixture') =>
        `**${label} paragraph ${number}.** This deterministic passage gives the conversation a readable anchor while new content arrives. Scroll upward to inspect an earlier paragraph, then append more content and verify that the same words remain in view. The fixture contains no visitor history or model output.`;
    const message = (
        role: ChatMessage['role'],
        content: string,
        status: ChatMessage['status'] = 'done'
    ): ChatMessage => ({
        id: `scroll-message-${++sequence}`,
        role,
        content,
        status,
        createdAt: epoch + sequence
    });
    const progress = (
        text: string,
        type: ChatProgressEvent['type'] = 'status'
    ): ChatProgressEvent => ({
        id: `scroll-progress-${++sequence}`,
        type,
        text,
        createdAt: epoch + sequence
    });
    const stopTimer = () => {
        if (timer !== null) clearInterval(timer);
        timer = null;
    };
    const measure = () => {
        const region = transcript();
        const composer = document
            .getElementById('chat-composer')
            ?.closest('.conversation-composer');
        const lastMessage = region?.querySelector('ul')?.lastElementChild;
        const main = document.getElementById('main-content');
        const rect = (element: Element | null | undefined) => {
            if (!element) return null;
            const { top, right, bottom, left, width, height } = element.getBoundingClientRect();
            return { top, right, bottom, left, width, height };
        };
        const regionRect = rect(region);
        const composerRect = rect(composer);
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            messageCount: chatStore.state.messages.length,
            region: region
                ? {
                      rect: regionRect,
                      scrollTop: region.scrollTop,
                      maxScrollTop: Math.max(0, region.scrollHeight - region.clientHeight),
                      gap: Math.max(
                          0,
                          region.scrollHeight - region.clientHeight - region.scrollTop
                      ),
                      scrollHeight: region.scrollHeight,
                      clientHeight: region.clientHeight,
                      horizontalOverflow: Math.max(0, region.scrollWidth - region.clientWidth),
                      overflowX: getComputedStyle(region).overflowX,
                      overflowY: getComputedStyle(region).overflowY
                  }
                : null,
            composer: composerRect,
            lastMessageBottom: rect(lastMessage)?.bottom ?? null,
            composerOverlapsRegion: Boolean(
                regionRect && composerRect && regionRect.bottom > composerRect.top + 1
            ),
            main: main
                ? {
                      scrollTop: main.scrollTop,
                      horizontalOverflow: Math.max(0, main.scrollWidth - main.clientWidth)
                  }
                : null,
            documentHorizontalOverflow: Math.max(
                0,
                document.documentElement.scrollWidth - document.documentElement.clientWidth
            ),
            jumpLatestVisible: [...document.querySelectorAll('button')].some(
                (button) =>
                    button.textContent?.trim() === 'Latest response' &&
                    button.getBoundingClientRect().height > 0
            )
        };
    };
    const report = (error?: string) => {
        if (window.parent === window) return;
        window.parent.postMessage(
            {
                type: 'chat-scroll-state',
                scenario,
                messages: chatStore.state.messages.length,
                streaming: chatStore.state.isStreaming,
                chunks,
                metrics: measure(),
                error
            },
            window.location.origin
        );
    };
    const reset = (name: string, messages: ChatMessage[]) => {
        stopTimer();
        chunks = 0;
        scenario = name;
        Object.assign(chatStore.state, {
            messages,
            composer: '',
            typingStrength: 0,
            isStreaming: false,
            conversationStage: messages.length ? 'active' : 'idle',
            progressEvents: [],
            contextStatusCollapsed: true,
            audio: { state: 'idle', messageId: null }
        });
    };
    const seed = (name: string) => {
        if (name === 'idle' || name === 'clear') return reset(name, []);
        if (name === 'short')
            return reset(name, [
                message('user', 'Show me one short fixture answer.'),
                message(
                    'assistant',
                    'A short answer should sit comfortably above the composer, without unnecessary scrolling.'
                )
            ]);
        if (name === 'long')
            return reset(
                name,
                Array.from({ length: 30 }, (_, index) => [
                    message('user', `Fixture question ${index + 1}: explain this section.`),
                    message(
                        'assistant',
                        `## Answer ${index + 1}\n\n${Array.from({ length: 4 }, (_, part) => paragraph(part + 1, `Answer ${index + 1}`)).join('\n\n')}`
                    )
                ]).flat()
            );
        if (name === 'huge') {
            const code = [
                '```cpp',
                ...Array.from(
                    { length: 24 },
                    (_, index) =>
                        `const std::string fixture_line_${index + 1} = "${'wide_content_'.repeat(16)}";`
                ),
                '```'
            ].join('\n');
            const table =
                '| Row | Wide column A | Wide column B | Wide column C |\n| --- | --- | --- | --- |\n' +
                Array.from(
                    { length: 12 },
                    (_, index) =>
                        `| ${index + 1} | ${'wide_value_'.repeat(10)} | ${'measurement_'.repeat(10)} | ${'horizontal_'.repeat(10)} |`
                ).join('\n');
            return reset(name, [
                message('user', 'Show a long answer with wide code and a table.'),
                message(
                    'assistant',
                    [
                        ...Array.from({ length: 25 }, (_, index) =>
                            paragraph(index + 1, 'Huge answer')
                        ),
                        code,
                        table,
                        ...Array.from({ length: 25 }, (_, index) =>
                            paragraph(index + 26, 'Huge answer')
                        )
                    ].join('\n\n')
                )
            ]);
        }
        if (name === 'pending') {
            reset(name, [
                message('user', 'Load the pending fixture context.'),
                message('assistant', '', 'streaming')
            ]);
            chatStore.state.isStreaming = true;
            chatStore.state.progressEvents = Array.from({ length: 10 }, (_, index) =>
                progress(
                    `Fixture context step ${index + 1}: loading a synthetic source description.`,
                    index % 2 ? 'tool_result' : 'tool_call'
                )
            );
        }
    };
    const newTurn = () => {
        stopTimer();
        scenario = 'new turn';
        chatStore.state.messages = [
            ...chatStore.state.messages.map((entry) =>
                entry.status === 'streaming' ? { ...entry, status: 'done' as const } : entry
            ),
            message('user', `New fixture question ${sequence + 1}.`),
            message('assistant', '', 'streaming')
        ];
        chatStore.state.composer = '';
        chatStore.state.conversationStage = 'active';
        chatStore.state.isStreaming = true;
        chatStore.state.contextStatusCollapsed = true;
        chatStore.state.progressEvents = [progress('Understanding this fixture question…')];
        chatStore.state.composerFocusRequest += 1;
    };
    const append = () => {
        if (chatStore.state.messages.at(-1)?.role !== 'assistant') newTurn();
        const id = chatStore.state.messages.at(-1)!.id;
        chunks += 1;
        chatStore.state.messages = chatStore.state.messages.map((entry) =>
            entry.id === id
                ? {
                      ...entry,
                      status: 'streaming',
                      content:
                          entry.content +
                          (entry.content ? '\n\n' : '') +
                          paragraph(chunks, 'Stream chunk')
                  }
                : entry
        );
        chatStore.state.isStreaming = true;
        chatStore.state.composer = '';
        chatStore.state.interactionTick += 1;
    };
    const finish = (status: 'done' | 'stopped' | 'error') => {
        stopTimer();
        if (chatStore.state.messages.at(-1)?.role !== 'assistant') newTurn();
        const id = chatStore.state.messages.at(-1)!.id;
        chatStore.state.messages = chatStore.state.messages.map((entry) =>
            entry.id === id ? { ...entry, status } : entry
        );
        chatStore.state.isStreaming = false;
        chatStore.state.progressEvents =
            status === 'done'
                ? []
                : [
                      progress(
                          status === 'error'
                              ? 'Synthetic connection error. Use the lab controls to continue.'
                              : 'Response stopped.',
                          status === 'error' ? 'error' : 'status'
                      )
                  ];
        scenario = status;
    };
    const transcript = () =>
        document.querySelector<HTMLElement>('[role="region"][aria-label="Conversation"]');
    const clickControl = (label: string) => {
        const control = [...document.querySelectorAll('button')].find(
            (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === label
        );
        if (!control) throw new Error(`The ${label} control is not currently visible.`);
        control.click();
    };
    const command = async (action: string, value?: unknown) => {
        try {
            if (['idle', 'short', 'long', 'huge', 'pending', 'clear'].includes(action))
                seed(action);
            else if (action === 'new' || action === 'race') {
                newTurn();
                if (action === 'race') {
                    append();
                    scenario = 'new turn + immediate chunk';
                }
            } else if (action === 'burst') {
                append();
                scenario = 'stream burst';
            } else if (action === 'start') {
                stopTimer();
                append();
                scenario = 'sustained stream';
                timer = setInterval(() => {
                    append();
                    report();
                }, 200);
            } else if (action === 'stop' || action === 'error' || action === 'done')
                finish(action === 'stop' ? 'stopped' : action);
            else if (action === 'expand' || action === 'collapse')
                clickControl(
                    action === 'expand' ? 'Expand context status' : 'Collapse context status'
                );
            else if (action === 'latest') clickControl('Latest response');
            else if (action === 'motion')
                document.documentElement.dataset.scrollCheckReducedMotion = String(value === true);
            else if (action === 'large-text' || action === 'normal-text')
                document.documentElement.dataset.scrollCheckLargeText = String(
                    action === 'large-text'
                );
            else if (action !== 'report') {
                const region = transcript();
                if (!region) throw new Error('Choose a conversation scenario first.');
                if (action === 'top') region.scrollTo({ top: 0, behavior: 'instant' });
                else if (action === 'bottom')
                    region.scrollTo({ top: region.scrollHeight, behavior: 'instant' });
                else if (action === 'older')
                    region.scrollBy({
                        top: -Math.max(300, region.clientHeight * 0.75),
                        behavior: 'instant'
                    });
                else if (action === 'focus') region.focus({ preventScroll: true });
                else throw new Error(`Unknown fixture command: ${action}`);
            }
            await tick();
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            );
            report();
        } catch (error) {
            report(error instanceof Error ? error.message : 'Fixture command failed.');
        }
    };
    onMount(() => {
        const receive = (event: MessageEvent) => {
            if (
                event.origin !== window.location.origin ||
                event.source !== window.parent ||
                event.data?.type !== 'chat-scroll-command' ||
                typeof event.data.action !== 'string'
            )
                return;
            void command(event.data.action, event.data.value);
        };
        window.addEventListener('message', receive);
        const requested = new URL(window.location.href).searchParams.get('scenario');
        void command(
            requested && ['idle', 'short', 'long', 'huge', 'pending'].includes(requested)
                ? requested
                : window.parent === window
                  ? 'long'
                  : 'short'
        );
        return () => {
            stopTimer();
            window.removeEventListener('message', receive);
            delete document.documentElement.dataset.scrollCheckReducedMotion;
            delete document.documentElement.dataset.scrollCheckLargeText;
        };
    });
</script>

<style>
    :global(html[data-scroll-check-reduced-motion='true'] *) {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
    }
    :global(html[data-scroll-check-large-text='true']) {
        font-size: 20px;
    }
    :global(html[data-scroll-check-large-text='true'] .chat-message-markdown) {
        font-size: 1.25em;
    }
</style>
