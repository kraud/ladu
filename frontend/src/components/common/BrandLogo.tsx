import { cn } from '@/lib/utils';

/** Brand SVGs served from `public/brand/`. `ratio` = width / height of the source viewBox. */
const BRAND = {
    wordmark: { src: '/brand/Ladu_title_with_icon.svg', ratio: 359 / 104 },
    outline: { src: '/brand/Ladu_inside_bubble_outline.svg', ratio: 190 / 178 },
    filled: { src: '/brand/Ladu_bubble_filled.svg', ratio: 66 / 62 },
} as const;

export type BrandLogoVariant = keyof typeof BRAND;

/**
 * The Ladu brand mark: `wordmark` (bubble + "Ladu", app header), `outline`
 * (bubble with the L inside, auth screens and 404), `filled` (solid bubble).
 * Width follows the source ratio so the image is never squashed.
 * Decorative by default — pass `title` to give it an accessible name.
 */
export function BrandLogo({
    variant = 'wordmark',
    height,
    className,
    title,
}: {
    variant?: BrandLogoVariant;
    height: number;
    className?: string;
    title?: string;
}) {
    const { src, ratio } = BRAND[variant];

    return (
        <img
            src={src}
            alt={title ?? ''}
            aria-hidden={title ? undefined : true}
            width={Math.round(height * ratio)}
            height={height}
            className={cn('inline-block shrink-0', className)}
        />
    );
}
