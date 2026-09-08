import type { ReactNode } from 'react';

/**
 * Centered empty state: optional icon, one-line message, optional CTA.
 * Uses the `.empty` component class from `styles/globals.css`.
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="empty">
            {icon && <div className="e-icon">{icon}</div>}
            <p className="h3">{title}</p>
            {description && <p>{description}</p>}
            {action}
        </div>
    );
}
