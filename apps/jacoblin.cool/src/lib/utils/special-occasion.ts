export type SpecialOccasion = 'birthday';

const monthDayFormatters = new Map<string, Intl.DateTimeFormat>();

export const SITE_OCCASION_TIME_ZONE = 'Asia/Taipei';

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

export const resolveSpecialOccasion = (
    date: Date,
    timeZone = SITE_OCCASION_TIME_ZONE
): SpecialOccasion | null => {
    const { month, day } = getMonthAndDayInTimeZone(date, timeZone);

    if (month === 3 && day === 17) {
        return 'birthday';
    }

    return null;
};
