import { rowSelectionFeature, tableFeatures, type ColumnDef } from '@tanstack/react-table';
import type { WordSimpleBE } from '@/features/words/types';

/**
 * The TanStack Table features of the word tables (`/words` and `/tag/:id`). Row selection is the only
 * one: the server does the sorting, the filtering and the pages. A table method of another feature
 * exists only after that feature is added here.
 */
export const wordTableFeatures = tableFeatures({ rowSelectionFeature });

export type WordColumnDef = ColumnDef<typeof wordTableFeatures, WordSimpleBE>;
