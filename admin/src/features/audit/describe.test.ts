import { describe, expect, it } from 'vitest';
import { describeMetadata, describeTarget } from '@/features/audit/describe';
import type { AuditEntry } from '@/features/audit/types';

const entry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
    id: 'a1',
    createdAt: '2026-10-01T10:00:00.000Z',
    action: 'user.ban',
    staffId: 's1',
    staffName: 'Sam',
    targetType: 'user',
    targetId: 'u1',
    targetStaffName: null,
    reason: null,
    metadata: null,
    ...overrides,
});

describe('describeMetadata', () => {
    it('is empty without metadata', () => {
        expect(describeMetadata(null)).toBe('');
        expect(describeMetadata({})).toBe('');
    });

    it('shows a role change as one change', () => {
        expect(describeMetadata({ email: 'a@x.test', from: 'support', to: 'viewer' })).toBe('support → viewer · email: a@x.test');
    });

    it('skips empty values, objects and the "actor" marker, and limits the length', () => {
        expect(describeMetadata({ actor: 'system', email: 'a@x.test', note: null, deep: { a: 1 }, empty: '' })).toBe('email: a@x.test');
        expect(describeMetadata({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }).split(' · ')).toHaveLength(4);
    });

    it('shows a boolean as text', () => {
        expect(describeMetadata({ wasTemporary: true })).toBe('wasTemporary: true');
    });
});

describe('describeTarget', () => {
    it('links a user row to the user, and names it by email when the row kept one', () => {
        expect(describeTarget(entry({ metadata: { email: 'kaja@x.test' } }))).toEqual({ text: 'kaja@x.test', userId: 'u1' });
        expect(describeTarget(entry())).toEqual({ text: 'u1', userId: 'u1' });
    });

    it('does not link a purged account', () => {
        expect(describeTarget(entry({ action: 'user.purge', metadata: { email: 'kaja@x.test' } }))).toEqual({
            text: 'kaja@x.test (purged)',
            userId: null,
        });
    });

    it('names a staff target by its name, and falls back to the email, then the id', () => {
        expect(describeTarget(entry({ targetType: 'staff', targetId: 's2', targetStaffName: 'Target Person' })).text).toBe('Target Person');
        expect(describeTarget(entry({ targetType: 'staff', targetId: 's2', metadata: { email: 't@x.test' } })).text).toBe('t@x.test');
        expect(describeTarget(entry({ targetType: 'staff', targetId: 's2' })).text).toBe('s2');
    });

    it('handles a row with no target', () => {
        expect(describeTarget(entry({ targetType: null, targetId: null })).text).toBe('—');
    });
});
