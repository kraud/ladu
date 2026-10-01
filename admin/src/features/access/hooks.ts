import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    addInvites,
    allowLogin,
    disallowLogin,
    disallowLoginMany,
    fetchAccess,
    removeInvite,
    saveGate,
    signOutEveryone,
} from '@/features/access/api';
import type { AccessMode, AccessState, GateName } from '@/features/access/types';

export const accessKeys = { state: ['access'] as const };

export function useAccessState() {
    return useQuery({ queryKey: accessKeys.state, queryFn: fetchAccess });
}

/** Every answer carries the new state, so the page shows it at once. A change also writes an audit row. */
function useStoreAnswer() {
    const queryClient = useQueryClient();
    return (state: AccessState) => {
        queryClient.setQueryData(accessKeys.state, state);
        void queryClient.invalidateQueries({ queryKey: ['audit'] });
    };
}

/**
 * Same, for a change to who may sign in: the users list shows it in a column and a filter, and the user
 * page shows it with a button, so those go stale too.
 */
function useStoreLoginAnswer() {
    const store = useStoreAnswer();
    const queryClient = useQueryClient();
    return (state: AccessState) => {
        store(state);
        void queryClient.invalidateQueries({ queryKey: ['users'] });
    };
}

export function useSaveGate(gate: GateName) {
    const store = useStoreAnswer();
    return useMutation({
        mutationFn: (body: { mode: AccessMode; note: string; reason?: string }) => saveGate(gate, body),
        onSuccess: store,
    });
}

export function useAddInvites() {
    const store = useStoreAnswer();
    return useMutation({ mutationFn: addInvites, onSuccess: store });
}

export function useRemoveInvite() {
    const store = useStoreAnswer();
    return useMutation({ mutationFn: removeInvite, onSuccess: store });
}

export function useAllowLogin() {
    const store = useStoreLoginAnswer();
    return useMutation({ mutationFn: allowLogin, onSuccess: store });
}

export function useDisallowLoginMany() {
    const store = useStoreLoginAnswer();
    return useMutation({ mutationFn: disallowLoginMany, onSuccess: store });
}

export function useDisallowLogin() {
    const store = useStoreLoginAnswer();
    return useMutation({ mutationFn: disallowLogin, onSuccess: store });
}

/** Ends every learner session. No state comes back, only the number of accounts; the audit pages go stale. */
export function useSignOutEveryone() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: signOutEveryone,
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['audit'] }),
    });
}
