export type RailEdgeState = {
    canPrev: boolean;
    canNext: boolean;
};

export const computeRailEdgeState = (track: HTMLElement): RailEdgeState => {
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    if (maxScrollLeft <= 1) {
        return { canPrev: false, canNext: false };
    }

    const scrollLeft = track.scrollLeft;
    return {
        canPrev: scrollLeft > 1,
        canNext: scrollLeft < maxScrollLeft - 1
    };
};

export const scrollRailByViewport = (
    track: HTMLElement,
    direction: -1 | 1,
    reducedMotion: boolean
): void => {
    const viewportStep = Math.max(320, Math.round(track.clientWidth * 0.88));
    track.scrollBy({
        left: direction * viewportStep,
        behavior: reducedMotion ? 'auto' : 'smooth'
    });
};
