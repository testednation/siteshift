import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Download,
  FileCode2,
  FolderArchive,
  Layers,
  Loader2,
  Play,
  ScrollText,
  Search,
} from 'lucide-react';
import type { MigrationResult, SampleId } from '../types/migration';
import type { WorkspaceTab } from './Sidebar';

interface TutorialGuideViewProps {
  activeMigration: MigrationResult | null;
  migrationsCount: number;
  exportLogsCount: number;
  loadingSample: boolean;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onLaunchGuidedSample: (sampleId: SampleId) => void;
}

interface GlossaryEntry {
  term: string;
  category: 'WordPress' | 'Performance' | 'Exports';
  summary: string;
  whereUsed: string;
}

const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: 'WXR 1.2 XML',
    category: 'WordPress',
    summary:
      'WordPress eXtended RSS — WordPress’s official built-in import format. Uploading this XML file inside WP Admin (Tools → Import → WordPress) creates all of your migrated pages, SEO descriptions, and Gutenberg blocks automatically.',
    whereUsed: 'WordPress Output · Export & Deploy',
  },
  {
    term: 'Gutenberg Blocks (wp:*)',
    category: 'WordPress',
    summary:
      'WordPress’s visual block editor format. Instead of pasting messy HTML from Wix or Squarespace, PressPort converts headings, paragraphs, images, lists, buttons, and forms into native blocks you can drag and edit inside WordPress.',
    whereUsed: 'Pages & Blocks · WordPress Output',
  },
  {
    term: 'WordPress Theme (.zip)',
    category: 'Exports',
    summary:
      'A ready-to-install template package (style.css, functions.php, PHP templates, and local assets) that controls your site’s layout and loads your local CSS/JS cleanly. Upload it via WP Admin → Appearance → Themes → Upload Theme.',
    whereUsed: 'WordPress Output · Export & Deploy',
  },
  {
    term: 'Standalone Offline (.zip)',
    category: 'Exports',
    summary:
      'A self-contained folder of HTML, local CSS, local JavaScript, and images that opens directly from your computer (double-click index.html) even with Wi-Fi turned off. Great for backups, local previews, or static web hosting.',
    whereUsed: 'Top Bar · Export & Deploy',
  },
  {
    term: 'pressport-runtime.js',
    category: 'Performance',
    summary:
      'A lightweight 3.5 KB local JavaScript file that replaces bloated builder frameworks (like Wix Thunderbolt or Strikingly Bobcat) while preserving essential features like mobile menus, smooth scrolling, image lightboxes, and form validation.',
    whereUsed: 'Assets & Scripts · WordPress Output',
  },
  {
    term: 'Zero External CDN Requests',
    category: 'Performance',
    summary:
      'Site builders normally load scripts and images from their own servers (wixstatic.com, squarespace-cdn.com). PressPort downloads those assets locally so your site never breaks if you cancel your old builder subscription.',
    whereUsed: 'Pages & Blocks · Assets & Scripts',
  },
  {
    term: 'Asset Policies (Download / Inline / Replace / Ignore)',
    category: 'Performance',
    summary:
      'Controls what happens to each discovered script, stylesheet, or image: Download saves a local copy, Inline embeds small code directly in HTML, Replace swaps heavy builder JS for pressport-runtime.js, and Ignore removes trackers or bloat completely.',
    whereUsed: 'Assets & Scripts',
  },
  {
    term: 'Image Optimizer (Progressive JPEG)',
    category: 'Performance',
    summary:
      'Automatically resizes oversized images and converts heavy PNG or WebP files into fast-loading progressive JPEGs. Progressive JPEGs display a sharp preview right away while loading and work across all WordPress themes and browsers.',
    whereUsed: 'New Migration · Assets & Scripts',
  },
  {
    term: 'functions.php',
    category: 'WordPress',
    summary:
      'Your WordPress theme’s control file. PressPort generates this automatically to register menus, enable Gutenberg styling, load your local scripts via wp_enqueue_script(), and turn off WordPress’s default external emoji scripts.',
    whereUsed: 'WordPress Output',
  },
  {
    term: 'Export Logs (.log / .json)',
    category: 'Exports',
    summary:
      'A timestamped record of every export you run, including warnings about unreachable images or missing pages. Download a .log file to inspect step-by-step details if a WordPress import behaves unexpectedly.',
    whereUsed: 'Export Logs',
  },
];

const CHECKLIST_STORAGE_KEY = 'pressport_tutorial_checked_v1';

function loadCheckedSteps(): string[] {
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function TutorialGuideView({
  activeMigration,
  migrationsCount,
  exportLogsCount,
  loadingSample,
  onNavigateTab,
  onLaunchGuidedSample,
}: TutorialGuideViewProps) {
  const [manualChecked, setManualChecked] = useState<string[]>(() => loadCheckedSteps());
  const [glossaryQuery, setGlossaryQuery] = useState('');
  const [glossaryCategory, setGlossaryCategory] = useState<'all' | GlossaryEntry['category']>('all');

  const toggleManualStep = (stepId: string) => {
    setManualChecked((prev) => {
      const next = prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId];
      try {
        window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const stepCompletion = {
    step1: migrationsCount > 0 || manualChecked.includes('step1'),
    step2: manualChecked.includes('step2'),
    step3:
      Boolean(activeMigration?.options.optimizeImagesToJpeg) || manualChecked.includes('step3'),
    step4: exportLogsCount > 0 || manualChecked.includes('step4'),
  };

  const completedCount = Object.values(stepCompletion).filter(Boolean).length;

  const filteredGlossary = useMemo(() => {
    const q = glossaryQuery.trim().toLowerCase();
    return GLOSSARY_ENTRIES.filter((item) => {
      if (glossaryCategory !== 'all' && item.category !== glossaryCategory) return false;
      if (!q) return true;
      return (
        item.term.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.whereUsed.toLowerCase().includes(q)
      );
    });
  }, [glossaryQuery, glossaryCategory]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
            Beginner’s Migration Tutorial &amp; Guide
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            New to moving a site from Wix, Squarespace, Strikingly, Webflow, or Weebly to WordPress? Follow these four
            plain-English steps—or hover/click any info icon throughout the app for quick definitions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loadingSample}
            onClick={() => onLaunchGuidedSample('squarespace-editorial')}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
          >
            {loadingSample ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Try Practice Site (Squarespace)
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('setup')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            Go to New Migration
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Progress Strip */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span className="font-display text-sm font-semibold text-slate-950">
              Your First Migration Walkthrough
            </span>
          </div>
          <span className="font-mono text-xs font-medium tabular-nums text-slate-600">
            {completedCount} of 4 steps completed
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-100">
          <div
            className="h-full bg-blue-700 transition-[width] duration-200 ease-out"
            style={{ width: `${(completedCount / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* 4-Step Guided Walkthrough */}
      <div className="space-y-4">
        {/* Step 01 */}
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleManualStep('step1')}
                aria-label={stepCompletion.step1 ? 'Mark step 1 incomplete' : 'Mark step 1 complete'}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full"
              >
                {stepCompletion.step1 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-blue-700">Step 01</span>
                  <span aria-hidden="true">·</span>
                  <span>New Migration</span>
                  {migrationsCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-emerald-700">Completed automatically</span>
                    </>
                  )}
                </div>
                <h2 className="mt-1 font-display text-base font-semibold text-slate-950">
                  Import your existing site (online URL or offline files)
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  You can paste a public website link (Live URL), upload saved <code className="font-mono text-xs text-slate-800">.html</code> or{' '}
                  <code className="font-mono text-xs text-slate-800">.zip</code> files from your computer (Offline Upload), or paste raw page HTML.
                  If you just want to explore first, click any built-in sample blueprint at the bottom of New Migration.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  <strong className="font-semibold text-slate-700">Beginner tip:</strong> If a live site blocks crawlers
                  or is still unpublished, open it in Chrome, press <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[11px]">Ctrl/Cmd + S</kbd> (&ldquo;Webpage, Complete&rdquo;), zip the saved files, and drop them into <strong>Offline Upload</strong>.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('setup')}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                Open New Migration
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>

        {/* Step 02 */}
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleManualStep('step2')}
                aria-label={stepCompletion.step2 ? 'Mark step 2 incomplete' : 'Mark step 2 complete'}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full"
              >
                {stepCompletion.step2 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-blue-700">Step 02</span>
                  <span aria-hidden="true">·</span>
                  <span>Pages &amp; Blocks</span>
                </div>
                <h2 className="mt-1 font-display text-base font-semibold text-slate-950">
                  Verify your WordPress structure in Instant Preview
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  PressPort turns each section of your old site into clean WordPress Gutenberg blocks (headings,
                  paragraphs, images, lists, buttons, and forms). Click any section or block in the <strong>WordPress Block Tree</strong> to
                  inspect it in <strong>Instant Preview</strong> with a minimal CSS reset—this lets you verify content order
                  and headings without old builder styling getting in the way.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!activeMigration}
                onClick={() => {
                  if (!stepCompletion.step2) toggleManualStep('step2');
                  onNavigateTab('pages');
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {activeMigration ? 'Inspect Pages & Blocks' : 'Run Step 1 first'}
              </button>
            </div>
          </div>
        </article>

        {/* Step 03 */}
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleManualStep('step3')}
                aria-label={stepCompletion.step3 ? 'Mark step 3 incomplete' : 'Mark step 3 complete'}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full"
              >
                {stepCompletion.step3 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-blue-700">Step 03</span>
                  <span aria-hidden="true">·</span>
                  <span>Assets &amp; Scripts</span>
                </div>
                <h2 className="mt-1 font-display text-base font-semibold text-slate-950">
                  Strip builder bloat, localize assets &amp; optimize heavy images
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  The default preset automatically removes trackers and swaps heavy builder scripts for our 3.5 KB local
                  runtime. You can also flip the <strong>Image Optimizer</strong> switch to shrink heavy PNG and WebP images
                  into progressive JPEGs, or select multiple rows using checkboxes to bulk-apply{' '}
                  <strong>Download</strong>, <strong>Inline</strong>, <strong>Replace Local</strong>, or <strong>Ignore</strong> in one click.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!activeMigration}
                onClick={() => {
                  if (!stepCompletion.step3) toggleManualStep('step3');
                  onNavigateTab('assets');
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
              >
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                {activeMigration ? 'Open Assets & Scripts' : 'Run Step 1 first'}
              </button>
            </div>
          </div>
        </article>

        {/* Step 04 */}
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleManualStep('step4')}
                aria-label={stepCompletion.step4 ? 'Mark step 4 incomplete' : 'Mark step 4 complete'}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full"
              >
                {stepCompletion.step4 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-blue-700">Step 04</span>
                  <span aria-hidden="true">·</span>
                  <span>Export &amp; Deploy · Export Logs</span>
                  {exportLogsCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-emerald-700">Completed automatically</span>
                    </>
                  )}
                </div>
                <h2 className="mt-1 font-display text-base font-semibold text-slate-950">
                  Download your package and upload to WordPress (or test offline)
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  For a full WordPress site, download <strong>two files</strong> from Export &amp; Deploy:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
                  <li>
                    <strong>WordPress Theme (.zip)</strong> → upload in WP Admin under{' '}
                    <code className="font-mono text-slate-800">Appearance → Themes → Add New → Upload Theme</code> and click Activate.
                  </li>
                  <li>
                    <strong>WordPress WXR 1.2 (.xml)</strong> → import in WP Admin under{' '}
                    <code className="font-mono text-slate-800">Tools → Import → WordPress</code> to populate all pages and blocks.
                  </li>
                  <li>
                    Want an instant offline copy without WordPress? Choose <strong>Standalone Offline (.zip)</strong>, unzip it, and open <code className="font-mono text-slate-800">index.html</code>.
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={!activeMigration}
                onClick={() => onNavigateTab('export')}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {activeMigration ? 'Export & Deploy' : 'Run Step 1 first'}
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('logs')}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                Export Logs
              </button>
            </div>
          </div>
        </article>
      </div>

      {/* Which Download Should I Pick? Quick Comparison */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="font-display text-sm font-semibold text-slate-950">
            Which export format should I pick?
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="px-5 py-2.5">Export Package</th>
                <th className="px-5 py-2.5">Best For</th>
                <th className="px-5 py-2.5">How to Use It</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <FolderArchive className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                    Standalone Offline (.zip)
                  </span>
                </td>
                <td className="px-5 py-3">Offline archives, client previews, or static hosting (no WordPress needed)</td>
                <td className="px-5 py-3">Unzip folder and double-click <code className="font-mono text-slate-900">index.html</code></td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                  WordPress Theme (.zip)
                </td>
                <td className="px-5 py-3">Installing the cleaned layout, local CSS/JS, and images on a WordPress site</td>
                <td className="px-5 py-3">WP Admin → Appearance → Themes → Upload Theme</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                  WordPress WXR 1.2 (.xml)
                </td>
                <td className="px-5 py-3">Importing all pages, text, SEO descriptions, and Gutenberg blocks into WordPress</td>
                <td className="px-5 py-3">WP Admin → Tools → Import → WordPress</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                  Local Assets (.zip)
                </td>
                <td className="px-5 py-3">Developers who already have a custom WordPress theme and only need cleaned local files</td>
                <td className="px-5 py-3">Copy <code className="font-mono text-slate-900">assets/</code> into your existing child theme</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                  Updated Site &amp; Gutenberg (.zip)
                </td>
                <td className="px-5 py-3">Downloading everything after builder stripping and Gutenberg conversion (cleaned HTML, per-page Gutenberg block files, WXR XML, optimized local assets, and audit report)</td>
                <td className="px-5 py-3">Paste <code className="font-mono text-slate-900">gutenberg/*.gutenberg.html</code> into WordPress or inspect cleaned files locally</td>
              </tr>
              <tr>
                <td className="px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                  Original Site Source (.zip)
                </td>
                <td className="px-5 py-3">Archiving the untouched raw HTML and unoptimized assets before builder stripping, or re-migrating offline later</td>
                <td className="px-5 py-3">Keep as a backup or drop back into <strong>New Migration → Offline Upload</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Plain-English Glossary */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-950">
              Plain-English Glossary
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Quick explanations of WordPress and migration terms used in PressPort.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter glossary category">
              {(['all', 'WordPress', 'Performance', 'Exports'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGlossaryCategory(cat)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    glossaryCategory === cat
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={glossaryQuery}
                onChange={(e) => setGlossaryQuery(e.target.value)}
                placeholder="Search terms..."
                aria-label="Search glossary terms"
                className="w-44 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {filteredGlossary.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            No glossary entries match &ldquo;{glossaryQuery}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-y-0">
            {filteredGlossary.map((entry, idx) => (
              <div
                key={entry.term}
                className={`p-5 ${idx >= 2 ? 'md:border-t md:border-slate-200' : ''} ${
                  idx % 2 === 1 ? 'md:border-l md:border-slate-200' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-slate-950">{entry.term}</h3>
                  <span className="shrink-0 text-[11px] font-medium text-slate-500">
                    {entry.category}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{entry.summary}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Check className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  <span>Used in: {entry.whereUsed}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
