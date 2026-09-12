/**
 * New-word entry (`/addWord/{-$partOfSpeech}`) — a thin wrapper around
 * `WordForm` in create mode. Owns the create lifecycle the hooks
 * deliberately don't: the "Saving…" -> success/error toast morph, the
 * "See details" navigation, and resetting the form so the user stays on this
 * page for the next word (`pages-word-flow.md` §WordForm, use case 7).
 */
import { useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { WordForm } from '../form-engine/WordForm';
import { useCreateWord } from '../hooks';
import { wordErrorKey } from '../errors';
import type { CreateWordBody, UpdateWordBody } from '../types';
import { partOfSpeechFromRouteParam, partOfSpeechLabelKey } from '@/lib/words';
import { resolveLoadingToastError, resolveLoadingToastSuccess, startLoadingToast } from '@/lib/toast';

const route = getRouteApi('/_protected/addWord/{-$partOfSpeech}');

export function AddWordPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { partOfSpeech: posParam } = route.useParams();

    // Seeded once from the route param; cleared after a successful create so
    // the next word starts back at the PoS gate — the old app's `resetAll`
    // (`WordForm.tsx:291-305`) cleared the picked PoS too, not just the cards.
    const [defaultPartOfSpeech, setDefaultPartOfSpeech] = useState(() => partOfSpeechFromRouteParam(posParam));
    const [formKey, setFormKey] = useState(0);

    const createWord = useCreateWord();

    const title = defaultPartOfSpeech
        ? t('wordRelated:addWordPage.title', { currentPoS: t(partOfSpeechLabelKey(defaultPartOfSpeech)) })
        : t('wordRelated:addWordPage.titleDefault');

    function handleSubmit(body: CreateWordBody | UpdateWordBody) {
        const toastId = startLoadingToast(t('common:status.saving'));
        createWord.mutate(body, {
            onSuccess: (word) => {
                resolveLoadingToastSuccess(toastId, t('wordRelated:addWordPage.toastCreateSuccess'), {
                    label: t('common:buttons.clickToSeeDetailsWord'),
                    onClick: () => void navigate({ to: '/word/$wordId', params: { wordId: word.id } }),
                });
                setDefaultPartOfSpeech(undefined);
                setFormKey((key) => key + 1);
            },
            onError: (error) => {
                resolveLoadingToastError(toastId, t(wordErrorKey(error)));
            },
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h1 className="h1">{title}</h1>
                <p className="meta">{t('wordRelated:addWordPage.subtitle')}</p>
            </div>
            <WordForm
                key={formKey}
                mode="create"
                defaultPartOfSpeech={defaultPartOfSpeech}
                onSubmit={handleSubmit}
                submitting={createWord.isPending}
            />
        </div>
    );
}
