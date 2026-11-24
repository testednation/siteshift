import { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, RotateCcw } from 'lucide-react';
import type { SampleId } from '../types/migration';
import { formatBytes, formatPlatformLabel } from '../utils/format';
import {
  aggregateMigrationKpis,
  formatSeconds,
  type MigrationKpiRecord,
} from '../utils/migrationKpis';
import { InfoTooltip } from './InfoTooltip';

type ChartMetric = 'load_improvement' | 'assets_processed' | 'js_reduced';

interface RecentMigrationsKpiWidgetProps {
  records: MigrationKpiRecord[];
  activeSessionIds: Set<string>;
  loading: boolean;
  onSelectMigration: (id: string) => void;
  onRunSample: (sampleId: SampleId) => void;
  onClearHistory: () => void;
}

function truncateLabel(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}

function getNiceUpperBound(maxVal: number): number {
  if (maxVal <= 5) return 5;
  if (maxVal <= 10) return 10;
  if (maxVal <= 20) return 20;
  if (maxVal <= 50) return Math.ceil(maxVal / 10) * 10;
  return Math.ceil(maxVal / 25) * 25;
}

export function RecentMigrationsKpiWidget({
  records,
  activeSessionIds,
  loading,
  onSelectMigration,
  onRunSample,
  onClearHistory,
}: RecentMigrationsKpiWidgetProps) {
  const [metric, setMetric] = useState<ChartMetric>('load_improvement');
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  const summary = useMemo(() => aggregateMigrationKpis(records), [records]);

  // Display up to 8 most recent migrations chronologically (oldest left -> newest right)
  const chartRecords = useMemo(() => records.slice(0, 8).reverse(), [records]);

  const activeRecord = useMemo(() => {
    if (chartRecords.length === 0) return null;
    if (inspectedId) {
      const found = chartRecords.find((r) => r.id === inspectedId);
      if (found) return found;
    }
    return chartRecords[chartRecords.length - 1];
  }, [chartRecords, inspectedId]);

  const metricConfig = useMemo(() => {
    if (metric === 'assets_processed') {
      const maxAssets = Math.max(...chartRecords.map((r) => r.totalAssets), 4);
      const yMax = getNiceUpperBound(maxAssets);
      const avg =
        chartRecords.length > 0
          ? chartRecords.reduce((sum, r) => sum + r.totalAssets, 0) / chartRecords.length
          : 0;
      return {
        label: 'Assets Processed',
        yMax,
        avg,
        avgFormatted: `${avg.toFixed(1)} avg`,
        barFill: '#1D4ED8',
        barHoverFill: '#1E40AF',
        getValue: (r: MigrationKpiRecord) => r.totalAssets,
        formatValue: (v: number) => `${v}`,
        formatTick: (v: number) => `${Math.round(v)}`,
      };
    }

    if (metric === 'js_reduced') {
      const avg = summary.avgJsPercentSaved;
      return {
        label: 'JS Weight Cut',
        yMax: 100,
        avg,
        avgFormatted: `${avg}% avg`,
        barFill: '#1D4ED8',
        barHoverFill: '#1E40AF',
        getValue: (r: MigrationKpiRecord) => r.jsPercentSaved,
        formatValue: (v: number) => `-${v}%`,
        formatTick: (v: number) => `${Math.round(v)}%`,
      };
    }

    const avg = summary.avgLoadTimeImprovementPct;
    return {
      label: 'Load Time Improvement',
      yMax: 100,
      avg,
      avgFormatted: `+${avg}% avg`,
      barFill: '#047857',
      barHoverFill: '#065F46',
      getValue: (r: MigrationKpiRecord) => r.loadTimeImprovementPct,
      formatValue: (v: number) => `+${v}%`,
      formatTick: (v: number) => `${Math.round(v)}%`,
    };
  }, [metric, chartRecords, summary.avgJsPercentSaved, summary.avgLoadTimeImprovementPct]);

  // SVG chart geometry
  const svgWidth = 760;
  const svgHeight = 204;
  const padLeft = 46;
  const padRight = 18;
  const padTop = 26;
  const padBottom = 44;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const avgY =
    padTop + plotH - Math.min(1, Math.max(0, metricConfig.avg / metricConfig.yMax)) * plotH;

  return (
    <section
      aria-labelledby="recent-kpis-heading"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      {/* Widget Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2
              id="recent-kpis-heading"
              className="font-display text-base font-semibold text-slate-950"
            >
              Recent Migrations Performance
            </h2>
            <InfoTooltip
              title="Migration KPI Dashboard"
              content="Tracks measured performance indicators across your recent migrations, including total assets processed, estimated page load speed gains, and payload savings."
              tip="Updating asset policies or toggling the Image Optimizer on an active migration automatically updates these numbers."
            />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {records.length === 0
              ? 'Run a migration or sample blueprint to track asset processing and load-speed gains.'
              : `${records.length} recent ${records.length === 1 ? 'migration' : 'migrations'} analyzed · Stored locally in your browser`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {records.length > 0 && (
            <>
              <div
                role="tablist"
                aria-label="Chart metric view"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={metric === 'load_improvement'}
                  onClick={() => setMetric('load_improvement')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    metric === 'load_improvement'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Load Time Saved
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={metric === 'assets_processed'}
                  onClick={() => setMetric('assets_processed')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    metric === 'assets_processed'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Assets Processed
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={metric === 'js_reduced'}
                  onClick={() => setMetric('js_reduced')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    metric === 'js_reduced'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  JS Weight Cut
                </button>
              </div>

              <button
                type="button"
                onClick={onClearHistory}
                title="Clear stored KPI history"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4-Column KPI Strip (single elevation, hairline dividers only) */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 border-b border-slate-200 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Total Assets Processed</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
            {records.length > 0 ? summary.totalAssetsProcessed.toLocaleString() : '0'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {records.length > 0
              ? `${summary.totalAssetsLocalized} localized · ${summary.totalScriptsCleaned} scripts cleaned`
              : 'Scripts, styles, fonts & images'}
          </p>
        </div>

        <div className="border-l border-slate-200 px-5 py-4 lg:border-l-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-slate-500">Avg. Load Time Improvement</p>
            <InfoTooltip
              title="How Load Time Improvement Is Estimated"
              content="Calculated from each migration's measured payload reduction (4G transfer at 1.6 Mbps), removed JavaScript parse overhead, and eliminated third-party CDN round-trips."
              tip="Stripping builder runtimes and localizing assets removes both heavy scripts and external host lookups."
            />
          </div>
          <p
            className={`mt-1 font-mono text-2xl font-bold tracking-tight tabular-nums ${
              records.length > 0 ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {records.length > 0 ? `+${summary.avgLoadTimeImprovementPct}%` : '—'}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {records.length > 0
              ? `Est. ${formatSeconds(summary.avgLoadTimeBeforeMs)} → ${formatSeconds(summary.avgLoadTimeAfterMs)} avg`
              : 'Measured before vs. after'}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500">Total Payload Saved</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
            {records.length > 0 ? formatBytes(summary.totalBytesSaved) : '0 B'}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {records.length > 0
              ? `Avg. -${summary.avgJsPercentSaved}% JavaScript weight`
              : 'Trackers, runtimes & media'}
          </p>
        </div>

        <div className="border-l border-slate-200 px-5 py-4 lg:border-l-0">
          <p className="text-xs font-medium text-slate-500">Pages &amp; Blocks Migrated</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
            {records.length > 0 ? summary.totalPagesMigrated.toLocaleString() : '0'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {records.length > 0
              ? `${summary.totalGutenbergBlocks.toLocaleString()} Gutenberg blocks generated`
              : 'Converted to WordPress blocks'}
          </p>
        </div>
      </div>

      {/* Bar Chart Area or Clean Empty State */}
      {records.length === 0 ? (
        <div className="flex flex-col items-start justify-between gap-4 bg-slate-50/50 px-5 py-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">No migration benchmarks yet</p>
              <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-600">
                Complete your first migration below — or run an instant offline sample — to compare{' '}
                <strong className="font-medium text-slate-800">Load Time Improvement</strong> and{' '}
                <strong className="font-medium text-slate-800">Assets Processed</strong> side by side in the bar chart.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={() => onRunSample('squarespace-editorial')}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              Run Squarespace Sample
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onRunSample('wix-studio')}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              Run Wix Sample
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 pt-4 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-xs"
                style={{ backgroundColor: metricConfig.barFill }}
                aria-hidden="true"
              />
              <span className="font-medium text-slate-700">{metricConfig.label} by Site</span>
              <span aria-hidden="true">·</span>
              <span>
                Showing latest {chartRecords.length} of {records.length}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 tabular-nums">
              <span className="inline-block w-4 border-t border-dashed border-slate-400" aria-hidden="true" />
              <span>Average: {metricConfig.avgFormatted}</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label={`Bar chart showing ${metricConfig.label} across ${chartRecords.length} recent migrations`}
              className="h-[196px] w-full min-w-[480px] select-none"
            >
              {/* Horizontal Hairline Gridlines & Y-Axis Ticks */}
              {yTicks.map((ratio) => {
                const y = padTop + plotH - ratio * plotH;
                const val = ratio * metricConfig.yMax;
                return (
                  <g key={ratio}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke={ratio === 0 ? '#CBD5E1' : '#E2E8F0'}
                      strokeWidth={1}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="10.5"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    >
                      {metricConfig.formatTick(val)}
                    </text>
                  </g>
                );
              })}

              {/* Average Reference Line */}
              {chartRecords.length > 1 && (
                <line
                  x1={padLeft}
                  y1={avgY}
                  x2={svgWidth - padRight}
                  y2={avgY}
                  stroke="#94A3B8"
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                />
              )}

              {/* Bars */}
              {chartRecords.map((rec, idx) => {
                const slotCount = Math.max(chartRecords.length, 4);
                const slotW = plotW / slotCount;
                const barW = Math.min(54, Math.max(24, slotW * 0.46));
                const centerX = padLeft + slotW * idx + slotW / 2;
                const x = centerX - barW / 2;

                const rawValue = metricConfig.getValue(rec);
                const clampedRatio = Math.max(0, Math.min(1, rawValue / metricConfig.yMax));
                const barH = Math.max(rawValue > 0 ? 4 : 1, clampedRatio * plotH);
                const y = padTop + plotH - barH;

                const isSelected = activeRecord?.id === rec.id;
                const canOpen = activeSessionIds.has(rec.id);

                return (
                  <g
                    key={rec.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${rec.siteName} (${formatPlatformLabel(rec.detectedPlatform)}): ${metricConfig.label} ${metricConfig.formatValue(rawValue)}`}
                    onMouseEnter={() => setInspectedId(rec.id)}
                    onFocus={() => setInspectedId(rec.id)}
                    onClick={() => {
                      setInspectedId(rec.id);
                      if (canOpen) {
                        onSelectMigration(rec.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setInspectedId(rec.id);
                        if (canOpen) {
                          onSelectMigration(rec.id);
                        }
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    {/* Subtle hover/selection column backdrop */}
                    <rect
                      x={padLeft + slotW * idx + 4}
                      y={padTop - 4}
                      width={Math.max(0, slotW - 8)}
                      height={plotH + 6}
                      rx={6}
                      fill={isSelected ? '#F1F5F9' : 'transparent'}
                    />

                    {/* Bar Body */}
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={4}
                      fill={isSelected ? metricConfig.barHoverFill : metricConfig.barFill}
                      fillOpacity={isSelected ? 1 : 0.84}
                    />

                    {/* Value Label Above Bar */}
                    <text
                      x={centerX}
                      y={Math.max(13, y - 7)}
                      textAnchor="middle"
                      fill={isSelected ? '#0F172A' : '#334155'}
                      fontSize="11"
                      fontWeight={isSelected ? '700' : '600'}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    >
                      {metricConfig.formatValue(rawValue)}
                    </text>

                    {/* X-Axis Site Name */}
                    <text
                      x={centerX}
                      y={padTop + plotH + 17}
                      textAnchor="middle"
                      fill={isSelected ? '#0F172A' : '#334155'}
                      fontSize="11"
                      fontWeight={isSelected ? '600' : '500'}
                    >
                      {truncateLabel(rec.siteName, chartRecords.length > 5 ? 12 : 16)}
                    </text>

                    {/* X-Axis Platform Sub-label */}
                    <text
                      x={centerX}
                      y={padTop + plotH + 31}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="10"
                    >
                      {formatPlatformLabel(rec.detectedPlatform)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Interactive Selected Bar Detail Strip */}
          {activeRecord && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600">
                <span className="font-semibold text-slate-900">{activeRecord.siteName}</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span>{formatPlatformLabel(activeRecord.detectedPlatform)}</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  {activeRecord.totalAssets} assets ({activeRecord.assetsLocalized} local)
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono font-medium text-emerald-700 tabular-nums">
                  +{activeRecord.loadTimeImprovementPct}% faster ({formatSeconds(activeRecord.loadTimeBeforeMs)} →{' '}
                  {formatSeconds(activeRecord.loadTimeAfterMs)})
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  {formatBytes(activeRecord.bytesSaved)} saved
                </span>
              </div>

              {activeSessionIds.has(activeRecord.id) && (
                <button
                  type="button"
                  onClick={() => onSelectMigration(activeRecord.id)}
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 transition-colors hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  Open Migration
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
