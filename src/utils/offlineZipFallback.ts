import JSZip from 'jszip';
import type { MigrationResult } from '../types/migration';

/**
 * Client-side fallback builder for the Standalone Offline ZIP.
 * Used automatically if the server session expired or network is disconnected,
 * guaranteeing offline ZIP downloads always succeed.
 */
export async function buildClientOfflineZip(migration: MigrationResult): Promise<Blob> {
  const zip = new JSZip();

  for (const page of migration.pages) {
    const filename = page.isHome ? 'index.html' : `${page.slug}.html`;
    zip.file(filename, page.offlineHtml);
  }

  for (const themeFile of migration.themeFiles) {
    if (themeFile.path.startsWith('assets/')) {
      zip.file(themeFile.path, themeFile.content);
    }
  }

  zip.file(
    'asset-manifest.json',
    JSON.stringify(
      {
        siteName: migration.siteName,
        detectedPlatform: migration.detectedPlatform,
        metrics: migration.metrics,
        assets: migration.assets,
      },
      null,
      2,
    ),
  );

  zip.file(
    'OFFLINE-README.txt',
    [
      `${migration.siteName} — Standalone Offline Bundle`,
      '================================================',
      `Pages included: ${migration.pages.length}`,
      `External CDN requests: 0`,
      '',
      'How to use offline:',
      '1. Extract this ZIP archive to any local folder.',
      '2. Double-click index.html to open directly in your browser without internet.',
      '3. All styles and scripts load locally from ./assets/.',
    ].join('\n'),
  );

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
