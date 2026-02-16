export type BadgeDefinition = {
    label: string;
    description: string;
    icon?: string;
};

export const BADGE_REGISTRY: Record<string, BadgeDefinition> = {
    friend: { label: '認識的人', description: 'Someone I know personally', icon: '👋' },
    college: { label: '大學同學', description: 'College classmate', icon: '🎓' },
    coworker: { label: '同事', description: 'Worked together', icon: '💼' },
    community: { label: '社群夥伴', description: 'Met through developer community', icon: '🌐' }
};
