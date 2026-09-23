/**
 * The provider registry — one lookup point so `oauthController.ts` never
 * branches on a provider name itself. Adding a future provider means one
 * new adapter file plus one line here, not a change to the controller.
 */
import type { OAuthProvider } from '../types';

const { getGoogleProvider } = require('./google');

const PROVIDER_FACTORIES: Record<string, () => OAuthProvider | undefined> = {
    google: getGoogleProvider,
};

/** `undefined` for an unknown name or a known-but-unconfigured one — callers treat both as 404. */
function getProvider(name: string): OAuthProvider | undefined {
    const factory = PROVIDER_FACTORIES[name];
    return factory ? factory() : undefined;
}

/** `{ google: true }` etc. — drives `GET /api/auth/providers`. */
function listConfiguredProviders(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const name of Object.keys(PROVIDER_FACTORIES)) {
        result[name] = PROVIDER_FACTORIES[name]() !== undefined;
    }
    return result;
}

export = { getProvider, listConfiguredProviders };
