import { describe, expect, it } from 'vitest';
import { coveredLanguages } from './coveredLanguages';

const ACCOUNT = ['English', 'Spanish', 'German', 'Estonian'];

describe('coveredLanguages', () => {
    it('leaves out the start language and the languages that are not on the account', () => {
        expect(coveredLanguages(['English', 'Spanish', 'German', 'Estonian'], 'Spanish', ['English', 'Spanish', 'Estonian'])).toEqual({
            shown: ['English', 'Estonian'],
            more: 0,
        });
    });

    it('keeps the order of the covered list', () => {
        expect(coveredLanguages(['English', 'German', 'Estonian'], 'Spanish', ACCOUNT).shown).toEqual(['English', 'German', 'Estonian']);
    });

    it('shows up to 4 flags, then counts the rest', () => {
        const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        expect(coveredLanguages(many, 'A', many)).toEqual({ shown: ['B', 'C', 'D', 'E'], more: 2 });
        expect(coveredLanguages(['A', 'B', 'C', 'D', 'E'], 'A', many)).toEqual({ shown: ['B', 'C', 'D', 'E'], more: 0 });
    });

    it('gives nothing when the sense covers only the start language', () => {
        expect(coveredLanguages(['Spanish'], 'Spanish', ACCOUNT)).toEqual({ shown: [], more: 0 });
    });
});
