import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * The row above a set-up list, as in Tags: the scope badges (`rail`), then the count and the sort selector.
 * It shows no count while the list loads (`count` is `null`).
 */
export function ListToolbar<S extends string>({
    rail,
    count,
    sort,
    sortOptions,
    onSortChange,
}: {
    rail: ReactNode;
    count: string | null;
    sort: S;
    sortOptions: readonly { value: S; label: string }[];
    onSortChange: (sort: S) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="toolrow">
            {rail}
            <div className="sort-row">
                {count !== null && <span className="label-n">{count}</span>}
                <div className="flex items-center gap-2">
                    <span className="label-n">{t('practice:setup.sortLabel')}</span>
                    <Select value={sort} onValueChange={(value) => onSortChange(value as S)}>
                        <SelectTrigger size="sm" aria-label={t('practice:setup.sortLabel')}>
                            <SelectValue>{(value: S) => sortOptions.find((o) => o.value === value)?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent align="end" alignItemWithTrigger={false}>
                            {sortOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
