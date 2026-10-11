/**
 * "Random practice" with its safety net, shared by the phone menu and the dashboard's quick actions:
 * start a session with the default settings (`useQuickPractice`), but when a session is running, ask first
 * (`LeaveSessionDialog`: save it or leave it). A finished session (the results screen) has all its answers
 * saved, so nothing is asked then.
 *
 * Render `dialog` somewhere in the tree that uses `run`.
 */
import { useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { LeaveSessionDialog } from './components/LeaveSessionDialog';
import { useSessionFor } from './sessionStore';
import { useQuickPractice } from './useQuickPractice';

export function useRandomPractice(): {
    /** `onBeforeConfirm`: runs before the dialog opens (the phone menu closes first: two modal layers fight for focus). `onStarted`: runs when a session started. */
    run: (options?: { onBeforeConfirm?: () => void; onStarted?: () => void }) => void;
    isPending: boolean;
    dialog: ReactNode;
} {
    const quickPractice = useQuickPractice();
    const user = useAuthStore((s) => s.user);
    const session = useSessionFor(user?.id);
    const needsConfirm = session !== null && session.view !== 'results';
    const [confirming, setConfirming] = useState(false);

    function run({ onBeforeConfirm, onStarted }: { onBeforeConfirm?: () => void; onStarted?: () => void } = {}) {
        if (needsConfirm) {
            onBeforeConfirm?.();
            setConfirming(true);
        } else {
            quickPractice.start(onStarted);
        }
    }

    const dialog =
        session && needsConfirm ? (
            <LeaveSessionDialog
                open={confirming}
                onOpenChange={setConfirming}
                session={session}
                onLeave={() => {
                    setConfirming(false);
                    quickPractice.start();
                }}
            />
        ) : null;

    return { run, isPending: quickPractice.isPending, dialog };
}
