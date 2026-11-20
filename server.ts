import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssetAction, ExportFormat, MigrationOptions, SampleId } from './src/types/migration.ts';
import {
  clearExportLogs,
  getExportLogById,
  listExportLogs,
  recordServerExportFailure,
  recordServerExportSuccess,
} from './src/server/exportLogs.ts';
import {
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
    const validFormats: ExportFormat[] = ['wxr', 'theme', 'offline', 'assets'];
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
      server: { middlewareMode: true },
      appType: 'spa',
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
