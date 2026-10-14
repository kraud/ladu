import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export interface OpenWordDialogProps {
    /** The word a click on its row asked to open; `null` keeps the dialog closed. */
    wordId: string | null;
    /** The word as the table shows it (its first filled language), for the question. */
    label?: string;
    onClose: () => void;
    /** Called with the word id once the user has confirmed. */
    onOpen: (wordId: string) => void;
}

/**
 * "Open this word?" — a click on a table row asks first, then the page goes to `/word/$wordId`.
 * Shared by `/words` and `/tag/:id`. The dialog owns no navigation: the page does it in `onOpen`.
 */
export function OpenWordDialog({ wordId, label, onClose, onOpen }: OpenWordDialogProps) {
    const { t } = useTranslation();
    return (
        <ConfirmDialog
            open={wordId !== null}
            onOpenChange={(open) => !open && onClose()}
            title={t('review:openWord.title')}
            description={t('review:openWord.description', { word: label ?? '' })}
            confirmLabel={t('review:openWord.confirm')}
            destructive={false}
            onConfirm={() => {
                const id = wordId;
                onClose();
                if (id) onOpen(id);
            }}
        />
    );
}
