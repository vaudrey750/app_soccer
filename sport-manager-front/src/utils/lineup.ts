export const applySubstitutionToLineup = (
    lineup: { [positionId: number]: string },
    outMemberId: string,
    inMemberId: string
) => {
    const outPos = Object.entries(lineup).find(([, memberId]) => memberId === outMemberId)?.[0];
    if (!outPos) {
        return { ok: false as const, reason: 'OUT_NOT_FOUND' as const };
    }

    const inPos = Object.entries(lineup).find(([, memberId]) => memberId === inMemberId)?.[0];

    const nextLineup: { [positionId: number]: string } = { ...lineup };
    nextLineup[Number(outPos)] = inMemberId;
    if (inPos) {
        nextLineup[Number(inPos)] = outMemberId;
    }

    return {
        ok: true as const,
        nextLineup,
        outPositionId: Number(outPos),
        inPositionId: inPos ? Number(inPos) : null,
    };
};
