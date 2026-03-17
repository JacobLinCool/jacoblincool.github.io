import { z } from 'zod';
import specialOccasionsSource from '../../assets/special-occasions.json';
import type { PromptChip } from './knowledge-registry.js';

export type SpecialOccasion = string;

type SpecialOccasionMatcher = {
    kind: 'month-day';
    month: number;
    day: number;
};

export type SpecialOccasionDefinition = {
    id: SpecialOccasion;
    title: string;
    matcher: SpecialOccasionMatcher;
    description: string;
    promptChip: PromptChip;
};

export type SpecialOccasionCatalog = {
    version: string;
    timeZone: string;
    occasions: readonly SpecialOccasionDefinition[];
};

const monthDayFormatters = new Map<string, Intl.DateTimeFormat>();
const fullDateFormatters = new Map<string, Intl.DateTimeFormat>();

const promptChipSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    prompt: z.string().min(1)
});

const specialOccasionMatcherSchema = z.object({
    kind: z.literal('month-day'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31)
});

const specialOccasionDefinitionSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    matcher: specialOccasionMatcherSchema,
    description: z.string().min(1),
    promptChip: promptChipSchema
});

const specialOccasionCatalogSchema = z.object({
    version: z.string().min(1),
    timeZone: z.string().min(1),
    occasions: z.array(specialOccasionDefinitionSchema)
});

const ensureUniqueValues = (values: string[], label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
        if (seen.has(value)) {
            throw new Error(`Duplicate ${label}: ${value}`);
        }
        seen.add(value);
    }
};

export const buildStaticSpecialOccasionCatalog = (input: unknown): SpecialOccasionCatalog => {
    const catalog = specialOccasionCatalogSchema.parse(input);
    ensureUniqueValues(
        catalog.occasions.map((occasion) => occasion.id),
        'special occasion id'
    );
    ensureUniqueValues(
        catalog.occasions.map((occasion) => occasion.promptChip.id),
        'special occasion prompt chip id'
    );

    return catalog as SpecialOccasionCatalog;
};

const staticSpecialOccasionCatalog: SpecialOccasionCatalog =
    buildStaticSpecialOccasionCatalog(specialOccasionsSource);
const SPECIAL_OCCASIONS: readonly SpecialOccasionDefinition[] =
    staticSpecialOccasionCatalog.occasions;

export const SITE_OCCASION_TIME_ZONE: string = staticSpecialOccasionCatalog.timeZone;

const getMonthAndDayInTimeZone = (date: Date, timeZone: string) => {
    let formatter = monthDayFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            month: 'numeric',
            day: 'numeric'
        });
        monthDayFormatters.set(timeZone, formatter);
    }

    const parts = formatter.formatToParts(date);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);

    return { month, day };
};

const getFullDateInTimeZone = (date: Date, timeZone: string) => {
    let formatter = fullDateFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        fullDateFormatters.set(timeZone, formatter);
    }

    return formatter.format(date);
};

const formatMatcher = (matcher: SpecialOccasionMatcher) => {
    if (matcher.kind === 'month-day') {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC',
            month: 'long',
            day: 'numeric'
        }).format(new Date(Date.UTC(2026, matcher.month - 1, matcher.day)));
    }

    throw new Error(`Unsupported special occasion matcher: ${JSON.stringify(matcher)}`);
};

const matchesOccasion = (occasion: SpecialOccasionDefinition, date: Date, timeZone: string) => {
    const { month, day } = getMonthAndDayInTimeZone(date, timeZone);

    if (occasion.matcher.kind === 'month-day') {
        return month === occasion.matcher.month && day === occasion.matcher.day;
    }

    throw new Error(`Unsupported special occasion matcher: ${JSON.stringify(occasion.matcher)}`);
};

export const getSpecialOccasionCatalog = (): readonly SpecialOccasionDefinition[] =>
    SPECIAL_OCCASIONS;

export const loadStaticSpecialOccasionCatalog = (): SpecialOccasionCatalog =>
    staticSpecialOccasionCatalog;

export const getActiveSpecialOccasion = (
    date: Date,
    timeZone: string = SITE_OCCASION_TIME_ZONE
): SpecialOccasionDefinition | null =>
    SPECIAL_OCCASIONS.find((occasion) => matchesOccasion(occasion, date, timeZone)) ?? null;

export const resolveSpecialOccasion = (
    date: Date,
    timeZone: string = SITE_OCCASION_TIME_ZONE
): SpecialOccasion | null => {
    return getActiveSpecialOccasion(date, timeZone)?.id ?? null;
};

export const applySpecialOccasionPromptChips = (
    promptChips: PromptChip[],
    date: Date,
    timeZone: string = SITE_OCCASION_TIME_ZONE
): PromptChip[] => {
    const activeOccasion = getActiveSpecialOccasion(date, timeZone);
    if (!activeOccasion || promptChips.length === 0) {
        return promptChips;
    }

    return [activeOccasion.promptChip, ...promptChips.slice(0, promptChips.length - 1)];
};

export const buildSpecialOccasionSystemInstruction = (
    date: Date,
    timeZone: string = SITE_OCCASION_TIME_ZONE
): string => {
    const activeOccasion = getActiveSpecialOccasion(date, timeZone);
    const catalogLines = SPECIAL_OCCASIONS.map(
        (occasion) =>
            `- ${occasion.title}: ${formatMatcher(occasion.matcher)}. ${occasion.description}`
    );

    return [
        `Special occasions on this site follow the ${timeZone} calendar.`,
        `Today in ${timeZone} is ${getFullDateInTimeZone(date, timeZone)}.`,
        activeOccasion
            ? `The active special occasion today is ${activeOccasion.title}. ${activeOccasion.description}`
            : 'There is no active special occasion today.',
        'Known special occasions:',
        ...catalogLines
    ].join('\n');
};
