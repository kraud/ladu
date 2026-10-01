import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStaffMember, fetchStaff, runStaffAction, type CreateStaffBody, type StaffActionBody, type StaffActionName } from '@/features/staff/api';

export const staffListKeys = { list: ['staff', 'list'] as const };

export function useStaffList() {
    return useQuery({ queryKey: staffListKeys.list, queryFn: fetchStaff });
}

/** A staff change also writes an audit row, so the audit pages go stale too. */
function useRefreshAfterChange() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: staffListKeys.list });
        void queryClient.invalidateQueries({ queryKey: ['audit'] });
    };
}

export function useCreateStaff() {
    const refresh = useRefreshAfterChange();
    return useMutation({ mutationFn: (body: CreateStaffBody) => createStaffMember(body), onSuccess: refresh });
}

export function useStaffAction(id: string) {
    const refresh = useRefreshAfterChange();
    return useMutation({
        mutationFn: (vars: { action: StaffActionName } & StaffActionBody) => {
            const { action, ...body } = vars;
            return runStaffAction(id, action, body);
        },
        onSuccess: refresh,
    });
}
