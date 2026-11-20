import { useCallback, useEffect, useState } from 'react';
import { Download, FolderArchive, Loader2, Menu, Plus } from 'lucide-react';
import { AssetsScriptsView } from './components/AssetsScriptsView';
import { ExportDeployView } from './components/ExportDeployView';
import { ExportLogsView } from './components/ExportLogsView';
import { MigrationSetupView } from './components/MigrationSetupView';
import { PagesBlocksView } from './components/PagesBlocksView';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { WordPressOutputView } from './components/WordPressOutputView';
import type {
  AssetAction,
  ExportFormat,
  ExportLogEntry,
  MigrationOptions,
  MigrationResult,
  SampleId,
} from './types/migration';
import {
  buildExportLogFilename,
  formatExportFormatLabel,
  formatExportLogText,
} from './utils/exportLogFormat';
import { buildClientOfflineZip } from './utils/offlineZipFallback';

export type { ExportFormat };

const EXPORT_LOGS_STORAGE_KEY = 'pressport_export_logs_v1';
const MAX_CACHED_LOGS = 100;

const TAB_LABELS: Record<WorkspaceTab, string> = {
  setup: 'New Migration',
  pages: 'Pages & Blocks',
  assets: 'Assets & Scripts',
  wordpress: 'WordPress Output',
  export: 'Export & Deploy',
  logs: 'Export Logs',
};

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

function loadCachedExportLogs(): ExportLogEntry[] {
  try {
    const raw = window.localStorage.getItem(EXPORT_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ExportLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveCachedExportLogs(logs: ExportLogEntry[]) {
  try {
    window.localStorage.setItem(
      EXPORT_LOGS_STORAGE_KEY,
      JSON.stringify(logs.slice(0, MAX_CACHED_LOGS)),
    );
  } catch {
    // Ignore storage quota errors
  }
}

function mergeExportLogs(serverLogs: ExportLogEntry[], localLogs: ExportLogEntry[]): ExportLogEntry[] {
  const byId = new Map<string, ExportLogEntry>();
  for (const entry of serverLogs) {
    byId.set(entry.id, entry);
  }
  for (const entry of localLogs) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_CACHED_LOGS);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('setup');
  const [history, setHistory] = useState<MigrationResult[]>([]);
  const [activeMigrationId, setActiveMigrationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingPolicies, setUpdatingPolicies] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<ExportFormat | null>(null);
  const [exportLogs, setExportLogs] = useState<ExportLogEntry[]>(() => loadCachedExportLogs());
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeMigration =
    history.find((item) => item.id === activeMigrationId) || null;

  const failedExportsCount = exportLogs.filter((entry) => entry.status === 'failed').length;

  const refreshExportLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/export-logs');
      if (!res.ok) return;
      const data = (await res.json()) as { logs?: ExportLogEntry[] };
      if (Array.isArray(data.logs)) {
        setExportLogs((prev) => {
          const merged = mergeExportLogs(data.logs!, prev);
          saveCachedExportLogs(merged);
          return merged;
        });
      }
    } catch {
      // Keep local cached logs when offline
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void refreshExportLogs();
  }, [refreshExportLogs]);

  const appendClientExportLog = useCallback((entry: ExportLogEntry) => {
    setExportLogs((prev) => {
      const next = mergeExportLogs([entry], prev);
      saveCachedExportLogs(next);
      return next;
    });
  }, []);

  const commitMigrationResult = (result: MigrationResult) => {
    setHistory((prev) => [result, ...prev.filter((item) => item.id !== result.id)].slice(0, 10));
    setActiveMigrationId(result.id);
    setActiveTab('pages');
    setError(null);
  };

  const handleRunUrl = async (url: string, options: MigrationOptions) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/migrate/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to migrate live site URL.');
      }
      commitMigrationResult(data as MigrationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected migration error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunOffline = async (
    files: Array<{ name: string; contentBase64: string; mimeType?: string }>,
    pastedHtml: string | undefined,
    options: MigrationOptions,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/migrate/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, pastedHtml, options }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process offline files.');
      }
      commitMigrationResult(data as MigrationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected offline processing error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunSample = async (
    sampleId: SampleId,
    options: MigrationOptions,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/migrate/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId, options }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load sample migration.');
      }
      commitMigrationResult(data as MigrationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected sample migration error.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePolicies = async (overrides: Record<string, AssetAction>) => {
    if (!activeMigration) return;
    setUpdatingPolicies(true);
    try {
      const res = await fetch(`/api/migrate/${activeMigration.id}/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update asset policies.');
      }
      const updated = data as MigrationResult;
      setHistory((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update asset policy.');
    } finally {
      setUpdatingPolicies(false);
    }
  };

  const handleUpdateImageOptimization = async (config: {
    optimizeImagesToJpeg: boolean;
    imageJpegQuality?: number;
    imageMaxWidth?: number;
  }) => {
    if (!activeMigration) return;
    setUpdatingPolicies(true);
    try {
      const res = await fetch(`/api/migrate/${activeMigration.id}/image-optimizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to optimize migration images.');
      }
      const updated = data as MigrationResult;
      setHistory((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not optimize images.');
    } finally {
      setUpdatingPolicies(false);
    }
  };

  const handleDownload = async (format: ExportFormat) => {
    if (!activeMigration || downloadingFormat) return;
    setDownloadingFormat(format);
    setError(null);

    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const fallbackFilenames: Record<ExportFormat, string> = {
      wxr: `${activeMigration.siteSlug}-wordpress-wxr.xml`,
      theme: `${activeMigration.siteSlug}-wp-theme.zip`,
      offline: `${activeMigration.siteSlug}-offline-local.zip`,
      assets: `${activeMigration.siteSlug}-local-assets.zip`,
    };

    const runClientOfflineFallback = async (reason: string) => {
      const fallbackBlob = await buildClientOfflineZip(activeMigration);
      triggerBlobDownload(fallbackBlob, fallbackFilenames.offline);
      const completedAtIso = new Date().toISOString();
      const durationMs = Math.max(1, Date.now() - startedAtMs);
      appendClientExportLog({
        id: `exp-local-${Date.now().toString(16)}`,
        migrationId: activeMigration.id,
        siteName: activeMigration.siteName,
        siteSlug: activeMigration.siteSlug,
        platform: activeMigration.detectedPlatform,
        format: 'offline',
        filename: fallbackFilenames.offline,
        status: 'success',
        timestamp: completedAtIso,
        durationMs,
        sizeBytes: fallbackBlob.size,
        fileCount: activeMigration.pages.length + 4,
        pagesCount: activeMigration.pages.length,
        blocksCount: activeMigration.metrics.gutenbergBlocksGenerated,
        assetsLocalized: activeMigration.metrics.assetsLocalized,
        scriptsStripped: activeMigration.metrics.scriptsStripped,
        scriptsReplacedLocal: activeMigration.metrics.scriptsReplacedLocal,
        warningsCount: activeMigration.warnings.length + 1,
        source: 'client-fallback',
        entries: [
          {
            timestamp: startedAtIso,
            level: 'INFO',
            stage: 'INIT',
            message: `Export requested: ${formatExportFormatLabel('offline')} for "${activeMigration.siteName}" (job ${activeMigration.id}).`,
          },
          {
            timestamp: completedAtIso,
            level: 'WARN',
            stage: 'FALLBACK',
            message: `Server export unavailable (${reason}); generated Standalone Offline ZIP in browser fallback engine.`,
          },
          {
            timestamp: completedAtIso,
            level: 'INFO',
            stage: 'ARCHIVE',
            message: `Built "${fallbackFilenames.offline}" (${fallbackBlob.size} bytes) in ${durationMs} ms.`,
          },
          ...activeMigration.warnings.map((w) => ({
            timestamp: completedAtIso,
            level: 'WARN' as const,
            stage: 'MIGRATION',
            message: w,
          })),
          {
            timestamp: completedAtIso,
            level: 'INFO',
            stage: 'DELIVERY',
            message: `Offline ZIP download triggered successfully via browser fallback.`,
          },
        ],
      });
    };

    let serverLogged = false;

    try {
      const res = await fetch(`/api/migrate/${activeMigration.id}/download/${format}`);
      serverLogged = Boolean(res.headers.get('X-PressPort-Log-Id'));

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        const reason = errPayload.error || `HTTP ${res.status} error`;
        if (format === 'offline') {
          await runClientOfflineFallback(reason);
          return;
        }
        throw new Error(reason);
      }
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || fallbackFilenames[format];
      const blob = await res.blob();
      triggerBlobDownload(blob, filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed.';
      if (format === 'offline') {
        await runClientOfflineFallback(message);
      } else {
        setError(message);
        if (!serverLogged) {
          const failedAtIso = new Date().toISOString();
          appendClientExportLog({
            id: `exp-err-${Date.now().toString(16)}`,
            migrationId: activeMigration.id,
            siteName: activeMigration.siteName,
            siteSlug: activeMigration.siteSlug,
            platform: activeMigration.detectedPlatform,
            format,
            filename: fallbackFilenames[format],
            status: 'failed',
            timestamp: failedAtIso,
            durationMs: Math.max(1, Date.now() - startedAtMs),
            sizeBytes: 0,
            fileCount: 0,
            pagesCount: activeMigration.pages.length,
            blocksCount: activeMigration.metrics.gutenbergBlocksGenerated,
            assetsLocalized: activeMigration.metrics.assetsLocalized,
            scriptsStripped: activeMigration.metrics.scriptsStripped,
            scriptsReplacedLocal: activeMigration.metrics.scriptsReplacedLocal,
            warningsCount: activeMigration.warnings.length + 1,
            errorMessage: message,
            source: 'client-fallback',
            entries: [
              {
                timestamp: startedAtIso,
                level: 'INFO',
                stage: 'INIT',
                message: `Export requested: ${formatExportFormatLabel(format)} for "${activeMigration.siteName}" (job ${activeMigration.id}).`,
              },
              {
                timestamp: failedAtIso,
                level: 'ERROR',
                stage: 'NETWORK',
                message: `Export failed before server completion: ${message}`,
              },
              {
                timestamp: failedAtIso,
                level: 'WARN',
                stage: 'HINT',
                message: `Check server connectivity or re-run the migration and retry the export.`,
              },
            ],
          });
        }
      }
    } finally {
      setDownloadingFormat(null);
      void refreshExportLogs();
    }
  };

  const handleDownloadLog = async (entry: ExportLogEntry, ext: 'log' | 'json') => {
    const filename = buildExportLogFilename(entry, ext);

    if (entry.source === 'server') {
      try {
        const res = await fetch(
          `/api/export-logs/${encodeURIComponent(entry.id)}/download${ext === 'json' ? '?format=json' : ''}`,
        );
        if (res.ok) {
          const blob = await res.blob();
          triggerBlobDownload(blob, filename);
          return;
        }
      } catch {
        // Fall through to client-side formatting from cached entry
      }
    }

    const content = ext === 'json' ? JSON.stringify(entry, null, 2) : formatExportLogText(entry);
    const mimeType = ext === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
    triggerBlobDownload(new Blob([content], { type: mimeType }), filename);
  };

  const handleDownloadAllLogsJson = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const content = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalEntries: exportLogs.length,
        logs: exportLogs,
      },
      null,
      2,
    );
    triggerBlobDownload(
      new Blob([content], { type: 'application/json; charset=utf-8' }),
      `pressport-export-logs-${stamp}.json`,
    );
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/export-logs', { method: 'DELETE' });
    } catch {
      // Clear local logs even if server is unreachable
    }
    setExportLogs([]);
    saveCachedExportLogs([]);
  };

  const handleSelectMigration = (id: string) => {
    setActiveMigrationId(id);
    if (activeTab === 'setup') {
      setActiveTab('pages');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeMigration={activeMigration}
        history={history}
        exportLogsCount={exportLogs.length}
        failedExportsCount={failedExportsCount}
        onSelectMigration={handleSelectMigration}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Contextual Workspace Top Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-6 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
              <span className="font-medium text-slate-500 whitespace-nowrap">PressPort</span>
              {activeMigration && activeTab !== 'setup' && activeTab !== 'logs' && (
                <>
                  <span className="text-slate-300" aria-hidden="true">/</span>
                  <span className="truncate font-medium text-slate-700">{activeMigration.siteName}</span>
                </>
              )}
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-950 whitespace-nowrap">
                {TAB_LABELS[activeTab]}
              </span>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {activeMigration && (
              <button
                type="button"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownload('offline')}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {downloadingFormat === 'offline' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FolderArchive className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Download Offline ZIP
              </button>
            )}

            {activeMigration && activeTab !== 'export' ? (
              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                All Exports
              </button>
            ) : activeTab !== 'setup' ? (
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New Migration
              </button>
            ) : null}
          </div>
        </header>

        {/* Scrollable Main Workspace Viewport */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          {activeTab === 'setup' && (
            <MigrationSetupView
              loading={loading}
              error={error}
              onRunUrl={handleRunUrl}
              onRunOffline={handleRunOffline}
              onRunSample={handleRunSample}
            />
          )}

          {activeTab === 'pages' && activeMigration && (
            <PagesBlocksView
              migration={activeMigration}
              downloadingFormat={downloadingFormat}
              onDownload={handleDownload}
            />
          )}

          {activeTab === 'assets' && activeMigration && (
            <AssetsScriptsView
              migration={activeMigration}
              updatingPolicies={updatingPolicies}
              onUpdatePolicies={handleUpdatePolicies}
              onUpdateImageOptimization={handleUpdateImageOptimization}
            />
          )}

          {activeTab === 'wordpress' && activeMigration && (
            <WordPressOutputView
              migration={activeMigration}
              downloadingFormat={downloadingFormat}
              onDownload={handleDownload}
            />
          )}

          {activeTab === 'export' && activeMigration && (
            <ExportDeployView
              migration={activeMigration}
              downloadingFormat={downloadingFormat}
              exportLogsCount={exportLogs.length}
              onDownload={handleDownload}
              onOpenLogs={() => setActiveTab('logs')}
            />
          )}

          {activeTab === 'logs' && (
            <ExportLogsView
              logs={exportLogs}
              loading={loadingLogs}
              activeMigration={activeMigration}
              downloadingFormat={downloadingFormat}
              onRefreshLogs={refreshExportLogs}
              onClearLogs={handleClearLogs}
              onDownloadLog={handleDownloadLog}
              onDownloadAllLogsJson={handleDownloadAllLogsJson}
              onGoToExport={() => setActiveTab('export')}
              onGoToSetup={() => setActiveTab('setup')}
              onQuickExport={handleDownload}
            />
          )}
        </main>
      </div>
    </div>
  );
}

