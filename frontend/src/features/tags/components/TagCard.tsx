/**
 * The `/tags` list card (Slice 5) — badges, label, 2-line description,
 * word/follower stats, "Cloned from" line, "by <author>" row, and
 * relation-aware actions. `MOCKUPS/tags.html`'s `.tagcard`.
 *
 * `.tagcard-main` (click/Enter/Space opens the tag) and `.tagcard-foot`
 * (the action buttons) are siblings, not nested — matching the mockup's own
 * DOM shape, so there's no click-bubbling conflict between "open the card"
 * and "click a footer button" to reason about.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { CopyIcon, UserMinusIcon, UserPlusIcon, UsersIcon } from '@phosphor-icons/react';
import { FlagIcon } from '@/components/common/FlagIcon';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { ClonedBadge, RelationBadge, VerifiedMark, VisibilityBadge, hasVerifiedBadge, tagRelation } from './TagBadge';
import type { TagSummary } from '../types';

export interface TagCardProps {
    tag: TagSummary;
    /** The action footer. Off on the All and Yours tabs, where actions live on the tag page. */
    showActions?: boolean;
    onFollow?: (tag: TagSummary) => void;
    onUnfollow?: (tag: TagSummary) => void;
    onClone?: (tag: TagSummary) => void;
}

const MAX_FLAGS = 3;

/**
 * The languages of the tag's words that the user also uses (the words can have more: those do not matter
 * to this user). In the order of the user's account. Up to three flags, then a "+N" like the Tags column
 * of the words table.
 */
function LanguageFlags({ languages }: { languages: string[] }) {
    const { t } = useTranslation();
    const userLanguages = useAuthStore((s) => s.user?.languages);
    const shared = (userLanguages ?? []).filter((language) => languages.includes(language));
    if (shared.length === 0) return null;
    const overflow = shared.length - MAX_FLAGS;
    return (
        <span className="ml-auto flex items-center gap-1" aria-label={t('tags:card.languages', { list: shared.join(', ') })}>
            {shared.slice(0, MAX_FLAGS).map((language) => (
                <FlagIcon key={language} lang={language} title={language} width={16} height={12} />
            ))}
            {overflow > 0 && <span className="hint text-xs">+{overflow}</span>}
        </span>
    );
}

/** One-line description; a more/less button shows only when the text is cut off. */
function Description({ text }: { text: string }) {
    const { t } = useTranslation();
    const ref = useRef<HTMLParagraphElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [truncated, setTruncated] = useState(false);

    useLayoutEffect(() => {
        const el = ref.current;
        if (el) setTruncated(el.scrollWidth > el.clientWidth);
    }, [text, expanded]);

    const toggle = (
        <button type="button" className="t-more" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {t(expanded ? 'tags:card.less' : 'tags:card.more')}
        </button>
    );

    // Open: the button follows the last word. Closed: one line, button at the right edge.
    if (expanded) {
        return (
            <p className="t-desc t-desc-open">
                {text} {toggle}
            </p>
        );
    }
    return (
        <div className="t-desc-row">
            <p ref={ref} className="t-desc">
                {text}
            </p>
            {truncated && toggle}
        </div>
    );
}

export function TagCard({ tag, showActions = true, onFollow, onUnfollow, onClone }: TagCardProps) {
    const { t } = useTranslation();
    const relation = tagRelation(tag);
    // The mockup hides the follower count specifically for an unavailable
    // tag — its own visibility is exactly what put it out of reach, so a
    // stale follower number there would be more confusing than absent.
    const showFollowerCount = relation !== 'unavailable';
    const authorVerified = hasVerifiedBadge(tag.author.badges);

    return (
        <article className="card tagcard">
            <div className="tagcard-main">
                <Link
                    to="/tag/$tagId"
                    params={{ tagId: tag.id }}
                    className="t-link"
                    aria-label={t('tags:card.openAriaLabel', { label: tag.label })}
                >
                    <span className="t-label">
                        {tag.label}
                        {authorVerified && tag.visibility === 'Public' && <VerifiedMark />}
                    </span>
                </Link>
                {tag.description ? (
                    <Description text={tag.description} />
                ) : (
                    <p className="t-desc italic">{t('tags:card.noDescription')}</p>
                )}
                <div className="t-badge-row t-badge-row-card">
                    <RelationBadge relation={relation} />
                    <VisibilityBadge visibility={tag.visibility} />
                    {tag.sourceTag && <ClonedBadge sourceLabel={tag.sourceTag.label} />}
                    <LanguageFlags languages={tag.languages} />
                </div>
                <div className="t-stats">
                    <span>
                        <b className="num">{tag.wordCount}</b> {t('tags:card.wordCount', { count: tag.wordCount })}
                    </span>
                    {showFollowerCount && (
                        <>
                            <span className="dotsep">·</span>
                            <span className="flex items-center gap-1">
                                <b className="num">{tag.followerCount}</b>
                                <UsersIcon size={12} />
                            </span>
                        </>
                    )}
                    {relation !== 'owned' && (
                        <span className="t-by-inline">
                            {t('tags:card.by')}{' '}
                            <span
                                className={authorVerified ? 't-by-verified' : undefined}
                                title={authorVerified ? t('tags:authorBadge.officialTitle') : undefined}
                            >
                                {tag.author.username}
                            </span>
                        </span>
                    )}
                </div>
                {relation === 'unavailable' && <div className="t-note">{t('tags:card.unavailableNote')}</div>}
            </div>

            {showActions && (
                <div className="tagcard-foot">
                    {relation === 'followed' && (
                        <>
                            <Button size="xs" variant="secondary" onClick={() => onUnfollow?.(tag)}>
                                <UserMinusIcon size={12} aria-hidden="true" />
                                {t('tags:card.unfollow')}
                            </Button>
                            <Button size="xs" variant="secondary" onClick={() => onClone?.(tag)}>
                                <CopyIcon size={12} aria-hidden="true" />
                                {t('tags:card.clone')}
                            </Button>
                        </>
                    )}
                    {relation === 'discover' && (
                        <>
                            <Button size="xs" variant="secondary" onClick={() => onFollow?.(tag)}>
                                <UserPlusIcon size={12} aria-hidden="true" />
                                {t('tags:card.follow')}
                            </Button>
                            <Button size="xs" variant="secondary" onClick={() => onClone?.(tag)}>
                                <CopyIcon size={12} aria-hidden="true" />
                                {t('tags:card.clone')}
                            </Button>
                        </>
                    )}
                    {relation === 'unavailable' && (
                        <Button size="xs" variant="secondary" onClick={() => onUnfollow?.(tag)}>
                            <UserMinusIcon size={12} aria-hidden="true" />
                            {t('tags:card.unfollow')}
                        </Button>
                    )}
                </div>
            )}
        </article>
    );
}
