/** Same limits as the backend (lib/staffAccounts.ts). The server checks again; this only saves a round trip. */
export const MIN_PASSWORD_LENGTH = 12;
// bcrypt reads only the first 72 bytes, so the server refuses a longer password.
export const MAX_PASSWORD_BYTES = 72;

/** A message if the password is not allowed, or `null` if it is. */
export function passwordProblem(password: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return `Use at most ${MAX_PASSWORD_BYTES} bytes.`;
    return null;
}

// No 0/O, 1/l/I: a password that someone reads out loud must not be ambiguous.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GENERATED_LENGTH = 20;

/** A random temporary password, from the browser's secure random source. */
export function generatePassword(): string {
    const limit = 256 - (256 % ALPHABET.length); // values above this would favour the first letters
    let out = '';
    while (out.length < GENERATED_LENGTH) {
        const bytes = crypto.getRandomValues(new Uint8Array(GENERATED_LENGTH));
        for (const byte of bytes) {
            if (byte < limit && out.length < GENERATED_LENGTH) out += ALPHABET[byte % ALPHABET.length];
        }
    }
    return out;
}
