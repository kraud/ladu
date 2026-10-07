/**
 * "Random practice": start a session with the default settings, with no set-up
 * screen. Used by the mobile menu. The session goes into the store, so
 * `/practice` shows it as soon as the route opens.
 */
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/stores/authStore';
import { practiceErrorKey } from './errors';
import { useGenerateExercises } from './hooks';
import { defaultParams, toGenerateBody } from './params';
import { usePracticeSessionStore } from './sessionStore';

export function useQuickPractice() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const startSession = usePracticeSessionStore((s) => s.start);
    const generate = useGenerateExercises();

    function start(onStarted?: () => void) {
        if (!user || generate.isPending) return;
        const params = defaultParams(user.languages);
        generate.mutate(toGenerateBody(params), {
            onSuccess: ({ exercises }) => {
                if (exercises.length === 0) {
                    toast.info(t('practice:configs.startDialog.noMatch'));
                    return;
                }
                startSession({ userId: user.id, params, wordIds: null, preselected: null, exercises });
                onStarted?.();
                void navigate({ to: '/practice', search: {} });
            },
            onError: (error) => toast.error(t(practiceErrorKey(error))),
        });
    }

    return { start, isPending: generate.isPending };
}
