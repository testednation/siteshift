import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  FileText,
  FolderArchive,
  RefreshCw,
  ScrollText,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ExportFormat,
  ExportLogEntry,
  MigrationResult,
  PlatformType,
} from '../types/migration';
import {
  buildExportLogFilename,
  formatExportFormatLabel,
  formatExportFormatShort,
  formatExportLogText,
} from '../utils/exportLogFormat';
import { formatBytes, formatPlatformLabel } from '../utils/format';
import { InfoTooltip } from './InfoTooltip';

interface ExportLogsViewProps {
  logs: ExportLogEntry[];
  loading: boolean;
  activeMigration: MigrationResult | null;
  downloadingFormat: ExportFormat | null;
  onRefreshLogs: () => void;
  onClearLogs: () => void;
  onDownloadLog: (entry: ExportLogEntry, ext: 'log' | 'json') => void;
  onDownloadAllLogsJson: () => void;
  onGoToExport: () => void;
  onGoToSetup: () => void;
  onQuickExport: (format: ExportFormat) => void;
}

const PLATFORM_OPTIONS: Array<{ id: 'all' | PlatformType; label: string }> = [
  { id: 'all', label: 'All Platforms' },
  { id: 'wix', label: 'Wix' },
  { id: 'squarespace', label: 'Squarespace' },
  { id: 'strikingly', label: 'Strikingly' },
  { id: 'webflow', label: 'Webflow' },
  { id: 'weebly', label: 'Weebly' },
  { id: 'html', label: 'Static HTML' },
];

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatShortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function ExportLogsView({
  logs,
  loading,
  activeMigration,
  downloadingFormat,
  onRefreshLogs,
  onClearLogs,
  onDownloadLog,
  onDownloadAllLogsJson,
  onGoToExport,
  onGoToSetup,
  onQuickExport,
}: ExportLogsViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | ExportFormat>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs[0]?.id || null);
  const [traceFilter, setTraceFilter] = useState<'all' | 'issues'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Support pressing "/" to focus the global search bar from anywhere in the view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInputFocused) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    for (const entry of logs) {
      counts[entry.platform] = (counts[entry.platform] || 0) + 1;
    }
    return counts;
  }, [logs]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    platformFilter !== 'all' ||
    statusFilter !== 'all' ||
    formatFilter !== 'all';

  const resetAllFilters = () => {
    setSearchQuery('');
    setPlatformFilter('all');
    setStatusFilter('all');
    setFormatFilter('all');
  };

  const filteredLogs = useMemo(() => {
    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return logs.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (formatFilter !== 'all' && entry.format !== formatFilter) return false;
      if (platformFilter !== 'all' && entry.platform !== platformFilter) return false;
      if (tokens.length === 0) return true;

      const searchableHaystack = [
        entry.siteName,
        entry.siteSlug,
        entry.platform,
        formatPlatformLabel(entry.platform),
        entry.filename,
        entry.id,
        formatExportFormatLabel(entry.format),
        formatExportFormatShort(entry.format),
        entry.errorMessage || '',
      ]
        .join(' ')
        .toLowerCase();

      return tokens.every((token) => searchableHaystack.includes(token));
    });
  }, [logs, statusFilter, formatFilter, platformFilter, searchQuery]);

  useEffect(() => {
    if (filteredLogs.length === 0) {
      setSelectedLogId(null);
      return;
    }
    if (!selectedLogId || !filteredLogs.some((item) => item.id === selectedLogId)) {
      setSelectedLogId(filteredLogs[0].id);
    }
  }, [filteredLogs, selectedLogId]);

  const selectedLog = useMemo(
    () => filteredLogs.find((item) => item.id === selectedLogId) || null,
    [filteredLogs, selectedLogId],
  );

  const summary = useMemo(() => {
    let succeeded = 0;
    let failed = 0;
    let totalBytes = 0;
    let totalWarnings = 0;
    for (const entry of logs) {
      if (entry.status === 'success') succeeded++;
      else failed++;
      totalBytes += entry.sizeBytes;
      totalWarnings += entry.warningsCount;
    }
    return { total: logs.length, succeeded, failed, totalBytes, totalWarnings };
  }, [logs]);

  const visibleTraceLines = useMemo(() => {
    if (!selectedLog) return [];
    if (traceFilter === 'all') return selectedLog.entries;
    return selectedLog.entries.filter((line) => line.level === 'WARN' || line.level === 'ERROR');
  }, [selectedLog, traceFilter]);

  const handleCopyLog = async (entry: ExportLogEntry) => {
    try {
      await navigator.clipboard.writeText(formatExportLogText(entry));
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId((prev) => (prev === entry.id ? null : prev)), 2000);
    } catch {
      // Clipboard blocked in sandboxed iframe; fallback to file download
      onDownloadLog(entry, 'log');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-slate-950">Export Logs</h1>
            <InfoTooltip
              title="How Export Logs Help Beginners"
              content="Every time you download a Theme, WXR XML, or Offline ZIP, PressPort records a step-by-step trace here. If an image was skipped or a WordPress import shows a warning, download the .log file to see exactly why."
              tip="Press / anywhere on this page to quickly search logs by site name or platform."
            />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Audit trail of WordPress Theme, WXR 1.2 XML, Offline ZIP, and asset export operations with downloadable
            diagnostic logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefreshLogs}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>

          {logs.length > 0 && (
            <>
              <button
                type="button"
                onClick={onDownloadAllLogsJson}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                Download All (.json)
              </button>

              {confirmClear ? (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs">
                  <span className="font-medium text-red-800">Clear all logs?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearLogs();
                      setConfirmClear(false);
                    }}
                    className="rounded bg-red-700 px-2 py-0.5 font-semibold text-white hover:bg-red-800 whitespace-nowrap"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-1.5 py-0.5 font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-300 hover:text-red-700 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear History
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Global Search Bar for Migration History (Site Name & Platform) */}
      <section
        aria-label="Search export history"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="text"
              role="searchbox"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  e.preventDefault();
                  setSearchQuery('');
                }
              }}
              placeholder="Search export history by site name or platform (e.g., Wix, Squarespace, Strikingly, Webflow)..."
              aria-label="Global search export logs by site name or platform"
              className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-20 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : (
                <kbd
                  className="hidden select-none rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-400 sm:inline-block"
                  title="Press / to search"
                >
                  /
                </kbd>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
            <span className="font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
              {hasActiveFilters
                ? `${filteredLogs.length} of ${logs.length} matching`
                : `${logs.length} ${logs.length === 1 ? 'record' : 'records'}`}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800 whitespace-nowrap"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Interactive Platform Filter Strip */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5">
          <span className="mr-1 text-xs font-medium text-slate-500 whitespace-nowrap">Platform:</span>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by source platform">
            {PLATFORM_OPTIONS.map((opt) => {
              const active = platformFilter === opt.id;
              const count = platformCounts[opt.id] || 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlatformFilter(opt.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-950'
                  }`}
                >
                  {opt.label}
                  {count > 0 && opt.id !== 'all' ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Summary Strip */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0">
          <div className="px-4 py-3.5">
            <div className="text-xs font-medium text-slate-500">Total Exports</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-950">{summary.total}</div>
            <div className="mt-0.5 text-xs text-slate-500">Recorded in history</div>
          </div>
          <div className="px-4 py-3.5">
            <div className="text-xs font-medium text-slate-500">Succeeded</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700">{summary.succeeded}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {summary.total > 0 ? `${Math.round((summary.succeeded / summary.total) * 100)}% success rate` : 'No runs yet'}
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="text-xs font-medium text-slate-500">Failed</div>
            <div
              className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                summary.failed > 0 ? 'text-red-700' : 'text-slate-950'
              }`}
            >
              {summary.failed}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {summary.totalWarnings} diagnostic {summary.totalWarnings === 1 ? 'warning' : 'warnings'}
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="text-xs font-medium text-slate-500">Total Packaged Output</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-950">
              {formatBytes(summary.totalBytes)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Across completed archives</div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && logs.length === 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5 text-xs font-semibold text-slate-500">
            Loading export history...
          </div>
          <div className="divide-y divide-slate-100">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="flex h-12 items-center justify-between px-5">
                <div className="h-3.5 w-36 rounded bg-slate-100" />
                <div className="h-3.5 w-52 rounded bg-slate-100" />
                <div className="h-3.5 w-20 rounded bg-slate-100" />
                <div className="h-3.5 w-24 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : logs.length === 0 ? (
        /* Empty State */
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ScrollText className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-base font-semibold text-slate-950">No export operations recorded yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Run any WordPress Theme, WXR 1.2 XML, Standalone Offline ZIP, or Local Assets export to inspect timestamps,
            packaging status, warnings, and downloadable diagnostic logs here.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {activeMigration ? (
              <>
                <button
                  type="button"
                  onClick={onGoToExport}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
                >
                  Open Export &amp; Deploy
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={downloadingFormat !== null}
                  onClick={() => onQuickExport('theme')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <FolderArchive className="h-3.5 w-3.5" aria-hidden="true" />
                  Export WP Theme Now
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onGoToSetup}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
              >
                Start New Migration
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Status & Format Filter Toolbar + Export History Table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              {/* Interactive Status Segmented Control */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter by status">
                  {(
                    [
                      { id: 'all', label: `All (${summary.total})` },
                      { id: 'success', label: `Succeeded (${summary.succeeded})` },
                      { id: 'failed', label: `Failed (${summary.failed})` },
                    ] as const
                  ).map((tab) => {
                    const active = statusFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                          active
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <label className="sr-only" htmlFor="export-log-format-filter">
                  Filter by export format
                </label>
                <select
                  id="export-log-format-filter"
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value as 'all' | ExportFormat)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Formats</option>
                  <option value="theme">WordPress Theme (.zip)</option>
                  <option value="wxr">WordPress WXR 1.2 (.xml)</option>
                  <option value="offline">Standalone Offline (.zip)</option>
                  <option value="assets">Local Assets (.zip)</option>
                </select>
              </div>

              <span className="font-mono text-xs tabular-nums text-slate-500">
                Showing {filteredLogs.length} {filteredLogs.length === 1 ? 'export' : 'exports'}
              </span>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-600">
                  No export logs match
                  {searchQuery.trim() ? ` "${searchQuery.trim()}"` : ' the active filters'}.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700"
                >
                  Clear search &amp; filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-2.5 whitespace-nowrap">Timestamp</th>
                      <th className="px-4 py-2.5">Site &amp; Artifact</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">Format</th>
                      <th className="px-4 py-2.5 whitespace-nowrap">Status</th>
                      <th className="px-4 py-2.5 text-right whitespace-nowrap">Output</th>
                      <th className="px-4 py-2.5 text-right whitespace-nowrap">Log File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map((entry) => {
                      const isSelected = selectedLog?.id === entry.id;
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => setSelectedLogId(entry.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3 align-middle font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                            <div>{formatTimestamp(entry.timestamp)}</div>
                            <div className="mt-0.5 text-[11px] text-slate-400">{entry.id}</div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div className="font-medium text-slate-900">{entry.siteName}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span className="font-mono text-[11px] text-slate-600">{entry.filename}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatPlatformLabel(entry.platform)}</span>
                              {entry.source === 'client-fallback' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Browser fallback</span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle text-xs font-medium text-slate-700 whitespace-nowrap">
                            {formatExportFormatShort(entry.format)}
                          </td>

                          <td className="px-4 py-3 align-middle whitespace-nowrap">
                            {entry.status === 'success' ? (
                              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>Succeeded</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                                <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>Failed</span>
                              </div>
                            )}
                            {entry.warningsCount > 0 && (
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700 tabular-nums">
                                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span>
                                  {entry.warningsCount} {entry.warningsCount === 1 ? 'warning' : 'warnings'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right align-middle font-mono text-xs tabular-nums whitespace-nowrap">
                            <div className="font-medium text-slate-900">
                              {entry.status === 'success' ? formatBytes(entry.sizeBytes) : '—'}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {entry.durationMs} ms
                              {entry.fileCount > 0 ? ` · ${entry.fileCount} ${entry.fileCount === 1 ? 'file' : 'files'}` : ''}
                            </div>
                          </td>

                          <td
                            className="px-4 py-3 text-right align-middle whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => onDownloadLog(entry, 'log')}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                              Download .log
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Export Diagnostic Log Inspector */}
          {selectedLog && (
            <section
              aria-label="Diagnostic log inspector"
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              {/* Inspector Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-slate-950 truncate">
                      {selectedLog.siteName} — {formatExportFormatLabel(selectedLog.format)}
                    </h2>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    {selectedLog.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Succeeded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Failed
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500 tabular-nums">
                    <span>{buildExportLogFilename(selectedLog, 'log')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatTimestamp(selectedLog.timestamp)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedLog.durationMs} ms</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLog(selectedLog)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 whitespace-nowrap"
                  >
                    {copiedId === selectedLog.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy Log
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownloadLog(selectedLog, 'json')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
                  >
                    <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                    Download .json
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownloadLog(selectedLog, 'log')}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Download .log
                  </button>
                </div>
              </div>

              {/* Error Banner for Failed Exports */}
              {selectedLog.status === 'failed' && selectedLog.errorMessage && (
                <div className="flex items-start gap-2.5 border-b border-red-200 bg-red-50 px-5 py-3 text-xs text-red-900">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <div>
                    <span className="font-semibold">Export Error: </span>
                    <span>{selectedLog.errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Compact Diagnostic Context Strip */}
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 bg-slate-50/70 text-xs sm:grid-cols-6 sm:divide-y-0">
                <div className="px-4 py-2.5">
                  <div className="text-slate-500">Platform</div>
                  <div className="mt-0.5 font-medium text-slate-900">{formatPlatformLabel(selectedLog.platform)}</div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-slate-500">Pages / Blocks</div>
                  <div className="mt-0.5 font-mono font-medium tabular-nums text-slate-900">
                    {selectedLog.pagesCount} / {selectedLog.blocksCount}
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-slate-500">Localized Assets</div>
                  <div className="mt-0.5 font-mono font-medium tabular-nums text-slate-900">
                    {selectedLog.assetsLocalized}
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-slate-500">JS Replaced / Stripped</div>
                  <div className="mt-0.5 font-mono font-medium tabular-nums text-slate-900">
                    {selectedLog.scriptsReplacedLocal} / {selectedLog.scriptsStripped}
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-slate-500">Archive Size</div>
                  <div className="mt-0.5 font-mono font-medium tabular-nums text-slate-900">
                    {selectedLog.status === 'success' ? formatBytes(selectedLog.sizeBytes) : '0 B'}
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-slate-500">Engine</div>
                  <div className="mt-0.5 font-medium text-slate-900">
                    {selectedLog.source === 'server' ? 'Server Pipeline' : 'Client Fallback'}
                  </div>
                </div>
              </div>

              {/* Trace Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-2.5">
                <span className="text-xs font-medium text-slate-600 tabular-nums">
                  Execution Trace ({visibleTraceLines.length} of {selectedLog.entries.length} lines)
                </span>
                <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTraceFilter('all')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      traceFilter === 'all' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    All Entries
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceFilter('issues')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      traceFilter === 'issues' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    Warnings &amp; Errors
                  </button>
                </div>
              </div>

              {/* Monospace Diagnostic Console Output */}
              <div className="max-h-[340px] overflow-auto bg-slate-950 px-5 py-4 font-mono text-xs leading-relaxed text-slate-200">
                {visibleTraceLines.length === 0 ? (
                  <div className="py-4 text-slate-400">
                    No warnings or errors recorded for this export operation.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {visibleTraceLines.map((line, index) => {
                      const levelClass =
                        line.level === 'ERROR'
                          ? 'text-red-400 font-semibold'
                          : line.level === 'WARN'
                            ? 'text-amber-300 font-semibold'
                            : 'text-emerald-400';
                      return (
                        <div key={`${selectedLog.id}-line-${index}`} className="flex items-start gap-3">
                          <span className="shrink-0 tabular-nums text-slate-500">
                            {formatShortTime(line.timestamp)}
                          </span>
                          <span className={`w-12 shrink-0 ${levelClass}`}>[{line.level}]</span>
                          <span className="w-20 shrink-0 text-slate-400">{line.stage}</span>
                          <span className="min-w-0 flex-1 break-words text-slate-100">{line.message}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
