import { describe, it, expect } from 'vitest';
import { applySubstitutionToLineup } from '../src/utils/lineup';

describe('applySubstitutionToLineup', () => {
    it('remplace le sortant par l’entrant sur la position du sortant', () => {
        const lineup = { 1: 'A', 2: 'B', 50: 'C' };
        const res = applySubstitutionToLineup(lineup, 'A', 'C');
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        expect(res.nextLineup[1]).toBe('C');
    });

    it('swap OUT/IN si IN est déjà assigné à une autre position', () => {
        const lineup = { 1: 'A', 2: 'B', 50: 'C' };
        const res = applySubstitutionToLineup(lineup, 'A', 'C');
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        // OUT position 1 devient C
        expect(res.nextLineup[1]).toBe('C');
        // IN position 50 devient A
        expect(res.nextLineup[50]).toBe('A');
    });

    it('retourne OUT_NOT_FOUND si sortant absent', () => {
        const lineup = { 1: 'A' };
        const res = applySubstitutionToLineup(lineup, 'Z', 'B');
        expect(res.ok).toBe(false);
        if (res.ok) return;
        expect(res.reason).toBe('OUT_NOT_FOUND');
    });
});
