import crypto from 'node:crypto';
import type {
  ExportFormat,
  ExportLogEntry,
  ExportLogFormat,
  ExportLogLine,
  MigrationResult,
  PlatformType,
} from '../types/migration.ts';
import { formatExportFormatLabel } from '../utils/exportLogFormat.ts';

const MAX_LOG_ENTRIES = 100;
const exportLogStore: ExportLogEntry[] = [];

function createLogId(): string {
  return `exp-${crypto.randomBytes(4).toString('hex')}`;
}

function makeLine(stage: string, level: ExportLogLine['level'], message: string, timestamp?: string): ExportLogLine {
  return {
    timestamp: timestamp || new Date().toISOString(),
    level,
    stage,
    message,
  };
}

export function listExportLogs(): ExportLogEntry[] {
  return exportLogStore;
}

export function getExportLogById(logId: string): ExportLogEntry | undefined {
  return exportLogStore.find((entry) => entry.id === logId);
}

export function clearExportLogs(): void {
  exportLogStore.length = 0;
}

function pushExportLog(entry: ExportLogEntry): ExportLogEntry {
  exportLogStore.unshift(entry);
  if (exportLogStore.length > MAX_LOG_ENTRIES) {
    exportLogStore.length = MAX_LOG_ENTRIES;
  }
  return entry;
}

export function recordServerExportSuccess(params: {
  result: MigrationResult;
  format: ExportFormat;
  filename: string;
  sizeBytes: number;
  fileCount: number;
  packagedPaths: string[];
  durationMs: number;
  startedAtIso: string;
}): ExportLogEntry {
  const { result, format, filename, sizeBytes, fileCount, packagedPaths, durationMs, startedAtIso } = params;
  const completedAtIso = new Date().toISOString();
  const entries: ExportLogLine[] = [];

  entries.push(
    makeLine(
      'INIT',
      'INFO',
      `Export requested: ${formatExportFormatLabel(format)} for "${result.siteName}" (job ${result.id}, platform=${result.detectedPlatform}).`,
      startedAtIso,
    ),
  );

  entries.push(
    makeLine(
      'CONFIG',
      'INFO',
      `Migration options: offlineOnly=${result.options.offlineOnly}, stripTrackers=${result.options.stripTrackers}, replacePlatformJs=${result.options.replacePlatformJs}, localizeImages=${result.options.localizeImages}, gutenbergBlocks=${result.options.generateGutenbergBlocks}.`,
      startedAtIso,
    ),
  );

  entries.push(
    makeLine(
      'VALIDATE',
      'INFO',
      `Verified ${result.pages.length} migrated page(s) and ${result.metrics.gutenbergBlocksGenerated} Gutenberg block(s); external requests reduced from ${result.metrics.externalRequestsBefore} to ${result.metrics.externalRequestsAfter}.`,
    ),
  );

  // Check for pages with empty Gutenberg content (useful WP import diagnostic)
  let warningCount = 0;
  for (const page of result.pages) {
    if (!page.gutenbergContent.trim()) {
      warningCount++;
      entries.push(
        makeLine(
          'VALIDATE',
          'WARN',
          `Page "/${page.slug}" produced empty Gutenberg content; verify source HTML sections before importing into WordPress.`,
        ),
      );
    }
  }

  // Asset breakdown diagnostics
  const inlinedCount = result.assets.filter((a) => a.action === 'keep_inline').length;
  const placeholderCount = result.assets.filter(
    (a) => a.action === 'localize' && a.isExternal && !a.fetchedLocally,
  ).length;

  entries.push(
    makeLine(
      'ASSETS',
      'INFO',
      `Asset policies applied: ${result.metrics.assetsLocalized} downloaded locally, ${result.metrics.scriptsReplacedLocal} replaced with pressport-runtime.js, ${inlinedCount} inlined, ${result.metrics.scriptsStripped} stripped.`,
    ),
  );

  if (result.options.optimizeImagesToJpeg && result.metrics.imagesOptimizedCount > 0) {
    const savedKb = (result.metrics.imageBytesSaved / 1024).toFixed(1);
    entries.push(
      makeLine(
        'IMAGES',
        'INFO',
        `Image Optimizer converted/compressed ${result.metrics.imagesOptimizedCount} raster image(s) to progressive JPEG (quality=${result.options.imageJpegQuality}%, maxWidth=${result.options.imageMaxWidth > 0 ? `${result.options.imageMaxWidth}px` : 'original'}), saving ${savedKb} KB.`,
      ),
    );
  }

  if (placeholderCount > 0) {
    warningCount++;
    entries.push(
      makeLine(
        'ASSETS',
        'WARN',
        `${placeholderCount} external asset(s) could not be fetched directly and were bundled as offline local fallbacks or stubs.`,
      ),
    );
  }

  if (inlinedCount > 0) {
    entries.push(
      makeLine(
        'ASSETS',
        'INFO',
        `${inlinedCount} asset(s) configured as inline will be embedded directly in HTML output.`,
      ),
    );
  }

  // Include original migration warnings so WP debugging has complete context
  for (const warn of result.warnings) {
    warningCount++;
    entries.push(makeLine('MIGRATION', 'WARN', warn));
  }

  // Format-specific validation notes
  if (format === 'wxr') {
    const hasWxrVersion = result.wxrXml.includes('<wp:wxr_version>1.2</wp:wxr_version>');
    entries.push(
      makeLine(
        'WXR',
        hasWxrVersion ? 'INFO' : 'WARN',
        hasWxrVersion
          ? `Validated WordPress WXR 1.2 XML header, channel metadata, and CDATA-wrapped page items (${result.pages.length} pages).`
          : `WXR 1.2 version tag not detected; verify XML structure before running Tools -> Import -> WordPress.`,
      ),
    );
    if (!hasWxrVersion) warningCount++;
  } else if (format === 'theme') {
    entries.push(
      makeLine(
        'THEME',
        'INFO',
        `Packaged WordPress theme "${result.siteSlug}" with style.css, functions.php, PHP templates, local runtime assets, and accompanying WXR XML.`,
      ),
    );
  } else if (format === 'offline') {
    entries.push(
      makeLine(
        'OFFLINE',
        'INFO',
        `Packaged standalone offline site with index.html, local pressport-runtime.js, pressport-base.css, asset-manifest.json, and OFFLINE-README.txt.`,
      ),
    );
  } else if (format === 'source') {
    entries.push(
      makeLine(
        'SOURCE',
        'INFO',
        `Packaged untouched original site source (${result.pages.length} raw HTML page(s), unoptimized captured source assets, source-manifest.json, and SOURCE-README.txt).`,
      ),
    );
  } else if (format === 'updated') {
    entries.push(
      makeLine(
        'UPDATED',
        'INFO',
        `Packaged post-strip & Gutenberg bundle (${result.pages.length} cleaned HTML page(s), ${result.metrics.gutenbergBlocksGenerated} Gutenberg blocks in gutenberg/*.gutenberg.html, WXR 1.2 XML, localized/optimized assets, and migration-report.json).`,
      ),
    );
  } else {
    entries.push(
      makeLine(
        'ASSETS',
        'INFO',
        `Packaged local assets directory and asset-manifest.json for existing WordPress child themes.`,
      ),
    );
  }

  const previewPaths = packagedPaths.slice(0, 12).join(', ');
  const extraPathsCount = Math.max(0, packagedPaths.length - 12);
  entries.push(
    makeLine(
      'ARCHIVE',
      'INFO',
      `Built "${filename}" (${sizeBytes} bytes, ${fileCount} ${fileCount === 1 ? 'file' : 'files'}) in ${durationMs} ms. Included: ${previewPaths}${extraPathsCount > 0 ? ` (+${extraPathsCount} more)` : ''}.`,
      completedAtIso,
    ),
  );

  entries.push(
    makeLine(
      'DELIVERY',
      'INFO',
      `Export completed successfully with ${warningCount} warning(s). Ready for WordPress import or offline deployment.`,
      completedAtIso,
    ),
  );

  return pushExportLog({
    id: createLogId(),
    migrationId: result.id,
    siteName: result.siteName,
    siteSlug: result.siteSlug,
    platform: result.detectedPlatform,
    format,
    filename,
    status: 'success',
    timestamp: completedAtIso,
    durationMs,
    sizeBytes,
    fileCount,
    pagesCount: result.pages.length,
    blocksCount: result.metrics.gutenbergBlocksGenerated,
    assetsLocalized: result.metrics.assetsLocalized,
    scriptsStripped: result.metrics.scriptsStripped,
    scriptsReplacedLocal: result.metrics.scriptsReplacedLocal,
    warningsCount: warningCount,
    source: 'server',
    entries,
  });
}

export function recordServerBulkExportSuccess(params: {
  includedSites: Array<{
    id: string;
    siteName: string;
    siteSlug: string;
    platform: PlatformType;
    format: ExportFormat;
    folderName: string;
    fileCount: number;
    pagesCount: number;
    blocksCount: number;
    assetsLocalized: number;
    scriptsStripped: number;
    scriptsReplacedLocal: number;
  }>;
  skippedIds: string[];
  filename: string;
  sizeBytes: number;
  fileCount: number;
  packagedPaths: string[];
  durationMs: number;
  startedAtIso: string;
}): ExportLogEntry {
  const {
    includedSites,
    skippedIds,
    filename,
    sizeBytes,
    fileCount,
    packagedPaths,
    durationMs,
    startedAtIso,
  } = params;
  const completedAtIso = new Date().toISOString();
  const entries: ExportLogLine[] = [];

  const totalPages = includedSites.reduce((sum, s) => sum + s.pagesCount, 0);
  const totalBlocks = includedSites.reduce((sum, s) => sum + s.blocksCount, 0);
  const totalAssetsLocalized = includedSites.reduce((sum, s) => sum + s.assetsLocalized, 0);
  const totalScriptsStripped = includedSites.reduce((sum, s) => sum + s.scriptsStripped, 0);
  const totalScriptsReplaced = includedSites.reduce((sum, s) => sum + s.scriptsReplacedLocal, 0);

  entries.push(
    makeLine(
      'INIT',
      'INFO',
      `Bulk export requested for ${includedSites.length + skippedIds.length} queued migration(s).`,
      startedAtIso,
    ),
  );

  for (const site of includedSites) {
    entries.push(
      makeLine(
        'QUEUE',
        'INFO',
        `Concatenated "${site.siteName}" (${site.id}, ${site.platform.toUpperCase()}) as ${formatExportFormatLabel(site.format)} -> /${site.folderName}/ (${site.fileCount} files).`,
      ),
    );
  }

  for (const missingId of skippedIds) {
    entries.push(
      makeLine(
        'LOOKUP',
        'WARN',
        `Queued migration "${missingId}" was not found in server memory and was skipped from the bulk archive.`,
      ),
    );
  }

  const previewPaths = packagedPaths.slice(0, 12).join(', ');
  const extraPathsCount = Math.max(0, packagedPaths.length - 12);
  entries.push(
    makeLine(
      'ARCHIVE',
      'INFO',
      `Built concatenated ZIP "${filename}" (${sizeBytes} bytes, ${fileCount} files across ${includedSites.length} site(s)) in ${durationMs} ms. Included: ${previewPaths}${extraPathsCount > 0 ? ` (+${extraPathsCount} more)` : ''}.`,
      completedAtIso,
    ),
  );

  entries.push(
    makeLine(
      'DELIVERY',
      'INFO',
      `Bulk export completed with ${skippedIds.length} warning(s).`,
      completedAtIso,
    ),
  );

  const label =
    includedSites.length === 1
      ? `${includedSites[0].siteName} (Bulk)`
      : `Bulk Export (${includedSites.length} Sites: ${includedSites
          .slice(0, 2)
          .map((s) => s.siteName)
          .join(', ')}${includedSites.length > 2 ? ` +${includedSites.length - 2}` : ''})`;

  return pushExportLog({
    id: createLogId(),
    migrationId: includedSites.map((s) => s.id).join(','),
    siteName: label,
    siteSlug: `bulk-${includedSites.length}-sites`,
    platform: includedSites[0]?.platform || 'html',
    format: 'bulk',
    filename,
    status: 'success',
    timestamp: completedAtIso,
    durationMs,
    sizeBytes,
    fileCount,
    pagesCount: totalPages,
    blocksCount: totalBlocks,
    assetsLocalized: totalAssetsLocalized,
    scriptsStripped: totalScriptsStripped,
    scriptsReplacedLocal: totalScriptsReplaced,
    warningsCount: skippedIds.length,
    source: 'server',
    entries,
  });
}

export function recordServerExportFailure(params: {
  migrationId: string;
  result?: MigrationResult;
  format: ExportLogFormat;
  errorMessage: string;
  httpStatus: number;
  durationMs: number;
  startedAtIso: string;
}): ExportLogEntry {
  const { migrationId, result, format, errorMessage, httpStatus, durationMs, startedAtIso } = params;
  const failedAtIso = new Date().toISOString();
  const siteSlug = result?.siteSlug || (format === 'bulk' ? 'bulk-export' : 'unknown-site');
  const siteName =
    result?.siteName || (format === 'bulk' ? 'Bulk Export Queue' : `Migration ${migrationId}`);
  const platform: PlatformType = result?.detectedPlatform || 'html';

  const fallbackFilename =
    format === 'wxr'
      ? `${siteSlug}-wordpress-wxr.xml`
      : format === 'theme'
        ? `${siteSlug}-wp-theme.zip`
        : format === 'offline'
          ? `${siteSlug}-offline-local.zip`
          : format === 'source'
            ? `${siteSlug}-site-source.zip`
            : format === 'updated'
              ? `${siteSlug}-updated-gutenberg.zip`
              : format === 'bulk'
                ? 'pressport-bulk-export.zip'
                : `${siteSlug}-local-assets.zip`;

  const entries: ExportLogLine[] = [
    makeLine(
      'INIT',
      'INFO',
      `Export requested: ${formatExportFormatLabel(format)} for "${siteName}" (job ${migrationId}).`,
      startedAtIso,
    ),
  ];

  if (!result) {
    entries.push(
      makeLine(
        'LOOKUP',
        'ERROR',
        `Migration job "${migrationId}" was not found in server memory (HTTP ${httpStatus}).`,
        failedAtIso,
      ),
    );
    entries.push(
      makeLine(
        'HINT',
        'WARN',
        `In-memory migration sessions clear on server restart. Re-run the migration from "New Migration" or use Standalone Offline ZIP fallback.`,
        failedAtIso,
      ),
    );
  } else {
    entries.push(
      makeLine(
        'ARCHIVE',
        'ERROR',
        `Failed to package "${fallbackFilename}" after ${durationMs} ms (HTTP ${httpStatus}): ${errorMessage}`,
        failedAtIso,
      ),
    );
    for (const warn of result.warnings) {
      entries.push(makeLine('MIGRATION', 'WARN', warn, failedAtIso));
    }
    entries.push(
      makeLine(
        'HINT',
        'WARN',
        `Check Assets & Scripts for invalid asset policies or retry the export.`,
        failedAtIso,
      ),
    );
  }

  return pushExportLog({
    id: createLogId(),
    migrationId,
    siteName,
    siteSlug,
    platform,
    format,
    filename: fallbackFilename,
    status: 'failed',
    timestamp: failedAtIso,
    durationMs,
    sizeBytes: 0,
    fileCount: 0,
    pagesCount: result?.pages.length || 0,
    blocksCount: result?.metrics.gutenbergBlocksGenerated || 0,
    assetsLocalized: result?.metrics.assetsLocalized || 0,
    scriptsStripped: result?.metrics.scriptsStripped || 0,
    scriptsReplacedLocal: result?.metrics.scriptsReplacedLocal || 0,
    warningsCount: (result?.warnings.length || 0) + 1,
    errorMessage,
    source: 'server',
    entries,
  });
}
