import type { MigrationResult, PlatformType } from '../types/migration';

const KPI_STORAGE_KEY = 'pressport_migration_kpis_v1';
const MAX_STORED_KPIS = 12;

export interface MigrationKpiRecord {
  id: string;
  siteName: string;
  siteSlug: string;
  detectedPlatform: PlatformType;
  createdAt: string;
  totalAssets: number;
  assetsLocalized: number;
  scriptsStripped: number;
  scriptsReplacedLocal: number;
  pagesMigrated: number;
  gutenbergBlocks: number;
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  bytesSaved: number;
  percentSaved: number;
  jsOriginalBytes: number;
  jsOptimizedBytes: number;
  jsPercentSaved: number;
  externalRequestsBefore: number;
  externalRequestsAfter: number;
  loadTimeBeforeMs: number;
  loadTimeAfterMs: number;
  loadTimeImprovementPct: number;
}

export interface AggregatedMigrationKpis {
  migrationsCount: number;
  totalAssetsProcessed: number;
  totalAssetsLocalized: number;
  totalScriptsCleaned: number;
  avgLoadTimeImprovementPct: number;
  avgLoadTimeBeforeMs: number;
  avgLoadTimeAfterMs: number;
  totalBytesSaved: number;
  avgJsPercentSaved: number;
  totalPagesMigrated: number;
  totalGutenbergBlocks: number;
}

/**
 * Deterministic page-load estimate derived strictly from measured migration data:
 * - Base server TTFB: 120 ms
 * - Payload transfer on typical 4G/broadband (~1.6 Mbps = 200 bytes/ms)
 * - JS parse & hydration overhead (~180 bytes/ms)
 * - External third-party CDN/tracker round-trip overhead (85 ms per external request)
 */
export function estimateLoadTimeMetrics(result: MigrationResult): {
  loadTimeBeforeMs: number;
  loadTimeAfterMs: number;
  loadTimeImprovementPct: number;
} {
  const { metrics } = result;
  const baseTtfbMs = 120;

  const beforeTransferMs = metrics.totalOriginalBytes / 200;
  const beforeJsParseMs = metrics.jsOriginalBytes / 180;
  const beforeExternalMs = metrics.externalRequestsBefore * 85;
  const loadTimeBeforeMs = Math.max(
    baseTtfbMs + 50,
    Math.round(baseTtfbMs + beforeTransferMs + beforeJsParseMs + beforeExternalMs),
  );

  const afterTransferMs = metrics.totalOptimizedBytes / 200;
  const afterJsParseMs = metrics.jsOptimizedBytes / 180;
  const afterExternalMs = metrics.externalRequestsAfter * 85;
  const loadTimeAfterMs = Math.max(
    baseTtfbMs,
    Math.round(baseTtfbMs + afterTransferMs + afterJsParseMs + afterExternalMs),
  );

  const rawImprovement =
    loadTimeBeforeMs > 0
      ? ((loadTimeBeforeMs - loadTimeAfterMs) / loadTimeBeforeMs) * 100
      : 0;
  const loadTimeImprovementPct = Math.max(0, Math.min(98, Math.round(rawImprovement)));

  return {
    loadTimeBeforeMs,
    loadTimeAfterMs,
    loadTimeImprovementPct,
  };
}

export function toMigrationKpiRecord(result: MigrationResult): MigrationKpiRecord {
  const loadMetrics = estimateLoadTimeMetrics(result);

  return {
    id: result.id,
    siteName: result.siteName,
    siteSlug: result.siteSlug,
    detectedPlatform: result.detectedPlatform,
    createdAt: result.createdAt,
    totalAssets: result.assets.length,
    assetsLocalized: result.metrics.assetsLocalized,
    scriptsStripped: result.metrics.scriptsStripped,
    scriptsReplacedLocal: result.metrics.scriptsReplacedLocal,
    pagesMigrated: result.metrics.pagesMigrated,
    gutenbergBlocks: result.metrics.gutenbergBlocksGenerated,
    totalOriginalBytes: result.metrics.totalOriginalBytes,
    totalOptimizedBytes: result.metrics.totalOptimizedBytes,
    bytesSaved: result.metrics.bytesSaved,
    percentSaved: result.metrics.percentSaved,
    jsOriginalBytes: result.metrics.jsOriginalBytes,
    jsOptimizedBytes: result.metrics.jsOptimizedBytes,
    jsPercentSaved: result.metrics.jsPercentSaved,
    externalRequestsBefore: result.metrics.externalRequestsBefore,
    externalRequestsAfter: result.metrics.externalRequestsAfter,
    ...loadMetrics,
  };
}

export function aggregateMigrationKpis(records: MigrationKpiRecord[]): AggregatedMigrationKpis {
  const count = records.length;
  if (count === 0) {
    return {
      migrationsCount: 0,
      totalAssetsProcessed: 0,
      totalAssetsLocalized: 0,
      totalScriptsCleaned: 0,
      avgLoadTimeImprovementPct: 0,
      avgLoadTimeBeforeMs: 0,
      avgLoadTimeAfterMs: 0,
      totalBytesSaved: 0,
      avgJsPercentSaved: 0,
      totalPagesMigrated: 0,
      totalGutenbergBlocks: 0,
    };
  }

  let totalAssetsProcessed = 0;
  let totalAssetsLocalized = 0;
  let totalScriptsCleaned = 0;
  let loadImprovementSum = 0;
  let loadBeforeSum = 0;
  let loadAfterSum = 0;
  let totalBytesSaved = 0;
  let jsPercentSavedSum = 0;
  let totalPagesMigrated = 0;
  let totalGutenbergBlocks = 0;

  for (const r of records) {
    totalAssetsProcessed += r.totalAssets;
    totalAssetsLocalized += r.assetsLocalized;
    totalScriptsCleaned += r.scriptsStripped + r.scriptsReplacedLocal;
    loadImprovementSum += r.loadTimeImprovementPct;
    loadBeforeSum += r.loadTimeBeforeMs;
    loadAfterSum += r.loadTimeAfterMs;
    totalBytesSaved += Math.max(0, r.bytesSaved);
    jsPercentSavedSum += r.jsPercentSaved;
    totalPagesMigrated += r.pagesMigrated;
    totalGutenbergBlocks += r.gutenbergBlocks;
  }

  return {
    migrationsCount: count,
    totalAssetsProcessed,
    totalAssetsLocalized,
    totalScriptsCleaned,
    avgLoadTimeImprovementPct: Math.round(loadImprovementSum / count),
    avgLoadTimeBeforeMs: Math.round(loadBeforeSum / count),
    avgLoadTimeAfterMs: Math.round(loadAfterSum / count),
    totalBytesSaved,
    avgJsPercentSaved: Math.round(jsPercentSavedSum / count),
    totalPagesMigrated,
    totalGutenbergBlocks,
  };
}

export function formatSeconds(ms: number): string {
  if (ms <= 0) return '0.00s';
  return `${(ms / 1000).toFixed(2)}s`;
}

export function loadStoredMigrationKpis(): MigrationKpiRecord[] {
  try {
    const raw = window.localStorage.getItem(KPI_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MigrationKpiRecord =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.siteName === 'string' &&
        typeof item.totalAssets === 'number' &&
        typeof item.loadTimeImprovementPct === 'number',
    );
  } catch {
    return [];
  }
}

export function saveStoredMigrationKpis(records: MigrationKpiRecord[]): void {
  try {
    window.localStorage.setItem(
      KPI_STORAGE_KEY,
      JSON.stringify(records.slice(0, MAX_STORED_KPIS)),
    );
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

export function upsertMigrationKpi(
  records: MigrationKpiRecord[],
  result: MigrationResult,
): MigrationKpiRecord[] {
  const nextRecord = toMigrationKpiRecord(result);
  const existingIdx = records.findIndex((r) => r.id === nextRecord.id);
  let next: MigrationKpiRecord[];
  if (existingIdx >= 0) {
    next = records.map((r, idx) => (idx === existingIdx ? nextRecord : r));
  } else {
    next = [nextRecord, ...records].slice(0, MAX_STORED_KPIS);
  }
  saveStoredMigrationKpis(next);
  return next;
}

export function clearStoredMigrationKpis(): void {
  try {
    window.localStorage.removeItem(KPI_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
