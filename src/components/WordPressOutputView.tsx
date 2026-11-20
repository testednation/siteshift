import { useState } from 'react';
import { Check, Copy, Download, FileCode2, FileText, FolderArchive, Loader2 } from 'lucide-react';
import type { ExportFormat } from '../App';
import type { MigrationResult } from '../types/migration';
import { formatBytes } from '../utils/format';
import { InfoTooltip } from './InfoTooltip';

function describeWpFile(filePath: string | undefined, wxrKey: string): string {
  if (!filePath) return '';
  if (filePath === wxrKey || filePath.endsWith('.xml')) {
    return 'WordPress import file (WXR 1.2): upload via WP Admin → Tools → Import → WordPress to create all your pages and Gutenberg blocks.';
  }
  if (filePath === 'functions.php') {
    return 'Theme control file: registers menus, enables Gutenberg editor support, loads your local JS/CSS via wp_enqueue_script(), and disables remote WP emoji scripts.';
  }
  if (filePath === 'style.css') {
    return 'Theme identity header: tells WordPress your theme’s name, version, and author so it appears in Appearance → Themes.';
  }
  if (filePath === 'header.php') {
    return 'Shared top template: outputs the <head> tags, site title, and primary navigation bar shown across every WordPress page.';
  }
  if (filePath === 'footer.php') {
    return 'Shared bottom template: renders the site footer and triggers wp_footer() so local scripts load cleanly at the bottom of the page.';
  }
  if (filePath === 'front-page.php') {
    return 'Homepage template: renders your migrated home page content when set as the Static Front Page in WordPress Settings → Reading.';
  }
  if (filePath === 'page.php') {
    return 'Standard page template: displays the Gutenberg block content for every sub-page imported from your old site.';
  }
  if (filePath === 'index.php') {
    return 'Fallback WordPress template: required by every valid WordPress theme to display posts or pages if a more specific template isn’t matched.';
  }
  if (filePath.includes('pressport-runtime.js')) {
    return 'Lightweight 3.5 KB local JavaScript replacement for heavy Wix/Squarespace/Strikingly runtimes—handles mobile menus, smooth scroll, lightboxes, and forms offline.';
  }
  if (filePath.includes('pressport-base.css')) {
    return 'Local base stylesheet: provides clean responsive typography, spacing, and Gutenberg block styling with zero external CDN requests.';
  }
  if (filePath.toLowerCase().includes('readme')) {
    return 'Step-by-step installation notes bundled inside your ZIP so you can reference import steps offline anytime.';
  }
  return 'Generated local asset bundled directly inside your WordPress theme folder so your site runs fast and offline.';
}

interface WordPressOutputViewProps {
  migration: MigrationResult;
  downloadingFormat: ExportFormat | null;
  onDownload: (format: ExportFormat) => void;
}

export function WordPressOutputView({
  migration,
  downloadingFormat,
  onDownload,
}: WordPressOutputViewProps) {
  const [selectedPath, setSelectedPath] = useState<string>('functions.php');
  const [copied, setCopied] = useState(false);

  const wxrKey = `${migration.siteSlug}-wordpress-wxr.xml`;

  const activeFile =
    selectedPath === wxrKey
      ? {
          path: wxrKey,
          language: 'xml' as const,
          sizeBytes: new Blob([migration.wxrXml]).size,
          content: migration.wxrXml,
        }
      : migration.themeFiles.find((f) => f.path === selectedPath) || migration.themeFiles[0];

  const handleCopy = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-slate-950">
              Generated WordPress Theme &amp; WXR 1.2 XML
            </h1>
            <InfoTooltip
              title="Theme Files vs. WXR 1.2 XML"
              content="In WordPress, the Theme (.zip) controls your site's layout, CSS, and local scripts, while the WXR 1.2 (.xml) file imports your actual pages and editable Gutenberg blocks."
              tip="You don't need to edit these files manually—just inspect them here if you're curious, then download from Export & Deploy."
            />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Inspect every PHP template, local script enqueue in <code className="font-mono text-xs">functions.php</code>,
            and the Gutenberg WXR import file before downloading.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={downloadingFormat !== null}
            onClick={() => onDownload('offline')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {downloadingFormat === 'offline' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <FolderArchive className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Download Offline ZIP
          </button>
          <button
            type="button"
            disabled={downloadingFormat !== null}
            onClick={() => onDownload('wxr')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download WXR XML
          </button>
          <button
            type="button"
            disabled={downloadingFormat !== null}
            onClick={() => onDownload('theme')}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
          >
            {downloadingFormat === 'theme' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Download WP Theme (.zip)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* File Explorer */}
        <div className="rounded-lg border border-slate-200 bg-white lg:col-span-4">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="font-mono text-xs font-semibold text-slate-900">
              {migration.siteSlug}/
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {migration.themeFiles.length + 1} generated files · WordPress 6.x compatible
            </div>
          </div>

          <ul className="divide-y divide-slate-100">
            <li>
              <button
                type="button"
                onClick={() => setSelectedPath(wxrKey)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                  selectedPath === wxrKey ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2 truncate font-mono text-xs font-medium">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                  <span className="truncate">{wxrKey}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                  {formatBytes(new Blob([migration.wxrXml]).size)}
                </span>
              </button>
            </li>

            {migration.themeFiles.map((file) => {
              const isSelected = activeFile?.path === file.path;
              return (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => setSelectedPath(file.path)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate font-mono text-xs font-medium">
                      <FileText
                        className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{file.path}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Code Viewer */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="min-w-0">
              <span className="font-mono text-xs font-semibold text-slate-900">
                {activeFile?.path}
              </span>
              <span className="ml-2 font-mono text-xs text-slate-500 tabular-nums">
                {activeFile ? formatBytes(activeFile.sizeBytes) : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy File
                </>
              )}
            </button>
          </div>
          {activeFile && (
            <div className="border-b border-slate-200 bg-blue-50/50 px-4 py-2 text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-blue-900">What this file does:</span>{' '}
              {describeWpFile(activeFile.path, wxrKey)}
            </div>
          )}
          <pre className="h-[590px] overflow-auto bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-100">
            <code>{activeFile?.content || ''}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
