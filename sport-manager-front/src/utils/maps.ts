export const getMapsSearchUrl = (query: string): string => {
    const trimmed = query.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
};
