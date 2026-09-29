export const blogDescription = 'Notes on research, software, and things worth exploring.';

export const formatPostDate = (date: string, lang = 'en') =>
    new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00Z`));
