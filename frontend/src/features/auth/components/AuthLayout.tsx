import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { FlagIcon } from '@/components/common/FlagIcon';
import { PublicLanguageSelector } from '@/components/layout/PublicLanguageSelector';
import { UI_LANGUAGES } from '@/lib/language';

/**
 * The shared frame for every public auth screen + the 404
 * (`MOCKUPS/auth/*.html`): a full-height two-column `.auth-shell` — a brand
 * "ground" on the left (mark, tagline, one screen-specific blurb line, the
 * four supported-language flags, and the interface-language selector) and a
 * framed, inset `.auth-panel` on the right holding the actual form.
 *
 * `blurb` is each screen's own `.auth-sub` line. `showLanguageSelector`
 * is false for the 404, which renders outside the `_public` layout and
 * deliberately has no language switcher (Phase 1 decision, unchanged here).
 */
export function AuthLayout({
    blurb,
    showLanguageSelector = true,
    title,
    subtitle,
    children,
    links,
}: {
    blurb: string;
    showLanguageSelector?: boolean;
    title?: string;
    subtitle?: string;
    children: ReactNode;
    links?: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className="auth-shell page">
            <aside className="auth-brand">
                <BrandLogo variant="outline" height={178} title="Ladu" className="auth-brand-mark" />
                <div className="stack-sm flex flex-col gap-2">
                    <p className="auth-tagline">{t('loginRegister:brand.tagline')}</p>
                    <p className="auth-sub">{blurb}</p>
                </div>
                <div className="flag-row" aria-label={t('loginRegister:brand.supportedLanguages')}>
                    {UI_LANGUAGES.map((lang) => (
                        <span key={lang.key} className="flag-chip">
                            <FlagIcon lang={lang.key} width={24} height={16} />
                            {lang.key}
                        </span>
                    ))}
                </div>
                {showLanguageSelector && (
                    <div className="auth-lang">
                        <PublicLanguageSelector />
                    </div>
                )}
            </aside>

            <main className="auth-panel">
                <div className="auth-form">
                    {(title || subtitle) && (
                        <div className="form-head">
                            {title && <h1 className="h2">{title}</h1>}
                            {subtitle && <p>{subtitle}</p>}
                        </div>
                    )}
                    {children}
                    {links && <div className="auth-foot">{links}</div>}
                </div>
            </main>
        </div>
    );
}
