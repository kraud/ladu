/** `GET /api/access` (public): the state of each gate, plus the owner's optional extra line, and whether the demo is on. */
export type AccessMode = 'open' | 'closed' | 'limited';

export interface GateStatus {
    mode: AccessMode;
    /** Plain text the owner typed (for example "Back at 14:00 UTC"). Not translated. Never markup. */
    note: string;
}

export interface AccessStatus {
    registration: GateStatus;
    login: GateStatus;
    /** The demo gate (demo-access.md). Only on/off: the caps are not public. */
    demo: { enabled: boolean };
    /** The onboarding switch (onboarding.md D26). While off, no account is sent to `/onboarding`. */
    onboarding: { enabled: boolean };
}

/**
 * What the app assumes when it cannot read the status: the server still enforces each gate. The demo
 * reads as off, so `/demo` never offers a start that the server would refuse. Onboarding reads as off for the same reason.
 */
export const OPEN_ACCESS: AccessStatus = {
    registration: { mode: 'open', note: '' },
    login: { mode: 'open', note: '' },
    demo: { enabled: false },
    onboarding: { enabled: false },
};
