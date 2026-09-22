import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '../components/AuthLayout';
import { ResetPasswordForm } from '../components/ResetPasswordForm';

const route = getRouteApi('/_public/resetPassword/{-$userId}/{-$tokenId}');

export function ResetPasswordPage() {
    const { t } = useTranslation();
    const { userId, tokenId } = route.useParams();
    const isSetMode = Boolean(userId && tokenId);

    return (
        <AuthLayout
            blurb={
                isSetMode
                    ? t('loginRegister:brand.subResetSet')
                    : t('loginRegister:brand.subResetRequest')
            }
            title={
                isSetMode
                    ? t('loginRegister:resetPassword.titleReset')
                    : t('loginRegister:resetPassword.titleForgot')
            }
            subtitle={
                isSetMode
                    ? t('loginRegister:resetPassword.subtitleNewPassword')
                    : t('loginRegister:resetPassword.subtitleEnterEmail')
            }
            links={
                <>
                    <span>{t('loginRegister:switchSectionButtons.alreadyRegistered')}</span>{' '}
                    <Link to="/login">{t('loginRegister:switchSectionButtons.signIn')}</Link>
                </>
            }
        >
            {isSetMode ? (
                <ResetPasswordForm mode="set" userId={userId as string} tokenId={tokenId as string} />
            ) : (
                <ResetPasswordForm mode="request" />
            )}
        </AuthLayout>
    );
}
