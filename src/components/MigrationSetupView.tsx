import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  FileArchive,
  FileCode,
  Globe,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { MigrationOptions, PlatformType, SampleId } from '../types/migration';
import { formatBytes } from '../utils/format';
import { InfoTooltip } from './InfoTooltip';

type SourceTab = 'url' | 'offline' | 'paste';

const TUTORIAL_BANNER_STORAGE_KEY = 'pressport_hide_tutorial_banner_v1';

interface UploadedLocalFile {
  name: string;
  size: number;
  mimeType: string;
  contentBase64: string;
}

interface MigrationSetupViewProps {
  loading: boolean;
  error: string | null;
  onRunUrl: (url: string, options: MigrationOptions) => Promise<void>;
  onRunOffline: (
    files: Array<{ name: string; contentBase64: string; mimeType?: string }>,
    pastedHtml: string | undefined,
    options: MigrationOptions,
  ) => Promise<void>;
  onRunSample: (sampleId: SampleId, options: MigrationOptions) => Promise<void>;
  onOpenTutorial?: () => void;
}

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
  siteNameOverride: '',
};

function readFileAsBase64(file: File): Promise<UploadedLocalFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        contentBase64: base64,
      });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function MigrationSetupView({
  loading,
  error,
  onRunUrl,
  onRunOffline,
  onRunSample,
  onOpenTutorial,
}: MigrationSetupViewProps) {
  const [sourceTab, setSourceTab] = useState<SourceTab>('url');
  const [urlInput, setUrlInput] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedLocalFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [options, setOptions] = useState<MigrationOptions>(DEFAULT_OPTIONS);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(TUTORIAL_BANNER_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    try {
      window.localStorage.setItem(TUTORIAL_BANNER_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    const loaded = await Promise.all(filesArray.map(readFileAsBase64));
    setUploadedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const deduped = loaded.filter((f) => !existingNames.has(f.name));
      return [...prev, ...deduped];
    });
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    await handleFilesSelected(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    await handleFilesSelected(e.dataTransfer.files);
  };

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (sourceTab === 'url') {
      await onRunUrl(urlInput, options);
    } else if (sourceTab === 'offline') {
      await onRunOffline(
        uploadedFiles.map((f) => ({
          name: f.name,
          contentBase64: f.contentBase64,
          mimeType: f.mimeType,
        })),
        undefined,
        { ...options, offlineOnly: true },
      );
    } else {
      await onRunOffline([], pastedHtml, { ...options, offlineOnly: true });
    }
  };

  const canSubmit =
    !loading &&
    ((sourceTab === 'url' && urlInput.trim().length > 3) ||
      (sourceTab === 'offline' && uploadedFiles.length > 0) ||
      (sourceTab === 'paste' && pastedHtml.trim().length > 20));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Intro Header */}
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Migrate Wix, Squarespace, Strikingly &amp; Webflow to WordPress
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
          Crawl a live site or upload saved HTML/ZIP exports offline. PressPort strips proprietary builder runtimes
          (Wix Thunderbolt, Squarespace SQS, Strikingly Bobcat, Webflow, Weebly), replaces external JavaScript with
          lightweight local assets, and exports an installable WordPress theme, WXR 1.2 XML, or Offline ZIP.
        </p>
      </div>

      {/* Non-blocking Beginner Quick-Start Strip */}
      {onOpenTutorial && !bannerDismissed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              <strong className="font-semibold text-slate-900">First time migrating to WordPress?</strong>{' '}
              Follow our 4-step Beginner Tutorial or hover any info icon for plain-English explanations.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenTutorial}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              Open Beginner Tutorial
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Dismiss beginner guide strip"
              className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span className="font-semibold">Migration error:</span> {error}
        </div>
      )}

      {/* Main Split Grid: Source Intake + Optimization Rules */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Source Input */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-base font-semibold text-slate-900">1. Choose Site Source</h2>
                <InfoTooltip
                  title="Choosing a Site Source"
                  content="Use Live URL for published websites, Offline Upload for saved .html or .zip folders on your computer, or Paste HTML for a single page's source code."
                  tip="If a site blocks automated crawlers, save the page in Chrome (Ctrl/Cmd+S → Webpage, Complete), zip the folder, and use Offline Upload."
                />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Works with live public URLs or 100% offline local HTML/ZIP exports.
              </p>
            </div>
            {/* Interactive Source Segmented Control */}
            <div
              role="tablist"
              aria-label="Source input mode"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sourceTab === 'url'}
                onClick={() => setSourceTab('url')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sourceTab === 'url'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                Live URL
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sourceTab === 'offline'}
                onClick={() => setSourceTab('offline')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sourceTab === 'offline'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Offline Upload
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sourceTab === 'paste'}
                onClick={() => setSourceTab('paste')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sourceTab === 'paste'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
                Paste HTML
              </button>
            </div>
          </div>

          <div className="mt-5">
            {sourceTab === 'url' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="site-url" className="block text-sm font-medium text-slate-800">
                    Website URL (Wix, Squarespace, Strikingly, Webflow, Weebly)
                  </label>
                  <input
                    id="site-url"
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://atelier.squarespace.com or https://studio.wixsite.com/mysite"
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Automatically discovers internal pages, identifies builder DOM &amp; CDN signatures, and downloads
                    assets locally.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="max-pages" className="block text-sm font-medium text-slate-800">
                        Crawl Page Limit
                      </label>
                      <InfoTooltip
                        title="Crawl Page Limit"
                        content="Controls how many internal pages PressPort follows from your starting URL. Start with 1–3 pages to test the output quickly, or pick up to 10 pages for a fuller site crawl."
                      />
                    </div>
                    <select
                      id="max-pages"
                      value={options.maxPages}
                      onChange={(e) => setOptions((o) => ({ ...o, maxPages: Number(e.target.value) }))}
                      className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      <option value={1}>Single page only (1 page)</option>
                      <option value={3}>Small site (up to 3 pages)</option>
                      <option value={5}>Standard crawl (up to 5 pages)</option>
                      <option value={10}>Full crawl (up to 10 pages)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="platform-hint" className="block text-sm font-medium text-slate-800">
                        Source Platform Detection
                      </label>
                      <InfoTooltip
                        title="Source Platform Detection"
                        content="PressPort automatically detects whether your site was built on Wix, Squarespace, Strikingly, Webflow, or Weebly so it can strip each builder's specific scripts cleanly."
                        tip="Leave on Auto-detect unless your site uses a custom domain with hidden builder tags."
                      />
                    </div>
                    <select
                      id="platform-hint"
                      value={options.platformHint}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, platformHint: e.target.value as 'auto' | PlatformType }))
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      <option value="auto">Auto-detect (Wix / Squarespace / Strikingly / Webflow / Weebly)</option>
                      <option value="squarespace">Force Squarespace parser rules</option>
                      <option value="wix">Force Wix parser rules</option>
                      <option value="strikingly">Force Strikingly parser rules</option>
                      <option value="webflow">Force Webflow parser rules</option>
                      <option value="weebly">Force Weebly parser rules</option>
                      <option value="html">Standard HTML / Static site</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {sourceTab === 'offline' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    dragActive
                      ? 'border-blue-600 bg-blue-50/60'
                      : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
                  }`}
                >
                  <FileArchive className="h-8 w-8 text-slate-500" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-slate-900">
                    Drop Wix, Squarespace, Strikingly, Webflow, or Weebly HTML/ZIP exports here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Supports single or multi-page .html files, local images/CSS/JS, or complete .zip archives. Runs
                    100% offline.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".html,.htm,.zip,.css,.js,.svg,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileInputChange}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    Browse Local Files
                  </button>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                    {uploadedFiles.map((file) => (
                      <div key={file.name} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-medium text-slate-900">{file.name}</p>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {formatBytes(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(file.name)}
                          aria-label={`Remove ${file.name}`}
                          className="ml-3 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sourceTab === 'paste' && (
              <div>
                <label htmlFor="paste-html" className="block text-sm font-medium text-slate-800">
                  Raw Page HTML Source (Offline)
                </label>
                <textarea
                  id="paste-html"
                  rows={9}
                  value={pastedHtml}
                  onChange={(e) => setPastedHtml(e.target.value)}
                  placeholder="<!doctype html>&#10;<html>&#10;  <head>...</head>&#10;  <body>Paste your saved Wix, Squarespace, Strikingly, Webflow, or Weebly page source here...</body>&#10;</html>"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            )}

            {/* Optional WordPress Site Name Override */}
            <div className="mt-5 border-t border-slate-200 pt-5">
              <label htmlFor="site-name-override" className="block text-sm font-medium text-slate-800">
                WordPress Theme &amp; Site Name <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="site-name-override"
                type="text"
                value={options.siteNameOverride || ''}
                onChange={(e) => setOptions((o) => ({ ...o, siteNameOverride: e.target.value }))}
                placeholder="Auto-detected from page <title>"
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Migrating &amp; Localizing Assets...
                  </>
                ) : (
                  <>
                    Start Migration
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: JS Replacement & Local Asset Policies */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 lg:col-span-5">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              2. JS Replacement &amp; Local Assets
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Configure how external scripts and media are transformed for offline speed.
            </p>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            <PolicyToggle
              id="opt-replace-platform"
              checked={options.replacePlatformJs}
              onChange={(checked) => setOptions((o) => ({ ...o, replacePlatformJs: checked }))}
              title="Replace site-builder runtime JS"
              description="Replaces heavy Wix Thunderbolt, Squarespace universal JS, Strikingly Bobcat, Webflow, and Weebly bundles with our 3.5 KB local runtime."
              tooltip={{
                title: 'Why replace builder JavaScript?',
                content:
                  'Hosted builders ship hundreds of kilobytes of proprietary code that only works on their servers. Replacing it with pressport-runtime.js keeps mobile menus, lightboxes, and forms working offline.',
                tip: 'Recommended for almost all WordPress migrations.',
              }}
            />
            <PolicyToggle
              id="opt-strip-trackers"
              checked={options.stripTrackers}
              onChange={(checked) => setOptions((o) => ({ ...o, stripTrackers: checked }))}
              title="Strip telemetry & third-party trackers"
              description="Removes Frog BI, Squarespace performance scripts, Mixpanel, Segment, Tag Manager, and proprietary JSON hydration blobs."
              tooltip={{
                title: 'Removing Trackers & Telemetry',
                content:
                  'Deletes analytics beacons and hidden builder metadata that slow down page loads and fail when running offline. You can add fresh WordPress analytics plugins later if needed.',
              }}
            />
            <PolicyToggle
              id="opt-localize-js"
              checked={options.localizeExternalJs}
              onChange={(checked) => setOptions((o) => ({ ...o, localizeExternalJs: checked }))}
              title="Localize custom & widget JavaScript"
              description="Downloads remaining external scripts into assets/js/ and registers them via wp_enqueue_script()."
              tooltip={{
                title: 'Localizing Custom Scripts',
                content:
                  'Saves any remaining custom scripts inside your WordPress theme folder and loads them the official WordPress way via functions.php so nothing relies on external hosts.',
              }}
            />
            <PolicyToggle
              id="opt-localize-css"
              checked={options.localizeStylesAndFonts}
              onChange={(checked) => setOptions((o) => ({ ...o, localizeStylesAndFonts: checked }))}
              title="Bundle local CSS & disable WP emoji CDN"
              description="Rewrites stylesheets to local theme paths and removes default remote WordPress head scripts."
              tooltip={{
                title: 'Local CSS & WP Emoji Cleanup',
                content:
                  'Copies stylesheets locally into your theme and disables WordPress’s default external emoji script request so your pages achieve zero third-party network requests.',
              }}
            />
            <PolicyToggle
              id="opt-localize-img"
              checked={options.localizeImages}
              onChange={(checked) => setOptions((o) => ({ ...o, localizeImages: checked }))}
              title="Localize images for offline rendering"
              description="Rewrites wixstatic.com, squarespace-cdn.com, strikinglycdn.com, and website-files.com media URLs to local assets/images/."
              tooltip={{
                title: 'Why localize images?',
                content:
                  'If your old Wix or Squarespace subscription ends, hotlinked images on their CDN stop loading. Localizing saves every image inside your export so you own them permanently.',
              }}
            />
            <PolicyToggle
              id="opt-optimize-jpeg"
              checked={options.optimizeImagesToJpeg}
              onChange={(checked) => setOptions((o) => ({ ...o, optimizeImagesToJpeg: checked }))}
              title="Optimize high-res images to progressive JPEG"
              description="Compresses and converts WebP and heavy PNG images into progressive JPEGs (82% quality, max 1600px wide) during migration. Can also be toggled anytime in Assets & Scripts."
              tooltip={{
                title: 'Image Optimizer (Progressive JPEG)',
                content:
                  'Automatically resizes oversized images and converts heavy PNG or WebP files into fast-loading progressive JPEGs. Crisp SVG logos and icons are kept untouched.',
                tip: 'You can also toggle this and adjust quality anytime later inside Assets & Scripts.',
              }}
            />
          </div>
        </div>
      </form>

      {/* Instant Offline Test Blueprints */}
      <section aria-labelledby="sample-blueprints-heading" className="border-t border-slate-200 pt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="sample-blueprints-heading" className="font-display text-base font-semibold text-slate-900">
              Test the pipeline offline with authentic exports
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Run the full parser, JS replacement engine, Gutenberg converter, and WordPress ZIP builder without an
              external URL.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">Squarespace 7.1 Export</span>
                <span aria-hidden="true">·</span>
                <span>2 pages</span>
                <span aria-hidden="true">·</span>
                <span>Fluid Engine &amp; SQS blocks</span>
              </div>
              <h3 className="mt-1.5 font-display text-base font-semibold text-slate-950">
                Kanso Ceramic Atelier
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                Includes Squarespace universal scripts, Static.SQUARESPACE_CONTEXT blob, performance telemetry, lazy
                data-src imagery, and custom schedule JS.
              </p>
            </div>
            <div className="mt-4 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => onRunSample('squarespace-editorial', options)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                Migrate Squarespace Sample
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">Wix Studio Export</span>
                <span aria-hidden="true">·</span>
                <span>3 pages</span>
                <span aria-hidden="true">·</span>
                <span>Thunderbolt &amp; BI scripts</span>
              </div>
              <h3 className="mt-1.5 font-display text-base font-semibold text-slate-950">
                Northline Architecture Studio
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                Includes Wix Thunderbolt bundles, Parastorage React UMD, Frog BI telemetry, inline viewerModel JSON, and
                multi-page navigation.
              </p>
            </div>
            <div className="mt-4 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => onRunSample('wix-studio', options)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                Migrate Wix Sample
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">Strikingly Export</span>
                <span aria-hidden="true">·</span>
                <span>Multi-section landing page</span>
                <span aria-hidden="true">·</span>
                <span>Bobcat &amp; trackers</span>
              </div>
              <h3 className="mt-1.5 font-display text-base font-semibold text-slate-950">
                PacketDock Launch Site
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                Includes Strikingly Bobcat runtime, s-section DOM markup, Mixpanel &amp; Segment trackers, and a custom
                pricing helper script.
              </p>
            </div>
            <div className="mt-4 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => onRunSample('strikingly-launch', options)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                Migrate Strikingly Sample
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">Webflow Export</span>
                <span aria-hidden="true">·</span>
                <span>2 pages</span>
                <span aria-hidden="true">·</span>
                <span>webflow.js &amp; GTM</span>
              </div>
              <h3 className="mt-1.5 font-display text-base font-semibold text-slate-950">
                Gridline Telemetry
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                Includes Webflow runtime chunks, Google Tag Manager, website-files.com CDN media, w-richtext sections,
                and custom latency script.
              </p>
            </div>
            <div className="mt-4 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => onRunSample('webflow-saas', options)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                Migrate Webflow Sample
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface PolicyToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  tooltip?: {
    title: string;
    content: string;
    tip?: string;
  };
}

function PolicyToggle({ id, checked, onChange, title, description, tooltip }: PolicyToggleProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-3.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
      />
      <span className="min-w-0">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900">
          <span>{title}</span>
          {tooltip && (
            <InfoTooltip title={tooltip.title} content={tooltip.content} tip={tooltip.tip} />
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </label>
  );
}
