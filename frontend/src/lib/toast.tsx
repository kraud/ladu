/**
 * A "Saving…" toast that morphs in place into a success or error toast —
 * `react-toastify`'s `toast.loading` -> `toast.update`. First use is the
 * word-create flow (`features/words/pages/AddWordPage.tsx`); extracted here
 * rather than inlined because the same morph shape (loading -> success with
 * an optional action, or loading -> error) is the general pattern for any
 * mutation whose success links somewhere, not a one-off.
 */
import { type ReactNode } from 'react';
import { toast, type Id } from 'react-toastify';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

function actionBody(message: string, action?: ToastAction): ReactNode {
    if (!action) return message;
    return (
        <span className="flex flex-col gap-1">
            <span>{message}</span>
            <button
                type="button"
                className="self-start font-semibold underline underline-offset-2"
                onClick={action.onClick}
            >
                {action.label}
            </button>
        </span>
    );
}

/** Starts an indefinite loading toast; returns its id for `resolveLoadingToast`. */
export function startLoadingToast(message: string): Id {
    return toast.loading(message);
}

/** Morphs a loading toast (from `startLoadingToast`) into a success toast, optionally with an action. */
export function resolveLoadingToastSuccess(id: Id, message: string, action?: ToastAction): void {
    toast.update(id, {
        render: actionBody(message, action),
        type: 'success',
        isLoading: false,
        autoClose: 5000,
    });
}

/** Morphs a loading toast (from `startLoadingToast`) into an error toast. */
export function resolveLoadingToastError(id: Id, message: string): void {
    toast.update(id, {
        render: message,
        type: 'error',
        isLoading: false,
        autoClose: 5000,
    });
}
