import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GoogleIcon } from '@/components/common/GoogleIcon';
import { cn } from '@/lib/utils';
import { useOAuthProviders } from '../hooks';

/**
 * A real `<a href>`, not a `<button onClick>` — clicking it is a full,
 * top-level browser navigation to the backend (`GET /api/auth/:provider/start`
 * 302s to the provider), never an XHR. An anchor gets keyboard, middle-click,
 * and "open in new tab" right for free; a JS-driven navigation would have to
 * reimplement all of that.
 */
export function OAuthButtons() {
    const { t } = useTranslation();
    const { data: providers } = useOAuthProviders();

    const configured = providers ? Object.entries(providers).filter(([, on]) => on) : [];
    if (configured.length === 0) return null;

    return (
        <div className="oauth-buttons flex flex-col gap-3">
            {configured.map(([provider]) =>
                provider === 'google' ? (
                    <a
                        key={provider}
                        href="/api/auth/google/start"
                        className={cn(buttonVariants({ variant: 'outline' }), 'w-full gap-2')}
                    >
                        <GoogleIcon width={16} height={16} />
                        {t('loginRegister:oauth.continueWithGoogle')}
                    </a>
                ) : null,
            )}
            <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{t('loginRegister:oauth.orContinueWith')}</span>
                <Separator className="flex-1" />
            </div>
        </div>
    );
}
