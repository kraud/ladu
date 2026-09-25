import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { FlagIcon } from '@/components/common/FlagIcon';
import { PublicLanguageSelector } from '@/components/layout/PublicLanguageSelector';
import { PublicThemeToggle } from '@/components/layout/PublicThemeToggle';
import { UI_LANGUAGES } from '@/lib/language';

/**
 * The shared frame for every public auth screen + the 404
 * (`MOCKUPS/auth/*.html`): a full-height two-column `.auth-shell` — a brand
 * "ground" on the left (mark, tagline, one screen-specific blurb line, the
 * four supported-language flags, and the interface-language selector + theme
 * switch) and a
 * framed, inset `.auth-panel` on the right holding the actual form.
 *
 * `blurb` is each screen's own `.auth-sub` line. `showLanguageSelector`
 * is false for the 404, which renders outside the `_public` layout and
 * deliberately has no language switcher (Phase 1 decision, unchanged here).
 * `themeToggle` defaults to the saved-choice `PublicThemeToggle` next to the
 * language selector; the 404 passes a page-only switch instead (Phase 3.9,
 * Slice 7), so it shows a switch without the selector.
 */
export function AuthLayout({
    blurb,
    showLanguageSelector = true,
    themeToggle = showLanguageSelector ? <PublicThemeToggle /> : null,
    title,
    subtitle,
    children,
    links,
}: {
    blurb: string;
    showLanguageSelector?: boolean;
    themeToggle?: ReactNode;
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
                {(showLanguageSelector || themeToggle) && (
                    <div className="auth-lang flex items-center gap-1">
                        {showLanguageSelector && <PublicLanguageSelector />}
                        {themeToggle}
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
