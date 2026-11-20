import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileCode,
  FolderArchive,
  Grid2x2,
  Layers,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react';
import type { ExportFormat } from '../App';
import type { ExtractedBlock, ExtractedSection, MigrationResult } from '../types/migration';
import { formatBytes, formatPlatformLabel } from '../utils/format';
import { buildWpInstantPreviewDoc } from '../utils/wpInstantPreview';
import { InfoTooltip } from './InfoTooltip';

interface PagesBlocksViewProps {
  migration: MigrationResult;
  downloadingFormat: ExportFormat | null;
  onDownload: (format: ExportFormat) => void;
}

type InspectorMode = 'instant' | 'theme' | 'gutenberg' | 'html';
type ViewportWidth = 'full' | 'tablet' | 'mobile';

type PreviewSelection =
  | { scope: 'page' }
  | { scope: 'section'; sectionId: string }
  | { scope: 'block'; sectionId: string; blockId: string };

export function PagesBlocksView({
  migration,
  downloadingFormat,
  onDownload,
}: PagesBlocksViewProps) {
  const [selectedPageId, setSelectedPageId] = useState<string>(migration.pages[0]?.id || '');
  const [selection, setSelection] = useState<PreviewSelection>({ scope: 'page' });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const firstSectionId = migration.pages[0]?.sections[0]?.id;
    return firstSectionId ? new Set([firstSectionId]) : new Set();
  });
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('instant');
  const [showBlockOutlines, setShowBlockOutlines] = useState(true);
  const [viewportWidth, setViewportWidth] = useState<ViewportWidth>('full');
  const [copied, setCopied] = useState(false);

  // Sync selected page & reset selection when switching migrations
  useEffect(() => {
    const firstPage = migration.pages[0];
    setSelectedPageId(firstPage?.id || '');
    setSelection({ scope: 'page' });
    const firstSec = firstPage?.sections[0]?.id;
    setExpandedSections(firstSec ? new Set([firstSec]) : new Set());
  }, [migration.id]);

  const selectedPage =
    migration.pages.find((p) => p.id === selectedPageId) || migration.pages[0];

  const activeSection: ExtractedSection | null = useMemo(() => {
    if (!selectedPage || selection.scope === 'page') return null;
    return selectedPage.sections.find((s) => s.id === selection.sectionId) || null;
  }, [selectedPage, selection]);

  const activeBlock: ExtractedBlock | null = useMemo(() => {
    if (!activeSection || selection.scope !== 'block') return null;
    return activeSection.blocks?.find((b) => b.id === selection.blockId) || null;
  }, [activeSection, selection]);

  const instantPreviewDoc = useMemo(() => {
    if (!selectedPage) return '';
    let bodyHtml = '';
    if (selection.scope === 'block' && activeBlock) {
      bodyHtml = activeBlock.wpPreviewHtml;
    } else if (selection.scope === 'section' && activeSection) {
      bodyHtml = activeSection.wpPreviewHtml || activeSection.gutenbergMarkup;
    } else {
      bodyHtml = selectedPage.sections
        .map((s) => s.wpPreviewHtml || s.gutenbergMarkup)
        .join('\n');
      if (!bodyHtml) {
        bodyHtml = selectedPage.gutenbergContent;
      }
    }

    return buildWpInstantPreviewDoc({
      title: selectedPage.title,
      bodyHtml,
      showBlockOutlines,
    });
  }, [selectedPage, selection, activeSection, activeBlock, showBlockOutlines]);

  const scopedGutenbergMarkup = useMemo(() => {
    if (!selectedPage) return '';
    if (selection.scope === 'block' && activeBlock) {
      return activeBlock.gutenbergMarkup;
    }
    if (selection.scope === 'section' && activeSection) {
      return activeSection.gutenbergMarkup || selectedPage.gutenbergContent;
    }
    return selectedPage.gutenbergContent;
  }, [selectedPage, selection, activeSection, activeBlock]);

  if (!selectedPage) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <p className="text-sm text-slate-600">No pages were extracted from this source.</p>
      </div>
    );
  }

  const handleSelectPage = (pageId: string) => {
    setSelectedPageId(pageId);
    setSelection({ scope: 'page' });
    const nextPage = migration.pages.find((p) => p.id === pageId);
    const firstSec = nextPage?.sections[0]?.id;
    setExpandedSections(firstSec ? new Set([firstSec]) : new Set());
  };

  const toggleExpandSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleSelectSection = (sectionId: string) => {
    setSelection({ scope: 'section', sectionId });
    setExpandedSections((prev) => new Set(prev).add(sectionId));
    if (inspectorMode === 'theme' || inspectorMode === 'html') {
      setInspectorMode('instant');
    }
  };

  const handleSelectBlock = (sectionId: string, blockId: string) => {
    setSelection({ scope: 'block', sectionId, blockId });
    if (inspectorMode === 'theme' || inspectorMode === 'html') {
      setInspectorMode('instant');
    }
  };

  const handleCopyCode = async () => {
    const content =
      inspectorMode === 'gutenberg' ? scopedGutenbergMarkup : selectedPage.offlineHtml;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const activeScopeLabel =
    selection.scope === 'block' && activeBlock
      ? `${activeBlock.wpType} · ${activeBlock.label}`
      : selection.scope === 'section' && activeSection
        ? `wp:group · ${activeSection.heading}`
        : `Full Page · ${selectedPage.title}`;

  const iframeWidthClass =
    viewportWidth === 'mobile'
      ? 'w-[390px] border-x border-slate-200 shadow-xs'
      : viewportWidth === 'tablet'
        ? 'w-[768px] border-x border-slate-200 shadow-xs'
        : 'w-full';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Quantitative Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Detected Source</div>
          <div className="mt-1 font-display text-lg font-bold text-slate-950">
            {formatPlatformLabel(migration.detectedPlatform)}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {migration.detectionSignals[0] || 'HTML structure'}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span>JS Payload Reduced</span>
            <InfoTooltip
              title="JavaScript Payload Reduced"
              content="Shows how much builder JavaScript was removed or swapped for our 3.5 KB local runtime. Less JavaScript means much faster page loads on WordPress and mobile devices."
            />
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-emerald-700 tabular-nums">
            -{migration.metrics.jsPercentSaved}%
          </div>
          <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
            {formatBytes(migration.metrics.jsOriginalBytes)} → {formatBytes(migration.metrics.jsOptimizedBytes)}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span>External CDN Requests</span>
            <InfoTooltip
              title="External CDN Requests"
              content="Counts how many scripts, stylesheets, and images used to load from external builder servers (like wixstatic.com or squarespace-cdn.com). Reaching 0 means your site works 100% offline."
            />
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-slate-950 tabular-nums">
            {migration.metrics.externalRequestsBefore} → {migration.metrics.externalRequestsAfter}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">100% local offline execution</div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span>Gutenberg Blocks</span>
            <InfoTooltip
              title="WordPress Gutenberg Blocks"
              content="Gutenberg is WordPress's visual page editor. PressPort translates headings, paragraphs, images, lists, and buttons into editable native blocks instead of a single locked HTML blob."
            />
          </div>
          <div className="mt-1 font-mono text-lg font-semibold text-slate-950 tabular-nums">
            {migration.metrics.gutenbergBlocksGenerated}
          </div>
          <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
            Across {migration.metrics.pagesMigrated} {migration.metrics.pagesMigrated === 1 ? 'page' : 'pages'}
          </div>
        </div>
      </div>

      {/* Page & Block Selector + Instant Preview Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Migrated Page List & Interactive Gutenberg Block Tree */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Migrated Pages ({migration.pages.length})
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {migration.pages.map((page) => {
                const isSelectedPage = page.id === selectedPage.id;
                const isFullPageActive = isSelectedPage && selection.scope === 'page';
                return (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectPage(page.id)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        isFullPageActive
                          ? 'bg-blue-50/80'
                          : isSelectedPage
                            ? 'bg-slate-50'
                            : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-sm font-medium ${
                            isFullPageActive ? 'text-blue-900' : 'text-slate-900'
                          }`}
                        >
                          {page.title}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-slate-500">
                          /{page.isHome ? '' : page.slug}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                        <span>{page.wordCount} words</span>
                        <span aria-hidden="true">·</span>
                        <span>{page.imageCount} images</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {page.scriptCountBefore}→{page.scriptCountAfter} JS
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Interactive Gutenberg Sections & Blocks Tree */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    WordPress Block Tree ({selectedPage.sections.length})
                  </h3>
                  <InfoTooltip
                    title="WordPress Block Tree"
                    content="Lists every section (wp:group) and individual block (headings, paragraphs, images, buttons) that will appear in your WordPress editor. Expand a section and click any item to isolate it in the preview."
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Click any section or block to inspect in Instant Preview.
                </p>
              </div>
              {selection.scope !== 'page' && (
                <button
                  type="button"
                  onClick={() => setSelection({ scope: 'page' })}
                  className="shrink-0 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                >
                  Full Page
                </button>
              )}
            </div>
            <ul className="divide-y divide-slate-100">
              {selectedPage.sections.map((section, idx) => {
                const isExpanded = expandedSections.has(section.id);
                const isSectionSelected =
                  selection.scope === 'section' && selection.sectionId === section.id;
                const blocks = section.blocks || [];

                return (
                  <li key={section.id}>
                    <div
                      className={`flex items-start gap-1.5 px-3 py-2.5 transition-colors ${
                        isSectionSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={isExpanded ? `Collapse ${section.heading}` : `Expand ${section.heading}`}
                        onClick={() => toggleExpandSection(section.id)}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectSection(section.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`truncate text-sm font-medium ${
                              isSectionSelected ? 'text-blue-900' : 'text-slate-900'
                            }`}
                          >
                            {String(idx + 1).padStart(2, '0')}. {section.heading}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-slate-500 tabular-nums">
                            {section.blockCount} blocks
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{section.summary}</p>
                      </button>
                    </div>

                    {isExpanded && blocks.length > 0 && (
                      <ul className="border-t border-slate-100 bg-slate-50/50 py-1 pl-9 pr-3">
                        {blocks.map((block) => {
                          const isBlockSelected =
                            selection.scope === 'block' &&
                            selection.sectionId === section.id &&
                            selection.blockId === block.id;
                          return (
                            <li key={block.id}>
                              <button
                                type="button"
                                onClick={() => handleSelectBlock(section.id, block.id)}
                                className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                                  isBlockSelected
                                    ? 'bg-blue-100/80 font-semibold text-blue-950'
                                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                                }`}
                              >
                                <span className="truncate">{block.label}</span>
                                <span className="shrink-0 font-mono text-[11px] text-slate-500">
                                  {block.wpType}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Right: Instant Preview & Code Inspector Panel */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setInspectorMode('instant')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  inspectorMode === 'instant'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Grid2x2 className="h-3.5 w-3.5" aria-hidden="true" />
                Instant Preview
              </button>
              <button
                type="button"
                onClick={() => setInspectorMode('theme')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  inspectorMode === 'theme'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Offline Theme
              </button>
              <button
                type="button"
                onClick={() => setInspectorMode('gutenberg')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  inspectorMode === 'gutenberg'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Gutenberg Code
              </button>
              <button
                type="button"
                onClick={() => setInspectorMode('html')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  inspectorMode === 'html'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
                Offline HTML
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
              <span className="font-mono">
                {formatBytes(selectedPage.originalHtmlBytes)} → {formatBytes(selectedPage.cleanedHtmlBytes)}
              </span>
              {(inspectorMode === 'gutenberg' || inspectorMode === 'html') && (
                <button
                  type="button"
                  onClick={handleCopyCode}
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
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {inspectorMode === 'instant' && (
            <div className="flex flex-1 flex-col bg-slate-100">
              {/* Instant Preview Contextual Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 text-slate-700">
                  <span className="truncate font-mono font-medium text-slate-900">
                    {activeScopeLabel}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="shrink-0 text-slate-500">Minimal CSS reset</span>
                  <InfoTooltip
                    title="Instant Preview (Minimal CSS Reset)"
                    content="Displays your converted WordPress structure using a clean neutral stylesheet (no old Wix/Squarespace theme CSS) so you can check heading order, images, and spacing before importing."
                    tip="Toggle Block Outlines to see where each Gutenberg block starts and ends, or switch to Offline Theme to see the styled page."
                  />
                  {selection.scope !== 'page' && (
                    <>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setSelection({ scope: 'page' })}
                        className="shrink-0 font-medium text-blue-700 hover:underline whitespace-nowrap"
                      >
                        Show full page
                      </button>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Block Outline Toggle */}
                  <button
                    type="button"
                    aria-pressed={showBlockOutlines}
                    onClick={() => setShowBlockOutlines((v) => !v)}
                    className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      showBlockOutlines
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Block Outlines: {showBlockOutlines ? 'On' : 'Off'}
                  </button>

                  {/* Responsive Width Switcher */}
                  <div
                    role="group"
                    aria-label="Preview viewport width"
                    className="inline-flex items-center rounded border border-slate-300 bg-white p-0.5"
                  >
                    <button
                      type="button"
                      aria-label="Desktop width"
                      aria-pressed={viewportWidth === 'full'}
                      onClick={() => setViewportWidth('full')}
                      className={`rounded p-1 transition-colors ${
                        viewportWidth === 'full'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Tablet width"
                      aria-pressed={viewportWidth === 'tablet'}
                      onClick={() => setViewportWidth('tablet')}
                      className={`rounded p-1 transition-colors ${
                        viewportWidth === 'tablet'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Tablet className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Mobile width"
                      aria-pressed={viewportWidth === 'mobile'}
                      onClick={() => setViewportWidth('mobile')}
                      className={`rounded p-1 transition-colors ${
                        viewportWidth === 'mobile'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Isolated Minimal-Reset Structural Preview Canvas */}
              <div className="flex flex-1 justify-center overflow-auto bg-slate-100">
                <iframe
                  title={`WordPress Instant Preview — ${activeScopeLabel}`}
                  sandbox=""
                  srcDoc={instantPreviewDoc}
                  className={`h-[620px] max-w-full bg-white transition-all ${iframeWidthClass}`}
                />
              </div>
            </div>
          )}

          {inspectorMode === 'theme' && (
            <div className="flex flex-1 flex-col bg-slate-100">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
                <span className="truncate font-mono">
                  offline://{migration.siteSlug}/{selectedPage.isHome ? 'index.html' : `${selectedPage.slug}.html`}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-emerald-700 font-medium sm:inline">
                    0 external network requests
                  </span>
                  <button
                    type="button"
                    disabled={downloadingFormat !== null}
                    onClick={() => onDownload('offline')}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {downloadingFormat === 'offline' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FolderArchive className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Download Offline ZIP
                  </button>
                </div>
              </div>
              <iframe
                title={`Offline theme preview of ${selectedPage.title}`}
                sandbox="allow-scripts"
                srcDoc={selectedPage.previewHtml}
                className="h-[620px] w-full bg-white"
              />
            </div>
          )}

          {(inspectorMode === 'gutenberg' || inspectorMode === 'html') && (
            <div className="flex flex-1 flex-col">
              {inspectorMode === 'gutenberg' && selection.scope !== 'page' && (
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
                  <span className="truncate font-mono">Scoped to: {activeScopeLabel}</span>
                  <button
                    type="button"
                    onClick={() => setSelection({ scope: 'page' })}
                    className="shrink-0 font-medium text-blue-400 hover:underline whitespace-nowrap"
                  >
                    Show full page markup
                  </button>
                </div>
              )}
              <pre className="h-[654px] overflow-auto bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-100">
                <code>
                  {inspectorMode === 'gutenberg' ? scopedGutenbergMarkup : selectedPage.offlineHtml}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
