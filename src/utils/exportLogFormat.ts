import type { ExportLogEntry, ExportLogFormat } from '../types/migration.ts';

export function formatExportFormatLabel(format: ExportLogFormat): string {
  switch (format) {
    case 'theme':
      return 'WordPress Theme (.zip)';
    case 'wxr':
      return 'WordPress WXR 1.2 (.xml)';
    case 'offline':
      return 'Standalone Offline (.zip)';
    case 'assets':
      return 'Local Assets (.zip)';
    case 'source':
      return 'Original Site Source (.zip)';
    case 'updated':
      return 'Updated Site & Gutenberg (.zip)';
    case 'bulk':
      return 'Bulk Concatenated Export (.zip)';
    default:
      return format;
  }
}

export function formatExportFormatShort(format: ExportLogFormat): string {
  switch (format) {
    case 'theme':
      return 'WP Theme';
    case 'wxr':
      return 'WXR XML';
    case 'offline':
      return 'Offline ZIP';
    case 'assets':
      return 'Assets ZIP';
    case 'source':
      return 'Source ZIP';
    case 'updated':
      return 'Updated ZIP';
    case 'bulk':
      return 'Bulk ZIP';
    default:
      return format;
  }
}

function formatByteSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function buildExportLogFilename(entry: ExportLogEntry, ext: 'log' | 'json' = 'log'): string {
  const safeSlug = (entry.siteSlug || 'migration').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const shortId = entry.id.replace(/[^a-z0-9-]+/gi, '').slice(-8);
  return `pressport-export-${safeSlug}-${entry.format}-${shortId}.${ext}`;
}

export function formatExportLogText(entry: ExportLogEntry): string {
  const divider = '='.repeat(76);
  const subDivider = '-'.repeat(76);
  const lines: string[] = [
    divider,
    `PRESSPORT WORDPRESS MIGRATION EXPORT LOG`,
    divider,
    `Log ID:           ${entry.id}`,
    `Timestamp (UTC):  ${entry.timestamp}`,
    `Status:           ${entry.status.toUpperCase()}`,
    `Export Format:    ${formatExportFormatLabel(entry.format)}`,
    `Artifact File:    ${entry.filename}`,
    `Delivery Engine:  ${entry.source === 'server' ? 'Server Export Pipeline' : 'Browser Offline ZIP Fallback'}`,
    subDivider,
    `MIGRATION CONTEXT`,
    `Migration ID:     ${entry.migrationId}`,
    `Site Name:        ${entry.siteName} (${entry.siteSlug})`,
    `Source Platform:  ${entry.platform.toUpperCase()}`,
    `Pages / Blocks:   ${entry.pagesCount} pages · ${entry.blocksCount} Gutenberg blocks`,
    `Asset Summary:    ${entry.assetsLocalized} localized · ${entry.scriptsReplacedLocal} replaced local · ${entry.scriptsStripped} stripped`,
    `Archive Output:   ${formatByteSize(entry.sizeBytes)} (${entry.sizeBytes} bytes) · ${entry.fileCount} ${entry.fileCount === 1 ? 'file' : 'files'}`,
    `Duration:         ${entry.durationMs} ms`,
    `Warnings:         ${entry.warningsCount}`,
  ];

  if (entry.errorMessage) {
    lines.push(`Error Summary:    ${entry.errorMessage}`);
  }

  lines.push(subDivider);
  lines.push('EXECUTION TRACE');
  lines.push(subDivider);

  for (const item of entry.entries) {
    const levelPad = item.level.padEnd(5, ' ');
    const stagePad = item.stage.padEnd(10, ' ');
    lines.push(`${item.timestamp}  [${levelPad}]  [${stagePad}]  ${item.message}`);
  }

  lines.push(divider);
  lines.push('END OF LOG');
  return `${lines.join('\n')}\n`;
}
