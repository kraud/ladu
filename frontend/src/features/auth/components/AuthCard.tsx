import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The shared frame for every public auth screen (`MOCKUPS/auth/*.html`):
 * `.auth-shell` column → logo banner → `.card`. `links` renders inside the
 * card, after the content, as the `.auth-links` row.
 */
export function AuthCard({
    title,
    subtitle,
    children,
    links,
    cardClassName,
}: {
    title?: string;
    subtitle?: string;
    children: ReactNode;
    links?: ReactNode;
    cardClassName?: string;
}) {
    return (
        <div className="auth-shell page">
            <span className="logo auth-banner">
                <span className="logo-mark">L</span>Ladu
            </span>
            <div className={cn('card card-pad auth-card', cardClassName)}>
                {title && <h1 className="h2 mb-1">{title}</h1>}
                {subtitle && <p className="mb-5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
                {children}
                {links && <div className="auth-links">{links}</div>}
            </div>
        </div>
    );
}
