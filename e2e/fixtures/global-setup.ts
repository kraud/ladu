import { closePool, setOnboardingEnabled } from './db';

/**
 * Runs once before every e2e run, after the servers are up (so the migrations have been applied).
 *
 * The onboarding switch (onboarding.md D26) is global state. While it is on, every new account is sent
 * to `/onboarding` after sign-in, which breaks each spec that registers or signs in a learner. A local
 * database often has it on (the owner turns it on to try the flow by hand), so each run starts with it
 * off. `onboarding-gate.spec.ts` is the only spec that turns it on, and it turns it off again.
 */
export default async function globalSetup(): Promise<void> {
    try {
        await setOnboardingEnabled(false);
    } catch (error) {
        console.warn('[e2e] could not turn the onboarding switch off:', (error as Error).message);
    } finally {
        await closePool();
    }
}
