export interface BackupEvent {
    ok: boolean;
    detail: string | null;
    at: string;
}

export interface HealthResponse {
    service: {
        database: 'ok' | 'error';
        environment: string;
        sha: string;
        nodeVersion: string;
        uptimeSeconds: number;
        checkedAt: string;
    };
    /** `null` when the database did not answer. */
    database: {
        sizeBytes: number;
        migration: { latest: string | null; appliedCount: number };
        tables: Record<string, number>;
    } | null;
    /** `null` when the database did not answer. Inside, a `null` event means "nothing recorded". */
    backups: { lastBackup: BackupEvent | null; lastRestoreTest: BackupEvent | null } | null;
}
