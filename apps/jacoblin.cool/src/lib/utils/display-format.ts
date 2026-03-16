const numberFormatter = new Intl.NumberFormat('en-US');

const utcDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
});

export const formatCount = (value: number): string => numberFormatter.format(value);

export const formatUtcDateTime = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unavailable';
    }

    return `${utcDateTimeFormatter.format(date)} UTC`;
};
