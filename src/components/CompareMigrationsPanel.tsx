import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, GitCompareArrows, Plus } from 'lucide-react';
import type { MigrationResult } from '../types/migration';
import { formatBytes, formatPlatformLabel } from '../utils/format';
import {
  formatSeconds,
  toMigrationKpiRecord,
  type MigrationKpiRecord,
} from '../utils/migrationKpis';
import { InfoTooltip } from './InfoTooltip';

interface CompareMigrationsPanelProps {
  activeMigration: MigrationResult;
  kpiRecords: MigrationKpiRecord[];
  activeSessionIds: Set<string>;
  onSelectMigration: (id: string) => void;
  onGoToSetup: () => void;
}

type DiffTone = 'better' | 'worse' | 'neutral';

interface ComparisonRow {
  id: string;
  label: string;
  helper?: string;
  valueA: string;
  subA?: string;
  valueB: string;
  subB?: string;
  deltaLabel: string;
  deltaSub?: string;
  tone: DiffTone;
}

function formatRecordDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = date.toLocaleString(undefined, { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${month} ${day}, ${time}`;
}

function formatSignedBytes(diff: number): string {
  if (diff === 0) return '0 B';
  const sign = diff > 0 ? '+' : '-';
  return `${sign}${formatBytes(Math.abs(diff))}`;
}

function formatSignedCount(diff: number, unit = ''): string {
  if (diff === 0) return 'Same';
  const sign = diff > 0 ? '+' : '-';
  const suffix = unit ? ` ${unit}` : '';
  return `${sign}${Math.abs(diff).toLocaleString()}${suffix}`;
}

function formatSignedSeconds(diffMs: number): string {
  if (Math.abs(diffMs) < 5) return 'Same';
  const sign = diffMs > 0 ? '+' : '-';
  return `${sign}${(Math.abs(diffMs) / 1000).toFixed(2)}s`;
}

export function CompareMigrationsPanel({
  activeMigration,
  kpiRecords,
  activeSessionIds,
  onSelectMigration,
  onGoToSetup,
}: CompareMigrationsPanelProps) {
  // Ensure the active migration is always available alongside persisted historical migrations
  const comparableRecords = useMemo<MigrationKpiRecord[]>(() => {
    const activeRecord = toMigrationKpiRecord(activeMigration);
    const byId = new Map<string, MigrationKpiRecord>();
    for (const rec of kpiRecords) {
      byId.set(rec.id, rec);
    }
    byId.set(activeRecord.id, activeRecord);

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activeMigration, kpiRecords]);

  const [leftId, setLeftId] = useState<string>(() => activeMigration.id);
  const [rightId, setRightId] = useState<string>(() => {
    const other = comparableRecords.find((r) => r.id !== activeMigration.id);
    return other ? other.id : activeMigration.id;
  });

  // Keep selections valid whenever comparableRecords change
  useEffect(() => {
    if (comparableRecords.length === 0) return;
    const ids = new Set(comparableRecords.map((r) => r.id));

    let nextLeft = leftId;
    if (!ids.has(nextLeft)) {
      nextLeft = activeMigration.id;
      setLeftId(nextLeft);
    }

    if (!ids.has(rightId) || (comparableRecords.length >= 2 && rightId === nextLeft)) {
      const candidate = comparableRecords.find((r) => r.id !== nextLeft);
      if (candidate) {
        setRightId(candidate.id);
      }
    }
  }, [comparableRecords, activeMigration.id, leftId, rightId]);

  const recordA = useMemo(
    () => comparableRecords.find((r) => r.id === leftId) || comparableRecords[0] || null,
    [comparableRecords, leftId],
  );

  const recordB = useMemo(
    () =>
      comparableRecords.find((r) => r.id === rightId) ||
      comparableRecords.find((r) => r.id !== recordA?.id) ||
      null,
    [comparableRecords, rightId, recordA],
  );

  const handleSwap = () => {
    if (!recordA || !recordB) return;
    setLeftId(recordB.id);
    setRightId(recordA.id);
  };

  const rows = useMemo<ComparisonRow[]>(() => {
    if (!recordA || !recordB) return [];

    const loadSavedMsA = Math.max(0, recordA.loadTimeBeforeMs - recordA.loadTimeAfterMs);
    const loadSavedMsB = Math.max(0, recordB.loadTimeBeforeMs - recordB.loadTimeAfterMs);
    const loadSavedPctDiff = recordB.loadTimeImprovementPct - recordA.loadTimeImprovementPct;
    const loadSavedMsDiff = loadSavedMsB - loadSavedMsA;

    const loadAfterDiffMs = recordB.loadTimeAfterMs - recordA.loadTimeAfterMs;
    const assetCountDiff = recordB.totalAssets - recordA.totalAssets;
    const localizedDiff = recordB.assetsLocalized - recordA.assetsLocalized;

    const cleanedA = recordA.scriptsStripped + recordA.scriptsReplacedLocal;
    const cleanedB = recordB.scriptsStripped + recordB.scriptsReplacedLocal;
    const cleanedDiff = cleanedB - cleanedA;

    const bundleAfterDiff = recordB.totalOptimizedBytes - recordA.totalOptimizedBytes;
    const bytesSavedDiff = recordB.bytesSaved - recordA.bytesSaved;
    const jsAfterDiff = recordB.jsOptimizedBytes - recordA.jsOptimizedBytes;

    const extElimA = Math.max(0, recordA.externalRequestsBefore - recordA.externalRequestsAfter);
    const extElimB = Math.max(0, recordB.externalRequestsBefore - recordB.externalRequestsAfter);
    const extElimDiff = extElimB - extElimA;

    const blocksDiff = recordB.gutenbergBlocks - recordA.gutenbergBlocks;
    const pagesDiff = recordB.pagesMigrated - recordA.pagesMigrated;

    return [
      {
        id: 'load-savings',
        label: 'Load Time Savings',
        helper: 'Estimated 4G transfer, JS parse & CDN RTT reduction',
        valueA: `+${recordA.loadTimeImprovementPct}% faster`,
        subA: `${formatSeconds(loadSavedMsA)} saved (${formatSeconds(recordA.loadTimeBeforeMs)} → ${formatSeconds(recordA.loadTimeAfterMs)})`,
        valueB: `+${recordB.loadTimeImprovementPct}% faster`,
        subB: `${formatSeconds(loadSavedMsB)} saved (${formatSeconds(recordB.loadTimeBeforeMs)} → ${formatSeconds(recordB.loadTimeAfterMs)})`,
        deltaLabel:
          loadSavedPctDiff === 0
            ? 'Same %'
            : `${loadSavedPctDiff > 0 ? '+' : ''}${loadSavedPctDiff} pts`,
        deltaSub:
          Math.abs(loadSavedMsDiff) < 5
            ? 'Same time saved'
            : `${formatSignedSeconds(loadSavedMsDiff)} saved`,
        tone:
          loadSavedPctDiff > 0 || (loadSavedPctDiff === 0 && loadSavedMsDiff > 10)
            ? 'better'
            : loadSavedPctDiff < 0 || (loadSavedPctDiff === 0 && loadSavedMsDiff < -10)
              ? 'worse'
              : 'neutral',
      },
      {
        id: 'load-after',
        label: 'Estimated Load Time (After)',
        helper: 'Lower is faster for end users',
        valueA: formatSeconds(recordA.loadTimeAfterMs),
        subA: `From ${formatSeconds(recordA.loadTimeBeforeMs)}`,
        valueB: formatSeconds(recordB.loadTimeAfterMs),
        subB: `From ${formatSeconds(recordB.loadTimeBeforeMs)}`,
        deltaLabel:
          Math.abs(loadAfterDiffMs) < 5
            ? 'Same'
            : `${formatSignedSeconds(loadAfterDiffMs)} ${loadAfterDiffMs < 0 ? 'faster' : 'slower'}`,
        tone: loadAfterDiffMs < -5 ? 'better' : loadAfterDiffMs > 5 ? 'worse' : 'neutral',
      },
      {
        id: 'total-assets',
        label: 'Total Assets Processed',
        helper: 'Scripts, stylesheets, fonts & media discovered',
        valueA: `${recordA.totalAssets.toLocaleString()} assets`,
        subA: `${recordA.assetsLocalized} localized`,
        valueB: `${recordB.totalAssets.toLocaleString()} assets`,
        subB: `${recordB.assetsLocalized} localized`,
        deltaLabel: formatSignedCount(assetCountDiff, 'assets'),
        deltaSub:
          localizedDiff === 0
            ? 'Same localized count'
            : `${formatSignedCount(localizedDiff)} localized`,
        tone: 'neutral',
      },
      {
        id: 'scripts-cleaned',
        label: 'Scripts Stripped / Replaced',
        helper: 'Builder runtimes & trackers removed or localized',
        valueA: `${cleanedA} scripts`,
        subA: `${recordA.scriptsStripped} stripped · ${recordA.scriptsReplacedLocal} replaced`,
        valueB: `${cleanedB} scripts`,
        subB: `${recordB.scriptsStripped} stripped · ${recordB.scriptsReplacedLocal} replaced`,
        deltaLabel: formatSignedCount(cleanedDiff, 'scripts'),
        tone: 'neutral',
      },
      {
        id: 'bundle-after',
        label: 'Migrated Bundle Size',
        helper: 'Total output bytes across localized pages & assets',
        valueA: formatBytes(recordA.totalOptimizedBytes),
        subA: `From ${formatBytes(recordA.totalOriginalBytes)}`,
        valueB: formatBytes(recordB.totalOptimizedBytes),
        subB: `From ${formatBytes(recordB.totalOriginalBytes)}`,
        deltaLabel:
          bundleAfterDiff === 0
            ? 'Same'
            : `${formatSignedBytes(bundleAfterDiff)} ${bundleAfterDiff < 0 ? 'smaller' : 'larger'}`,
        tone: bundleAfterDiff < 0 ? 'better' : bundleAfterDiff > 0 ? 'worse' : 'neutral',
      },
      {
        id: 'payload-saved',
        label: 'Total Payload Saved',
        helper: 'Bytes eliminated via stripping & optimization',
        valueA: formatBytes(recordA.bytesSaved),
        subA: `${recordA.percentSaved}% reduction`,
        valueB: formatBytes(recordB.bytesSaved),
        subB: `${recordB.percentSaved}% reduction`,
        deltaLabel:
          bytesSavedDiff === 0 ? 'Same' : `${formatSignedBytes(bytesSavedDiff)} saved`,
        deltaSub:
          recordB.percentSaved === recordA.percentSaved
            ? undefined
            : `${recordB.percentSaved - recordA.percentSaved > 0 ? '+' : ''}${recordB.percentSaved - recordA.percentSaved} pts`,
        tone: bytesSavedDiff > 0 ? 'better' : bytesSavedDiff < 0 ? 'worse' : 'neutral',
      },
      {
        id: 'js-payload',
        label: 'JavaScript Payload (After)',
        helper: 'Lower JS weight reduces main-thread parse time',
        valueA: formatBytes(recordA.jsOptimizedBytes),
        subA: `-${recordA.jsPercentSaved}% from ${formatBytes(recordA.jsOriginalBytes)}`,
        valueB: formatBytes(recordB.jsOptimizedBytes),
        subB: `-${recordB.jsPercentSaved}% from ${formatBytes(recordB.jsOriginalBytes)}`,
        deltaLabel:
          jsAfterDiff === 0
            ? 'Same'
            : `${formatSignedBytes(jsAfterDiff)} ${jsAfterDiff < 0 ? 'lighter' : 'heavier'}`,
        tone: jsAfterDiff < 0 ? 'better' : jsAfterDiff > 0 ? 'worse' : 'neutral',
      },
      {
        id: 'external-requests',
        label: 'External CDN Requests Removed',
        helper: 'Eliminated third-party network round-trips',
        valueA: `${extElimA} removed`,
        subA: `${recordA.externalRequestsBefore} → ${recordA.externalRequestsAfter} remote`,
        valueB: `${extElimB} removed`,
        subB: `${recordB.externalRequestsBefore} → ${recordB.externalRequestsAfter} remote`,
        deltaLabel: formatSignedCount(extElimDiff, 'requests'),
        tone:
          recordB.externalRequestsAfter < recordA.externalRequestsAfter
            ? 'better'
            : recordB.externalRequestsAfter > recordA.externalRequestsAfter
              ? 'worse'
              : 'neutral',
      },
      {
        id: 'pages-blocks',
        label: 'Pages & Gutenberg Blocks',
        helper: 'Migrated page count and WordPress blocks generated',
        valueA: `${recordA.pagesMigrated} ${recordA.pagesMigrated === 1 ? 'page' : 'pages'}`,
        subA: `${recordA.gutenbergBlocks.toLocaleString()} blocks`,
        valueB: `${recordB.pagesMigrated} ${recordB.pagesMigrated === 1 ? 'page' : 'pages'}`,
        subB: `${recordB.gutenbergBlocks.toLocaleString()} blocks`,
        deltaLabel:
          pagesDiff === 0
            ? 'Same pages'
            : formatSignedCount(pagesDiff, Math.abs(pagesDiff) === 1 ? 'page' : 'pages'),
        deltaSub:
          blocksDiff === 0 ? 'Same blocks' : formatSignedCount(blocksDiff, 'blocks'),
        tone: 'neutral',
      },
    ];
  }, [recordA, recordB]);

  const formatOptionLabel = (rec: MigrationKpiRecord) => {
    const stamp = formatRecordDate(rec.createdAt);
    return `${rec.siteName} (${formatPlatformLabel(rec.detectedPlatform)})${stamp ? ` · ${stamp}` : ''} · ${rec.id}`;
  };

  const renderToneClass = (tone: DiffTone) => {
    if (tone === 'better') return 'text-emerald-700 font-semibold';
    if (tone === 'worse') return 'text-amber-700 font-semibold';
    return 'text-slate-600 font-medium';
  };

  return (
    <section
      aria-labelledby="compare-migrations-heading"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <h2
              id="compare-migrations-heading"
              className="font-display text-base font-semibold text-slate-950"
            >
              Compare Migrations
            </h2>
            <InfoTooltip
              title="Side-by-Side Migration Performance Diff"
              content="Pick any two historical migrations stored in your browser to compare asset counts, script stripping, final bundle weight, and estimated load time savings side by side."
              tip="Green deltas highlight where Migration B outperforms Baseline A (faster post-migration load time, greater load savings, or smaller bundle size)."
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Select two historical migrations to inspect a side-by-side diff of asset counts, bundle weight, and load
            time savings.
          </p>
        </div>

        {comparableRecords.length >= 2 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
              {comparableRecords.length} historical migrations available
            </span>
            <button
              type="button"
              onClick={handleSwap}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
              Swap A ⇄ B
            </button>
          </div>
        )}
      </div>

      {comparableRecords.length < 2 ? (
        /* Single-Migration Empty Comparison State */
        <div className="flex flex-col items-start justify-between gap-4 bg-slate-50/60 px-5 py-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-slate-900">
              Run one more migration to unlock side-by-side performance comparison
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Only <strong className="font-medium text-slate-800">{activeMigration.siteName}</strong> is currently
              recorded in your migration history. Migrate another site — or re-run the same site with{' '}
              <strong className="font-medium text-slate-800">Auto-Optimize Assets</strong> enabled — to compare asset
              counts, bundle sizes, and load time savings side by side.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToSetup}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Run Another Migration
          </button>
        </div>
      ) : (
        <>
          {/* Two-Column Historical Migration Selectors */}
          <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="compare-migration-a"
                  className="text-xs font-semibold text-slate-700"
                >
                  Baseline Migration A
                </label>
                {recordA && activeSessionIds.has(recordA.id) && recordA.id !== activeMigration.id && (
                  <button
                    type="button"
                    onClick={() => onSelectMigration(recordA.id)}
                    className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                  >
                    Inspect A
                  </button>
                )}
              </div>
              <select
                id="compare-migration-a"
                value={recordA?.id || ''}
                onChange={(e) => setLeftId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              >
                {comparableRecords.map((rec) => (
                  <option key={rec.id} value={rec.id}>
                    {formatOptionLabel(rec)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="compare-migration-b"
                  className="text-xs font-semibold text-slate-700"
                >
                  Comparison Migration B
                </label>
                {recordB && activeSessionIds.has(recordB.id) && recordB.id !== activeMigration.id && (
                  <button
                    type="button"
                    onClick={() => onSelectMigration(recordB.id)}
                    className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                  >
                    Inspect B
                  </button>
                )}
              </div>
              <select
                id="compare-migration-b"
                value={recordB?.id || ''}
                onChange={(e) => setRightId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              >
                {comparableRecords.map((rec) => (
                  <option key={rec.id} value={rec.id}>
                    {formatOptionLabel(rec)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {recordA && recordB && recordA.id === recordB.id && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-900">
              You have selected the same migration on both sides. Pick a different migration in either dropdown to view
              differences.
            </div>
          )}

          {/* Side-by-Side Performance Diff Table */}
          {recordA && recordB && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-5 py-2.5">Performance Metric</th>
                    <th className="px-5 py-2.5 text-right">
                      <span className="block text-slate-900">A: {recordA.siteName}</span>
                      <span className="block font-normal text-[11px] text-slate-500">
                        {formatPlatformLabel(recordA.detectedPlatform)} · {recordA.id}
                      </span>
                    </th>
                    <th className="px-5 py-2.5 text-right">
                      <span className="block text-slate-900">B: {recordB.siteName}</span>
                      <span className="block font-normal text-[11px] text-slate-500">
                        {formatPlatformLabel(recordB.detectedPlatform)} · {recordB.id}
                      </span>
                    </th>
                    <th className="px-5 py-2.5 text-right whitespace-nowrap">
                      <span className="block text-slate-900">Diff (B vs. A)</span>
                      <span className="block font-normal text-[11px] text-slate-500">Delta</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 align-middle font-sans">
                        <div className="font-medium text-slate-900">{row.label}</div>
                        {row.helper && (
                          <div className="mt-0.5 text-[11px] text-slate-500">{row.helper}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right align-middle whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{row.valueA}</div>
                        {row.subA && (
                          <div className="mt-0.5 text-[11px] text-slate-500">{row.subA}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right align-middle whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{row.valueB}</div>
                        {row.subB && (
                          <div className="mt-0.5 text-[11px] text-slate-500">{row.subB}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right align-middle whitespace-nowrap">
                        <div className={renderToneClass(row.tone)}>{row.deltaLabel}</div>
                        {row.deltaSub && (
                          <div className="mt-0.5 text-[11px] text-slate-500">{row.deltaSub}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Concise Diff Summary Strip */}
          {recordA && recordB && recordA.id !== recordB.id && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-semibold text-slate-900">Summary:</span>
                <span>
                  {recordB.loadTimeAfterMs < recordA.loadTimeAfterMs
                    ? `${recordB.siteName} (B) loads ${formatSeconds(recordA.loadTimeAfterMs - recordB.loadTimeAfterMs)} faster after migration`
                    : recordA.loadTimeAfterMs < recordB.loadTimeAfterMs
                      ? `${recordA.siteName} (A) loads ${formatSeconds(recordB.loadTimeAfterMs - recordA.loadTimeAfterMs)} faster after migration`
                      : 'Both migrations have identical post-migration load times'}
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {recordB.totalAssets === recordA.totalAssets
                    ? `Same asset count (${recordA.totalAssets})`
                    : `${formatSignedCount(recordB.totalAssets - recordA.totalAssets, 'assets')} in B`}
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {recordB.totalOptimizedBytes === recordA.totalOptimizedBytes
                    ? `Same bundle size (${formatBytes(recordA.totalOptimizedBytes)})`
                    : `${formatSignedBytes(recordB.totalOptimizedBytes - recordA.totalOptimizedBytes)} final bundle`}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
