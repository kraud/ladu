/**
 * Thin transport layer over `apiClient`, one function per
 * `autocompleteTranslationController` route. No React, no query-cache access —
 * those live in `hooks.ts`. Matches `features/words/api.ts`'s own shape.
 */
import { apiClient } from '@/api/client';
import type { EstonianLookupResponse, GenericLookupResponse } from './types';

const base = '/autocompleteTranslations';

export async function getVerbEN(infinitive: string): Promise<GenericLookupResponse> {
    const { data } = await apiClient.get<GenericLookupResponse>(
        `${base}/english/verb/${encodeURIComponent(infinitive)}`
    );
    return data;
}

export async function getVerbES(infinitive: string): Promise<GenericLookupResponse> {
    const { data } = await apiClient.get<GenericLookupResponse>(
        `${base}/spanish/verb/${encodeURIComponent(infinitive)}`
    );
    return data;
}

export async function getNounGenderES(singular: string): Promise<GenericLookupResponse> {
    const { data } = await apiClient.get<GenericLookupResponse>(
        `${base}/spanish/noun/${encodeURIComponent(singular)}`
    );
    return data;
}

export async function getVerbDE(infinitive: string): Promise<GenericLookupResponse> {
    const { data } = await apiClient.get<GenericLookupResponse>(
        `${base}/german/verb/${encodeURIComponent(infinitive)}`
    );
    return data;
}

export async function getNounDE(singular: string): Promise<GenericLookupResponse> {
    const { data } = await apiClient.get<GenericLookupResponse>(
        `${base}/german/noun/${encodeURIComponent(singular)}`
    );
    return data;
}

export async function getVerbEE(infinitiveMa: string, searchInEnglish?: boolean): Promise<EstonianLookupResponse> {
    const { data } = await apiClient.get<EstonianLookupResponse>(
        `${base}/estonian/verb/${encodeURIComponent(infinitiveMa)}`,
        { params: searchInEnglish ? { searchInEnglish: true } : undefined }
    );
    return data;
}

export async function getNounEE(singular: string, searchInEnglish?: boolean): Promise<EstonianLookupResponse> {
    const { data } = await apiClient.get<EstonianLookupResponse>(
        `${base}/estonian/noun/${encodeURIComponent(singular)}`,
        { params: searchInEnglish ? { searchInEnglish: true } : undefined }
    );
    return data;
}

export async function getAdjectiveEE(singular: string, searchInEnglish?: boolean): Promise<EstonianLookupResponse> {
    const { data } = await apiClient.get<EstonianLookupResponse>(
        `${base}/estonian/adjective/${encodeURIComponent(singular)}`,
        { params: searchInEnglish ? { searchInEnglish: true } : undefined }
    );
    return data;
}
