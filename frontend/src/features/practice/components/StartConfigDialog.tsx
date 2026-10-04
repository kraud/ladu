import { PlayIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { SavedConfig } from '../types';

/**
 * Asked when the user selects a saved configuration: start a session with it right away (the first
 * exercise opens; the settings screen is skipped), or open it in New configuration to change it first.
 * `error` is a reason the direct start did not work (for example no exercise matches); the dialog stays
 * open so the user can change the settings instead.
 */
export function StartConfigDialog({
    config,
    starting,
    error,
    onStart,
    onChange,
    onCancel,
}: {
    config: SavedConfig;
    starting: boolean;
    error: string | null;
    onStart: () => void;
    onChange: () => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    return (
        <Dialog open onOpenChange={(open) => !open && !starting && onCancel()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{config.name}</DialogTitle>
                    <DialogDescription>{t('practice:configs.startDialog.question')}</DialogDescription>
                </DialogHeader>
                {error && (
                    <p className="err show" role="alert">
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" disabled={starting} onClick={onChange}>
                        <SlidersHorizontalIcon aria-hidden size={14} />
                        {t('practice:configs.startDialog.change')}
                    </Button>
                    <Button type="button" disabled={starting} onClick={onStart}>
                        {starting ? (
                            <>
                                <span className="spinner" />
                                {t('practice:setup.starting')}
                            </>
                        ) : (
                            <>
                                <PlayIcon aria-hidden weight="fill" size={14} />
                                {t('practice:configs.startDialog.start')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
