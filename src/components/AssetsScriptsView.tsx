import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  Ban,
  Check,
  Code,
  Download,
  ImageDown,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type { AssetAction, AssetKind, MigrationResult } from '../types/migration';
import { formatActionLabel, formatBytes } from '../utils/format';
import { InfoTooltip } from './InfoTooltip';

interface AssetsScriptsViewProps {
  migration: MigrationResult;
  updatingPolicies: boolean;
  onUpdatePolicies: (overrides: Record<string, AssetAction>) => Promise<void>;
  onUpdateImageOptimization: (config: {
    optimizeImagesToJpeg: boolean;
    imageJpegQuality?: number;
    imageMaxWidth?: number;
  }) => Promise<void>;
}

type KindFilter = 'all' | 'js' | 'stylesheet' | 'image';

const JPEG_QUALITY_PRESETS: Array<{ value: number; label: string }> = [
  { value: 70, label: '70% Compact' },
  { value: 82, label: '82% Balanced' },
  { value: 90, label: '90% High' },
];

export function AssetsScriptsView({
  migration,
  updatingPolicies,
  onUpdatePolicies,
  onUpdateImageOptimization,
}: AssetsScriptsViewProps) {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Reset selections when switching to a different migration project
  useEffect(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
    setBulkNotice(null);
  }, [migration.id]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return migration.assets.filter((asset) => {
      if (kindFilter === 'js' && asset.kind !== 'script' && asset.kind !== 'inline-script') {
        return false;
      }
      if (kindFilter === 'stylesheet' && asset.kind !== 'stylesheet') return false;
      if (kindFilter === 'image' && asset.kind !== 'image') return false;
      if (!q) return true;
      return (
        asset.displayName.toLowerCase().includes(q) ||
        asset.originalUrl.toLowerCase().includes(q) ||
        asset.reason.toLowerCase().includes(q) ||
        (asset.localPath || '').toLowerCase().includes(q)
      );
    });
  }, [migration.assets, kindFilter, searchQuery]);

  const visibleSelectedCount = useMemo(
    () => filteredAssets.filter((a) => selectedIds.has(a.id)).length,
    [filteredAssets, selectedIds],
  );

  const allVisibleSelected =
    filteredAssets.length > 0 && visibleSelectedCount === filteredAssets.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < filteredAssets.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const selectedAssets = useMemo(
    () => migration.assets.filter((a) => selectedIds.has(a.id)),
    [migration.assets, selectedIds],
  );

  const replaceableSelectedCount = useMemo(
    () => selectedAssets.filter((a) => a.kind === 'script' || a.kind === 'stylesheet').length,
    [selectedAssets],
  );

  const handleToggleAllVisible = () => {
    setBulkNotice(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const asset of filteredAssets) {
          next.delete(asset.id);
        }
      } else {
        for (const asset of filteredAssets) {
          next.add(asset.id);
        }
      }
      return next;
    });
    setLastClickedIndex(null);
  };

  const handleRowSelect = (
    assetId: string,
    rowIndex: number,
    event: MouseEvent<HTMLInputElement>,
  ) => {
    setBulkNotice(null);
    const isShift = event.shiftKey;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isShift && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, rowIndex);
        const end = Math.max(lastClickedIndex, rowIndex);
        const shouldSelect = !prev.has(assetId);
        for (let i = start; i <= end; i++) {
          const item = filteredAssets[i];
          if (!item) continue;
          if (shouldSelect) {
            next.add(item.id);
          } else {
            next.delete(item.id);
          }
        }
      } else {
        if (next.has(assetId)) {
          next.delete(assetId);
        } else {
          next.add(assetId);
        }
      }
      return next;
    });

    setLastClickedIndex(rowIndex);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  };

  const handleSelectAllInProject = () => {
    setSelectedIds(new Set(migration.assets.map((a) => a.id)));
  };

  const handleBulkApply = async (action: AssetAction, label: string) => {
    if (selectedIds.size === 0 || updatingPolicies) return;

    const overrides: Record<string, AssetAction> = {};
    let skipped = 0;

    for (const asset of selectedAssets) {
      if (action === 'replace_local' && asset.kind !== 'script' && asset.kind !== 'stylesheet') {
        skipped++;
        continue;
      }
      overrides[asset.id] = action;
    }

    const appliedCount = Object.keys(overrides).length;
    if (appliedCount === 0) return;

    await onUpdatePolicies(overrides);
    setSelectedIds(new Set());
    setLastClickedIndex(null);

    const skippedNote = skipped > 0 ? ` (${skipped} non-script/CSS skipped)` : '';
    setBulkNotice(
      `Applied "${label}" to ${appliedCount} ${appliedCount === 1 ? 'asset' : 'assets'}${skippedNote}.`,
    );
  };

  const handleSingleChange = async (assetId: string, action: AssetAction) => {
    setBulkNotice(null);
    await onUpdatePolicies({ [assetId]: action });
  };

  const handleBulkPreset = async (preset: 'max-speed' | 'localize-all') => {
    const overrides: Record<string, AssetAction> = {};
    for (const asset of migration.assets) {
      if (preset === 'max-speed') {
        if (asset.category === 'telemetry_tracker') {
          overrides[asset.id] = 'strip';
        } else if (asset.category === 'platform_runtime') {
          overrides[asset.id] = asset.kind === 'inline-script' ? 'strip' : 'replace_local';
        } else if (asset.kind === 'script') {
          overrides[asset.id] = 'replace_local';
        } else {
          overrides[asset.id] = 'localize';
        }
      } else {
        overrides[asset.id] = asset.kind === 'inline-script' ? 'keep_inline' : 'localize';
      }
    }
    await onUpdatePolicies(overrides);
    setSelectedIds(new Set());
    setBulkNotice(
      preset === 'max-speed'
        ? 'Applied "Max Offline Speed" preset across all assets.'
        : 'Applied "Download All Local" preset across all assets.',
    );
  };

  const kindCount = (kind: KindFilter) => {
    if (kind === 'all') return migration.assets.length;
    if (kind === 'js') {
      return migration.assets.filter((a) => a.kind === 'script' || a.kind === 'inline-script').length;
    }
    return migration.assets.filter((a) => a.kind === kind).length;
  };

  const imageStats = useMemo(() => {
    const images = migration.assets.filter((a) => a.kind === 'image');
    const eligible = images.filter((a) => a.imageOptimization?.eligible && a.action !== 'strip');
    const svgCount = images.filter((a) => a.imageOptimization?.originalFormat === 'SVG').length;
    const formats = Array.from(
      new Set(
        eligible
          .map((a) => a.imageOptimization?.originalFormat)
          .filter((f): f is string => Boolean(f)),
      ),
    );
    const eligibleOriginalBytes = eligible.reduce((sum, a) => sum + a.originalBytes, 0);
    const eligibleOptimizedBytes = eligible.reduce((sum, a) => sum + a.optimizedBytes, 0);
    const bytesSaved = migration.metrics.imageBytesSaved || 0;
    const pctSaved =
      eligibleOriginalBytes > 0 ? Math.round((bytesSaved / eligibleOriginalBytes) * 100) : 0;

    return {
      totalCount: images.length,
      eligibleCount: eligible.length,
      optimizedCount: migration.metrics.imagesOptimizedCount || 0,
      svgCount,
      formats,
      eligibleOriginalBytes,
      eligibleOptimizedBytes,
      bytesSaved,
      pctSaved,
    };
  }, [migration.assets, migration.metrics]);

  const imageOptEnabled = Boolean(migration.options.optimizeImagesToJpeg);
  const imageJpegQuality = migration.options.imageJpegQuality || 82;
  const imageMaxWidth = migration.options.imageMaxWidth ?? 1600;

  const handleToggleImageOptimizer = async () => {
    if (updatingPolicies) return;
    setBulkNotice(null);
    const nextEnabled = !imageOptEnabled;
    await onUpdateImageOptimization({
      optimizeImagesToJpeg: nextEnabled,
      imageJpegQuality,
      imageMaxWidth,
    });
    setBulkNotice(
      nextEnabled
        ? `Image Optimizer enabled — raster images converted to progressive JPEG (${imageJpegQuality}% quality).`
        : 'Image Optimizer disabled — restored original source image binaries and formats.',
    );
  };

  const handleChangeJpegQuality = async (quality: number) => {
    if (updatingPolicies || quality === imageJpegQuality) return;
    setBulkNotice(null);
    await onUpdateImageOptimization({
      optimizeImagesToJpeg: true,
      imageJpegQuality: quality,
      imageMaxWidth,
    });
  };

  const handleChangeImageMaxWidth = async (maxWidth: number) => {
    if (updatingPolicies || maxWidth === imageMaxWidth) return;
    setBulkNotice(null);
    await onUpdateImageOptimization({
      optimizeImagesToJpeg: true,
      imageJpegQuality,
      imageMaxWidth: maxWidth,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Summary Header & Presets */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-950">
            JavaScript Replacement &amp; Local Asset Inventory
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Select multiple assets to bulk-apply a policy, or override individual rows below. Changes immediately
            recompile the WordPress theme, WXR XML, and offline ZIP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={updatingPolicies}
            onClick={() => handleBulkPreset('max-speed')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            Preset: Max Offline Speed
          </button>
          <button
            type="button"
            disabled={updatingPolicies}
            onClick={() => handleBulkPreset('localize-all')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Preset: Download All Local
          </button>
        </div>
      </div>

      {/* Exact Measured Savings Bar + Export vs. Original Visual Progress Indicator */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Original JS Weight</div>
            <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
              {formatBytes(migration.metrics.jsOriginalBytes)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {migration.metrics.scriptsStripped} ignored · {migration.metrics.scriptsReplacedLocal} replaced
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Local JS Weight</div>
            <div className="mt-1 font-mono text-lg font-semibold text-emerald-700 tabular-nums">
              {formatBytes(migration.metrics.jsOptimizedBytes)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Includes 3.5 KB pressport-runtime.js</div>
          </div>
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Total Package Savings</div>
            <div className="mt-1 font-mono text-lg font-semibold text-emerald-700 tabular-nums">
              {formatBytes(migration.metrics.bytesSaved)} ({migration.metrics.percentSaved}%)
            </div>
            <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
              {formatBytes(migration.metrics.totalOriginalBytes)} → {formatBytes(migration.metrics.totalOptimizedBytes)}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Localized Files Bundled</div>
            <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
              {migration.metrics.assetsLocalized}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Zero external host dependencies</div>
          </div>
        </div>

        {/* Visual Export Size vs. Original Site Progress Bar */}
        {(() => {
          const originalTotal = migration.metrics.totalOriginalBytes;
          const exportedTotal = migration.metrics.totalOptimizedBytes;
          const rawPct = originalTotal > 0 ? (exportedTotal / originalTotal) * 100 : 0;
          const clampedPct = Math.min(100, Math.max(exportedTotal > 0 ? 1.5 : 0, rawPct));
          const isLarger = exportedTotal > originalTotal;
          const pctDisplay = rawPct < 1 && rawPct > 0 ? '<1' : String(Math.round(rawPct));

          return (
            <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <span>Exported Bundle Size vs. Original Site</span>
                  <InfoTooltip
                    title="Exported Bundle Size Bar"
                    content="Compares the total size of your cleaned export package against the original site. A shorter blue bar means a lighter, faster-loading WordPress site."
                    tip="Turning on the Image Optimizer or setting heavy scripts to Ignore updates this bar live."
                  />
                </span>
                <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-slate-600">
                  <span className="font-semibold text-slate-950">
                    {formatBytes(exportedTotal)}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span>{formatBytes(originalTotal)} original</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className={isLarger ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                    {isLarger
                      ? `${pctDisplay}% of original (+${formatBytes(exportedTotal - originalTotal)})`
                      : `${pctDisplay}% of original (${migration.metrics.percentSaved}% reduced)`}
                  </span>
                </div>
              </div>

              <div
                role="progressbar"
                aria-label="Exported bundle size relative to original site size"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(100, rawPct))}
                className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ease-out ${
                    isLarger ? 'bg-amber-600' : 'bg-blue-700'
                  }`}
                  style={{ width: `${clampedPct}%` }}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                <span>
                  Exported assets &amp; HTML: <strong className="font-mono font-medium text-slate-800">{formatBytes(exportedTotal)}</strong>
                </span>
                <span>
                  {imageStats.bytesSaved > 0 ? (
                    <>
                      Saved via JS stripping &amp; JPEG optimization:{' '}
                      <strong className="font-mono font-medium text-emerald-700">
                        {formatBytes(migration.metrics.bytesSaved)}
                      </strong>
                    </>
                  ) : (
                    <>
                      Saved via JS replacement &amp; stripping:{' '}
                      <strong className="font-mono font-medium text-emerald-700">
                        {formatBytes(migration.metrics.bytesSaved)}
                      </strong>
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Image Optimizer Utility Panel */}
      <section
        aria-label="Image Optimizer"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
                imageOptEnabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <ImageDown className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-950">Image Optimizer</h2>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span
                  className={`text-xs font-medium ${
                    imageOptEnabled ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {imageOptEnabled ? 'Active (Progressive JPEG)' : 'Off (Original Formats)'}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Automatically compress and convert high-resolution WebP, PNG, and JPEG assets into progressive JPEGs
                during migration. Vector SVGs remain untouched.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {updatingPolicies && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Optimizing...
              </span>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
              <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                Convert to Optimized JPEG
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={imageOptEnabled}
                aria-label="Automatically compress and convert high-resolution images to optimized JPEGs"
                disabled={updatingPolicies}
                onClick={handleToggleImageOptimizer}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  imageOptEnabled ? 'bg-blue-700' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                    imageOptEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Compression Controls & Measured Impact Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 whitespace-nowrap">
                <span>JPEG Quality:</span>
                <InfoTooltip
                  title="JPEG Compression Quality"
                  content="Balances sharpness against file size. 82% Balanced looks nearly identical to the original while shrinking file sizes dramatically; 70% Compact saves the most space."
                />
              </span>
              <div
                role="group"
                aria-label="JPEG compression quality"
                className="inline-flex items-center gap-1 rounded-md bg-slate-200/70 p-0.5"
              >
                {JPEG_QUALITY_PRESETS.map((preset) => {
                  const active = imageJpegQuality === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={updatingPolicies}
                      onClick={() => handleChangeJpegQuality(preset.value)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap tabular-nums disabled:opacity-50 ${
                        active && imageOptEnabled
                          ? 'bg-white text-slate-950 shadow-xs'
                          : active
                            ? 'bg-white/80 text-slate-700'
                            : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 whitespace-nowrap">
                <label htmlFor="image-opt-max-width">Max Width:</label>
                <InfoTooltip
                  title="Maximum Image Width"
                  content="Scales down oversized photos (for example 4000px camera uploads) to a web-friendly width. Smaller images are never stretched larger."
                  tip="1600 px looks crisp on retina desktop screens while keeping WordPress pages fast."
                />
              </span>
              <select
                id="image-opt-max-width"
                value={imageMaxWidth}
                disabled={updatingPolicies}
                onChange={(e) => handleChangeImageMaxWidth(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none disabled:opacity-50"
              >
                <option value={1200}>1200 px (Blog / Fast)</option>
                <option value={1600}>1600 px (Balanced)</option>
                <option value={1920}>1920 px (Full HD)</option>
                <option value={0}>Original dimensions</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            {imageStats.eligibleCount === 0 ? (
              <span className="text-slate-500">
                {imageStats.svgCount > 0
                  ? `${imageStats.svgCount} vector ${imageStats.svgCount === 1 ? 'SVG' : 'SVGs'} (preserved as vector)`
                  : 'No raster images detected in this migration'}
              </span>
            ) : imageOptEnabled ? (
              <>
                <span className="font-semibold text-emerald-700">
                  {imageStats.optimizedCount} of {imageStats.eligibleCount} converted to JPEG
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="font-mono text-slate-700">
                  {formatBytes(imageStats.eligibleOriginalBytes)} → {formatBytes(imageStats.eligibleOptimizedBytes)}
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-emerald-700">
                  -{formatBytes(imageStats.bytesSaved)} ({imageStats.pctSaved}%)
                </span>
              </>
            ) : (
              <>
                <span className="font-medium text-slate-700">
                  {imageStats.eligibleCount} high-res {imageStats.eligibleCount === 1 ? 'image' : 'images'} eligible
                  {imageStats.formats.length > 0 ? ` (${imageStats.formats.join(', ')})` : ''}
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="font-mono text-slate-600">
                  {formatBytes(imageStats.eligibleOriginalBytes)} source total
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Filter Toolbar, Contextual Bulk Edit Bar & High-Density Data Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['all', 'All Assets'],
                ['js', 'JavaScript'],
                ['stylesheet', 'Stylesheets'],
                ['image', 'Images'],
              ] as Array<[KindFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setKindFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                  kindFilter === key
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {label} ({kindCount(key)})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {updatingPolicies && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Recompiling...
              </span>
            )}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by URL or filename..."
                className="w-56 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>
        </div>

        {/* Contextual Bulk-Edit Bar when 1+ rows are selected */}
        {selectedIds.size > 0 && (
          <div
            role="region"
            aria-label="Bulk asset actions"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-blue-50/70 px-4 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-800 tabular-nums">
              <span className="font-semibold text-blue-900">
                {selectedIds.size} {selectedIds.size === 1 ? 'asset' : 'assets'} selected
              </span>
              {selectedIds.size < migration.assets.length && (
                <>
                  <span className="text-slate-400" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleSelectAllInProject}
                    className="font-medium text-blue-700 hover:underline whitespace-nowrap"
                  >
                    Select all {migration.assets.length}
                  </button>
                </>
              )}
              <span className="text-slate-400" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="font-medium text-slate-600 hover:text-slate-950 whitespace-nowrap"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium text-slate-600">Set policy:</span>
              <button
                type="button"
                disabled={updatingPolicies}
                onClick={() => handleBulkApply('localize', 'Download (Local)')}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </button>
              <button
                type="button"
                disabled={updatingPolicies}
                onClick={() => handleBulkApply('keep_inline', 'Inline')}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                <Code className="h-3.5 w-3.5" aria-hidden="true" />
                Inline
              </button>
              <button
                type="button"
                disabled={updatingPolicies || replaceableSelectedCount === 0}
                title={
                  replaceableSelectedCount === 0
                    ? 'Only JavaScript and Stylesheet assets can be replaced with the local runtime'
                    : undefined
                }
                onClick={() => handleBulkApply('replace_local', 'Replace w/ Local Runtime')}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Replace Local
              </button>
              <button
                type="button"
                disabled={updatingPolicies}
                onClick={() => handleBulkApply('strip', 'Ignore')}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:border-red-400 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
              >
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                Ignore
              </button>
            </div>
          </div>
        )}

        {/* Confirmation banner after bulk policy update */}
        {bulkNotice && selectedIds.size === 0 && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50/70 px-4 py-2 text-xs text-emerald-900"
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
              {bulkNotice}
            </span>
            <button
              type="button"
              onClick={() => setBulkNotice(null)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="w-10 py-2.5 pl-4 pr-2">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Select all visible assets"
                    checked={allVisibleSelected}
                    disabled={filteredAssets.length === 0 || updatingPolicies}
                    onChange={handleToggleAllVisible}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </th>
                <th className="px-4 py-2.5">Asset &amp; Original Source</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Local Destination</th>
                <th className="px-4 py-2.5 text-right">Before</th>
                <th className="px-4 py-2.5 text-right">After</th>
                <th className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1">
                    <span>Migration Policy</span>
                    <InfoTooltip
                      title="Asset Migration Policies"
                      content="Download saves the file locally in your export. Inline embeds small code directly in HTML. Replace w/ Local Runtime swaps heavy builder JS for pressport-runtime.js. Ignore removes trackers or bloat completely."
                      tip="Check multiple rows (Shift+click for ranges) to apply one policy in bulk."
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No assets match your current filter.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset, rowIndex) => {
                  const isSelected = selectedIds.has(asset.id);
                  const statusColor =
                    asset.action === 'strip'
                      ? 'text-red-700'
                      : asset.action === 'replace_local'
                        ? 'text-amber-700'
                        : 'text-emerald-700';

                  return (
                    <tr
                      key={asset.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/45 hover:bg-blue-50/70' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="w-10 py-3 pl-4 pr-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select ${asset.displayName}`}
                          checked={isSelected}
                          disabled={updatingPolicies}
                          onChange={() => {}}
                          onClick={(e) => handleRowSelect(asset.id, rowIndex, e)}
                          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="max-w-md px-4 py-3 align-top">
                        <div className="font-mono text-xs font-medium text-slate-900 truncate">
                          {asset.displayName}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                          {asset.originalUrl}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">{asset.reason}</div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700">
                          {formatKind(asset.kind)}
                        </span>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {asset.usedOnPages.join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {asset.action === 'keep_inline' ? (
                          <span className="font-mono text-xs text-slate-700">Embedded inline in HTML</span>
                        ) : asset.localPath ? (
                          <span className="font-mono text-xs text-slate-800">{asset.localPath}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Removed from output</span>
                        )}
                        <div className={`mt-0.5 text-[11px] font-medium ${statusColor}`}>
                          {formatActionLabel(asset.action)}
                        </div>
                        {asset.kind === 'image' && asset.imageOptimization?.applied && asset.action !== 'strip' && (
                          <div className="mt-0.5 font-mono text-[11px] font-medium text-emerald-700 tabular-nums">
                            {asset.imageOptimization.originalFormat} → {asset.imageOptimization.outputFormat}
                            {asset.imageOptimization.outputWidth && asset.imageOptimization.outputHeight
                              ? ` · ${asset.imageOptimization.outputWidth}×${asset.imageOptimization.outputHeight}`
                              : ''}
                            {asset.imageOptimization.bytesSaved > 0 && asset.originalBytes > 0
                              ? ` · -${Math.round((asset.imageOptimization.bytesSaved / asset.originalBytes) * 100)}%`
                              : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        <div>{formatBytes(asset.originalBytes)}</div>
                        {asset.kind === 'image' &&
                          asset.imageOptimization?.originalWidth &&
                          asset.imageOptimization?.originalHeight && (
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {asset.imageOptimization.originalWidth}×{asset.imageOptimization.originalHeight}{' '}
                              {asset.imageOptimization.originalFormat}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3 align-top text-right font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                        <div>
                          {asset.action === 'replace_local'
                            ? 'Shared runtime'
                            : formatBytes(asset.optimizedBytes)}
                        </div>
                        {asset.kind === 'image' &&
                          asset.action !== 'strip' &&
                          asset.imageOptimization?.applied && (
                            <div className="mt-0.5 text-[11px] font-medium text-emerald-700">
                              JPEG Q{asset.imageOptimization.quality}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <select
                          aria-label={`Migration policy for ${asset.displayName}`}
                          value={asset.action}
                          disabled={updatingPolicies}
                          onChange={(e) => handleSingleChange(asset.id, e.target.value as AssetAction)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:opacity-50"
                        >
                          <option value="localize">Download (Local)</option>
                          <option value="keep_inline">Inline</option>
                          {(asset.kind === 'script' || asset.kind === 'stylesheet') && (
                            <option value="replace_local">Replace w/ Local Runtime</option>
                          )}
                          <option value="strip">Ignore (Strip)</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatKind(kind: AssetKind): string {
  switch (kind) {
    case 'script':
      return 'External JS';
    case 'inline-script':
      return 'Inline JS';
    case 'stylesheet':
      return 'Stylesheet';
    case 'image':
      return 'Image';
    case 'font':
      return 'Font';
  }
}
