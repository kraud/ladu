import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { RowSelectionState } from '@tanstack/react-table';
import { useUiStore } from '@/stores/uiStore';
import { resolveLoadingToastError, startLoadingToast } from '@/lib/toast';
import { toPreselectedWord } from '@/features/practice/preselection';
import { useFetchAllMatchingWords } from '../hooks';
import type { LangKey, WordListFilters, WordSimpleBE } from '../types';

export interface UseWordSelectionOptions {
    /** The rows of the page on screen. */
    rows: WordSimpleBE[];
    /** The visible language columns, in order (Practice shows the words in them). */
    languages: LangKey[];
    /** The list filters: "(+ all pages)" selects every word that matches them. */
    filters: WordListFilters;
    /** Changes with the filters: a row selected under one filter set can drop out of another, so the selection is cleared. */
    filtersKey: string;
}

/**
 * The page-level selection of a word table, shared by `/words` and `/tag/:id`. Holds the selected
 * row ids (stable ids, kept across pages), and the selected words' data (Practice needs it, and only
 * the current page is loaded). A change of page, sort or page size keeps the selection; a change of
 * filters clears it.
 *
 * It also has the table-wide actions: select the page (the phone's "Select all"), select every
 * matching word on all pages ("(+ all pages)"), clear, and hand the selected words to Practice.
 */
export function useWordSelection({ rows, languages, filters, filtersKey }: UseWordSelectionOptions) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    useEffect(() => {
        setRowSelection({});
    }, [filtersKey]);

    // A row is stored when it is seen selected, and dropped when it is not selected any more.
    const selectedRowsRef = useRef(new Map<string, WordSimpleBE>());
    useEffect(() => {
        const selectedRows = selectedRowsRef.current;
        for (const row of rows) if (rowSelection[row.id]) selectedRows.set(row.id, row);
        for (const id of [...selectedRows.keys()]) if (!rowSelection[id]) selectedRows.delete(id);
    }, [rows, rowSelection]);

    const selectedIds = useMemo(() => Object.keys(rowSelection).filter((id) => rowSelection[id]), [rowSelection]);
    const pageFullySelected = rows.length > 0 && rows.every((row) => rowSelection[row.id]);
    const fetchAllMatching = useFetchAllMatchingWords();

    /** A selected word's data: from the page on screen, else from the words seen on other pages. */
    function selectedRow(id: string): WordSimpleBE | undefined {
        return rows.find((candidate) => candidate.id === id) ?? selectedRowsRef.current.get(id);
    }

    function clear() {
        setRowSelection({});
    }

    // Phone: no header checkbox, so "Select all" selects the page (words already selected on other pages stay).
    function selectPage() {
        setRowSelection((previous) => ({ ...previous, ...Object.fromEntries(rows.map((row) => [row.id, true])) }));
    }

    function selectAllMatching() {
        fetchAllMatching.mutate(filters, {
            onSuccess: (result) => {
                const next: RowSelectionState = {};
                for (const row of result.items) {
                    selectedRowsRef.current.set(row.id, row);
                    next[row.id] = true;
                }
                setRowSelection(next);
            },
            onError: () => {
                resolveLoadingToastError(startLoadingToast(t('common:status.saving')), t('review:bulk.selectAllFailed'));
            },
        });
    }

    /**
     * The bar's "(+ all pages)": offered once the whole page is selected and more words match on other
     * pages (`total` is the filtered total). `undefined` when there is nothing more to select.
     */
    function allPagesFor(total: number) {
        return pageFullySelected && total > rows.length && selectedIds.length < total
            ? { total, isSelecting: fetchAllMatching.isPending, onSelect: selectAllMatching }
            : undefined;
    }

    // Selected rows -> the practice parameters screen (Phase 5, C4). Ids only are not enough: the
    // screen shows the words and limits the word types, so the rows' own data goes along.
    function practice() {
        const words = selectedIds
            .map((id) => selectedRowsRef.current.get(id))
            .filter((row): row is WordSimpleBE => row !== undefined)
            .map((row) => toPreselectedWord(row, languages));
        if (words.length === 0) return;
        useUiStore.getState().setPracticePreselection(words);
        void navigate({ to: '/practice' });
    }

    return {
        rowSelection,
        setRowSelection,
        selectedIds,
        selectedRow,
        pageFullySelected,
        clear,
        selectPage,
        allPagesFor,
        practice,
    };
}
