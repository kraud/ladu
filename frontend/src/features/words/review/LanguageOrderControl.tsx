/**
 * The language visibility/order control — a single flat row listing every
 * account language, at a stable position each language keeps regardless of
 * visibility (`languageOrder.ts`'s `order` model — toggling visibility never
 * moves a chip; only the ← / → arrows do, and only among currently visible
 * chips). Visibility toggles by clicking the flag itself (padded for a
 * bigger click target) rather than a separate icon button; there is no text
 * label. All languages are selected (visible) by default; clicking a flag
 * greys its chip out via `[data-hidden]` without moving it. A hidden chip's
 * arrows are disabled (nothing to reorder it relative to — hidden order was
 * never meaningful, only the visible set's order ever reaches the URL).
 *
 * A ← / → move animates the two swapped chips sliding past each other
 * (`lib/useFlipAnimation.ts`) rather than jumping instantly, so a reorder
 * reads as a movement — the visual feedback a drag gesture would otherwise
 * give for free, now that dragging itself is gone (D19).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { FlagIcon } from '@/components/common/FlagIcon';
import { languageByKey } from '@/lib/language';
import { useFlipAnimation } from '@/lib/useFlipAnimation';
import type { LangKey } from '@/features/words/types';
import { MIN_VISIBLE_LANGUAGES } from './search';
import { hideLanguage, initialOrder, moveWithinOrder, reconcileOrder, showLanguage } from './languageOrder';

export interface LanguageOrderControlProps {
    /** Visible languages, in display order (`search.lang` resolved). */
    active: LangKey[];
    /** Every account language, in account order. */
    allLanguages: LangKey[];
    onChange: (next: LangKey[]) => void;
}

const ARROW_BUTTON_CLASS =
    'inline-grid size-5 place-items-center rounded text-muted-foreground hover:bg-[var(--fg-soft)] hover:text-foreground disabled:opacity-35 disabled:pointer-events-none';

export function LanguageOrderControl({ active, allLanguages, onChange }: LanguageOrderControlProps) {
    const { t } = useTranslation();
    const [order, setOrder] = useState(() => initialOrder(active, allLanguages));
    const registerChip = useFlipAnimation<LangKey>(order);

    // Reconciles `order` when the account's language set changes, or when
    // `active` changed from OUTSIDE this component (a direct URL edit,
    // browser back/forward). Our own actions below always leave `order`
    // already consistent with the `active` they pass to `onChange`, so this
    // is a no-op on the very next render after any of them.
    useEffect(() => {
        setOrder((prev) => reconcileOrder(prev, active, allLanguages));
    }, [active, allLanguages]);

    const canHide = active.length > MIN_VISIBLE_LANGUAGES;

    function move(index: number, delta: -1 | 1) {
        const result = moveWithinOrder(order, active, index, delta);
        if (!result) return;
        setOrder(result.order);
        onChange(result.active);
    }

    function toggleVisibility(key: LangKey, isVisible: boolean) {
        if (isVisible) {
            const next = hideLanguage(active, key);
            if (next) onChange(next);
        } else {
            onChange(showLanguage(order, active, key));
        }
    }

    return (
        <div className="fb-group">
            <div className="fhead">
                <span className="label">{t('review:filters.languageOrder')}</span>
                <span className="hint">{t('review:filters.languageOrderHint')}</span>
            </div>
            <div className="chips">
                {order.map((key) => {
                    const isVisible = active.includes(key);
                    const index = active.indexOf(key);
                    const language = languageByKey(key)?.native ?? key;

                    return (
                        <span
                            key={key}
                            ref={registerChip(key)}
                            className="chip lang-chip"
                            data-lang={key}
                            data-hidden={isVisible ? undefined : true}
                        >
                            <button
                                type="button"
                                className={ARROW_BUTTON_CLASS}
                                aria-label={t('review:filters.moveEarlier', { language })}
                                disabled={!isVisible || index === 0}
                                onClick={() => move(index, -1)}
                            >
                                <CaretLeftIcon size={11} />
                            </button>
                            <button
                                type="button"
                                className="lang-flag-toggle"
                                aria-pressed={isVisible}
                                aria-label={
                                    isVisible
                                        ? t('review:filters.hideLanguage', { language })
                                        : t('review:filters.showLanguage', { language })
                                }
                                disabled={isVisible && !canHide}
                                onClick={() => toggleVisibility(key, isVisible)}
                            >
                                <FlagIcon lang={key} />
                            </button>
                            <button
                                type="button"
                                className={ARROW_BUTTON_CLASS}
                                aria-label={t('review:filters.moveLater', { language })}
                                disabled={!isVisible || index === active.length - 1}
                                onClick={() => move(index, 1)}
                            >
                                <CaretRightIcon size={11} />
                            </button>
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
