import { http, HttpResponse } from 'msw';
import type { HealthResponse } from '@/features/health/types';

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

export function makeHealth(overrides: Partial<HealthResponse> = {}): HealthResponse {
    return {
        service: {
            database: 'ok',
            environment: 'prod',
            sha: '0123456789abcdef0123456789abcdef01234567',
            nodeVersion: 'v24.19.0',
            uptimeSeconds: 93_784,
            checkedAt: new Date().toISOString(),
        },
        database: {
            sizeBytes: 15_728_640,
            migration: { latest: '0013_ops_events', appliedCount: 14 },
            tables: { users: 1234, words: 50_000, translations: 120_000, tags: 40, practiceSessions: 7, loginEvents: 300, auditLog: 12 },
        },
        backups: {
            lastBackup: { ok: true, detail: 'ladu_prod_20261001T030000Z.dump', at: hoursAgo(5) },
            lastRestoreTest: { ok: true, detail: 'restored, 50000 rows in words', at: hoursAgo(72) },
        },
        links: [],
        linksStatus: 'not_set',
        ...overrides,
    };
}

export const healthHandler = (respond: () => HealthResponse | Response = () => makeHealth()) =>
    http.get('/api/admin/health', () => {
        const result = respond();
        return result instanceof Response ? result : HttpResponse.json(result);
    });

export { hoursAgo };
