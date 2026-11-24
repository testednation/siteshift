export type PlatformType = 'wix' | 'strikingly' | 'squarespace' | 'webflow' | 'weebly' | 'html';

export type SampleId =
  | 'wix-studio'
  | 'squarespace-editorial'
  | 'strikingly-launch'
  | 'webflow-saas';

export type AssetKind = 'script' | 'inline-script' | 'stylesheet' | 'image' | 'font';

export type AssetCategory =
  | 'platform_runtime'
  | 'telemetry_tracker'
  | 'ui_widget'
  | 'custom_script'
  | 'json_ld'
  | 'stylesheet'
  | 'media'
  | 'font';

export type AssetAction = 'strip' | 'replace_local' | 'localize' | 'keep_inline';

export interface MigrationOptions {
  platformHint: 'auto' | PlatformType;
  maxPages: number;
  offlineOnly: boolean;
  stripTrackers: boolean;
  replacePlatformJs: boolean;
  localizeExternalJs: boolean;
  localizeStylesAndFonts: boolean;
  localizeImages: boolean;
  optimizeImagesToJpeg: boolean;
  imageJpegQuality: number;
  imageMaxWidth: number;
  generateGutenbergBlocks: boolean;
  siteNameOverride?: string;
}

export interface AssetItem {
  id: string;
  kind: AssetKind;
  category: AssetCategory;
  originalUrl: string;
  displayName: string;
  localPath: string | null;
  action: AssetAction;
  reason: string;
  originalBytes: number;
  optimizedBytes: number;
  isExternal: boolean;
  fetchedLocally: boolean;
  usedOnPages: string[];
  mimeType: string;
  imageOptimization?: ImageOptimizationInfo;
}

export interface ImageOptimizationInfo {
  eligible: boolean;
  applied: boolean;
  originalFormat: string;
  outputFormat: string;
  originalWidth?: number;
  originalHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  quality?: number;
  bytesSaved: number;
}

export interface ExtractedBlock {
  id: string;
  wpType: 'wp:heading' | 'wp:paragraph' | 'wp:list' | 'wp:image' | 'wp:buttons' | 'wp:html';
  label: string;
  gutenbergMarkup: string;
  wpPreviewHtml: string;
}

export interface ExtractedSection {
  id: string;
  type: 'hero' | 'content' | 'gallery' | 'features' | 'contact' | 'footer';
  heading: string;
  summary: string;
  blockCount: number;
  gutenbergMarkup: string;
  wpPreviewHtml: string;
  blocks: ExtractedBlock[];
}

export interface MigratedPage {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  sourceUrl: string;
  isHome: boolean;
  wordCount: number;
  imageCount: number;
  scriptCountBefore: number;
  scriptCountAfter: number;
  originalHtmlBytes: number;
  cleanedHtmlBytes: number;
  gutenbergContent: string;
  offlineHtml: string;
  previewHtml: string;
  sections: ExtractedSection[];
}

export interface MigrationMetrics {
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  bytesSaved: number;
  percentSaved: number;
  jsOriginalBytes: number;
  jsOptimizedBytes: number;
  jsPercentSaved: number;
  externalRequestsBefore: number;
  externalRequestsAfter: number;
  scriptsStripped: number;
  scriptsReplacedLocal: number;
  assetsLocalized: number;
  pagesMigrated: number;
  gutenbergBlocksGenerated: number;
  processingTimeMs: number;
  imagesOptimizedCount: number;
  imageOriginalBytes: number;
  imageOptimizedBytes: number;
  imageBytesSaved: number;
}

export interface ThemeFilePreview {
  path: string;
  language: 'php' | 'css' | 'js' | 'xml' | 'txt' | 'html';
  sizeBytes: number;
  content: string;
}

export interface MigrationResult {
  id: string;
  createdAt: string;
  siteName: string;
  siteSlug: string;
  sourceLabel: string;
  sourceMode: 'url' | 'offline-upload' | 'paste' | 'sample';
  detectedPlatform: PlatformType;
  detectionSignals: string[];
  options: MigrationOptions;
  pages: MigratedPage[];
  assets: AssetItem[];
  metrics: MigrationMetrics;
  wxrXml: string;
  themeFiles: ThemeFilePreview[];
  warnings: string[];
}

export type ExportFormat = 'wxr' | 'theme' | 'offline' | 'assets' | 'source' | 'updated';

export type ExportLogFormat = ExportFormat | 'bulk';

export interface BulkExportRequestItem {
  id: string;
  format: ExportFormat;
}

export type ExportLogStatus = 'success' | 'failed';

export type ExportLogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface ExportLogLine {
  timestamp: string;
  level: ExportLogLevel;
  stage: string;
  message: string;
}

export interface ExportLogEntry {
  id: string;
  migrationId: string;
  siteName: string;
  siteSlug: string;
  platform: PlatformType;
  format: ExportLogFormat;
  filename: string;
  status: ExportLogStatus;
  timestamp: string;
  durationMs: number;
  sizeBytes: number;
  fileCount: number;
  pagesCount: number;
  blocksCount: number;
  assetsLocalized: number;
  scriptsStripped: number;
  scriptsReplacedLocal: number;
  warningsCount: number;
  errorMessage?: string;
  source: 'server' | 'client-fallback';
  entries: ExportLogLine[];
}

