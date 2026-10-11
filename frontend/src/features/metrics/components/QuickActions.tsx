import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ShuffleIcon, TranslateIcon } from '@phosphor-icons/react';
import { useRandomPractice } from '@/features/practice/useRandomPractice';
import { useIsMobile } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';

/** One big square-ish button: a large accent icon with the label underneath it. */
function QuickAction({
    icon,
    label,
    onClick,
    disabled,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-5 text-sm font-medium text-foreground transition-colors',
                'hover:bg-(--accent-soft) hover:text-(--accent-strong) disabled:pointer-events-none disabled:opacity-50',
            )}
        >
            <span aria-hidden className="text-(--accent) [&_svg]:size-9">
                {icon}
            </span>
            {label}
        </button>
    );
}

/**
 * The dashboard's two quick actions (the same two as the bottom of the phone menu): random practice and a
 * new word. Two equal halves of one row, each a big icon with its label under it. They sit under the stat
 * cards on a desktop and are not rendered on a phone, where the menu has them.
 */
export function QuickActions() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const randomPractice = useRandomPractice();

    if (isMobile) return null;

    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <QuickAction
                    icon={<ShuffleIcon />}
                    label={t('common:header.quick.randomPractice')}
                    disabled={randomPractice.isPending}
                    onClick={() => randomPractice.run()}
                />
                <QuickAction
                    icon={<TranslateIcon />}
                    label={t('common:header.quick.newWord')}
                    onClick={() => void navigate({ to: '/addWord/{-$partOfSpeech}' })}
                />
            </div>
            {randomPractice.dialog}
        </>
    );
}
