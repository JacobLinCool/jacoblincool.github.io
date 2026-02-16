import type { PromptChip } from '$lib/types/chat';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const DEFAULT_PROMPT_CHIPS: PromptChip[] = [
    {
        id: 'intro-work',
        label: 'What are you building now?',
        prompt: 'What are you currently building, and what problem are you solving?'
    },
    {
        id: 'career-next',
        label: 'Career advice',
        prompt: 'If I want to grow as an engineer this year, where should I focus first?'
    },
    {
        id: 'stack-pick',
        label: 'Tech stack thinking',
        prompt: 'How do you usually choose a tech stack for a new product?'
    },
    {
        id: 'site-vibe',
        label: 'About this site',
        prompt: 'What experience are you trying to create with this personal site?'
    }
];

const trimForContext = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildWarmReply = (rawInput: string) => {
    const input = trimForContext(rawInput);
    const lc = input.toLowerCase();

    if (lc.includes('career') || lc.includes('grow') || lc.includes('engineer')) {
        return `Great question. If I were in your shoes, I'd focus on three things: shipping cadence, system thinking, and communication. Build one small thing every week, write short technical notes after each build, and ask for direct feedback from people you trust. Consistency compounds much faster than one big sprint.`;
    }

    if (lc.includes('stack') || lc.includes('tech')) {
        return `When I pick a stack, I optimize for team velocity first, then long-term clarity. I ask: what can we ship safely in two weeks, what will be painful in six months, and which tradeoff is acceptable now. I prefer boring infrastructure plus one area of experimentation, not five.`;
    }

    if (lc.includes('site') || lc.includes('experience') || lc.includes('design')) {
        return `I want this site to feel like an intentional conversation, not a brochure. The goal is simple: you type naturally, I respond clearly, and the interface stays out of the way while still feeling alive. The motion should support focus, not distract from it.`;
    }

    return `I hear you. My default approach is to clarify the goal, define one concrete next step, and keep momentum with short feedback loops. If you want, I can break this into a practical mini-plan with tradeoffs and what to do first.`;
};

const splitIntoChunks = (text: string) => {
    const chunks = text.match(/\S+\s*/g) ?? [text];
    return chunks;
};

export const streamAssistantReply = async function* (userInput: string): AsyncGenerator<string> {
    const fullReply = buildWarmReply(userInput);
    const chunks = splitIntoChunks(fullReply);

    for (const chunk of chunks) {
        await delay(28 + Math.random() * 52);
        yield chunk;
    }
};
