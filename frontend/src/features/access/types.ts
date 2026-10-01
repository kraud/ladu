/** `GET /api/access` (public): the state of each gate, plus the owner's optional extra line. */
export type AccessMode = 'open' | 'closed' | 'limited';

export interface GateStatus {
    mode: AccessMode;
    /** Plain text the owner typed (for example "Back at 14:00 UTC"). Not translated. Never markup. */
    note: string;
}

export interface AccessStatus {
    registration: GateStatus;
    login: GateStatus;
}

/** What the app assumes when it cannot read the status: the server still enforces the gate. */
export const OPEN_ACCESS: AccessStatus = {
    registration: { mode: 'open', note: '' },
    login: { mode: 'open', note: '' },
};
