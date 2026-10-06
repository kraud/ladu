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
import { useTranslation } from 'react-i18next';
import { CopyIcon, UsersIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { avatarColor, avatarInitials } from '@/lib/avatar';
import { AuthorBadges, TagBadges, tagRelation } from './TagBadge';
import type { TagSummary } from '../types';

export interface TagCardProps {
    tag: TagSummary;
    onView: (tag: TagSummary) => void;
    onEdit?: (tag: TagSummary) => void;
    onDelete?: (tag: TagSummary) => void;
    onFollow?: (tag: TagSummary) => void;
    onUnfollow?: (tag: TagSummary) => void;
    onClone?: (tag: TagSummary) => void;
}

export function TagCard({ tag, onView, onEdit, onDelete, onFollow, onUnfollow, onClone }: TagCardProps) {
    const { t } = useTranslation();
    const relation = tagRelation(tag);
    // The mockup hides the follower count specifically for an unavailable
    // tag — its own visibility is exactly what put it out of reach, so a
    // stale follower number there would be more confusing than absent.
    const showFollowerCount = relation !== 'unavailable';

    function open() {
        onView(tag);
    }

    return (
        <article className="card tagcard">
            <div
                className="tagcard-main"
                role="link"
                tabIndex={0}
                aria-label={t('tags:card.openAriaLabel', { label: tag.label })}
                onClick={open}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        open();
                    }
                }}
            >
                <TagBadges tag={tag} />
                <span className="t-label">{tag.label}</span>
                {tag.description ? (
                    <p className="t-desc">{tag.description}</p>
                ) : (
                    <p className="t-desc italic">{t('tags:card.noDescription')}</p>
                )}
                <div className="t-stats">
                    <span>
                        <b className="num">{tag.wordCount}</b> {t('tags:card.wordCount', { count: tag.wordCount })}
                    </span>
                    {showFollowerCount && (
                        <>
                            <span className="dotsep">·</span>
                            <span className="flex items-center gap-1">
                                <UsersIcon size={12} />
                                <b className="num">{tag.followerCount}</b>
                            </span>
                        </>
                    )}
                </div>
                {relation === 'owned' && tag.sourceTag && (
                    <div className="t-cloned">
                        <CopyIcon size={12} className="mt-0.5 shrink-0" />
                        <span>
                            {t('tags:card.clonedFromPrefix')}{' '}
                            <span className="cl">{tag.sourceTag.label}</span>
                        </span>
                    </div>
                )}
                {relation !== 'owned' && (
                    <div className="t-by">
                        <span
                            className="avatar"
                            style={{ background: avatarColor(tag.author.username), color: '#fff' }}
                        >
                            {avatarInitials(tag.author.username)}
                        </span>
                        <span>{t('tags:card.byAuthor', { username: tag.author.username })}</span>
                        <AuthorBadges badges={tag.author.badges} />
                    </div>
                )}
                {relation === 'unavailable' && <div className="t-note">{t('tags:card.unavailableNote')}</div>}
            </div>

            <div className="tagcard-foot">
                {relation === 'owned' && (
                    <>
                        <Button size="sm" variant="secondary" onClick={() => onEdit?.(tag)}>
                            {t('common:buttons.edit')}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDelete?.(tag)}>
                            {t('common:buttons.delete')}
                        </Button>
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={open}>
                            {t('tags:card.viewWords')}
                        </Button>
                    </>
                )}
                {relation === 'followed' && (
                    <>
                        <Button size="sm" variant="ghost" onClick={() => onUnfollow?.(tag)}>
                            {t('tags:card.unfollow')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onClone?.(tag)}>
                            {t('tags:card.clone')}
                        </Button>
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={open}>
                            {t('tags:card.viewWords')}
                        </Button>
                    </>
                )}
                {relation === 'discover' && (
                    <>
                        <Button size="sm" variant="secondary" onClick={() => onFollow?.(tag)}>
                            {t('tags:card.follow')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onClone?.(tag)}>
                            {t('tags:card.clone')}
                        </Button>
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={open}>
                            {t('tags:card.viewWords')}
                        </Button>
                    </>
                )}
                {relation === 'unavailable' && (
                    <Button size="sm" variant="secondary" onClick={() => onUnfollow?.(tag)}>
                        {t('tags:card.unfollow')}
                    </Button>
                )}
            </div>
        </article>
    );
}
