const SUPPORTED_LOCALES = new Set(['en', 'zh-tw']);

export const resolveLocale = (pathname: string, acceptLanguage: string | null): string => {
    const parts = pathname.split('/').filter(Boolean);
    const candidate = parts[0]?.toLowerCase();
    if (candidate && SUPPORTED_LOCALES.has(candidate)) {
        return candidate;
    }

    if (acceptLanguage) {
        const normalized = acceptLanguage.toLowerCase();
        if (normalized.includes('zh-tw')) {
            return 'zh-tw';
        }
    }

    return 'en';
};
