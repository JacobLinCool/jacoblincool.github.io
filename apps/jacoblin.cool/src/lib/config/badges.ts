export type BadgeDefinition = {
    label: string;
    description: string;
    icon?: string;
};

export const BADGE_REGISTRY: Record<string, BadgeDefinition> = {
    friend: { label: 'Friend', description: 'Someone I know personally', icon: '👋' },
    college: { label: 'College Classmate', description: 'College classmate', icon: '🎓' },
    coworker: { label: 'Coworker', description: 'Worked together', icon: '💼' },
    community: { label: 'Community Partner', description: 'Met through developer community', icon: '🌐' }
};
