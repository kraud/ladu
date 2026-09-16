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

    // Seeded once from the route param; cleared after a successful create, or
    // when the user changes their mind via "Change word type" (D39), so the
    // next word starts back at the PoS gate — the old app's `resetAll`
    // (`WordForm.tsx:291-305`) cleared the picked PoS too, not just the cards.
    const [partOfSpeech, setPartOfSpeech] = useState(() => partOfSpeechFromRouteParam(posParam));
    const [formKey, setFormKey] = useState(0);

    const createWord = useCreateWord();

    // D37/D38: one heading pair, tracking the picked type rather than only
    // the route param — before a PoS is picked this doubles as the gate's own
    // title (`PartOfSpeechSelector` renders no heading of its own).
    const title = partOfSpeech
        ? t('wordRelated:addWordPage.title', { currentPoS: t(partOfSpeechLabelKey(partOfSpeech)) })
        : t('wordRelated:addWordPage.titleDefault');
    const subtitle = partOfSpeech
        ? t('wordRelated:addWordPage.subtitle')
        : t('wordRelated:partOfSpeechSelector.title');

    function resetToGate() {
        setPartOfSpeech(undefined);
        setFormKey((key) => key + 1);
    }

    function handleSubmit(body: CreateWordBody | UpdateWordBody) {
        const toastId = startLoadingToast(t('common:status.saving'));
        createWord.mutate(body, {
            onSuccess: (word) => {
                resolveLoadingToastSuccess(toastId, t('wordRelated:addWordPage.toastCreateSuccess'), {
                    label: t('common:buttons.clickToSeeDetailsWord'),
                    onClick: () => void navigate({ to: '/word/$wordId', params: { wordId: word.id } }),
                });
                resetToGate();
            },
            onError: (error) => {
                resolveLoadingToastError(toastId, t(wordErrorKey(error)));
            },
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-3">
                <h1 className="h1">{title}</h1>
                <p className="meta content-end">{subtitle}</p>
            </div>
            <WordForm
                key={formKey}
                mode="create"
                defaultPartOfSpeech={partOfSpeech}
                onSubmit={handleSubmit}
                onChangePartOfSpeech={resetToGate}
                onPartOfSpeechChange={setPartOfSpeech}
                submitting={createWord.isPending}
            />
        </div>
    );
}
