import { useTranslation } from 'react-i18next';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    PAGE_SIZE_OPTIONS,
    buildPageItems,
    pageCountFor,
    pageRange,
    parsePageSize,
    type PageSize,
} from '@/lib/pagination';

interface TablePaginationProps {
    /** Current page, 1-based. */
    page: number;
    pageSize: PageSize;
    /** Rows matching the filters, over all pages. */
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: PageSize) => void;
    /** Disables the controls, for example while a new page loads. */
    disabled?: boolean;
}

/**
 * Footer of a numbered-page table: "Showing 201–300 of 1143", Previous / page
 * numbers / Next, and the page-size menu (50 / 100 / 200 / All). With one page
 * only, the page buttons are left out. With "All", there is only one page.
 */
export function TablePagination({
    page,
    pageSize,
    total,
    onPageChange,
    onPageSizeChange,
    disabled = false,
}: TablePaginationProps) {
    const { t } = useTranslation('common');

    const pageCount = pageCountFor(total, pageSize);
    const { from, to } = pageRange(page, total, pageSize);
    const sizeLabel = (size: PageSize) => (size === 'all' ? t('pagination.all') : String(size));

    return (
        <div className="footer-row flex-wrap gap-3">
            <span className="meta" data-testid="pagination-range">
                {total > 0 ? t('pagination.range', { from, to, total }) : t('pagination.noRows')}
            </span>

            <div className="flex flex-wrap items-center gap-3">
                {pageCount > 1 && (
                    <nav aria-label={t('pagination.nav')} className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('pagination.previous')}
                            disabled={disabled || page <= 1}
                            onClick={() => onPageChange(page - 1)}
                        >
                            <CaretLeftIcon />
                        </Button>
                        {buildPageItems(page, pageCount).map((item, index) =>
                            item === 'gap' ? (
                                <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">
                                    …
                                </span>
                            ) : (
                                <Button
                                    key={item}
                                    variant={item === page ? 'default' : 'ghost'}
                                    size="sm"
                                    aria-label={t('pagination.page', { page: item })}
                                    aria-current={item === page ? 'page' : undefined}
                                    disabled={disabled}
                                    onClick={() => onPageChange(item)}
                                >
                                    {item}
                                </Button>
                            ),
                        )}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('pagination.next')}
                            disabled={disabled || page >= pageCount}
                            onClick={() => onPageChange(page + 1)}
                        >
                            <CaretRightIcon />
                        </Button>
                    </nav>
                )}

                <div className="flex items-center gap-2">
                    <span className="label-n">{t('pagination.rowsPerPage')}</span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                            const size = parsePageSize(value);
                            if (size !== undefined) onPageSizeChange(size);
                        }}
                        disabled={disabled}
                    >
                        <SelectTrigger size="sm" aria-label={t('pagination.rowsPerPage')}>
                            <SelectValue>{(value: string) => sizeLabel(parsePageSize(value) ?? 50)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent align="end" alignItemWithTrigger={false}>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {sizeLabel(size)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
