/**
 * The two small pill badges every tag surface shows (`TagCard`, and
 * `TagViewPage` in Slice 6): one for the caller's *relation* to the tag
 * (Owned/Followed/Unavailable/Discover), one for its *visibility*
 * (Public/Private). `.t-badge` + the `.b-*` modifiers, ported from
 * MOCKUPS/tags.html.
 */
import { useTranslation } from 'react-i18next';
import { CopyIcon, LockIcon, SealCheckIcon } from '@phosphor-icons/react';
import { isAuthorBadgeType, type AuthorBadgeType, type TagSummary } from '../types';

export type TagRelation = 'owned' | 'followed' | 'unavailable' | 'discover';

/**
 * Derives the card's relation from a `TagSummary` — `isOwner` and
 * `isFollowing` are independent booleans on the wire, but a card only ever
 * shows one relation badge at a time. `isFollowing && !isAvailable` is D9's
 * "unavailable" state; a plain `!isOwner && !isFollowing` (Discover) is only
 * ever reached for a tag that's currently viewable to begin with (the
 * `scope=discover` list and `GET /api/tags/:id` both already exclude
 * anything else).
 */
export function tagRelation(tag: Pick<TagSummary, 'isOwner' | 'isFollowing' | 'isAvailable'>): TagRelation {
    if (tag.isOwner) return 'owned';
    if (tag.isFollowing) return tag.isAvailable ? 'followed' : 'unavailable';
    return 'discover';
}

const RELATION_CLASS: Record<TagRelation, string> = {
    owned: 'b-owned',
    followed: 'b-followed',
    unavailable: 'b-unavail',
    discover: 'b-mine',
};

const RELATION_LABEL_KEY: Record<TagRelation, string> = {
    owned: 'tags:relation.owned',
    followed: 'tags:relation.followed',
    unavailable: 'tags:relation.unavailable',
    discover: 'tags:relation.discover',
};

export function RelationBadge({ relation }: { relation: TagRelation }) {
    const { t } = useTranslation();
    return <span className={`t-badge ${RELATION_CLASS[relation]}`}>{t(RELATION_LABEL_KEY[relation])}</span>;
}

export function VisibilityBadge({ visibility }: { visibility: TagSummary['visibility'] }) {
    const { t } = useTranslation();
    const isPrivate = visibility === 'Private';
    return (
        <span className={`t-badge ${isPrivate ? 'b-unavail' : 'b-mine'}`}>
            {isPrivate && <LockIcon size={11} weight="bold" />}
            {t(isPrivate ? 'tags:visibility.private' : 'tags:visibility.public')}
        </span>
    );
}

/** Both badges together, in the order every mockup card/header uses. */
export function TagBadges({ tag }: { tag: TagSummary }) {
    return (
        <div className="t-badge-row">
            <RelationBadge relation={tagRelation(tag)} />
            <VisibilityBadge visibility={tag.visibility} />
        </div>
    );
}

const AUTHOR_BADGE_KEY: Record<AuthorBadgeType, { label: string; title: string }> = {
    official: { label: 'tags:authorBadge.official', title: 'tags:authorBadge.officialTitle' },
};

/**
 * The account badges of a tag's author, shown after "by <username>". A seal icon
 * plus the word, in the accent colour and no pill: easy to see, not loud. The
 * icon is decoration; the visible word is the accessible name. A type this build
 * does not know is skipped.
 */
export function AuthorBadges({ badges }: { badges: readonly string[] }) {
    const { t } = useTranslation();
    const known = badges.filter(isAuthorBadgeType);
    if (known.length === 0) return null;
    return (
        <>
            {known.map((badge) => (
                <span key={badge} className="t-author-badge" title={t(AUTHOR_BADGE_KEY[badge].title)}>
                    <SealCheckIcon size={13} weight="fill" aria-hidden="true" />
                    {t(AUTHOR_BADGE_KEY[badge].label)}
                </span>
            ))}
        </>
    );
}

/** True when the author holds the `official` (verified) account badge. */
export function hasVerifiedBadge(badges: readonly string[]): boolean {
    return badges.filter(isAuthorBadgeType).includes('official');
}

/** Icon-only verified seal for the `/tags` card. The title and aria-label carry the meaning. */
export function VerifiedMark() {
    const { t } = useTranslation();
    const label = t('tags:authorBadge.officialTitle');
    return (
        <span className="t-verified" title={label} role="img" aria-label={label}>
            <SealCheckIcon size={14} weight="fill" aria-hidden="true" />
        </span>
    );
}

/** Marks a tag made by cloning another; the title names the source. */
export function ClonedBadge({ sourceLabel }: { sourceLabel: string }) {
    const { t } = useTranslation();
    return (
        <span className="t-badge b-mine" title={t('tags:card.clonedFromTitle', { label: sourceLabel })}>
            <CopyIcon size={11} weight="bold" aria-hidden="true" />
            {t('tags:card.cloned')}
        </span>
    );
}
