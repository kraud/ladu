import type { AuthUser } from '@/features/auth/types';
import type { Theme } from '@/lib/theme';

/** `POST /api/demo` body (demo-access.md). Both optional: the server falls back to English and no theme. */
export interface StartDemoRequest {
    /** The UI language as a label ("English"), like login sends it. */
    uiLanguage: string;
    /** Sent only when the visitor chose a theme on this browser. */
    theme?: Theme;
}

/** `POST /api/demo` → 201: a login-shaped answer with a token and the demo fields. */
export type StartDemoResponse = AuthUser;
