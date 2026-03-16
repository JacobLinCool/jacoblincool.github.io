export const parseBooleanPublicValue = (value: string | undefined, defaultValue: boolean) => {
    if (!value) {
        return defaultValue;
    }

    const normalized = value.trim().toLowerCase();
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }

    return defaultValue;
};

export const parseOptionalPublicString = (value: string | undefined) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};
