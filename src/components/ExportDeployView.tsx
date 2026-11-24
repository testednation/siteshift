import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileArchive,
  FileCode2,
  FolderArchive,
  Layers,
  Loader2,
  PackageCheck,
  Plus,
  ScrollText,
} from 'lucide-react';
import type { ExportFormat, MigrationResult } from '../types/migration';
import { formatExportFormatShort } from '../utils/exportLogFormat';
import { formatBytes, formatPlatformLabel } from '../utils/format';
import type { MigrationKpiRecord } from '../utils/migrationKpis';
import { CompareMigrationsPanel } from './CompareMigrationsPanel';
import { InfoTooltip } from './InfoTooltip';

const BULK_FORMAT_OPTIONS: Array<{ id: ExportFormat; label: string }> = [
  { id: 'theme', label: 'WordPress Theme (.zip)' },
  { id: 'offline', label: 'Standalone Offline (.zip)' },
  { id: 'updated', label: 'Updated Site & Gutenberg (.zip)' },
  { id: 'wxr', label: 'WordPress WXR 1.2 (.xml)' },
  { id: 'source', label: 'Original Site Source (.zip)' },
  { id: 'assets', label: 'Local Assets (.zip)' },
];

interface ExportDeployViewProps {
  migration: MigrationResult;
  history: MigrationResult[];
  kpiRecords: MigrationKpiRecord[];
  downloadingFormat: ExportFormat | null;
  bulkExporting: boolean;
  exportLogsCount: number;
  error: string | null;
  onDownload: (format: ExportFormat) => void;
  onBulkExport: (items: Array<{ migration: MigrationResult; format: ExportFormat }>) => Promise<void>;
  onSelectMigration: (id: string) => void;
  onGoToSetup: () => void;
  onOpenLogs: () => void;
}

export function ExportDeployView({
  migration,
  history,
  kpiRecords,
  downloadingFormat,
  bulkExporting,
  exportLogsCount,
  error,
  onDownload,
  onBulkExport,
  onSelectMigration,
  onGoToSetup,
  onOpenLogs,
}: ExportDeployViewProps) {
  const { metrics, siteSlug, siteName } = migration;

  // Bulk export queue state: select multiple previous migrations and assign export format
  const [selectedIds, setSelectedIds] = useState<string[]>(() => history.map((item) => item.id));
  const [defaultBulkFormat, setDefaultBulkFormat] = useState<ExportFormat>('theme');
  const [rowFormats, setRowFormats] = useState<Record<string, ExportFormat>>({});

  // Keep selectedIds synced with available history and auto-include newly added migrations
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(history.map((item) => item.id));
      const preserved = prev.filter((id) => validIds.has(id));
      if (preserved.length === 0 && history.length > 0) {
        return history.map((item) => item.id);
      }
      return preserved;
    });
  }, [history]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const queuedItems = useMemo(
    () =>
      history
        .filter((item) => selectedIdSet.has(item.id))
        .map((item) => ({
          migration: item,
          format: rowFormats[item.id] || defaultBulkFormat,
        })),
    [history, selectedIdSet, rowFormats, defaultBulkFormat],
  );

  const queueTotals = useMemo(() => {
    let pages = 0;
    let blocks = 0;
    let optimizedBytes = 0;
    for (const entry of queuedItems) {
      pages += entry.migration.pages.length;
      blocks += entry.migration.metrics.gutenbergBlocksGenerated;
      optimizedBytes += entry.migration.metrics.totalOptimizedBytes;
    }
    return { pages, blocks, optimizedBytes };
  }, [queuedItems]);

  const toggleSelectMigration = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleApplyFormatToAll = (nextFormat: ExportFormat) => {
    setDefaultBulkFormat(nextFormat);
    setRowFormats({});
  };

  const handleRowFormatChange = (id: string, format: ExportFormat) => {
    setRowFormats((prev) => ({ ...prev, [id]: format }));
  };

  const formatShortDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const offlineZipContents = [
    ...migration.pages.map((p) => (p.isHome ? 'index.html' : `${p.slug}.html`)),
    'assets/js/pressport-runtime.js',
    'assets/css/pressport-base.css',
    ...migration.assets
      .filter((a) => a.action === 'localize' && a.localPath)
      .map((a) => a.localPath!),
    'asset-manifest.json',
    'OFFLINE-README.txt',
  ];

  const sourceZipContents = [
    ...migration.pages.map((p) => (p.isHome ? 'index.html' : `${p.slug}.html`)),
    ...migration.assets.slice(0, 4).map((a) => {
      const folder =
        a.kind === 'inline-script'
          ? 'inline-scripts'
          : a.kind === 'script'
            ? 'js'
            : a.kind === 'stylesheet'
              ? 'css'
              : a.kind === 'font'
                ? 'fonts'
                : 'images';
      return `source-assets/${folder}/${a.displayName}`;
    }),
    'source-manifest.json',
    'SOURCE-README.txt',
  ];
  const sourceZipTotalCount = migration.pages.length + migration.assets.length + 2;

  const localizedAssetPaths = migration.assets
    .filter((a) => a.action === 'localize' && a.localPath)
    .map((a) => a.localPath!);
  const updatedZipContents = [
    ...migration.pages.map((p) => (p.isHome ? 'index.html' : `${p.slug}.html`)),
    ...migration.pages.map((p) => `gutenberg/${p.isHome ? 'home' : p.slug}.gutenberg.html`),
    'gutenberg/pages-blocks.json',
    `wordpress/${siteSlug}-wordpress-wxr.xml`,
    'assets/js/pressport-runtime.js',
    'assets/css/pressport-base.css',
    ...localizedAssetPaths,
    'migration-report.json',
    'UPDATED-README.txt',
  ];

  const artifacts: Array<{
    format: ExportFormat;
    title: string;
    filename: string;
    description: string;
    details: string;
    ctaLabel: string;
    primary?: boolean;
    icon: typeof Download;
    tooltip: { title: string; content: string; tip?: string };
  }> = [
    {
      format: 'offline',
      title: 'Standalone Offline Site (.zip)',
      filename: `${siteSlug}-offline-local.zip`,
      description:
        '100% self-contained HTML, local pressport-runtime.js, local CSS, and localized media. Opens directly from disk (file://) with zero internet or CDN calls.',
      details: `${offlineZipContents.length} local files · Unzip and open index.html offline`,
      ctaLabel: 'Download Offline ZIP',
      primary: true,
      icon: FolderArchive,
      tooltip: {
        title: 'Best for Instant Offline Viewing',
        content:
          'Does not require WordPress at all. Unzip on your laptop and double-click index.html to browse your migrated site offline or host it on any static host.',
      },
    },
    {
      format: 'theme',
      title: 'Installable WordPress Theme (.zip)',
      filename: `${siteSlug}-wp-theme.zip`,
      description:
        'Complete WordPress theme with functions.php, PHP templates, Gutenberg styling, WXR XML copy, and all localized JS/CSS/images.',
      details: 'Upload via WP Admin → Appearance → Themes → Upload Theme',
      ctaLabel: 'Download WP Theme',
      primary: true,
      icon: FileArchive,
      tooltip: {
        title: 'Step 1 of 2 for WordPress',
        content:
          'Installs your site’s design, clean PHP templates, and local CSS/JS/images inside WordPress. Pair this with the WXR XML file to populate your pages.',
        tip: 'Upload the .zip directly without unzipping it first.',
      },
    },
    {
      format: 'updated',
      title: 'Updated Site & Gutenberg (.zip)',
      filename: `${siteSlug}-updated-gutenberg.zip`,
      description:
        'Complete post-migration archive after builder stripping and Gutenberg conversion—includes cleaned HTML pages, per-page gutenberg/*.gutenberg.html block files, pages-blocks.json, WXR 1.2 XML, localized/optimized assets, and migration-report.json.',
      details: `${updatedZipContents.length} updated files · ${metrics.gutenbergBlocksGenerated} Gutenberg blocks · -${metrics.jsPercentSaved}% JS`,
      ctaLabel: 'Download Updated ZIP',
      primary: true,
      icon: PackageCheck,
      tooltip: {
        title: 'After Builder Stripping & Gutenberg Conversion',
        content:
          'Gives you every converted output in one clean ZIP: builder-stripped HTML, native WordPress Gutenberg block files ready to paste into the Block Editor, WXR XML, and optimized local assets.',
        tip: 'Compare side-by-side with Original Site Source (.zip) to verify everything PressPort cleaned.',
      },
    },
    {
      format: 'source',
      title: 'Original Site Source Archive (.zip)',
      filename: `${siteSlug}-site-source.zip`,
      description:
        'Untouched snapshot of the original captured site source before builder stripping, JS replacement, or image compression—includes raw HTML pages, original captured assets, and source-manifest.json.',
      details: `${sourceZipTotalCount} source files · Archival backup or re-upload via Offline Upload anytime`,
      ctaLabel: 'Download Source ZIP',
      icon: Archive,
      tooltip: {
        title: 'Untouched Site Backup & Offline Re-Import',
        content:
          'Saves the raw source HTML and original unoptimized files exactly as captured from Wix, Squarespace, Strikingly, Webflow, or Weebly—before any PressPort transformations.',
        tip: 'You can drop this exact ZIP back into New Migration → Offline Upload later to re-migrate with different settings without re-crawling.',
      },
    },
    {
      format: 'wxr',
      title: 'WordPress WXR 1.2 Content Import',
      filename: `${siteSlug}-wordpress-wxr.xml`,
      description:
        'Native WordPress eXtended RSS XML containing all migrated pages, Gutenberg blocks, SEO meta descriptions, and local attachment records.',
      details: 'Import via WP Admin → Tools → Import → WordPress',
      ctaLabel: 'Download XML',
      icon: FileCode2,
      tooltip: {
        title: 'Step 2 of 2 for WordPress',
        content:
          'Creates all of your migrated pages and editable Gutenberg blocks inside WordPress. If WordPress prompts you to install the official "WordPress Importer" plugin, click Install Now.',
      },
    },
    {
      format: 'assets',
      title: 'Localized Assets & Manifest Only',
      filename: `${siteSlug}-local-assets.zip`,
      description:
        'Contains only the cleaned assets/ directory (local runtime JS, localized scripts, CSS, images) plus asset-manifest.json for existing WP themes.',
      details: 'Drop assets/ directly into an existing child theme directory',
      ctaLabel: 'Download Assets ZIP',
      icon: Download,
      tooltip: {
        title: 'For Existing WordPress Themes',
        content:
          'Pick this if you already have a favorite WordPress theme (like Astra, GeneratePress, or Twenty Twenty-Five) and only want the cleaned local images, CSS, and JS files.',
      },
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-950">
            Export &amp; Deploy — {siteName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Download as a self-contained Offline ZIP or an installable WordPress package with zero external CDN
            dependencies.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLogs}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
        >
          <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
          Export Logs{exportLogsCount > 0 ? ` (${exportLogsCount})` : ''}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span className="font-semibold">Export error:</span> {error}
        </div>
      )}

      {/* Export Package Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {artifacts.map((artifact) => {
          const Icon = artifact.icon;
          const isDownloading = downloadingFormat === artifact.format;
          return (
            <div
              key={artifact.format}
              className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        artifact.primary ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h2 className="font-display text-base font-semibold text-slate-950">
                          {artifact.title}
                        </h2>
                        <InfoTooltip
                          title={artifact.tooltip.title}
                          content={artifact.tooltip.content}
                          tip={artifact.tooltip.tip}
                        />
                      </div>
                      <p className="font-mono text-xs text-slate-500">{artifact.filename}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{artifact.description}</p>
                {artifact.format === 'offline' && (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700">
                    <div className="font-semibold text-slate-900">Archive contents ({offlineZipContents.length} files):</div>
                    <div className="mt-1 truncate">
                      {offlineZipContents.slice(0, 6).join(' · ')}
                      {offlineZipContents.length > 6 ? ` · +${offlineZipContents.length - 6} more` : ''}
                    </div>
                  </div>
                )}
                {artifact.format === 'updated' && (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700">
                    <div className="font-semibold text-slate-900">
                      Post-strip &amp; Gutenberg contents ({updatedZipContents.length} files):
                    </div>
                    <div className="mt-1 truncate">
                      {updatedZipContents.slice(0, 5).join(' · ')}
                      {updatedZipContents.length > 5 ? ` · +${updatedZipContents.length - 5} more` : ''}
                    </div>
                  </div>
                )}
                {artifact.format === 'source' && (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700">
                    <div className="font-semibold text-slate-900">
                      Captured source contents ({sourceZipTotalCount} files):
                    </div>
                    <div className="mt-1 truncate">
                      {sourceZipContents.slice(0, 5).join(' · ')}
                      {sourceZipTotalCount > 5 ? ` · +${sourceZipTotalCount - 5} more` : ''}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-500">{artifact.details}</span>
                <button
                  type="button"
                  disabled={downloadingFormat !== null || bulkExporting}
                  onClick={() => onDownload(artifact.format)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ${
                    artifact.primary
                      ? 'bg-blue-700 text-white hover:bg-blue-800'
                      : 'border border-slate-300 bg-white text-slate-900 hover:border-blue-600 hover:text-blue-700'
                  }`}
                >
                  {isDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {isDownloading ? 'Building ZIP...' : artifact.ctaLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Export Queue: Concatenate Multiple Migrations into One ZIP */}
      <section
        aria-labelledby="bulk-export-heading"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
              <h2 id="bulk-export-heading" className="font-display text-base font-semibold text-slate-950">
                Bulk Export Queue (Concatenated ZIP)
              </h2>
              <InfoTooltip
                title="Bulk Concatenated ZIP Export"
                content="Select multiple migrated sites from this session and bundle all of their packages into a single organized .zip file. Each site is unpacked into its own numbered folder alongside a unified BULK-EXPORT-MANIFEST.json."
                tip="You can apply one format to the entire queue or pick a different package format per site."
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Select multiple previous migrations and queue their downloads into one combined ZIP archive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="bulk-default-format" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Queue format:
            </label>
            <select
              id="bulk-default-format"
              value={defaultBulkFormat}
              disabled={bulkExporting}
              onChange={(e) => handleApplyFormatToAll(e.target.value as ExportFormat)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            >
              {BULK_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={bulkExporting || selectedIds.length === history.length}
              onClick={() => setSelectedIds(history.map((item) => item.id))}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 disabled:opacity-40 whitespace-nowrap"
            >
              Select All ({history.length})
            </button>
            <button
              type="button"
              disabled={bulkExporting || selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 disabled:opacity-40 whitespace-nowrap"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Migration Queue Selection Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all migrations in bulk export queue"
                    checked={history.length > 0 && selectedIds.length === history.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? history.map((item) => item.id) : [])
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                </th>
                <th className="px-4 py-2.5">Migrated Site</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Pages &amp; Blocks</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Bundle Size</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Queued Package</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((item) => {
                const checked = selectedIdSet.has(item.id);
                const isCurrent = item.id === migration.id;
                const rowFormat = rowFormats[item.id] || defaultBulkFormat;
                const queueIdx = queuedItems.findIndex((q) => q.migration.id === item.id);

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${checked ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <input
                        id={`bulk-check-${item.id}`}
                        type="checkbox"
                        checked={checked}
                        disabled={bulkExporting}
                        onChange={() => toggleSelectMigration(item.id)}
                        aria-label={`Include ${item.siteName} in bulk export ZIP`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <label htmlFor={`bulk-check-${item.id}`} className="block cursor-pointer">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-900">{item.siteName}</span>
                          {isCurrent && (
                            <>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span className="text-xs font-semibold text-blue-700">Active</span>
                            </>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{formatPlatformLabel(item.detectedPlatform)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[11px] text-slate-500">{item.id}</span>
                          {item.createdAt && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-[11px] tabular-nums">
                                {formatShortDate(item.createdAt)}
                              </span>
                            </>
                          )}
                          {!isCurrent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  onSelectMigration(item.id);
                                }}
                                className="font-medium text-blue-700 hover:underline"
                              >
                                Inspect
                              </button>
                            </>
                          )}
                        </div>
                      </label>
                    </td>
                    <td className="px-4 py-3 align-middle font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      <div>
                        {item.pages.length} {item.pages.length === 1 ? 'page' : 'pages'} ·{' '}
                        {item.metrics.gutenbergBlocksGenerated} blocks
                      </div>
                      <div className="mt-0.5 text-[11px] text-emerald-700">
                        -{item.metrics.jsPercentSaved}% JS weight
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-middle font-mono text-xs tabular-nums text-slate-800 whitespace-nowrap">
                      <div>{formatBytes(item.metrics.totalOptimizedBytes)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {queueIdx >= 0
                          ? `/${String(queueIdx + 1).padStart(2, '0')}-${item.siteSlug}-${rowFormat}/`
                          : 'Not queued'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                      <label htmlFor={`bulk-format-${item.id}`} className="sr-only">
                        Export format for {item.siteName}
                      </label>
                      <select
                        id={`bulk-format-${item.id}`}
                        value={rowFormat}
                        disabled={!checked || bulkExporting}
                        onChange={(e) => handleRowFormatChange(item.id, e.target.value as ExportFormat)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        {BULK_FORMAT_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {formatExportFormatShort(opt.id)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Queue Summary & Concatenated Download Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5">
          <div className="text-xs text-slate-600">
            {queuedItems.length === 0 ? (
              <span>Select one or more migrations above to build a concatenated ZIP archive.</span>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono tabular-nums">
                <span className="font-sans font-semibold text-slate-900">
                  {queuedItems.length} {queuedItems.length === 1 ? 'migration' : 'migrations'} queued
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span>{queueTotals.pages} pages</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span>{queueTotals.blocks} Gutenberg blocks</span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span>Est. {formatBytes(queueTotals.optimizedBytes)}</span>
              </div>
            )}
            {history.length === 1 && (
              <p className="mt-1 text-xs text-slate-500">
                Tip: Migrate another site or offline sample to bundle multiple sites together in one ZIP.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {history.length < 2 && (
              <button
                type="button"
                onClick={onGoToSetup}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Migrate Another Site
              </button>
            )}
            <button
              type="button"
              disabled={queuedItems.length === 0 || bulkExporting || downloadingFormat !== null}
              onClick={() => void onBulkExport(queuedItems)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap"
            >
              {bulkExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Concatenating {queuedItems.length} {queuedItems.length === 1 ? 'Site' : 'Sites'}...
                </>
              ) : (
                <>
                  <FolderArchive className="h-3.5 w-3.5" aria-hidden="true" />
                  Download Bulk ZIP ({queuedItems.length})
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Compare Two Historical Migrations Side-by-Side */}
      <CompareMigrationsPanel
        activeMigration={migration}
        kpiRecords={kpiRecords}
        activeSessionIds={new Set(history.map((item) => item.id))}
        onSelectMigration={onSelectMigration}
        onGoToSetup={onGoToSetup}
      />

      {/* Measured Before vs After Performance Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Measured Migration &amp; Speed Audit ({formatPlatformLabel(migration.detectedPlatform)} → WordPress Local)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-5 py-2.5">Metric</th>
                <th className="px-5 py-2.5 text-right">Source ({formatPlatformLabel(migration.detectedPlatform)})</th>
                <th className="px-5 py-2.5 text-right">Migrated WordPress Local</th>
                <th className="px-5 py-2.5 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
              <tr>
                <td className="px-5 py-3 font-sans font-medium text-slate-800">JavaScript Payload</td>
                <td className="px-5 py-3 text-right text-slate-600">{formatBytes(metrics.jsOriginalBytes)}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-900">
                  {formatBytes(metrics.jsOptimizedBytes)}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                  -{metrics.jsPercentSaved}% JS weight
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-sans font-medium text-slate-800">Total Site Bundle</td>
                <td className="px-5 py-3 text-right text-slate-600">{formatBytes(metrics.totalOriginalBytes)}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-900">
                  {formatBytes(metrics.totalOptimizedBytes)}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                  Saved {formatBytes(metrics.bytesSaved)} ({metrics.percentSaved}%)
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-sans font-medium text-slate-800">External CDN Requests</td>
                <td className="px-5 py-3 text-right text-slate-600">{metrics.externalRequestsBefore} remote</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-900">
                  {metrics.externalRequestsAfter} remote
                </td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-700">100% offline-ready</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-sans font-medium text-slate-800">Converted Content</td>
                <td className="px-5 py-3 text-right text-slate-600">Proprietary DOM</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-900">
                  {metrics.gutenbergBlocksGenerated} Gutenberg blocks
                </td>
                <td className="px-5 py-3 text-right text-slate-700">
                  {metrics.pagesMigrated} {metrics.pagesMigrated === 1 ? 'page' : 'pages'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings if any */}
      {migration.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            Migration Notes ({migration.warnings.length})
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900/90">
            {migration.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Deployment Checklist */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-display text-base font-semibold text-slate-950">
          WordPress Import &amp; Offline Verification Checklist
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              <strong>Install Theme:</strong> In WordPress Admin, navigate to{' '}
              <code className="font-mono text-xs text-slate-900">Appearance → Themes → Add New → Upload Theme</code> and
              activate <code className="font-mono text-xs text-slate-900">{siteSlug}-wp-theme.zip</code>.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              <strong>Import Pages &amp; Blocks:</strong> Go to{' '}
              <code className="font-mono text-xs text-slate-900">Tools → Import → WordPress</code> and upload{' '}
              <code className="font-mono text-xs text-slate-900">{siteSlug}-wordpress-wxr.xml</code> to create all
              editable Gutenberg pages.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              <strong>Verify Offline Speed:</strong> Open Chrome DevTools → Network tab, enable Offline mode or inspect
              domains — confirm zero requests hit <code className="font-mono text-xs text-slate-900">wixstatic.com</code>,{' '}
              <code className="font-mono text-xs text-slate-900">squarespace-cdn.com</code>,{' '}
              <code className="font-mono text-xs text-slate-900">strikinglycdn.com</code>, or{' '}
              <code className="font-mono text-xs text-slate-900">website-files.com</code>.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
