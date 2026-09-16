/**
 * The `dash-grid`'s right column: the card holding both chart blocks, and
 * everything that decides what's in it — loading, error, empty, or the
 * charts themselves (Phase 3.5 Slice 6). Owns the three toggles as local
 * component state (D4) and both `useNavigate()` calls the pie's worst
 * segment needs (D7).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { ColumnsIcon, PlusIcon, RowsIcon } from '@phosphor-icons/react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { languageByLabel } from '@/lib/language';
import { partOfSpeechLabelKey, partOfSpeechToRouteParam } from '@/lib/words';
import { PartOfSpeech } from '@/ts/enums';
import { useUserMetrics } from '../hooks';
import {
    availableBarMonthRanges,
    barSeriesByLanguage,
    barSeriesByMonth,
    CREATABLE_POS,
    pieSeries,
    worstSegment,
    type BarMonthRangeOption,
} from '../selectors';
import { langColor, posColor } from './charts/chartColors';
import { BarChart, type BarChartGroup, type BarSeriesMeta } from './charts/BarChart';
import { PieChart, type PieChartSegment } from './charts/PieChart';

type PieMode = 'words' | 'translations';
type BarXMode = 'month' | 'language';
type BarGrouping = 'stacked' | 'separate';
type BarMonthsRange = 'all' | BarMonthRangeOption;

export function MetricsPanel() {
    const { t } = useTranslation('dashboard');
    const navigate = useNavigate();
    const { data: metrics, isPending, isError, error, refetch } = useUserMetrics();

    const [pieMode, setPieMode] = useState<PieMode>('words');
    const [barXMode, setBarXMode] = useState<BarXMode>('month');
    const [barGrouping, setBarGrouping] = useState<BarGrouping>('separate');
    const [barMonthsRange, setBarMonthsRange] = useState<BarMonthsRange>(6);

    if (isPending) {
        return (
            <div className="card metrics">
                <Skeleton className="h-[240px] w-full" />
                <Skeleton className="h-[240px] w-full" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="card card-pad">
                <ErrorState error={error instanceof Error ? error : undefined} resetErrorBoundary={() => void refetch()} />
            </div>
        );
    }

    if (metrics.totalWords === 0) {
        return (
            <div className="card card-pad">
                <EmptyState
                    icon={<PlusIcon size={20} />}
                    title={t('home.emptyTitle')}
                    description={t('home.emptyDescription')}
                    action={
                        <Link to="/addWord/{-$partOfSpeech}" className={buttonVariants()}>
                            {t('home.addFirstWords')}
                        </Link>
                    }
                />
            </div>
        );
    }

    const pieSegmentsRaw = pieSeries(metrics, pieMode);
    const pieSegments: PieChartSegment[] = pieSegmentsRaw.map((seg) =>
        pieMode === 'words'
            ? {
                  key: seg.key,
                  count: seg.count,
                  label: t(partOfSpeechLabelKey(seg.key as PartOfSpeech)),
                  color: posColor(seg.key as PartOfSpeech),
              }
            : {
                  key: seg.key,
                  count: seg.count,
                  label: languageByLabel(seg.key)?.native ?? seg.key,
                  color: langColor(seg.key),
              },
    );
    const pieTotal = pieSegments.reduce((sum, seg) => sum + seg.count, 0);
    const worstRaw = worstSegment(pieSegmentsRaw);
    const pieWorst = worstRaw ? (pieSegments.find((seg) => seg.key === worstRaw.key) ?? null) : null;
    const pieTitle = pieMode === 'words' ? t('charts.pie.title.wordMetric') : t('charts.pie.title.translationMetric');
    const pieUnit = pieMode === 'words' ? t('charts.pie.unit.words') : t('charts.pie.unit.translations');

    const onPieWorstClick = () => {
        if (!pieWorst) return;
        if (pieMode === 'words') {
            void navigate({
                to: '/addWord/{-$partOfSpeech}',
                params: { partOfSpeech: partOfSpeechToRouteParam(pieWorst.key as PartOfSpeech) },
            });
        } else {
            void navigate({ to: '/addWord/{-$partOfSpeech}' });
        }
    };

    const availableMonthsRanges = availableBarMonthRanges(metrics);
    const effectiveMonthsRange: BarMonthsRange =
        barMonthsRange === 'all' || availableMonthsRanges.includes(barMonthsRange)
            ? barMonthsRange
            : availableMonthsRanges[0]!;

    const barGroupsRaw =
        barXMode === 'month' ? barSeriesByMonth(metrics, effectiveMonthsRange) : barSeriesByLanguage(metrics);
    const barChartGroups: BarChartGroup[] = barGroupsRaw.map((group) => ({
        xLabel: barXMode === 'month' ? group.xLabel : (languageByLabel(group.xLabel)?.native ?? group.xLabel),
        values: group.series.map((s) => s.count),
    }));
    const barSeriesMeta: BarSeriesMeta[] = CREATABLE_POS.map((pos) => ({
        key: pos,
        label: t(partOfSpeechLabelKey(pos)),
        color: posColor(pos),
    }));
    const barTitle = barXMode === 'month' ? t('charts.bar.title.wordMetric') : t('charts.bar.title.translationMetric');
    // wordsPerMonth counts words, translationsPerLanguageAndPOS counts translations (D9) — no
    // bar-specific unit keys exist, so the pie's (equally generic "words"/"translations") are reused.
    const barUnit = barXMode === 'month' ? t('charts.pie.unit.words') : t('charts.pie.unit.translations');

    return (
        <div className="card metrics">
            <div className="chart-block">
                <div className="chart-head">
                    <h2>{pieTitle}</h2>
                    <SegmentedToggle
                        aria-label={t('charts.pie.toggleLabel')}
                        allowDeselect={false}
                        value={pieMode}
                        onValueChange={(value) => setPieMode(value as PieMode)}
                        options={[
                            { value: 'words', label: t('common:buttons.distributionByWordType') },
                            { value: 'translations', label: t('common:buttons.distributionByLanguage') },
                        ]}
                    />
                </div>
                <PieChart
                    segments={pieSegments}
                    total={pieTotal}
                    unitLabel={pieUnit}
                    worst={pieWorst}
                    onWorstClick={onPieWorstClick}
                    ariaLabel={pieTitle}
                />
            </div>

            <div className="chart-block">
                <div className="chart-head">
                    <h2>{barTitle}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        {barXMode === 'month' && (
                            <Select
                                value={String(effectiveMonthsRange)}
                                onValueChange={(value) =>
                                    setBarMonthsRange(value === 'all' ? 'all' : (Number(value) as BarMonthRangeOption))
                                }
                            >
                                <SelectTrigger size="sm" aria-label={t('charts.bar.monthRangeToggleLabel')}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('charts.bar.monthRange.all')}</SelectItem>
                                    {availableMonthsRanges.map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {t('charts.bar.monthRange.months', { count: n })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <SegmentedToggle
                            aria-label={t('charts.bar.groupingToggleLabel')}
                            allowDeselect={false}
                            value={barGrouping}
                            onValueChange={(value) => setBarGrouping(value as BarGrouping)}
                            options={[
                                {
                                    value: 'stacked',
                                    label: <RowsIcon size={14} />,
                                },
                                {
                                    value: 'separate',
                                    label: <ColumnsIcon size={14} />,
                                },
                            ]}
                        />
                        <SegmentedToggle
                            aria-label={t('charts.bar.xAxisToggleLabel')}
                            allowDeselect={false}
                            value={barXMode}
                            onValueChange={(value) => setBarXMode(value as BarXMode)}
                            options={[
                                { value: 'month', label: t('common:buttons.byMonth') },
                                { value: 'language', label: t('common:buttons.byLanguage') },
                            ]}
                        />
                    </div>
                </div>
                <BarChart
                    groups={barChartGroups}
                    series={barSeriesMeta}
                    stacked={barGrouping === 'stacked'}
                    unitLabel={barUnit}
                    ariaLabel={barTitle}
                />
            </div>
        </div>
    );
}
