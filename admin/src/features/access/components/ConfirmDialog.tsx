import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormDialog } from '@/features/staff/components/StaffDialogs';

const MAX_REASON_LENGTH = 500;

/**
 * A confirm dialog with an optional reason, for one row action on the Access page (approve or remove a
 * request, send the "you can sign in" email). The description says what will happen, and what will not.
 */
export function ConfirmDialog({
    title,
    description,
    submitLabel,
    pending,
    error,
    onConfirm,
    onClose,
}: {
    title: string;
    description: string;
    submitLabel: string;
    pending: boolean;
    error: unknown;
    onConfirm: (reason: string | undefined) => void;
    onClose: () => void;
}) {
    const [reason, setReason] = useState('');
    return (
        <FormDialog
            title={title}
            description={description}
            submitLabel={submitLabel}
            canSubmit
            pending={pending}
            error={error}
            onSubmit={() => onConfirm(reason.trim() || undefined)}
            onClose={onClose}
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-reason">
                    Reason <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea id="confirm-reason" value={reason} maxLength={MAX_REASON_LENGTH} onChange={(e) => setReason(e.target.value)} />
            </div>
        </FormDialog>
    );
}
