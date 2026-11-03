import type { ReactNode } from 'react';

/**
 * The shared frame of the two Account cards, so their headers match by construction: a 56px lead
 * (the avatar, or the translation icon) on the left, the title and a second line beside it, the
 * header buttons (`actions`) stacked in the top right corner (the same spot for Edit and for Save),
 * and the body below a divider.
 *
 * The header is at least as tall as two stacked buttons (2 x 36px + 8px gap + 2 x 20px padding + the
 * 1px divider), so both cards have the same header height whatever buttons each one shows at the
 * moment. The second line keeps its height when it is empty, so a title sits where the other
 * card's name sits.
 */
export function CardFrame({
    lead,
    title,
    subtitle,
    actions,
    children,
    label,
    labelledBy,
}: {
    lead: ReactNode;
    title: ReactNode;
    subtitle?: string;
    actions: ReactNode;
    children: ReactNode;
    /** accessible name of the card, when its title is not a heading */
    label?: string;
    /** id of the heading that names the card */
    labelledBy?: string;
}) {
    return (
        <section className="card min-w-0" aria-label={label} aria-labelledby={labelledBy}>
            <div className="flex min-h-[calc(7.5rem+1px)] items-center gap-4 border-b border-border p-5">
                {lead}
                <div className="min-w-0">
                    {title}
                    {/* A no-break space keeps the line's height when there is no subtitle. */}
                    <div className="meta" aria-hidden={!subtitle}>
                        {subtitle ?? ' '}
                    </div>
                </div>
                <span className="grow" />
                <div className="flex shrink-0 flex-col items-stretch gap-2 self-start">{actions}</div>
            </div>

            <div className="p-5">{children}</div>
        </section>
    );
}
