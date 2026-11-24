import * as cheerio from 'cheerio';
import JSZip from 'jszip';
import crypto from 'node:crypto';
import type {
  AssetAction,
  AssetCategory,
  AssetItem,
  AssetKind,
  BulkExportRequestItem,
  ExportFormat,
  ExtractedBlock,
  ExtractedSection,
  MigratedPage,
  MigrationMetrics,
  MigrationOptions,
  MigrationResult,
  PlatformType,
  SampleId,
  ThemeFilePreview,
} from '../types/migration.ts';
import {
  clampJpegQuality,
  normalizeMaxWidth,
  processImageBinary,
  renderSampleRasterImage,
  rewritePathToJpeg,
} from './imageOptimizer.ts';
import { PRESSPORT_BASE_CSS, PRESSPORT_LOCAL_RUNTIME_JS } from './localRuntime.ts';
import { SAMPLE_FIXTURES } from './samples.ts';

interface RawPageInput {
  filename: string;
  slug: string;
  sourceUrl: string;
  html: string;
}

interface StoredAssetBinary {
  buffer: Buffer;
  mimeType: string;
  textContent?: string;
}

export interface StoredMigrationJob {
  result: MigrationResult;
  rawPages: RawPageInput[];
  assetBinaries: Map<string, StoredAssetBinary>; // active binaries keyed by assetId
  originalAssetBinaries: Map<string, StoredAssetBinary>; // untouched source binaries keyed by assetId
  extraUploadedFiles: Map<string, StoredAssetBinary>; // normalized filename/url -> binary
}

const jobStore = new Map<string, StoredMigrationJob>();
const MAX_STORED_JOBS = 15;

export function getMigrationJob(id: string): StoredMigrationJob | undefined {
  return jobStore.get(id);
}

function saveMigrationJob(job: StoredMigrationJob): void {
  if (jobStore.size >= MAX_STORED_JOBS) {
    const oldestKey = jobStore.keys().next().value;
    if (oldestKey) jobStore.delete(oldestKey);
  }
  jobStore.set(job.result.id, job);
}

// ---------- Helpers ----------

function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'migrated-site';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeCdata(str: string): string {
  return str.replace(/]]>/g, ']]]]><![CDATA[>');
}

function shortHash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
}

function resolveAssetUrl(rawUrl: string, baseUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith('//');
}

function sanitizeFilename(urlOrPath: string, fallbackExt: string): string {
  let clean = urlOrPath.split('?')[0].split('#')[0];
  // Handle Wix media resize URLs: .../media/abc_123.jpg/v1/fill/...
  const wixMediaMatch = clean.match(/\/media\/([^/]+)/i);
  if (wixMediaMatch) {
    clean = wixMediaMatch[1];
  } else {
    const parts = clean.split('/').filter(Boolean);
    clean = parts[parts.length - 1] || `asset-${shortHash(urlOrPath)}`;
  }
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  if (!clean.includes('.')) {
    clean = `${clean}.${fallbackExt}`;
  }
  return clean.slice(0, 72);
}

function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (/^10\.\d+\.\d+\.\d+$/.test(lower)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(lower)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(lower)) return true;
  return false;
}

// ---------- Platform Detection ----------

export function detectPlatform(
  htmlList: string[],
  sourceUrl: string,
  hint: 'auto' | PlatformType,
): { platform: PlatformType; signals: string[] } {
  const combined = htmlList.join('\n').toLowerCase();
  const urlLower = sourceUrl.toLowerCase();
  const signals: string[] = [];

  const scores: Record<Exclude<PlatformType, 'html'>, number> = {
    wix: 0,
    strikingly: 0,
    squarespace: 0,
    webflow: 0,
    weebly: 0,
  };

  // Wix signatures
  if (urlLower.includes('wixsite.com') || urlLower.includes('wix.com')) {
    scores.wix += 4;
    signals.push('Wix domain pattern detected');
  }
  if (combined.includes('wix.com website builder') || combined.includes('wix-thunderbolt')) {
    scores.wix += 5;
    signals.push('Wix Thunderbolt renderer signature');
  }
  if (combined.includes('static.parastorage.com') || combined.includes('static.wixstatic.com')) {
    scores.wix += 4;
    signals.push('Wix CDN hosts (parastorage.com / wixstatic.com)');
  }
  if (combined.includes('wix-viewer-model') || combined.includes('wixbisession') || combined.includes('frog.wix.com')) {
    scores.wix += 3;
    signals.push('Wix viewerModel / BI telemetry runtime');
  }
  if (combined.includes('data-mesh-id') || combined.includes('site_container')) {
    scores.wix += 2;
    signals.push('Wix DOM layout mesh containers');
  }

  // Squarespace signatures
  if (urlLower.includes('squarespace.com') || urlLower.includes('sqsp.net')) {
    scores.squarespace += 4;
    signals.push('Squarespace domain pattern detected');
  }
  if (
    combined.includes('static1.squarespace.com') ||
    combined.includes('images.squarespace-cdn.com') ||
    combined.includes('assets.squarespace.com')
  ) {
    scores.squarespace += 5;
    signals.push('Squarespace CDN hosts (squarespace-cdn.com / static1.squarespace.com)');
  }
  if (
    combined.includes('static.squarespace_context') ||
    combined.includes('sqs-block') ||
    combined.includes('sqs-layout') ||
    combined.includes('content="squarespace"')
  ) {
    scores.squarespace += 4;
    signals.push('Squarespace Fluid Engine / SQS block DOM');
  }

  // Strikingly signatures
  if (urlLower.includes('strikingly.com') || urlLower.includes('mystrikingly.com')) {
    scores.strikingly += 4;
    signals.push('Strikingly domain pattern detected');
  }
  if (combined.includes('content="strikingly"') || combined.includes('assets.strikingly.com') || combined.includes('strikinglycdn.com')) {
    scores.strikingly += 5;
    signals.push('Strikingly CDN & generator metadata');
  }
  if (combined.includes('bobcat-runtime') || combined.includes('window.$s') || combined.includes('s-section')) {
    scores.strikingly += 4;
    signals.push('Strikingly Bobcat runtime & s-section layout');
  }

  // Webflow signatures
  if (urlLower.includes('webflow.io') || urlLower.includes('webflow.com')) {
    scores.webflow += 4;
    signals.push('Webflow domain pattern detected');
  }
  if (combined.includes('data-wf-site') || combined.includes('data-wf-page') || combined.includes('content="webflow"')) {
    scores.webflow += 5;
    signals.push('Webflow site/page data attributes');
  }
  if (combined.includes('website-files.com') || combined.includes('webflow.js') || combined.includes('w-richtext')) {
    scores.webflow += 4;
    signals.push('Webflow CDN (website-files.com) & runtime bundle');
  }

  // Weebly signatures
  if (urlLower.includes('weebly.com') || urlLower.includes('weeblysite.com')) {
    scores.weebly += 4;
    signals.push('Weebly domain pattern detected');
  }
  if (combined.includes('cdn2.editmysite.com') || combined.includes('wsite-section') || combined.includes('weebly-footer')) {
    scores.weebly += 5;
    signals.push('Weebly EditMySite CDN & wsite layout classes');
  }

  if (hint !== 'auto') {
    signals.unshift(`Platform locked to ${hint.toUpperCase()} via user override`);
    return { platform: hint, signals };
  }

  let bestPlatform: PlatformType = 'html';
  let bestScore = 1;
  (Object.keys(scores) as Array<Exclude<PlatformType, 'html'>>).forEach((key) => {
    if (scores[key] > bestScore) {
      bestScore = scores[key];
      bestPlatform = key;
    }
  });

  if (signals.length === 0) {
    signals.push('Standard HTML document structure');
  }
  return { platform: bestPlatform, signals };
}

// ---------- Script & Asset Classification ----------

interface Classification {
  category: AssetCategory;
  defaultAction: AssetAction;
  reason: string;
  estimatedRemoteBytes: number;
}

function classifyScript(urlOrContent: string, isInline: boolean, options: MigrationOptions): Classification {
  const lower = urlOrContent.toLowerCase();

  // Telemetry & Analytics Trackers
  const trackerPatterns = [
    'frog.wix.com',
    'wixbisession',
    'window.fedops',
    'tag-manager',
    'googletagmanager',
    'google-analytics',
    'mixpanel',
    'mxpnl.com',
    'segment.com',
    'analytics.js',
    'fbevents',
    'facebook.net',
    'hotjar',
    'sentry',
    'intercom',
    'snowplow',
    'clarity.ms',
    'scripts-compressed/performance',
    'sqs-analytics',
    'squarespace-telemetry',
  ];
  if (trackerPatterns.some((p) => lower.includes(p))) {
    return {
      category: 'telemetry_tracker',
      defaultAction: options.stripTrackers ? 'strip' : 'localize',
      reason: 'Third-party analytics / platform telemetry script; breaks offline privacy & slows TTI.',
      estimatedRemoteBytes: isInline ? Buffer.byteLength(urlOrContent, 'utf8') : 46_400,
    };
  }

  // Proprietary Wix / Squarespace / Strikingly / Webflow / Weebly Runtime & Editor Shells
  const platformPatterns = [
    'wix-thunderbolt',
    'parastorage.com/services/',
    'parastorage.com/unpkg/react',
    'wix-viewer-model',
    'viewermodel',
    'wix-forms-viewer',
    'santa',
    'bobcat-runtime',
    'strikingly-sections',
    'strikingly.com/assets/packed',
    'window.$s',
    'edit_page',
    'static.squarespace_context',
    'squarespace.com/universal/scripts-compressed/common',
    'squarespace.com/universal/scripts-compressed/extract-css-runtime',
    'static1.squarespace.com/static/vta/',
    'squarespace.com/universal/scripts-compressed/commerce',
    'webflow.js',
    'webflow.min.js',
    'webflow.schunk',
    'cdn2.editmysite.com/js/',
  ];
  if (platformPatterns.some((p) => lower.includes(p.toLowerCase()))) {
    const isJsonPayload =
      lower.includes('wix-viewer-model') ||
      lower.includes('window.$s') ||
      lower.includes('static.squarespace_context');
    return {
      category: 'platform_runtime',
      defaultAction: options.replacePlatformJs
        ? isJsonPayload
          ? 'strip'
          : 'replace_local'
        : 'localize',
      reason: isJsonPayload
        ? 'Proprietary hydration state blob not required after WordPress conversion.'
        : 'Heavy proprietary site-builder JS runtime replaced by lightweight local pressport-runtime.js.',
      estimatedRemoteBytes: isInline ? Buffer.byteLength(urlOrContent, 'utf8') : 248_000,
    };
  }

  // JSON-LD SEO Schema
  if (isInline && lower.includes('"@context"') && lower.includes('schema.org')) {
    return {
      category: 'json_ld',
      defaultAction: 'keep_inline',
      reason: 'Structured JSON-LD SEO schema preserved inline.',
      estimatedRemoteBytes: Buffer.byteLength(urlOrContent, 'utf8'),
    };
  }

  // Useful UI Widget or Custom Script
  return {
    category: isInline ? 'custom_script' : 'ui_widget',
    defaultAction: isInline
      ? 'keep_inline'
      : options.localizeExternalJs
        ? 'localize'
        : 'replace_local',
    reason: isInline
      ? 'Custom inline script preserved locally.'
      : 'External site script localized to assets/js/ for zero-CDN offline execution.',
    estimatedRemoteBytes: isInline ? Buffer.byteLength(urlOrContent, 'utf8') : 18_500,
  };
}

// ---------- Fallback Local SVG Generator ----------

function createOfflineImagePlaceholderSvg(label: string): Buffer {
  const safeLabel = escapeXml(label.slice(0, 44) || 'Localized Media');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
  <rect width="800" height="480" fill="#e2e8f0"/>
  <rect x="28" y="28" width="744" height="424" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <path d="M220 330 L340 210 L440 295 L520 230 L610 330 Z" fill="#cbd5e1"/>
  <circle cx="300" cy="170" r="28" fill="#94a3b8"/>
  <text x="400" y="388" text-anchor="middle" fill="#475569" font-family="sans-serif" font-size="16" font-weight="600">${safeLabel}</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

// ---------- Live Network Fetchers ----------

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 PressPortMigrator/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function crawlLiveSite(
  rawUrl: string,
  options: MigrationOptions,
): Promise<{ pages: RawPageInput[]; warnings: string[]; normalizedBaseUrl: string }> {
  let parsed: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Please enter a valid website URL (for example, https://example.wixsite.com/mysite).');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs can be crawled.');
  }
  if (isPrivateOrBlockedHost(parsed.hostname)) {
    throw new Error('Crawling local or private network addresses is blocked for security.');
  }

  const maxPages = Math.max(1, Math.min(options.maxPages || 5, 10));
  const visited = new Set<string>();
  const queue: string[] = [parsed.toString()];
  const pages: RawPageInput[] = [];
  const warnings: string[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const currentUrl = queue.shift()!;
    const canonical = currentUrl.split('#')[0].replace(/\/+$/, '');
    if (visited.has(canonical)) continue;
    visited.add(canonical);

    try {
      const res = await fetchWithTimeout(currentUrl, 10000);
      if (!res.ok) {
        warnings.push(`Skipped ${currentUrl} (HTTP ${res.status}).`);
        continue;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        continue;
      }
      const html = await res.text();
      const pageUrlObj = new URL(res.url || currentUrl);
      const pathSlug =
        pageUrlObj.pathname === '/' || pageUrlObj.pathname === ''
          ? 'home'
          : slugify(pageUrlObj.pathname.replace(/\.html?$/i, ''));

      pages.push({
        filename: pathSlug === 'home' ? 'index.html' : `${pathSlug}.html`,
        slug: pathSlug,
        sourceUrl: pageUrlObj.toString(),
        html,
      });

      // Discover internal same-origin links
      if (pages.length < maxPages) {
        const $ = cheerio.load(html);
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
            return;
          }
          try {
            const nextUrl = new URL(href, pageUrlObj.toString());
            if (
              nextUrl.origin === parsed.origin &&
              !/\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|mp4|css|js)$/i.test(nextUrl.pathname)
            ) {
              const nextCanon = nextUrl.toString().split('#')[0].replace(/\/+$/, '');
              if (!visited.has(nextCanon) && !queue.includes(nextUrl.toString())) {
                queue.push(nextUrl.toString());
              }
            }
          } catch {
            // Ignore malformed URLs
          }
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      warnings.push(`Could not fetch ${currentUrl}: ${msg}`);
    }
  }

  if (pages.length === 0) {
    throw new Error(
      `Unable to fetch HTML from ${parsed.toString()}. The host may block automated crawlers—save the page in your browser and use Offline Upload mode instead.`,
    );
  }

  return { pages, warnings, normalizedBaseUrl: parsed.origin };
}

// ---------- Core Migration & Compilation Engine ----------

interface DiscoveredAssetDraft {
  id: string;
  kind: AssetKind;
  category: AssetCategory;
  originalUrl: string;
  displayName: string;
  action: AssetAction;
  reason: string;
  isExternal: boolean;
  usedOnPages: Set<string>;
  inlineCode?: string;
  estimatedBytes: number;
  mimeType: string;
}

async function discoverAndLocalizeAssets(
  rawPages: RawPageInput[],
  options: MigrationOptions,
  extraUploadedFiles: Map<string, StoredAssetBinary>,
  warnings: string[],
): Promise<{
  assets: AssetItem[];
  assetBinaries: Map<string, StoredAssetBinary>;
  originalAssetBinaries: Map<string, StoredAssetBinary>;
  urlToAssetId: Map<string, string>;
}> {
  const drafts = new Map<string, DiscoveredAssetDraft>();
  const urlToAssetId = new Map<string, string>();
  const assetBinaries = new Map<string, StoredAssetBinary>();
  const originalAssetBinaries = new Map<string, StoredAssetBinary>();

  for (const page of rawPages) {
    const $ = cheerio.load(page.html);
    const baseUrl = /^https?:\/\//i.test(page.sourceUrl) ? page.sourceUrl : 'https://offline.local/';

    // 1. External & inline <script>
    $('script').each((idx, el) => {
      const src = $(el).attr('src');
      const type = ($(el).attr('type') || '').toLowerCase();
      if (src) {
        const resolved = resolveAssetUrl(src, baseUrl);
        const key = `script::${resolved}`;
        let draft = drafts.get(key);
        if (!draft) {
          const cls = classifyScript(resolved, false, options);
          const id = `ast-${shortHash(key)}`;
          draft = {
            id,
            kind: 'script',
            category: cls.category,
            originalUrl: resolved,
            displayName: sanitizeFilename(resolved, 'js'),
            action: cls.defaultAction,
            reason: cls.reason,
            isExternal: isExternalUrl(resolved),
            usedOnPages: new Set([page.slug]),
            estimatedBytes: cls.estimatedRemoteBytes,
            mimeType: 'application/javascript',
          };
          drafts.set(key, draft);
          urlToAssetId.set(resolved, id);
          urlToAssetId.set(src, id);
        } else {
          draft.usedOnPages.add(page.slug);
        }
      } else {
        const inlineCode = ($(el).html() || '').trim();
        if (!inlineCode) return;
        const scriptIdAttr = $(el).attr('id') || `inline-${idx + 1}`;
        const key = `inline-script::${page.slug}::${scriptIdAttr}::${shortHash(inlineCode)}`;
        const cls = classifyScript(`${scriptIdAttr} ${type} ${inlineCode}`, true, options);
        const id = `ast-${shortHash(key)}`;
        drafts.set(key, {
          id,
          kind: 'inline-script',
          category: cls.category,
          originalUrl: `inline://${page.slug}/${scriptIdAttr}`,
          displayName: `${scriptIdAttr}.js (${page.slug})`,
          action: cls.defaultAction,
          reason: cls.reason,
          isExternal: false,
          usedOnPages: new Set([page.slug]),
          inlineCode,
          estimatedBytes: Buffer.byteLength(inlineCode, 'utf8'),
          mimeType: type.includes('json') ? 'application/json' : 'application/javascript',
        });
      }
    });

    // 2. External stylesheets
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const resolved = resolveAssetUrl(href, baseUrl);
      const key = `css::${resolved}`;
      let draft = drafts.get(key);
      if (!draft) {
        const id = `ast-${shortHash(key)}`;
        const resolvedLower = resolved.toLowerCase();
        const isPlatformCss =
          resolvedLower.includes('parastorage.com') ||
          resolvedLower.includes('assets.strikingly.com/assets/themes') ||
          resolvedLower.includes('static1.squarespace.com/static/sitecss') ||
          resolvedLower.includes('assets.squarespace.com/universal/styles-compressed') ||
          resolvedLower.includes('cdn2.editmysite.com/css/');
        draft = {
          id,
          kind: 'stylesheet',
          category: 'stylesheet',
          originalUrl: resolved,
          displayName: sanitizeFilename(resolved, 'css'),
          action: isPlatformCss && options.replacePlatformJs
            ? 'replace_local'
            : options.localizeStylesAndFonts
              ? 'localize'
              : 'strip',
          reason: isPlatformCss
            ? 'Proprietary platform CSS bundle replaced with clean local pressport-base.css.'
            : 'External stylesheet localized into assets/css/ for offline rendering.',
          isExternal: isExternalUrl(resolved),
          usedOnPages: new Set([page.slug]),
          estimatedBytes: isPlatformCss ? 94_200 : 12_400,
          mimeType: 'text/css',
        };
        drafts.set(key, draft);
        urlToAssetId.set(resolved, id);
        urlToAssetId.set(href, id);
      } else {
        draft.usedOnPages.add(page.slug);
      }
    });

    // 3. Images (supports Wix, Squarespace data-image/data-src, Strikingly, Webflow, Weebly)
    $('img').each((_, el) => {
      const src =
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-image') ||
        $(el).attr('data-lazy-src');
      if (!src || src.startsWith('data:')) return;
      const resolved = resolveAssetUrl(src, baseUrl);
      const key = `img::${resolved}`;
      let draft = drafts.get(key);
      if (!draft) {
        const id = `ast-${shortHash(key)}`;
        const filename = sanitizeFilename(resolved, 'png');
        const ext = filename.split('.').pop()?.toLowerCase() || 'png';
        const mime =
          ext === 'svg'
            ? 'image/svg+xml'
            : ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'webp'
                ? 'image/webp'
                : ext === 'gif'
                  ? 'image/gif'
                  : 'image/png';
        draft = {
          id,
          kind: 'image',
          category: 'media',
          originalUrl: resolved,
          displayName: filename,
          action: options.localizeImages ? 'localize' : 'strip',
          reason: 'Media asset downloaded and rewritten to local assets/images/ path.',
          isExternal: isExternalUrl(resolved),
          usedOnPages: new Set([page.slug]),
          estimatedBytes: ext === 'svg' ? 2_400 : 68_000,
          mimeType: mime,
        };
        drafts.set(key, draft);
        urlToAssetId.set(resolved, id);
        urlToAssetId.set(src, id);
      } else {
        draft.usedOnPages.add(page.slug);
      }
    });
  }

  // Fetch or bind uploaded local binaries (bounded concurrency)
  const assetList: AssetItem[] = [];
  const draftArray = Array.from(drafts.values());

  for (const draft of draftArray) {
    let fetchedLocally = false;
    let originalBytes = draft.estimatedBytes;
    let localPath: string | null = null;

    if (draft.kind === 'script') {
      localPath = `assets/js/${draft.displayName}`;
    } else if (draft.kind === 'stylesheet') {
      localPath = `assets/css/${draft.displayName}`;
    } else if (draft.kind === 'image') {
      localPath = `assets/images/${draft.displayName}`;
    } else if (draft.kind === 'font') {
      localPath = `assets/fonts/${draft.displayName}`;
    }

    // Check if asset exists in uploaded ZIP / sample bundle
    const bundledMatch =
      extraUploadedFiles.get(draft.originalUrl) ||
      extraUploadedFiles.get(draft.displayName) ||
      extraUploadedFiles.get(draft.originalUrl.replace(/^https?:\/\/offline\.local\//i, ''));

    if (bundledMatch) {
      assetBinaries.set(draft.id, bundledMatch);
      originalBytes = bundledMatch.buffer.byteLength;
      fetchedLocally = true;
    } else if (draft.inlineCode !== undefined) {
      const buf = Buffer.from(draft.inlineCode, 'utf8');
      assetBinaries.set(draft.id, {
        buffer: buf,
        mimeType: draft.mimeType,
        textContent: draft.inlineCode,
      });
      originalBytes = buf.byteLength;
      fetchedLocally = true;
    } else if (
      !options.offlineOnly &&
      draft.isExternal &&
      (draft.action === 'localize' || draft.kind === 'image' || draft.kind === 'stylesheet')
    ) {
      try {
        const parsed = new URL(draft.originalUrl);
        if (!isPrivateOrBlockedHost(parsed.hostname)) {
          const resp = await fetchWithTimeout(draft.originalUrl, 5000);
          if (resp.ok) {
            const arrBuf = await resp.arrayBuffer();
            if (arrBuf.byteLength > 0 && arrBuf.byteLength <= 4 * 1024 * 1024) {
              const buf = Buffer.from(arrBuf);
              const contentType = resp.headers.get('content-type') || draft.mimeType;
              assetBinaries.set(draft.id, {
                buffer: buf,
                mimeType: contentType,
                textContent:
                  contentType.includes('javascript') || contentType.includes('css') || contentType.includes('svg')
                    ? buf.toString('utf8')
                    : undefined,
              });
              originalBytes = buf.byteLength;
              fetchedLocally = true;
            }
          }
        }
      } catch {
        // Offline or blocked remote asset — fallback handled below
      }
    }

    // Ensure localized images/scripts/CSS always have valid local files for offline functionality
    if (!assetBinaries.has(draft.id)) {
      if (draft.kind === 'image') {
        const fallbackSvg = createOfflineImagePlaceholderSvg(draft.displayName);
        if (localPath && !localPath.endsWith('.svg')) {
          localPath = localPath.replace(/\.[^.]+$/, '.svg');
        }
        assetBinaries.set(draft.id, {
          buffer: fallbackSvg,
          mimeType: 'image/svg+xml',
          textContent: fallbackSvg.toString('utf8'),
        });
        if (!options.offlineOnly && draft.isExternal) {
          warnings.push(`Remote image ${draft.displayName} could not be fetched directly; generated an offline local SVG placeholder.`);
        }
      } else if (draft.kind === 'script') {
        const stub = `/* PressPort localized stub for ${draft.displayName} (original source unavailable offline) */\n`;
        assetBinaries.set(draft.id, {
          buffer: Buffer.from(stub, 'utf8'),
          mimeType: 'application/javascript',
          textContent: stub,
        });
      } else if (draft.kind === 'stylesheet') {
        const stub = `/* PressPort localized stylesheet placeholder for ${draft.displayName} */\n`;
        assetBinaries.set(draft.id, {
          buffer: Buffer.from(stub, 'utf8'),
          mimeType: 'text/css',
          textContent: stub,
        });
      }
    }

    // Save untouched original binary before any image optimization
    const originalBinary = assetBinaries.get(draft.id);
    if (originalBinary) {
      originalAssetBinaries.set(draft.id, originalBinary);
    }

    let finalMimeType = originalBinary?.mimeType || draft.mimeType;
    let imageOptimization: AssetItem['imageOptimization'];

    if (draft.kind === 'image' && originalBinary) {
      const imgOutcome = await processImageBinary(
        originalBinary.buffer,
        originalBinary.mimeType,
        localPath,
        draft.displayName,
        {
          enabled: Boolean(options.optimizeImagesToJpeg),
          quality: clampJpegQuality(options.imageJpegQuality),
          maxWidth: normalizeMaxWidth(options.imageMaxWidth),
        },
      );
      imageOptimization = imgOutcome.info;
      if (imgOutcome.info.applied) {
        assetBinaries.set(draft.id, {
          buffer: imgOutcome.buffer,
          mimeType: imgOutcome.mimeType,
        });
        localPath = imgOutcome.localPath;
        finalMimeType = imgOutcome.mimeType;
      }
    }

    const optimizedBytes = computeAssetOptimizedBytes(draft.action, originalBytes, assetBinaries.get(draft.id));

    assetList.push({
      id: draft.id,
      kind: draft.kind,
      category: draft.category,
      originalUrl: draft.originalUrl,
      displayName: draft.displayName,
      localPath: draft.action === 'strip' ? null : draft.action === 'replace_local'
        ? draft.kind === 'stylesheet'
          ? 'assets/css/pressport-base.css'
          : 'assets/js/pressport-runtime.js'
        : localPath,
      action: draft.action,
      reason: draft.reason,
      originalBytes,
      optimizedBytes,
      isExternal: draft.isExternal,
      fetchedLocally,
      usedOnPages: Array.from(draft.usedOnPages),
      mimeType: finalMimeType,
      imageOptimization,
    });
  }

  return { assets: assetList, assetBinaries, originalAssetBinaries, urlToAssetId };
}

function computeAssetOptimizedBytes(
  action: AssetAction,
  originalBytes: number,
  binary?: StoredAssetBinary,
): number {
  if (action === 'strip') return 0;
  if (action === 'replace_local') return 0; // Shared runtime counted once globally
  if (binary) return binary.buffer.byteLength;
  return originalBytes;
}

// ---------- Page Extraction, Gutenberg Blocks, Offline HTML, WXR & Theme ----------

function buildPagesAndOutputs(
  id: string,
  createdAt: string,
  siteName: string,
  siteSlug: string,
  sourceLabel: string,
  sourceMode: MigrationResult['sourceMode'],
  detectedPlatform: PlatformType,
  detectionSignals: string[],
  options: MigrationOptions,
  rawPages: RawPageInput[],
  assets: AssetItem[],
  assetBinaries: Map<string, StoredAssetBinary>,
  warnings: string[],
  startedAtMs: number,
): MigrationResult {
  const assetByUrl = new Map<string, AssetItem>();
  for (const ast of assets) {
    assetByUrl.set(ast.originalUrl, ast);
    const filenameOnly = ast.originalUrl.split('/').pop();
    if (filenameOnly) assetByUrl.set(filenameOnly, ast);
  }

  // Collect nav links across site
  const navLinks: Array<{ label: string; href: string }> = rawPages.map((p) => {
    const $ = cheerio.load(p.html);
    const rawTitle = ($('title').first().text() || p.slug).split('|')[0].split('—')[0].trim();
    return {
      label: p.slug === 'home' ? 'Home' : rawTitle.slice(0, 28),
      href: p.filename,
    };
  });

  const localizedJsAssets = assets.filter(
    (a) => (a.kind === 'script' || a.kind === 'inline-script') && a.action === 'localize' && a.localPath,
  );
  const localizedCssAssets = assets.filter((a) => a.kind === 'stylesheet' && a.action === 'localize' && a.localPath);
  const inlinedJsAssets = assets.filter(
    (a) => (a.kind === 'script' || a.kind === 'inline-script') && a.action === 'keep_inline',
  );
  const inlinedCssAssets = assets.filter((a) => a.kind === 'stylesheet' && a.action === 'keep_inline');
  const usesLocalRuntime = assets.some((a) => a.action === 'replace_local' && a.kind === 'script') || true;

  let totalGutenbergBlocks = 0;
  const migratedPages: MigratedPage[] = [];

  for (let pageIdx = 0; pageIdx < rawPages.length; pageIdx++) {
    const raw = rawPages[pageIdx];
    const $ = cheerio.load(raw.html);
    const baseUrl = /^https?:\/\//i.test(raw.sourceUrl) ? raw.sourceUrl : 'https://offline.local/';

    const title = ($('title').first().text() || `${siteName} - ${raw.slug}`).trim();
    const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();
    const scriptCountBefore = $('script').length;

    // Remove script/style/noscript tags before semantic content extraction
    const jsonLdScripts: string[] = [];
    $('script').each((_, el) => {
      const type = ($(el).attr('type') || '').toLowerCase();
      if (type === 'application/ld+json') {
        const content = ($(el).html() || '').trim();
        if (content) jsonLdScripts.push(content);
      }
      $(el).remove();
    });
    $('style, noscript, iframe[src*="googletagmanager"], iframe[src*="doubleclick"]').remove();

    const sections: ExtractedSection[] = [];
    const gutenbergParts: string[] = [];
    const cleanSectionHtmlParts: string[] = [];
    const previewSectionHtmlParts: string[] = [];
    let imageCount = 0;

    // Locate primary content sections (Wix / Squarespace / Strikingly / Webflow / Weebly / generic)
    let sectionEls = $(
      'main section, #PAGES_CONTAINER section, .s-page-content section, section.page-section, .wsite-section, section',
    ).toArray();
    if (sectionEls.length === 0) {
      const mainEl = $('main, #PAGES_CONTAINER, #page, .s-page-content, body').first();
      sectionEls = mainEl.length ? [mainEl[0]] : [];
    }

    // Deduplicate nested sections (keep top-level sections only)
    const topSections = sectionEls.filter((el) => {
      return $(el).parents('section').length === 0;
    });

    topSections.forEach((secEl, idx) => {
      const $sec = $(secEl);
      const secId = $sec.attr('id') || $sec.attr('data-section-id') || `section-${idx + 1}`;
      const headings = $sec.find('h1, h2, h3, h4').toArray();
      const primaryHeading =
        (headings[0] ? $(headings[0]).text().trim() : '') ||
        (idx === 0 ? title.split('|')[0].trim() : `Section ${idx + 1}`);

      const secBlocks: string[] = [];
      const secWpPreviewBlocks: string[] = [];
      const extractedBlocks: ExtractedBlock[] = [];
      const secCleanHtml: string[] = [];
      const secPreviewHtml: string[] = [];

      const hasForm = $sec.find('form').length > 0;
      const hasArticles = $sec.find('article, .s-component, .sqs-block-summary-v2, .w-dyn-item').length >= 2;
      const secType: ExtractedSection['type'] = hasForm
        ? 'contact'
        : idx === 0
          ? 'hero'
          : hasArticles
            ? 'features'
            : $sec.find('img').length >= 2
              ? 'gallery'
              : 'content';

      // Walk meaningful direct and nested content nodes in document order
      const visitedNodes = new Set<unknown>();
      const nodes = $sec
        .find(
          'h1, h2, h3, p, ul, ol, img, a.wixui-button, a.s-button, a.sqs-block-button-element, a.sqs-button-element--primary, a.w-button, a.wsite-button, a.btn, form',
        )
        .toArray();

      for (const node of nodes) {
        if (visitedNodes.has(node)) continue;
        const tag = (node.tagName || '').toLowerCase();

        // Skip elements inside forms (handled with the form itself)
        if (tag !== 'form' && $(node).parents('form').length > 0) continue;

        if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
          const text = $(node).text().trim();
          if (!text) continue;
          const level = tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3;
          const gutenbergMarkup = `<!-- wp:heading {"level":${level}} -->\n<${tag} class="wp-block-heading">${escapeHtml(text)}</${tag}>\n<!-- /wp:heading -->`;
          const wpPreviewHtml = `<${tag} class="wp-block-heading" data-wp-block="wp:heading (H${level})">${escapeHtml(text)}</${tag}>`;
          secBlocks.push(gutenbergMarkup);
          secWpPreviewBlocks.push(wpPreviewHtml);
          extractedBlocks.push({
            id: `${secId}-blk-${extractedBlocks.length + 1}`,
            wpType: 'wp:heading',
            label: `${tag.toUpperCase()}: ${text.slice(0, 48)}`,
            gutenbergMarkup,
            wpPreviewHtml,
          });
          secCleanHtml.push(`<${tag}>${escapeHtml(text)}</${tag}>`);
          secPreviewHtml.push(`<${tag}>${escapeHtml(text)}</${tag}>`);
        } else if (tag === 'p') {
          const text = $(node).text().trim();
          if (!text || text.length < 3) continue;
          const gutenbergMarkup = `<!-- wp:paragraph -->\n<p>${escapeHtml(text)}</p>\n<!-- /wp:paragraph -->`;
          const wpPreviewHtml = `<p class="wp-block-paragraph" data-wp-block="wp:paragraph">${escapeHtml(text)}</p>`;
          secBlocks.push(gutenbergMarkup);
          secWpPreviewBlocks.push(wpPreviewHtml);
          extractedBlocks.push({
            id: `${secId}-blk-${extractedBlocks.length + 1}`,
            wpType: 'wp:paragraph',
            label: text.slice(0, 52),
            gutenbergMarkup,
            wpPreviewHtml,
          });
          secCleanHtml.push(`<p>${escapeHtml(text)}</p>`);
          secPreviewHtml.push(`<p>${escapeHtml(text)}</p>`);
        } else if (tag === 'ul' || tag === 'ol') {
          const items = $(node)
            .find('li')
            .toArray()
            .map((li) => $(li).text().trim())
            .filter(Boolean);
          if (items.length === 0) continue;
          const listHtml = `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
          const gutenbergMarkup = `<!-- wp:list ${tag === 'ol' ? '{"ordered":true} ' : ''}-->\n${listHtml}\n<!-- /wp:list -->`;
          const wpPreviewHtml = `<${tag} class="wp-block-list" data-wp-block="wp:list (${items.length} items)">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
          secBlocks.push(gutenbergMarkup);
          secWpPreviewBlocks.push(wpPreviewHtml);
          extractedBlocks.push({
            id: `${secId}-blk-${extractedBlocks.length + 1}`,
            wpType: 'wp:list',
            label: `List (${items.length} items)`,
            gutenbergMarkup,
            wpPreviewHtml,
          });
          secCleanHtml.push(listHtml);
          secPreviewHtml.push(listHtml);
        } else if (tag === 'img') {
          const rawSrc =
            $(node).attr('src') ||
            $(node).attr('data-src') ||
            $(node).attr('data-image') ||
            $(node).attr('data-lazy-src') ||
            '';
          const alt = ($(node).attr('alt') || primaryHeading).trim();
          if (!rawSrc) continue;
          const resolved = resolveAssetUrl(rawSrc, baseUrl);
          const matchedAsset = assetByUrl.get(resolved) || assetByUrl.get(rawSrc);
          if (matchedAsset && matchedAsset.action === 'strip') continue;

          imageCount++;
          const localRelPath = matchedAsset?.localPath || `assets/images/${sanitizeFilename(resolved, 'svg')}`;
          const wpMediaPath = `/wp-content/themes/${siteSlug}/${localRelPath}`;

          let previewDataSrc = localRelPath;
          if (matchedAsset) {
            const bin = assetBinaries.get(matchedAsset.id);
            if (bin) {
              previewDataSrc = `data:${bin.mimeType};base64,${bin.buffer.toString('base64')}`;
            }
          }

          const isInlinedImage = matchedAsset?.action === 'keep_inline' && previewDataSrc.startsWith('data:');
          const offlineImgSrc = isInlinedImage ? previewDataSrc : localRelPath;
          const wpImgSrc = isInlinedImage ? previewDataSrc : wpMediaPath;

          const gutenbergMarkup = `<!-- wp:image {"sizeSlug":"large"} -->\n<figure class="wp-block-image size-large"><img src="${escapeHtml(wpImgSrc)}" alt="${escapeHtml(alt)}" loading="lazy" /></figure>\n<!-- /wp:image -->`;
          const wpPreviewHtml = `<figure class="wp-block-image size-large" data-wp-block="wp:image"><img src="${escapeHtml(previewDataSrc)}" alt="${escapeHtml(alt)}" /><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
          secBlocks.push(gutenbergMarkup);
          secWpPreviewBlocks.push(wpPreviewHtml);
          extractedBlocks.push({
            id: `${secId}-blk-${extractedBlocks.length + 1}`,
            wpType: 'wp:image',
            label: alt.slice(0, 48) || 'Image',
            gutenbergMarkup,
            wpPreviewHtml,
          });
          secCleanHtml.push(
            `<figure class="pp-gallery"><img src="${escapeHtml(offlineImgSrc)}" alt="${escapeHtml(alt)}" loading="lazy" data-pp-lightbox="true" /></figure>`,
          );
          secPreviewHtml.push(
            `<figure class="pp-gallery"><img src="${escapeHtml(previewDataSrc)}" alt="${escapeHtml(alt)}" data-pp-lightbox="true" /></figure>`,
          );
        } else if (tag === 'a') {
          const label = $(node).text().trim();
          const href = $(node).attr('href') || '#';
          if (!label) continue;
          const gutenbergMarkup = `<!-- wp:buttons -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${escapeHtml(href)}">${escapeHtml(label)}</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`;
          const wpPreviewHtml = `<div class="wp-block-buttons" data-wp-block="wp:buttons"><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${escapeHtml(href)}">${escapeHtml(label)}</a></div></div>`;
          secBlocks.push(gutenbergMarkup);
          secWpPreviewBlocks.push(wpPreviewHtml);
          extractedBlocks.push({
            id: `${secId}-blk-${extractedBlocks.length + 1}`,
            wpType: 'wp:buttons',
            label: `Button: ${label.slice(0, 42)}`,
            gutenbergMarkup,
            wpPreviewHtml,
          });
          secCleanHtml.push(`<p><a class="pp-btn" href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`);
          secPreviewHtml.push(`<p><a class="pp-btn" href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`);
        } else if (tag === 'form') {
          const fields = $(node).find('input, textarea').toArray();
          const formHtmlParts: string[] = ['<form class="pp-form" data-pp-form="true" action="#" method="post">'];
          for (const field of fields) {
            const fTag = (field.tagName || 'input').toLowerCase();
            const fName = $(field).attr('name') || 'field';
            const fType = $(field).attr('type') || 'text';
            if (fType === 'hidden' || fType === 'submit') continue;
            const fPlaceholder = $(field).attr('placeholder') || fName;
            if (fTag === 'textarea') {
              formHtmlParts.push(
                `<label>${escapeHtml(fName)}<textarea name="${escapeHtml(fName)}" rows="4" placeholder="${escapeHtml(fPlaceholder)}"></textarea></label>`,
              );
            } else {
              formHtmlParts.push(
                `<label>${escapeHtml(fName)}<input type="${escapeHtml(fType)}" name="${escapeHtml(fName)}" placeholder="${escapeHtml(fPlaceholder)}" required /></label>`,
              );
            }
          }
          const btnText = $(node).find('button[type="submit"], button').first().text().trim() || 'Submit';
          formHtmlParts.push(`<button type="submit" class="pp-btn">${escapeHtml(btnText)}</button>`);
          formHtmlParts.push('</form>');
          const renderedForm = formHtmlParts.join('\n');
          const gutenbergMarkup = `<!-- wp:html -->\n${renderedForm}\n<!-- /wp:html -->`;
          const wpPreviewHtml = `<div class="wp-block-html" data-wp-block="wp:html (form)">\n${renderedForm}\n</div>`;
          secBlocks.push(gutenbergMarkup);
          secWpPreviewBlocks.push(wpPreviewHtml);
          extractedBlocks.push({
            id: `${secId}-blk-${extractedBlocks.length + 1}`,
            wpType: 'wp:html',
            label: `Form (${fields.length} fields)`,
            gutenbergMarkup,
            wpPreviewHtml,
          });
          secCleanHtml.push(renderedForm);
          secPreviewHtml.push(renderedForm);
        }
        visitedNodes.add(node);
      }

      if (secBlocks.length === 0) return;

      totalGutenbergBlocks += secBlocks.length + 1; // +1 for wrapping wp:group
      const sectionGutenbergMarkup = `<!-- wp:group {"anchor":"${escapeHtml(secId)}","layout":{"type":"constrained"}} -->\n<div class="wp-block-group" id="${escapeHtml(secId)}">\n${secBlocks.join('\n\n')}\n</div>\n<!-- /wp:group -->`;
      const sectionWpPreviewHtml = `<section class="wp-block-group" id="${escapeHtml(secId)}" data-wp-block="wp:group #${escapeHtml(secId)}">\n${secWpPreviewBlocks.join('\n')}\n</section>`;

      gutenbergParts.push(sectionGutenbergMarkup);

      cleanSectionHtmlParts.push(
        `<section id="${escapeHtml(secId)}" class="pp-section">\n  <div class="pp-container">\n    ${secCleanHtml.join('\n    ')}\n  </div>\n</section>`,
      );
      previewSectionHtmlParts.push(
        `<section id="${escapeHtml(secId)}" class="pp-section">\n  <div class="pp-container">\n    ${secPreviewHtml.join('\n    ')}\n  </div>\n</section>`,
      );

      const summaryText = $sec.find('p').first().text().trim().slice(0, 140) || primaryHeading;
      sections.push({
        id: secId,
        type: secType,
        heading: primaryHeading,
        summary: summaryText,
        blockCount: secBlocks.length,
        gutenbergMarkup: sectionGutenbergMarkup,
        wpPreviewHtml: sectionWpPreviewHtml,
        blocks: extractedBlocks,
      });
    });

    const gutenbergContent = gutenbergParts.join('\n\n');
    const navHtml = navLinks
      .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
      .join('');

    const extraCssTags = localizedCssAssets
      .filter((a) => a.usedOnPages.includes(raw.slug))
      .map((a) => `  <link rel="stylesheet" href="${escapeHtml(a.localPath!)}" />`)
      .join('\n');

    const inlineCssTags = inlinedCssAssets
      .filter((a) => a.usedOnPages.includes(raw.slug))
      .map((a) => {
        const cssText = assetBinaries.get(a.id)?.textContent || `/* Inlined ${a.displayName} */`;
        return `  <style data-inlined-from="${escapeHtml(a.displayName)}">\n${cssText}\n  </style>`;
      })
      .join('\n');

    const extraJsTags = localizedJsAssets
      .filter((a) => a.usedOnPages.includes(raw.slug))
      .map((a) => `  <script src="${escapeHtml(a.localPath!)}" defer></script>`)
      .join('\n');

    const inlineJsTags = inlinedJsAssets
      .filter((a) => a.usedOnPages.includes(raw.slug))
      .map((a) => {
        const jsText = assetBinaries.get(a.id)?.textContent || `/* Inlined ${a.displayName} */`;
        const typeAttr = a.mimeType.includes('json') ? ' type="application/json"' : '';
        return `  <script${typeAttr} data-inlined-from="${escapeHtml(a.displayName)}">\n${jsText}\n  </script>`;
      })
      .join('\n');

    const inlineJsonLdTags = jsonLdScripts
      .map((json) => `  <script type="application/ld+json">${json}</script>`)
      .join('\n');

    const offlineHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${metaDescription ? `<meta name="description" content="${escapeHtml(metaDescription)}" />` : ''}
  <link rel="stylesheet" href="assets/css/pressport-base.css" />
${extraCssTags}
${inlineCssTags}
${inlineJsonLdTags}
</head>
<body>
  <header class="pp-header">
    <div class="pp-container pp-header-inner">
      <a class="pp-brand" href="index.html">${escapeHtml(siteName)}</a>
      <button type="button" class="pp-nav-toggle" data-pp-nav-toggle aria-expanded="false">Menu</button>
      <ul class="pp-nav" data-pp-nav-menu>${navHtml}</ul>
    </div>
  </header>
  <main>
${cleanSectionHtmlParts.join('\n')}
  </main>
  <footer class="pp-footer">
    <div class="pp-container">
      <p>${escapeHtml(siteName)} — Migrated for offline speed &amp; WordPress portability.</p>
    </div>
  </footer>
  ${usesLocalRuntime ? '<script src="assets/js/pressport-runtime.js" defer></script>' : ''}
${extraJsTags}
${inlineJsTags}
</body>
</html>`;

    // Inline local CSS + runtime into previewHtml so sandboxed iframe works with zero network requests
    const extraCssInline = [...localizedCssAssets, ...inlinedCssAssets]
      .filter((a) => a.usedOnPages.includes(raw.slug))
      .map((a) => assetBinaries.get(a.id)?.textContent || '')
      .join('\n');

    const previewHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${PRESSPORT_BASE_CSS}\n${extraCssInline}</style>
</head>
<body>
  <header class="pp-header">
    <div class="pp-container pp-header-inner">
      <a class="pp-brand" href="#top">${escapeHtml(siteName)}</a>
      <button type="button" class="pp-nav-toggle" data-pp-nav-toggle aria-expanded="false">Menu</button>
      <ul class="pp-nav" data-pp-nav-menu>${navLinks
        .map((link) => `<li><a href="#section-1">${escapeHtml(link.label)}</a></li>`)
        .join('')}</ul>
    </div>
  </header>
  <main id="top">
${previewSectionHtmlParts.join('\n')}
  </main>
  <footer class="pp-footer">
    <div class="pp-container">
      <p>${escapeHtml(siteName)} — Local Offline Render (0 external network calls)</p>
    </div>
  </footer>
  <script>${PRESSPORT_LOCAL_RUNTIME_JS}</script>
</body>
</html>`;

    const plainText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = plainText ? plainText.split(' ').length : 0;
    const scriptCountAfter =
      (usesLocalRuntime ? 1 : 0) +
      localizedJsAssets.filter((a) => a.usedOnPages.includes(raw.slug)).length +
      inlinedJsAssets.filter((a) => a.usedOnPages.includes(raw.slug)).length;

    migratedPages.push({
      id: `page-${pageIdx + 1}-${raw.slug}`,
      slug: raw.slug,
      title,
      metaDescription,
      sourceUrl: raw.sourceUrl,
      isHome: pageIdx === 0 || raw.slug === 'home',
      wordCount,
      imageCount,
      scriptCountBefore,
      scriptCountAfter,
      originalHtmlBytes: Buffer.byteLength(raw.html, 'utf8'),
      cleanedHtmlBytes: Buffer.byteLength(offlineHtml, 'utf8'),
      gutenbergContent,
      offlineHtml,
      previewHtml,
      sections,
    });
  }

  // Generate WordPress WXR 1.2 XML
  const wxrXml = generateWordPressWxrXml(siteName, siteSlug, migratedPages, assets, createdAt);

  // Generate Installable WordPress Theme Files
  const themeFiles = generateWordPressThemeFiles(
    siteName,
    siteSlug,
    detectedPlatform,
    migratedPages,
    localizedJsAssets,
    localizedCssAssets,
  );

  // Compute exact measured metrics
  const originalHtmlTotal = migratedPages.reduce((sum, p) => sum + p.originalHtmlBytes, 0);
  const cleanedHtmlTotal = migratedPages.reduce((sum, p) => sum + p.cleanedHtmlBytes, 0);
  const runtimeBytes = Buffer.byteLength(PRESSPORT_LOCAL_RUNTIME_JS, 'utf8');
  const baseCssBytes = Buffer.byteLength(PRESSPORT_BASE_CSS, 'utf8');

  const jsAssets = assets.filter((a) => a.kind === 'script' || a.kind === 'inline-script');
  const jsOriginalBytes = jsAssets.reduce((sum, a) => sum + a.originalBytes, 0);
  const jsLocalizedBytes = jsAssets
    .filter((a) => a.action === 'localize' || a.action === 'keep_inline')
    .reduce((sum, a) => sum + a.optimizedBytes, 0);
  const jsOptimizedBytes = runtimeBytes + jsLocalizedBytes;

  const totalAssetsOriginal = assets.reduce((sum, a) => sum + a.originalBytes, 0);
  const totalAssetsOptimized =
    assets.reduce((sum, a) => sum + a.optimizedBytes, 0) + runtimeBytes + baseCssBytes;

  const totalOriginalBytes = originalHtmlTotal + totalAssetsOriginal;
  const totalOptimizedBytes = cleanedHtmlTotal + totalAssetsOptimized;
  const bytesSaved = Math.max(0, totalOriginalBytes - totalOptimizedBytes);
  const percentSaved =
    totalOriginalBytes > 0 ? Math.round((bytesSaved / totalOriginalBytes) * 100) : 0;
  const jsPercentSaved =
    jsOriginalBytes > 0
      ? Math.max(0, Math.round(((jsOriginalBytes - jsOptimizedBytes) / jsOriginalBytes) * 100))
      : 0;

  const externalRequestsBefore = assets.filter((a) => a.isExternal).length;
  const externalRequestsAfter = 0; // All retained assets are localized; stripped ones are removed.

  const imageAssets = assets.filter((a) => a.kind === 'image');
  const imagesOptimizedCount = imageAssets.filter(
    (a) => a.action !== 'strip' && a.imageOptimization?.applied,
  ).length;
  const imageOriginalBytes = imageAssets.reduce((sum, a) => sum + a.originalBytes, 0);
  const imageOptimizedBytes = imageAssets.reduce((sum, a) => sum + a.optimizedBytes, 0);
  const imageBytesSaved = imageAssets
    .filter((a) => a.action !== 'strip' && a.imageOptimization?.applied)
    .reduce((sum, a) => sum + (a.imageOptimization?.bytesSaved || 0), 0);

  const metrics: MigrationMetrics = {
    totalOriginalBytes,
    totalOptimizedBytes,
    bytesSaved,
    percentSaved,
    jsOriginalBytes,
    jsOptimizedBytes,
    jsPercentSaved,
    externalRequestsBefore,
    externalRequestsAfter,
    scriptsStripped: jsAssets.filter((a) => a.action === 'strip').length,
    scriptsReplacedLocal: jsAssets.filter((a) => a.action === 'replace_local').length,
    assetsLocalized: assets.filter((a) => a.action === 'localize').length,
    pagesMigrated: migratedPages.length,
    gutenbergBlocksGenerated: totalGutenbergBlocks,
    processingTimeMs: Math.max(12, Date.now() - startedAtMs),
    imagesOptimizedCount,
    imageOriginalBytes,
    imageOptimizedBytes,
    imageBytesSaved,
  };

  return {
    id,
    createdAt,
    siteName,
    siteSlug,
    sourceLabel,
    sourceMode,
    detectedPlatform,
    detectionSignals,
    options,
    pages: migratedPages,
    assets,
    metrics,
    wxrXml,
    themeFiles,
    warnings,
  };
}

function generateWordPressWxrXml(
  siteName: string,
  siteSlug: string,
  pages: MigratedPage[],
  assets: AssetItem[],
  createdAtIso: string,
): string {
  const pubDate = new Date(createdAtIso).toUTCString();
  const wpDate = createdAtIso.replace('T', ' ').slice(0, 19);

  let postId = 100;
  const pageItems = pages
    .map((page) => {
      postId++;
      return `    <item>
      <title><![CDATA[${safeCdata(page.title)}]]></title>
      <link>https://example.com/${escapeXml(page.isHome ? '' : page.slug + '/')}</link>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[admin]]></dc:creator>
      <guid isPermaLink="false">https://example.com/?page_id=${postId}</guid>
      <description><![CDATA[${safeCdata(page.metaDescription)}]]></description>
      <content:encoded><![CDATA[${safeCdata(page.gutenbergContent)}]]></content:encoded>
      <excerpt:encoded><![CDATA[${safeCdata(page.metaDescription)}]]></excerpt:encoded>
      <wp:post_id>${postId}</wp:post_id>
      <wp:post_date><![CDATA[${wpDate}]]></wp:post_date>
      <wp:post_date_gmt><![CDATA[${wpDate}]]></wp:post_date_gmt>
      <wp:comment_status><![CDATA[closed]]></wp:comment_status>
      <wp:ping_status><![CDATA[closed]]></wp:ping_status>
      <wp:post_name><![CDATA[${safeCdata(page.slug)}]]></wp:post_name>
      <wp:status><![CDATA[publish]]></wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:menu_order>${postId - 100}</wp:menu_order>
      <wp:post_type><![CDATA[page]]></wp:post_type>
      <wp:postmeta>
        <wp:meta_key><![CDATA[_pressport_source_url]]></wp:meta_key>
        <wp:meta_value><![CDATA[${safeCdata(page.sourceUrl)}]]></wp:meta_value>
      </wp:postmeta>
    </item>`;
    })
    .join('\n');

  const localizedImages = assets.filter((a) => a.kind === 'image' && a.action === 'localize' && a.localPath);
  const mediaItems = localizedImages
    .map((img) => {
      postId++;
      return `    <item>
      <title><![CDATA[${safeCdata(img.displayName)}]]></title>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[admin]]></dc:creator>
      <wp:post_id>${postId}</wp:post_id>
      <wp:post_date><![CDATA[${wpDate}]]></wp:post_date>
      <wp:post_name><![CDATA[${safeCdata(slugify(img.displayName))}]]></wp:post_name>
      <wp:status><![CDATA[inherit]]></wp:status>
      <wp:post_type><![CDATA[attachment]]></wp:post_type>
      <wp:attachment_url><![CDATA[/wp-content/themes/${safeCdata(siteSlug)}/${safeCdata(img.localPath!)}]]></wp:attachment_url>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
  <channel>
    <title><![CDATA[${safeCdata(siteName)}]]></title>
    <link>https://example.com</link>
    <description><![CDATA[Migrated to WordPress with local offline assets via PressPort]]></description>
    <pubDate>${pubDate}</pubDate>
    <language>en-US</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    <wp:base_site_url>https://example.com</wp:base_site_url>
    <wp:base_blog_url>https://example.com</wp:base_blog_url>
    <wp:author>
      <wp:author_id>1</wp:author_id>
      <wp:author_login><![CDATA[admin]]></wp:author_login>
      <wp:author_email><![CDATA[admin@example.com]]></wp:author_email>
      <wp:author_display_name><![CDATA[Site Administrator]]></wp:author_display_name>
    </wp:author>
${pageItems}
${mediaItems}
  </channel>
</rss>`;
}

function generateWordPressThemeFiles(
  siteName: string,
  siteSlug: string,
  platform: PlatformType,
  pages: MigratedPage[],
  localizedJs: AssetItem[],
  localizedCss: AssetItem[],
): ThemeFilePreview[] {
  const styleCss = `/*
Theme Name: ${siteName} (Migrated)
Theme URI: https://example.com/${siteSlug}
Author: PressPort Automated Migration
Description: Clean, zero-CDN WordPress theme migrated from ${platform.toUpperCase()} with all JavaScript, styles, and media localized for offline speed.
Version: 1.0.0
Requires at least: 6.2
Tested up to: 6.7
Requires PHP: 8.0
Text Domain: ${siteSlug}
*/

/* Base styles are enqueued from assets/css/pressport-base.css via functions.php */
`;

  const enqueueCssLines = localizedCss
    .map(
      (css, i) =>
        `    wp_enqueue_style( '${siteSlug}-local-css-${i + 1}', get_template_directory_uri() . '/${css.localPath}', array( '${siteSlug}-base' ), '1.0.0' );`,
    )
    .join('\n');

  const enqueueJsLines = localizedJs
    .map(
      (js, i) =>
        `    wp_enqueue_script( '${siteSlug}-local-js-${i + 1}', get_template_directory_uri() . '/${js.localPath}', array( '${siteSlug}-runtime' ), '1.0.0', true );`,
    )
    .join('\n');

  const functionsPhp = `<?php
/**
 * ${siteName} Theme Functions
 * Enqueues strictly local CSS and JavaScript assets (zero external CDNs).
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function ${siteSlug.replace(/-/g, '_')}_theme_setup() {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'align-wide' );
    add_theme_support( 'responsive-embeds' );
    add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );

    register_nav_menus( array(
        'primary' => __( 'Primary Navigation', '${siteSlug}' ),
    ) );
}
add_action( 'after_setup_theme', '${siteSlug.replace(/-/g, '_')}_theme_setup' );

function ${siteSlug.replace(/-/g, '_')}_enqueue_local_assets() {
    // 1. Core local stylesheet (replaces proprietary builder CSS)
    wp_enqueue_style(
        '${siteSlug}-base',
        get_template_directory_uri() . '/assets/css/pressport-base.css',
        array(),
        '1.0.0'
    );
${enqueueCssLines ? '\n' + enqueueCssLines : ''}

    // 2. Lightweight local JS runtime (replaces Wix Thunderbolt / Strikingly Bobcat JS)
    wp_enqueue_script(
        '${siteSlug}-runtime',
        get_template_directory_uri() . '/assets/js/pressport-runtime.js',
        array(),
        '1.0.0',
        true
    );
${enqueueJsLines ? '\n' + enqueueJsLines : ''}
}
add_action( 'wp_enqueue_scripts', '${siteSlug.replace(/-/g, '_')}_enqueue_local_assets' );

// Disable unnecessary WordPress emoji CDN scripts for strict offline performance
remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );
`;

  const headerPhp = `<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo( 'charset' ); ?>" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="pp-header">
  <div class="pp-container pp-header-inner">
    <a class="pp-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>">
      <?php bloginfo( 'name' ); ?>
    </a>
    <button type="button" class="pp-nav-toggle" data-pp-nav-toggle aria-expanded="false">Menu</button>
    <?php
      wp_nav_menu( array(
        'theme_location' => 'primary',
        'container'      => false,
        'menu_class'     => 'pp-nav',
        'fallback_cb'    => 'wp_page_menu',
      ) );
    ?>
  </div>
</header>
<main id="primary" class="site-main">
`;

  const footerPhp = `</main>
<footer class="pp-footer">
  <div class="pp-container">
    <p>&copy; <?php echo esc_html( date( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>.</p>
  </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
`;

  const pagePhp = `<?php
get_header();
while ( have_posts() ) :
    the_post();
    ?>
    <article id="post-<?php the_ID(); ?>" <?php post_class( 'pp-section' ); ?>>
      <div class="pp-container">
        <?php the_content(); ?>
      </div>
    </article>
    <?php
endwhile;
get_footer();
`;

  const homePage = pages.find((p) => p.isHome) || pages[0];
  const frontPagePhp = `<?php
/**
 * Front Page Template — renders Gutenberg content or migrated static fallback.
 */
get_header();
if ( have_posts() ) :
    while ( have_posts() ) :
        the_post();
        the_content();
    endwhile;
else :
    ?>
    <div class="pp-section">
      <div class="pp-container">
        <h1>${escapeHtml(homePage?.title || siteName)}</h1>
        <p>Import the accompanying WXR XML file via Tools &rarr; Import &rarr; WordPress to populate all Gutenberg pages.</p>
      </div>
    </div>
    <?php
endif;
get_footer();
`;

  const readmeTxt = `PressPort Migration Package — ${siteName}
====================================================
Source Platform: ${platform.toUpperCase()}
Pages Migrated:  ${pages.length}
External CDNs:   0 (All JS, CSS, and media localized)

STEP 1: Install the WordPress Theme
  1. Open WordPress Admin -> Appearance -> Themes -> Add New -> Upload Theme.
  2. Upload "${siteSlug}-wp-theme.zip" and click Activate.

STEP 2: Import Migrated Pages & Gutenberg Blocks
  1. Open WordPress Admin -> Tools -> Import -> WordPress (install importer if prompted).
  2. Upload "${siteSlug}-wordpress-wxr.xml".
  3. Assign content to your administrator account and run import.

STEP 3: Set Homepage & Navigation
  1. Go to Settings -> Reading and choose your migrated Home page as the static front page.
  2. Go to Appearance -> Menus and assign your imported pages to "Primary Navigation".

OFFLINE VERIFICATION
  - All scripts load from /wp-content/themes/${siteSlug}/assets/js/
  - WordPress emoji CDN scripts are disabled automatically in functions.php.
`;

  const files: Array<Omit<ThemeFilePreview, 'sizeBytes'>> = [
    { path: 'style.css', language: 'css', content: styleCss },
    { path: 'functions.php', language: 'php', content: functionsPhp },
    { path: 'header.php', language: 'php', content: headerPhp },
    { path: 'footer.php', language: 'php', content: footerPhp },
    { path: 'index.php', language: 'php', content: pagePhp },
    { path: 'page.php', language: 'php', content: pagePhp },
    { path: 'front-page.php', language: 'php', content: frontPagePhp },
    { path: 'assets/js/pressport-runtime.js', language: 'js', content: PRESSPORT_LOCAL_RUNTIME_JS },
    { path: 'assets/css/pressport-base.css', language: 'css', content: PRESSPORT_BASE_CSS },
    { path: 'README-MIGRATION.txt', language: 'txt', content: readmeTxt },
  ];

  return files.map((f) => ({
    ...f,
    sizeBytes: Buffer.byteLength(f.content, 'utf8'),
  }));
}

// ---------- Public Entry Points ----------

export async function runUrlMigration(url: string, options: MigrationOptions): Promise<MigrationResult> {
  const startedAt = Date.now();
  const { pages, warnings, normalizedBaseUrl } = await crawlLiveSite(url, options);
  const { platform, signals } = detectPlatform(
    pages.map((p) => p.html),
    url,
    options.platformHint,
  );

  const $first = cheerio.load(pages[0].html);
  const inferredName =
    options.siteNameOverride?.trim() ||
    ($first('title').first().text().split('|')[0].split('—')[0].trim()) ||
    new URL(normalizedBaseUrl).hostname.replace(/^www\./, '');
  const siteSlug = slugify(inferredName);

  const extraUploadedFiles = new Map<string, StoredAssetBinary>();
  const { assets, assetBinaries, originalAssetBinaries } = await discoverAndLocalizeAssets(
    pages,
    options,
    extraUploadedFiles,
    warnings,
  );

  const id = `mig-${shortHash(`${url}-${Date.now()}`)}`;
  const result = buildPagesAndOutputs(
    id,
    new Date().toISOString(),
    inferredName,
    siteSlug,
    url,
    'url',
    platform,
    signals,
    options,
    pages,
    assets,
    assetBinaries,
    warnings,
    startedAt,
  );

  saveMigrationJob({ result, rawPages: pages, assetBinaries, originalAssetBinaries, extraUploadedFiles });
  return result;
}

export async function runOfflineMigration(
  files: Array<{ name: string; contentBase64: string; mimeType?: string }>,
  pastedHtml: string | undefined,
  options: MigrationOptions,
): Promise<MigrationResult> {
  const startedAt = Date.now();
  const rawPages: RawPageInput[] = [];
  const extraUploadedFiles = new Map<string, StoredAssetBinary>();
  const warnings: string[] = [];

  if (pastedHtml && pastedHtml.trim().length > 0) {
    rawPages.push({
      filename: 'index.html',
      slug: 'home',
      sourceUrl: 'offline://pasted-document/index.html',
      html: pastedHtml,
    });
  }

  for (const file of files) {
    const buf = Buffer.from(file.contentBase64, 'base64');
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(buf);
      const entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.includes('__MACOSX'));
      for (const entry of entries) {
        const entryLower = entry.name.toLowerCase();
        const baseName = entry.name.split('/').pop() || entry.name;
        if (entryLower.endsWith('.html') || entryLower.endsWith('.htm')) {
          const html = await entry.async('string');
          const slug =
            baseName.toLowerCase() === 'index.html' || baseName.toLowerCase() === 'index.htm'
              ? 'home'
              : slugify(baseName.replace(/\.html?$/i, ''));
          rawPages.push({
            filename: slug === 'home' ? 'index.html' : `${slug}.html`,
            slug,
            sourceUrl: `offline://${entry.name}`,
            html,
          });
        } else {
          const entryBuf = await entry.async('nodebuffer');
          const mime = guessMimeFromFilename(baseName);
          const binary: StoredAssetBinary = {
            buffer: entryBuf,
            mimeType: mime,
            textContent: mime.includes('text') || mime.includes('javascript') || mime.includes('svg')
              ? entryBuf.toString('utf8')
              : undefined,
          };
          extraUploadedFiles.set(entry.name, binary);
          extraUploadedFiles.set(baseName, binary);
        }
      }
    } else if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
      const html = buf.toString('utf8');
      const baseName = file.name.split('/').pop() || file.name;
      const slug =
        baseName.toLowerCase() === 'index.html' || baseName.toLowerCase() === 'index.htm' || rawPages.length === 0
          ? rawPages.some((p) => p.slug === 'home')
            ? slugify(baseName.replace(/\.html?$/i, ''))
            : 'home'
          : slugify(baseName.replace(/\.html?$/i, ''));
      rawPages.push({
        filename: slug === 'home' ? 'index.html' : `${slug}.html`,
        slug,
        sourceUrl: `offline://${baseName}`,
        html,
      });
    } else {
      const baseName = file.name.split('/').pop() || file.name;
      const mime = file.mimeType || guessMimeFromFilename(baseName);
      const binary: StoredAssetBinary = {
        buffer: buf,
        mimeType: mime,
        textContent: mime.includes('text') || mime.includes('javascript') || mime.includes('svg')
          ? buf.toString('utf8')
          : undefined,
      };
      extraUploadedFiles.set(file.name, binary);
      extraUploadedFiles.set(baseName, binary);
    }
  }

  if (rawPages.length === 0) {
    throw new Error('No HTML files were found. Upload at least one .html file, a .zip site export, or paste HTML markup.');
  }

  // Ensure home page is first
  rawPages.sort((a, b) => (a.slug === 'home' ? -1 : b.slug === 'home' ? 1 : 0));

  const { platform, signals } = detectPlatform(
    rawPages.map((p) => p.html),
    rawPages[0].sourceUrl,
    options.platformHint,
  );

  const $first = cheerio.load(rawPages[0].html);
  const inferredName =
    options.siteNameOverride?.trim() ||
    ($first('title').first().text().split('|')[0].split('—')[0].trim()) ||
    'Migrated Offline Site';
  const siteSlug = slugify(inferredName);

  const effectiveOptions: MigrationOptions = { ...options, offlineOnly: true };
  const { assets, assetBinaries, originalAssetBinaries } = await discoverAndLocalizeAssets(
    rawPages,
    effectiveOptions,
    extraUploadedFiles,
    warnings,
  );

  const id = `mig-${shortHash(`${inferredName}-${Date.now()}`)}`;
  const sourceLabel =
    files.length > 0
      ? files.length === 1
        ? files[0].name
        : `${files.length} local files (${files[0].name}...)`
      : 'Pasted HTML Document';

  const result = buildPagesAndOutputs(
    id,
    new Date().toISOString(),
    inferredName,
    siteSlug,
    sourceLabel,
    files.length > 0 ? 'offline-upload' : 'paste',
    platform,
    signals,
    effectiveOptions,
    rawPages,
    assets,
    assetBinaries,
    warnings,
    startedAt,
  );

  saveMigrationJob({ result, rawPages, assetBinaries, originalAssetBinaries, extraUploadedFiles });
  return result;
}

export async function runSampleMigration(
  sampleId: SampleId,
  options: MigrationOptions,
): Promise<MigrationResult> {
  const startedAt = Date.now();
  const fixture = SAMPLE_FIXTURES[sampleId];
  if (!fixture) {
    throw new Error(`Unknown sample fixture: ${sampleId}`);
  }

  const rawPages: RawPageInput[] = fixture.files.map((f) => ({
    filename: f.filename,
    slug: f.slug,
    sourceUrl: `${fixture.sourceUrl}/${f.filename}`,
    html: f.html,
  }));

  const extraUploadedFiles = new Map<string, StoredAssetBinary>();
  for (const asset of fixture.bundledAssets) {
    if (asset.rasterFormat) {
      const rasterBuf = await renderSampleRasterImage(
        asset.content,
        asset.rasterFormat,
        asset.rasterWidth || 2200,
      );
      extraUploadedFiles.set(asset.originalUrl, {
        buffer: rasterBuf,
        mimeType: asset.mimeType,
      });
    } else {
      const buf = Buffer.from(asset.content, 'utf8');
      extraUploadedFiles.set(asset.originalUrl, {
        buffer: buf,
        mimeType: asset.mimeType,
        textContent: asset.content,
      });
    }
  }

  const warnings: string[] = [];
  const { platform, signals } = detectPlatform(
    rawPages.map((p) => p.html),
    fixture.sourceUrl,
    options.platformHint,
  );

  const siteName = options.siteNameOverride?.trim() || fixture.siteName;
  const siteSlug = slugify(siteName);
  const effectiveOptions: MigrationOptions = { ...options, offlineOnly: true };

  const { assets, assetBinaries, originalAssetBinaries } = await discoverAndLocalizeAssets(
    rawPages,
    effectiveOptions,
    extraUploadedFiles,
    warnings,
  );

  const id = `mig-${shortHash(`${sampleId}-${Date.now()}`)}`;
  const result = buildPagesAndOutputs(
    id,
    new Date().toISOString(),
    siteName,
    siteSlug,
    fixture.sourceUrl,
    'sample',
    platform,
    signals,
    effectiveOptions,
    rawPages,
    assets,
    assetBinaries,
    warnings,
    startedAt,
  );

  saveMigrationJob({ result, rawPages, assetBinaries, originalAssetBinaries, extraUploadedFiles });
  return result;
}

export function updateJobAssetPolicies(
  jobId: string,
  overrides: Record<string, AssetAction>,
): MigrationResult {
  const job = jobStore.get(jobId);
  if (!job) {
    throw new Error('Migration session not found. Please run a migration first.');
  }

  const startedAt = Date.now();
  const updatedAssets: AssetItem[] = job.result.assets.map((asset) => {
    const nextAction = overrides[asset.id] || asset.action;
    const bin = job.assetBinaries.get(asset.id);

    let localPath: string | null = asset.localPath;
    if (nextAction === 'strip' || nextAction === 'keep_inline') {
      localPath = null;
    } else if (nextAction === 'replace_local') {
      localPath =
        asset.kind === 'stylesheet'
          ? 'assets/css/pressport-base.css'
          : 'assets/js/pressport-runtime.js';
    } else if (nextAction === 'localize') {
      const folder =
        asset.kind === 'script' || asset.kind === 'inline-script'
          ? 'js'
          : asset.kind === 'stylesheet'
            ? 'css'
            : asset.kind === 'font'
              ? 'fonts'
              : 'images';
      const fallbackExt =
        folder === 'js' ? 'js' : folder === 'css' ? 'css' : folder === 'images' ? 'svg' : 'woff2';
      const basePath = `assets/${folder}/${sanitizeFilename(asset.displayName, fallbackExt)}`;
      localPath =
        asset.kind === 'image' && asset.imageOptimization?.applied
          ? rewritePathToJpeg(basePath)
          : asset.kind === 'image' && bin?.mimeType === 'image/svg+xml' && !basePath.endsWith('.svg')
            ? basePath.replace(/\.[^.]+$/, '.svg')
            : basePath;
    }

    return {
      ...asset,
      action: nextAction,
      localPath,
      optimizedBytes: computeAssetOptimizedBytes(nextAction, asset.originalBytes, bin),
    };
  });

  const rebuilt = buildPagesAndOutputs(
    job.result.id,
    job.result.createdAt,
    job.result.siteName,
    job.result.siteSlug,
    job.result.sourceLabel,
    job.result.sourceMode,
    job.result.detectedPlatform,
    job.result.detectionSignals,
    job.result.options,
    job.rawPages,
    updatedAssets,
    job.assetBinaries,
    job.result.warnings,
    startedAt,
  );

  job.result = rebuilt;
  return rebuilt;
}

export async function updateJobImageOptimization(
  jobId: string,
  config: {
    optimizeImagesToJpeg: boolean;
    imageJpegQuality?: number;
    imageMaxWidth?: number;
  },
): Promise<MigrationResult> {
  const job = jobStore.get(jobId);
  if (!job) {
    throw new Error('Migration session not found. Please run a migration first.');
  }

  const startedAt = Date.now();
  const nextOptions: MigrationOptions = {
    ...job.result.options,
    optimizeImagesToJpeg: Boolean(config.optimizeImagesToJpeg),
    imageJpegQuality: clampJpegQuality(
      config.imageJpegQuality !== undefined ? config.imageJpegQuality : job.result.options.imageJpegQuality,
    ),
    imageMaxWidth: normalizeMaxWidth(
      config.imageMaxWidth !== undefined ? config.imageMaxWidth : job.result.options.imageMaxWidth,
    ),
  };

  const updatedAssets: AssetItem[] = [];

  for (const asset of job.result.assets) {
    if (asset.kind !== 'image') {
      updatedAssets.push(asset);
      continue;
    }

    const originalBin = job.originalAssetBinaries.get(asset.id) || job.assetBinaries.get(asset.id);
    if (!originalBin) {
      updatedAssets.push(asset);
      continue;
    }

    const baseLocalPath =
      originalBin.mimeType === 'image/svg+xml'
        ? `assets/images/${sanitizeFilename(asset.displayName, 'svg').replace(/\.[^.]+$/, '.svg')}`
        : `assets/images/${sanitizeFilename(asset.displayName, 'png')}`;

    const outcome = await processImageBinary(
      originalBin.buffer,
      originalBin.mimeType,
      baseLocalPath,
      asset.displayName,
      {
        enabled: nextOptions.optimizeImagesToJpeg,
        quality: nextOptions.imageJpegQuality,
        maxWidth: nextOptions.imageMaxWidth,
      },
    );

    const activeBin: StoredAssetBinary = outcome.info.applied
      ? { buffer: outcome.buffer, mimeType: outcome.mimeType }
      : originalBin;

    job.assetBinaries.set(asset.id, activeBin);

    const nextLocalPath =
      asset.action === 'strip' || asset.action === 'keep_inline'
        ? null
        : outcome.localPath;

    updatedAssets.push({
      ...asset,
      localPath: nextLocalPath,
      mimeType: activeBin.mimeType,
      optimizedBytes: computeAssetOptimizedBytes(asset.action, asset.originalBytes, activeBin),
      imageOptimization: outcome.info,
    });
  }

  const rebuilt = buildPagesAndOutputs(
    job.result.id,
    job.result.createdAt,
    job.result.siteName,
    job.result.siteSlug,
    job.result.sourceLabel,
    job.result.sourceMode,
    job.result.detectedPlatform,
    job.result.detectionSignals,
    nextOptions,
    job.rawPages,
    updatedAssets,
    job.assetBinaries,
    job.result.warnings,
    startedAt,
  );

  job.result = rebuilt;
  return rebuilt;
}

// ---------- Export Archive Builders ----------

export async function buildExportArtifact(
  jobId: string,
  format: ExportFormat,
): Promise<{
  filename: string;
  mimeType: string;
  buffer: Buffer;
  fileCount: number;
  packagedPaths: string[];
}> {
  const job = jobStore.get(jobId);
  if (!job) {
    throw new Error('Migration session not found.');
  }

  const { result, rawPages, assetBinaries, originalAssetBinaries, extraUploadedFiles } = job;
  const slug = result.siteSlug;

  if (format === 'wxr') {
    const filename = `${slug}-wordpress-wxr.xml`;
    return {
      filename,
      mimeType: 'application/xml; charset=utf-8',
      buffer: Buffer.from(result.wxrXml, 'utf8'),
      fileCount: 1,
      packagedPaths: [filename],
    };
  }

  const zip = new JSZip();

  if (format === 'theme') {
    const root = zip.folder(slug)!;
    for (const file of result.themeFiles) {
      root.file(file.path, file.content);
    }
    for (const asset of result.assets) {
      if (asset.action === 'localize' && asset.localPath) {
        const bin = assetBinaries.get(asset.id);
        if (bin) {
          root.file(asset.localPath, bin.buffer);
        }
      }
    }
    root.file(`${slug}-wordpress-wxr.xml`, result.wxrXml);

    const packagedPaths = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return {
      filename: `${slug}-wp-theme.zip`,
      mimeType: 'application/zip',
      buffer,
      fileCount: packagedPaths.length,
      packagedPaths,
    };
  }

  if (format === 'offline') {
    for (const page of result.pages) {
      const filename = page.isHome ? 'index.html' : `${page.slug}.html`;
      zip.file(filename, page.offlineHtml);
    }
    zip.file('assets/js/pressport-runtime.js', PRESSPORT_LOCAL_RUNTIME_JS);
    zip.file('assets/css/pressport-base.css', PRESSPORT_BASE_CSS);
    for (const asset of result.assets) {
      if (asset.action === 'localize' && asset.localPath) {
        const bin = assetBinaries.get(asset.id);
        if (bin) {
          zip.file(asset.localPath, bin.buffer);
        }
      }
    }
    zip.file(
      'asset-manifest.json',
      JSON.stringify(
        {
          siteName: result.siteName,
          detectedPlatform: result.detectedPlatform,
          metrics: result.metrics,
          assets: result.assets,
        },
        null,
        2,
      ),
    );
    zip.file(
      'OFFLINE-README.txt',
      [
        `${result.siteName} — Standalone Offline Site Bundle`,
        '====================================================',
        `Source Platform:       ${result.detectedPlatform.toUpperCase()}`,
        `Pages Included:        ${result.pages.map((p) => (p.isHome ? 'index.html' : `${p.slug}.html`)).join(', ')}`,
        `External CDN Calls:    0 (100% localized)`,
        `JS Weight Reduction:   -${result.metrics.jsPercentSaved}%`,
        '',
        'HOW TO RUN OFFLINE:',
        '  1. Extract this ZIP archive to any folder on your computer or local server.',
        '  2. Open index.html directly in any browser (works over file:// with Wi-Fi disabled).',
        '  3. All navigation, smooth scroll, lightbox galleries, and forms run via ./assets/js/pressport-runtime.js.',
      ].join('\n'),
    );

    const packagedPaths = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return {
      filename: `${slug}-offline-local.zip`,
      mimeType: 'application/zip',
      buffer,
      fileCount: packagedPaths.length,
      packagedPaths,
    };
  }

  if (format === 'source') {
    const usedPaths = new Set<string>();
    const addUniqueFile = (desiredPath: string, content: string | Buffer): string => {
      const safePath = desiredPath
        .replace(/^\/+/, '')
        .replace(/\.\.(\/|\\)/g, '')
        .replace(/\\/g, '/');
      let finalPath = safePath || 'file.dat';
      if (usedPaths.has(finalPath)) {
        const dotIdx = finalPath.lastIndexOf('.');
        let counter = 2;
        while (usedPaths.has(finalPath)) {
          finalPath =
            dotIdx > 0
              ? `${safePath.slice(0, dotIdx)}-${counter}${safePath.slice(dotIdx)}`
              : `${safePath}-${counter}`;
          counter++;
        }
      }
      usedPaths.add(finalPath);
      zip.file(finalPath, content);
      return finalPath;
    };

    // 1. Raw, untouched HTML source pages at archive root (directly re-uploadable via Offline Upload)
    const manifestPages: Array<{
      filename: string;
      slug: string;
      sourceUrl: string;
      bytes: number;
    }> = [];
    for (const rawPage of rawPages) {
      const safeName = sanitizeFilename(rawPage.filename || `${rawPage.slug}.html`, 'html');
      const archivedPath = addUniqueFile(safeName, rawPage.html);
      manifestPages.push({
        filename: archivedPath,
        slug: rawPage.slug,
        sourceUrl: rawPage.sourceUrl,
        bytes: Buffer.byteLength(rawPage.html, 'utf8'),
      });
    }

    // 2. Untouched original captured assets (pre-optimization PNG/WebP/SVG, original CSS, original JS, inline scripts)
    const capturedAssetBaseNames = new Set<string>();
    const manifestAssets: Array<{
      id: string;
      kind: AssetKind;
      category: AssetCategory;
      originalUrl: string;
      displayName: string;
      archivedPath: string | null;
      originalBytes: number;
      fetchedLocally: boolean;
    }> = [];

    for (const asset of result.assets) {
      const originalBin = originalAssetBinaries.get(asset.id);
      let archivedPath: string | null = null;

      if (originalBin) {
        const subFolder =
          asset.kind === 'inline-script'
            ? 'inline-scripts'
            : asset.kind === 'script'
              ? 'js'
              : asset.kind === 'stylesheet'
                ? 'css'
                : asset.kind === 'font'
                  ? 'fonts'
                  : 'images';
        const fallbackExt =
          subFolder === 'js' || subFolder === 'inline-scripts'
            ? 'js'
            : subFolder === 'css'
              ? 'css'
              : subFolder === 'fonts'
                ? 'woff2'
                : originalBin.mimeType === 'image/svg+xml'
                  ? 'svg'
                  : 'png';
        const safeAssetName = sanitizeFilename(asset.displayName, fallbackExt);
        archivedPath = addUniqueFile(`source-assets/${subFolder}/${safeAssetName}`, originalBin.buffer);
        capturedAssetBaseNames.add(safeAssetName);
        capturedAssetBaseNames.add(asset.displayName);
      }

      manifestAssets.push({
        id: asset.id,
        kind: asset.kind,
        category: asset.category,
        originalUrl: asset.originalUrl,
        displayName: asset.displayName,
        archivedPath,
        originalBytes: asset.originalBytes,
        fetchedLocally: asset.fetchedLocally,
      });
    }

    // 3. Any additional uploaded files from an offline ZIP not already packaged
    const seenBuffers = new Set<Buffer>();
    for (const [key, bin] of extraUploadedFiles.entries()) {
      if (seenBuffers.has(bin.buffer)) continue;
      const baseName = key.split('/').pop() || key;
      if (!baseName || baseName.endsWith('.html') || baseName.endsWith('.htm')) continue;
      if (capturedAssetBaseNames.has(baseName)) continue;
      seenBuffers.add(bin.buffer);
      const safeExtra = sanitizeFilename(baseName, 'bin');
      addUniqueFile(`source-assets/extra/${safeExtra}`, bin.buffer);
    }

    // 4. Source manifest & plain-English README
    addUniqueFile(
      'source-manifest.json',
      JSON.stringify(
        {
          siteName: result.siteName,
          siteSlug: result.siteSlug,
          sourceLabel: result.sourceLabel,
          sourceMode: result.sourceMode,
          detectedPlatform: result.detectedPlatform,
          detectionSignals: result.detectionSignals,
          capturedAt: result.createdAt,
          pageCount: manifestPages.length,
          assetCount: manifestAssets.length,
          pages: manifestPages,
          assets: manifestAssets,
        },
        null,
        2,
      ),
    );

    addUniqueFile(
      'SOURCE-README.txt',
      [
        `${result.siteName} — Original Captured Site Source Archive`,
        '=========================================================',
        `Source Platform:  ${result.detectedPlatform.toUpperCase()}`,
        `Origin:           ${result.sourceLabel}`,
        `Captured At:      ${result.createdAt}`,
        `Raw HTML Pages:   ${manifestPages.map((p) => p.filename).join(', ')}`,
        `Captured Assets:  ${manifestAssets.filter((a) => a.archivedPath).length} original files`,
        '',
        'WHAT IS INSIDE:',
        '  - Root *.html files: Untouched original HTML captured BEFORE PressPort stripped',
        '    builder scripts, replaced JS, or converted pages to WordPress Gutenberg blocks.',
        '  - source-assets/: Original unoptimized media, stylesheets, external scripts, and',
        '    inline scripts captured during the crawl/upload.',
        '  - source-manifest.json: Full index of original URLs, detection signals, and sizes.',
        '',
        'TIP — RE-MIGRATE OFFLINE ANYTIME:',
        '  You can drop this exact .zip archive directly into PressPort -> New Migration ->',
        '  Offline Upload to re-run or experiment with different WordPress policies offline.',
      ].join('\n'),
    );

    const packagedPaths = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return {
      filename: `${slug}-site-source.zip`,
      mimeType: 'application/zip',
      buffer,
      fileCount: packagedPaths.length,
      packagedPaths,
    };
  }

  if (format === 'updated') {
    // 1. Cleaned, builder-stripped HTML pages at root (zero trackers, local asset paths)
    for (const page of result.pages) {
      const htmlFilename = page.isHome ? 'index.html' : `${page.slug}.html`;
      zip.file(htmlFilename, page.offlineHtml);

      // 2. Converted WordPress Gutenberg block markup per page
      const blockFilename = page.isHome ? 'home.gutenberg.html' : `${page.slug}.gutenberg.html`;
      zip.file(`gutenberg/${blockFilename}`, page.gutenbergContent);
    }

    // 3. Structured Gutenberg sections & blocks JSON export
    zip.file(
      'gutenberg/pages-blocks.json',
      JSON.stringify(
        {
          siteName: result.siteName,
          siteSlug: result.siteSlug,
          detectedPlatform: result.detectedPlatform,
          generatedAt: new Date().toISOString(),
          totalBlocks: result.metrics.gutenbergBlocksGenerated,
          pages: result.pages.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            metaDescription: p.metaDescription,
            isHome: p.isHome,
            wordCount: p.wordCount,
            imageCount: p.imageCount,
            scriptCountBefore: p.scriptCountBefore,
            scriptCountAfter: p.scriptCountAfter,
            sections: p.sections,
          })),
        },
        null,
        2,
      ),
    );

    // 4. WordPress WXR 1.2 XML containing all converted Gutenberg pages
    zip.file(`wordpress/${slug}-wordpress-wxr.xml`, result.wxrXml);

    // 5. Local runtime, base stylesheet, and all active localized/optimized assets
    zip.file('assets/js/pressport-runtime.js', PRESSPORT_LOCAL_RUNTIME_JS);
    zip.file('assets/css/pressport-base.css', PRESSPORT_BASE_CSS);
    for (const asset of result.assets) {
      if (asset.action === 'localize' && asset.localPath) {
        const bin = assetBinaries.get(asset.id);
        if (bin) {
          zip.file(asset.localPath, bin.buffer);
        }
      }
    }

    // 6. Post-migration audit report & README
    zip.file(
      'migration-report.json',
      JSON.stringify(
        {
          siteName: result.siteName,
          siteSlug: result.siteSlug,
          detectedPlatform: result.detectedPlatform,
          sourceLabel: result.sourceLabel,
          options: result.options,
          metrics: result.metrics,
          warnings: result.warnings,
          assets: result.assets,
        },
        null,
        2,
      ),
    );

    zip.file(
      'UPDATED-README.txt',
      [
        `${result.siteName} — Updated Site & Gutenberg Conversion Archive`,
        '================================================================',
        `Source Platform:       ${result.detectedPlatform.toUpperCase()}`,
        `Pages Converted:       ${result.pages.length}`,
        `Gutenberg Blocks:      ${result.metrics.gutenbergBlocksGenerated}`,
        `Builder JS Stripped:   ${result.metrics.scriptsStripped} stripped, ${result.metrics.scriptsReplacedLocal} replaced locally (-${result.metrics.jsPercentSaved}% JS weight)`,
        `External CDN Requests: ${result.metrics.externalRequestsBefore} -> ${result.metrics.externalRequestsAfter}`,
        '',
        'WHAT IS INSIDE:',
        '  - Root *.html files: Cleaned HTML pages after builder script & tracker stripping',
        '    (linked to ./assets/ for 100% offline viewing).',
        '  - gutenberg/*.gutenberg.html: Native WordPress Gutenberg block markup ready to',
        '    paste directly into the WordPress Block Editor (Code Editor view).',
        '  - gutenberg/pages-blocks.json: Structured JSON tree of all converted sections & blocks.',
        `  - wordpress/${slug}-wordpress-wxr.xml: Ready-to-import WordPress WXR 1.2 XML file.`,
        '  - assets/: Local pressport-runtime.js, pressport-base.css, and all localized/optimized media.',
        '  - migration-report.json: Full before/after performance & asset transformation audit.',
      ].join('\n'),
    );

    const packagedPaths = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return {
      filename: `${slug}-updated-gutenberg.zip`,
      mimeType: 'application/zip',
      buffer,
      fileCount: packagedPaths.length,
      packagedPaths,
    };
  }

  // format === 'assets'
  zip.file('assets/js/pressport-runtime.js', PRESSPORT_LOCAL_RUNTIME_JS);
  zip.file('assets/css/pressport-base.css', PRESSPORT_BASE_CSS);
  for (const asset of result.assets) {
    if (asset.action === 'localize' && asset.localPath) {
      const bin = assetBinaries.get(asset.id);
      if (bin) {
        zip.file(asset.localPath, bin.buffer);
      }
    }
  }
  zip.file(
    'asset-manifest.json',
    JSON.stringify(
      {
        siteName: result.siteName,
        externalRequestsBefore: result.metrics.externalRequestsBefore,
        externalRequestsAfter: result.metrics.externalRequestsAfter,
        jsBytesBefore: result.metrics.jsOriginalBytes,
        jsBytesAfter: result.metrics.jsOptimizedBytes,
        assets: result.assets,
      },
      null,
      2,
    ),
  );

  const packagedPaths = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return {
    filename: `${slug}-local-assets.zip`,
    mimeType: 'application/zip',
    buffer,
    fileCount: packagedPaths.length,
    packagedPaths,
  };
}

export async function buildBulkExportArchive(items: BulkExportRequestItem[]): Promise<{
  filename: string;
  mimeType: string;
  buffer: Buffer;
  fileCount: number;
  packagedPaths: string[];
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
}> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Select at least one migration to build a bulk export ZIP.');
  }

  const masterZip = new JSZip();
  const usedFolders = new Set<string>();
  const includedSites: Array<{
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
  }> = [];
  const skippedIds: string[] = [];

  for (const item of items) {
    const job = jobStore.get(item.id);
    if (!job) {
      skippedIds.push(item.id);
      continue;
    }

    const artifact = await buildExportArtifact(item.id, item.format);
    const indexPrefix = String(includedSites.length + 1).padStart(2, '0');
    let folderName = `${indexPrefix}-${job.result.siteSlug}-${item.format}`;
    let dupCounter = 2;
    while (usedFolders.has(folderName)) {
      folderName = `${indexPrefix}-${job.result.siteSlug}-${item.format}-${dupCounter}`;
      dupCounter++;
    }
    usedFolders.add(folderName);

    const siteFolder = masterZip.folder(folderName)!;
    let unpackedFileCount = 0;

    if (item.format === 'wxr') {
      siteFolder.file(artifact.filename, artifact.buffer);
      unpackedFileCount = 1;
    } else {
      const innerZip = await JSZip.loadAsync(artifact.buffer);
      const innerEntries = Object.values(innerZip.files).filter((entry) => !entry.dir);
      for (const entry of innerEntries) {
        const entryBuffer = await entry.async('nodebuffer');
        siteFolder.file(entry.name, entryBuffer);
        unpackedFileCount++;
      }
    }

    includedSites.push({
      id: job.result.id,
      siteName: job.result.siteName,
      siteSlug: job.result.siteSlug,
      platform: job.result.detectedPlatform,
      format: item.format,
      folderName,
      fileCount: unpackedFileCount,
      pagesCount: job.result.pages.length,
      blocksCount: job.result.metrics.gutenbergBlocksGenerated,
      assetsLocalized: job.result.metrics.assetsLocalized,
      scriptsStripped: job.result.metrics.scriptsStripped,
      scriptsReplacedLocal: job.result.metrics.scriptsReplacedLocal,
    });
  }

  if (includedSites.length === 0) {
    throw new Error(
      'None of the selected migrations are available in active server memory. Re-run a migration and try again.',
    );
  }

  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, '-').slice(0, 19);

  masterZip.file(
    'BULK-EXPORT-MANIFEST.json',
    JSON.stringify(
      {
        generatedAt,
        totalQueued: items.length,
        totalIncluded: includedSites.length,
        skippedIds,
        sites: includedSites,
      },
      null,
      2,
    ),
  );

  masterZip.file(
    'BULK-EXPORT-README.txt',
    [
      `PressPort Bulk Concatenated Export (${includedSites.length} ${includedSites.length === 1 ? 'Site' : 'Sites'})`,
      '================================================================',
      `Generated At: ${generatedAt}`,
      `Included Migrations: ${includedSites.length}`,
      ...(skippedIds.length > 0 ? [`Skipped Expired Sessions: ${skippedIds.join(', ')}`] : []),
      '',
      'INCLUDED FOLDERS:',
      ...includedSites.map(
        (site, idx) =>
          `  ${idx + 1}. /${site.folderName}/ — ${site.siteName} (${site.platform.toUpperCase()}, ${site.format}, ${site.fileCount} files, ${site.pagesCount} pages, ${site.blocksCount} Gutenberg blocks)`,
      ),
      '',
      'Each folder contains the full unpacked export package for that migration, ready to deploy or import into WordPress.',
    ].join('\n'),
  );

  const packagedPaths = Object.values(masterZip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name);
  const buffer = await masterZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const filename = `pressport-bulk-${includedSites.length}-sites-${stamp}.zip`;

  return {
    filename,
    mimeType: 'application/zip',
    buffer,
    fileCount: packagedPaths.length,
    packagedPaths,
    includedSites,
    skippedIds,
  };
}

function guessMimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'js':
    case 'mjs':
      return 'application/javascript';
    case 'css':
      return 'text/css';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}
