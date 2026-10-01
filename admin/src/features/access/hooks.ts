import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addInvites, fetchAccess, removeInvite, saveRegistration } from '@/features/access/api';
import type { AccessState } from '@/features/access/types';

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

export function useSaveRegistration() {
    const store = useStoreAnswer();
    return useMutation({ mutationFn: saveRegistration, onSuccess: store });
}

export function useAddInvites() {
    const store = useStoreAnswer();
    return useMutation({ mutationFn: addInvites, onSuccess: store });
}

export function useRemoveInvite() {
    const store = useStoreAnswer();
    return useMutation({ mutationFn: removeInvite, onSuccess: store });
}
