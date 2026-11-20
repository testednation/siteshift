import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileArchive,
  FileCode2,
  FolderArchive,
  Loader2,
  ScrollText,
} from 'lucide-react';
import type { ExportFormat, MigrationResult } from '../types/migration';
import { formatBytes, formatPlatformLabel } from '../utils/format';
import { InfoTooltip } from './InfoTooltip';

interface ExportDeployViewProps {
  migration: MigrationResult;
  downloadingFormat: ExportFormat | null;
  exportLogsCount: number;
  onDownload: (format: ExportFormat) => void;
  onOpenLogs: () => void;
}

export function ExportDeployView({
  migration,
  downloadingFormat,
  exportLogsCount,
  onDownload,
  onOpenLogs,
}: ExportDeployViewProps) {
  const { metrics, siteSlug, siteName } = migration;

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
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="text-xs text-slate-500">{artifact.details}</span>
                <button
                  type="button"
                  disabled={downloadingFormat !== null}
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
