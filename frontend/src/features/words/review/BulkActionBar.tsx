/**
 * The bulk action bar — visible only once one or more rows are selected.
 * View at exactly one selection, Delete at one or more behind a
 * `ConfirmDialog`. Create-exercises and Assign-tag are absent, not disabled
 * (Phases 5 and 4 respectively).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export interface BulkActionBarProps {
    selectedCount: number;
    onView: () => void;
    /** Called once the user has confirmed the delete — this component owns the confirm step. */
    onDelete: () => void;
}

export function BulkActionBar({ selectedCount, onView, onDelete }: BulkActionBarProps) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);

    if (selectedCount === 0) return null;

    return (
        <>
            <div className="bulkbar">
                <span className="count">{selectedCount}</span>
                <span className="grow" style={{ fontSize: 13 }}>
                    {t('review:bulk.selected')}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedCount !== 1}
                    onClick={onView}
                >
                    {t('review:bulk.view')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="danger"
                    onClick={() => setConfirming(true)}
                >
                    {t('review:bulk.delete')}
                </Button>
            </div>
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title={t('review:bulk.confirmTitle', { count: selectedCount })}
                description={t('review:bulk.confirmDescription', { count: selectedCount })}
                confirmLabel={t('review:bulk.delete')}
                onConfirm={() => {
                    setConfirming(false);
                    onDelete();
                }}
            />
        </>
    );
}
