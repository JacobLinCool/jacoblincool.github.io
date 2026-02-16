export const siteConfig = {
    identity: {
        name: 'Jacob Lin',
        shortName: 'Jacob',
        logoAlt: 'Jacob Lin logo'
    },

    chat: {
        taglines: [
            'I am Jacob',
            'I am a Passionate Developer',
            'I am a Curious Learner',
            'I am a Researcher of Artificial Intelligence',
            'I am a Researcher of Human-Computer Interaction',
            'I am a 1st Year Graduate Student at NYCU',
            'I am a ex-GDG on Campus Lead',
            'Nice to meet you!'
        ],

        promptChips: [
            {
                id: 'intro-work',
                label: 'What are you building now?',
                prompt: 'What are you currently building, and what problem are you solving?'
            },
            {
                id: 'research-focus',
                label: 'Tell me about your research',
                prompt: 'What is your research focus in AI and HCI, and what are you working on?'
            },
            {
                id: 'dev-journey',
                label: 'Your journey into tech',
                prompt: 'How did you get into programming and technology? What shaped your path?'
            },
            {
                id: 'site-behind',
                label: 'How was this site built?',
                prompt: 'What technologies and ideas went into building this personal site?'
            }
        ],

        warmReplies: [
            {
                keywords: ['research', 'ai', 'hci'],
                reply: "I'm exploring the intersection of AI and human-computer interaction — specifically, how we can design interfaces that adapt to people rather than forcing people to adapt to them. Right now I'm interested in how language models can become more useful collaborators in creative and technical workflows, not just answer machines. The research is early, but the questions keep me up at night in the best way."
            },
            {
                keywords: ['journey', 'how did you', 'path'],
                reply: "I started by tinkering with small scripts in high school, just automating things that annoyed me. That curiosity led me to open-source communities, then to leading GDG on Campus where I organized events and helped others get started. Somewhere along the way I realized I wanted to understand not just how to build things, but why certain designs click with people — that's what brought me to grad school and HCI research."
            },
            {
                keywords: ['site', 'built', 'technolog'],
                reply: "This site is built with SvelteKit and deployed on Firebase. The chat interface you're using right now is the centerpiece — I wanted the experience to feel like a conversation, not a static portfolio. The typing animation, streaming responses, and layout transitions are all custom. I treat this site as a living playground where I experiment with interaction ideas from my research."
            }
        ],

        fallbackReply:
            'I hear you. My default approach is to clarify the goal, define one concrete next step, and keep momentum with short feedback loops. If you want, I can break this into a practical mini-plan with tradeoffs and what to do first.'
    }
};
