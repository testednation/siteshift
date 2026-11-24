import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AssetAction,
  BulkExportRequestItem,
  ExportFormat,
  MigrationOptions,
  SampleId,
} from './src/types/migration.ts';
import {
  clearExportLogs,
  getExportLogById,
  listExportLogs,
  recordServerBulkExportSuccess,
  recordServerExportFailure,
  recordServerExportSuccess,
} from './src/server/exportLogs.ts';
import {
  buildBulkExportArchive,
  buildExportArtifact,
  getMigrationJob,
  runOfflineMigration,
  runSampleMigration,
  runUrlMigration,
  updateJobAssetPolicies,
  updateJobImageOptimization,
} from './src/server/migrationEngine.ts';
import { SAMPLE_FIXTURES } from './src/server/samples.ts';
import { buildExportLogFilename, formatExportLogText } from './src/utils/exportLogFormat.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_OPTIONS: MigrationOptions = {
  platformHint: 'auto',
  maxPages: 5,
  offlineOnly: false,
  stripTrackers: true,
  replacePlatformJs: true,
  localizeExternalJs: true,
  localizeStylesAndFonts: true,
  localizeImages: true,
  optimizeImagesToJpeg: false,
  imageJpegQuality: 82,
  imageMaxWidth: 1600,
  generateGutenbergBlocks: true,
};

function mergeOptions(raw: Partial<MigrationOptions> | undefined): MigrationOptions {
  const rawQuality = Number(raw?.imageJpegQuality);
  const rawMaxWidth = Number(raw?.imageMaxWidth);
  return {
    ...DEFAULT_OPTIONS,
    ...(raw || {}),
    maxPages: Math.max(1, Math.min(Number(raw?.maxPages) || DEFAULT_OPTIONS.maxPages, 10)),
    imageJpegQuality: Number.isFinite(rawQuality)
      ? Math.max(50, Math.min(95, Math.round(rawQuality)))
      : DEFAULT_OPTIONS.imageJpegQuality,
    imageMaxWidth: Number.isFinite(rawMaxWidth)
      ? rawMaxWidth <= 0
        ? 0
        : Math.max(400, Math.min(3840, Math.round(rawMaxWidth)))
      : DEFAULT_OPTIONS.imageMaxWidth,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '40mb' }));

  // List available built-in sample blueprints
  app.get('/api/samples', (_req, res) => {
    const items = Object.values(SAMPLE_FIXTURES).map((s) => ({
      id: s.id,
      label: s.label,
      platform: s.platform,
      siteName: s.siteName,
      sourceUrl: s.sourceUrl,
      description: s.description,
      pageCount: s.files.length,
    }));
    res.json({ samples: items });
  });

  // 1. Live URL migration
  app.post('/api/migrate/url', async (req, res) => {
    try {
      const { url, options } = req.body as { url?: string; options?: Partial<MigrationOptions> };
      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({
          error: 'Please provide a Wix, Squarespace, Strikingly, Webflow, or Weebly URL to migrate.',
        });
        return;
      }
      const result = await runUrlMigration(url.trim(), mergeOptions(options));
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to migrate live URL.';
      res.status(400).json({ error: message });
    }
  });

  // 2. Offline file upload (.html / .zip) or pasted HTML migration
  app.post('/api/migrate/offline', async (req, res) => {
    try {
      const { files, pastedHtml, options } = req.body as {
        files?: Array<{ name: string; contentBase64: string; mimeType?: string }>;
        pastedHtml?: string;
        options?: Partial<MigrationOptions>;
      };
      const result = await runOfflineMigration(files || [], pastedHtml, mergeOptions(options));
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process offline site files.';
      res.status(400).json({ error: message });
    }
  });

  // 3. Built-in authentic platform sample migration
  app.post('/api/migrate/sample', async (req, res) => {
    try {
      const { sampleId, options } = req.body as {
        sampleId?: SampleId;
        options?: Partial<MigrationOptions>;
      };
      if (!sampleId || !(sampleId in SAMPLE_FIXTURES)) {
        res.status(400).json({ error: 'Invalid sample fixture selected.' });
        return;
      }
      const result = await runSampleMigration(sampleId, mergeOptions(options));
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run sample migration.';
      res.status(400).json({ error: message });
    }
  });

  // 4. Update individual asset policies (Strip / Replace Local / Localize) and recompile live
  app.post('/api/migrate/:id/policies', (req, res) => {
    try {
      const { overrides } = req.body as { overrides?: Record<string, AssetAction> };
      if (!overrides || typeof overrides !== 'object') {
        res.status(400).json({ error: 'Missing asset policy overrides.' });
        return;
      }
      const updated = updateJobAssetPolicies(req.params.id, overrides);
      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update asset policies.';
      res.status(404).json({ error: message });
    }
  });

  // 4b. Toggle or reconfigure Image Optimizer (compress/convert WebP & heavy PNGs to progressive JPEGs)
  app.post('/api/migrate/:id/image-optimizer', async (req, res) => {
    try {
      const { optimizeImagesToJpeg, imageJpegQuality, imageMaxWidth } = req.body as {
        optimizeImagesToJpeg?: boolean;
        imageJpegQuality?: number;
        imageMaxWidth?: number;
      };
      if (typeof optimizeImagesToJpeg !== 'boolean') {
        res.status(400).json({ error: 'Missing optimizeImagesToJpeg boolean flag.' });
        return;
      }
      const updated = await updateJobImageOptimization(req.params.id, {
        optimizeImagesToJpeg,
        imageJpegQuality,
        imageMaxWidth,
      });
      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to optimize migration images.';
      res.status(404).json({ error: message });
    }
  });

  // 5. Download real WordPress Theme ZIP, WXR XML, Offline Static ZIP, or Local Assets ZIP
  app.get('/api/migrate/:id/download/:format', async (req, res) => {
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const rawFormat = req.params.format;
    const validFormats: ExportFormat[] = ['wxr', 'theme', 'offline', 'assets', 'source', 'updated'];
    const isKnownFormat = validFormats.includes(rawFormat as ExportFormat);
    const format = (isKnownFormat ? rawFormat : 'theme') as ExportFormat;
    const job = getMigrationJob(req.params.id);

    try {
      if (!isKnownFormat) {
        const message = `Unsupported export format: "${rawFormat}".`;
        const logEntry = recordServerExportFailure({
          migrationId: req.params.id,
          result: job?.result,
          format,
          errorMessage: message,
          httpStatus: 400,
          durationMs: Math.max(1, Date.now() - startedAtMs),
          startedAtIso,
        });
        res.setHeader('X-PressPort-Log-Id', logEntry.id);
        res.status(400).json({ error: message, logId: logEntry.id });
        return;
      }

      if (!job) {
        const message = 'Migration session expired or not found.';
        const logEntry = recordServerExportFailure({
          migrationId: req.params.id,
          format,
          errorMessage: message,
          httpStatus: 404,
          durationMs: Math.max(1, Date.now() - startedAtMs),
          startedAtIso,
        });
        res.setHeader('X-PressPort-Log-Id', logEntry.id);
        res.status(404).json({ error: message, logId: logEntry.id });
        return;
      }

      const artifact = await buildExportArtifact(req.params.id, format);
      const durationMs = Math.max(1, Date.now() - startedAtMs);
      const logEntry = recordServerExportSuccess({
        result: job.result,
        format,
        filename: artifact.filename,
        sizeBytes: artifact.buffer.byteLength,
        fileCount: artifact.fileCount,
        packagedPaths: artifact.packagedPaths,
        durationMs,
        startedAtIso,
      });

      res.setHeader('Content-Type', artifact.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
      res.setHeader('Content-Length', String(artifact.buffer.byteLength));
      res.setHeader('X-PressPort-Log-Id', logEntry.id);
      res.send(artifact.buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate export archive.';
      const logEntry = recordServerExportFailure({
        migrationId: req.params.id,
        result: job?.result,
        format,
        errorMessage: message,
        httpStatus: 500,
        durationMs: Math.max(1, Date.now() - startedAtMs),
        startedAtIso,
      });
      res.setHeader('X-PressPort-Log-Id', logEntry.id);
      res.status(500).json({ error: message, logId: logEntry.id });
    }
  });

  // 5b. Bulk export: concatenate multiple migrations into a single unified ZIP
  app.post('/api/migrate/bulk-download', async (req, res) => {
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const validFormats: ExportFormat[] = ['wxr', 'theme', 'offline', 'assets', 'source', 'updated'];
    const rawItems = (req.body as { items?: unknown })?.items;

    try {
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        const message = 'Select at least one migration to include in the bulk export ZIP.';
        const logEntry = recordServerExportFailure({
          migrationId: 'bulk-empty',
          format: 'bulk',
          errorMessage: message,
          httpStatus: 400,
          durationMs: Math.max(1, Date.now() - startedAtMs),
          startedAtIso,
        });
        res.setHeader('X-PressPort-Log-Id', logEntry.id);
        res.status(400).json({ error: message, logId: logEntry.id });
        return;
      }

      const sanitizedItems: BulkExportRequestItem[] = [];
      for (const entry of rawItems.slice(0, 20)) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as { id?: unknown; format?: unknown };
        if (typeof candidate.id !== 'string' || !candidate.id.trim()) continue;
        const format = validFormats.includes(candidate.format as ExportFormat)
          ? (candidate.format as ExportFormat)
          : 'theme';
        sanitizedItems.push({ id: candidate.id.trim(), format });
      }

      if (sanitizedItems.length === 0) {
        const message = 'No valid migration items were provided for bulk export.';
        const logEntry = recordServerExportFailure({
          migrationId: 'bulk-invalid',
          format: 'bulk',
          errorMessage: message,
          httpStatus: 400,
          durationMs: Math.max(1, Date.now() - startedAtMs),
          startedAtIso,
        });
        res.setHeader('X-PressPort-Log-Id', logEntry.id);
        res.status(400).json({ error: message, logId: logEntry.id });
        return;
      }

      const archive = await buildBulkExportArchive(sanitizedItems);
      const durationMs = Math.max(1, Date.now() - startedAtMs);
      const logEntry = recordServerBulkExportSuccess({
        includedSites: archive.includedSites,
        skippedIds: archive.skippedIds,
        filename: archive.filename,
        sizeBytes: archive.buffer.byteLength,
        fileCount: archive.fileCount,
        packagedPaths: archive.packagedPaths,
        durationMs,
        startedAtIso,
      });

      res.setHeader('Content-Type', archive.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${archive.filename}"`);
      res.setHeader('Content-Length', String(archive.buffer.byteLength));
      res.setHeader('X-PressPort-Log-Id', logEntry.id);
      res.send(archive.buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to build bulk export archive.';
      const logEntry = recordServerExportFailure({
        migrationId: Array.isArray(rawItems)
          ? rawItems
              .map((i) => (i && typeof i === 'object' ? String((i as { id?: unknown }).id || '') : ''))
              .filter(Boolean)
              .join(',') || 'bulk'
          : 'bulk',
        format: 'bulk',
        errorMessage: message,
        httpStatus: 404,
        durationMs: Math.max(1, Date.now() - startedAtMs),
        startedAtIso,
      });
      res.setHeader('X-PressPort-Log-Id', logEntry.id);
      res.status(404).json({ error: message, logId: logEntry.id });
    }
  });

  // 6. Export Logs history & downloadable diagnostic log files
  app.get('/api/export-logs', (_req, res) => {
    res.json({ logs: listExportLogs() });
  });

  app.get('/api/export-logs/:logId/download', (req, res) => {
    const entry = getExportLogById(req.params.logId);
    if (!entry) {
      res.status(404).json({ error: 'Export log entry not found.' });
      return;
    }

    const asJson = req.query.format === 'json';
    if (asJson) {
      const payload = JSON.stringify(entry, null, 2);
      const filename = buildExportLogFilename(entry, 'json');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(payload);
      return;
    }

    const text = formatExportLogText(entry);
    const filename = buildExportLogFilename(entry, 'log');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(text);
  });

  app.delete('/api/export-logs', (_req, res) => {
    clearExportLogs();
    res.json({ cleared: true });
  });

  // Vite dev middleware vs. production static build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Vite 8 still injects /@vite/client even when hmr/ws are false, which attempts
    // a WebSocket connection to port 24678 and throws an unhandled rejection behind
    // single-port proxies. Serve a minimal ESM shim that preserves CSS injection
    // and import.meta.hot APIs without opening a WebSocket.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export class ErrorOverlay extends (typeof HTMLElement !== "undefined" ? HTMLElement : Object) {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PressPort migration server listening on http://localhost:${PORT}`);
  });
}

startServer();
