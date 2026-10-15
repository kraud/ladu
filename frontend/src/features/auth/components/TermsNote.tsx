import { Trans } from 'react-i18next';
import { privacyUrl, termsUrl } from '@/lib/landing';

/**
 * The sentence under "Create account": by creating an account the user
 * confirms the age rule and accepts the Terms and the Privacy Policy. A note,
 * not a checkbox (.context/plans/landing-terms-licences-blog.md, section 2.1).
 * The server records the time and the Terms version when it creates the
 * account (`backend/lib/terms.ts`), so the request carries nothing extra.
 *
 * The two links open the landing pages in a new tab, so the form keeps its
 * values. Those pages are English only.
 */
/** `i18nKey`: the demo start screen (demo-access.md D12) uses its own sentence, with the same two tags. */
export function TermsNote({ i18nKey = 'loginRegister:register.termsNote' }: { i18nKey?: string }) {
    return (
        <p className="terms-note">
            <Trans
                i18nKey={i18nKey}
                components={{
                    terms: <a href={termsUrl} target="_blank" rel="noopener noreferrer" />,
                    privacy: <a href={privacyUrl} target="_blank" rel="noopener noreferrer" />,
                }}
            />
        </p>
    );
}
