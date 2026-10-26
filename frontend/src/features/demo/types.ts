import type { AuthUser } from '@/features/auth/types';
import type { Theme } from '@/lib/theme';

/** `POST /api/demo` body (demo-access.md). The server falls back to English, all five languages and no theme. */
export interface StartDemoRequest {
    /** The UI language as a label ("English"), like login sends it. */
    uiLanguage: string;
    /** The languages the visitor picked on `/demo` (labels, ≥ 2, in the order picked; D16). */
    languages: string[];
    /** Sent only when the visitor chose a theme on this browser. */
    theme?: Theme;
    /** The Turnstile token, while the captcha is on (captcha.md). Works for this one request only. */
    captchaToken?: string;
}

/** `POST /api/demo` → 201: a login-shaped answer with a token and the demo fields. */
export type StartDemoResponse = AuthUser;
