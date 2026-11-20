import {
  ArrowRightLeft,
  Code2,
  Download,
  FileCode2,
  Layers,
  Plus,
  ScrollText,
  X,
} from 'lucide-react';
import type { MigrationResult } from '../types/migration';
import { formatPlatformLabel } from '../utils/format';

export type WorkspaceTab = 'setup' | 'pages' | 'assets' | 'wordpress' | 'export' | 'logs';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  activeMigration: MigrationResult | null;
  history: MigrationResult[];
  exportLogsCount: number;
  failedExportsCount: number;
  onSelectMigration: (id: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  requiresResult: boolean;
  icon: typeof Plus;
}> = [
  { id: 'setup', label: 'New Migration', requiresResult: false, icon: Plus },
  { id: 'pages', label: 'Pages & Blocks', requiresResult: true, icon: Layers },
  { id: 'assets', label: 'Assets & Scripts', requiresResult: true, icon: FileCode2 },
  { id: 'wordpress', label: 'WordPress Output', requiresResult: true, icon: Code2 },
  { id: 'export', label: 'Export & Deploy', requiresResult: true, icon: Download },
  { id: 'logs', label: 'Export Logs', requiresResult: false, icon: ScrollText },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  activeMigration,
  history,
  exportLogsCount,
  failedExportsCount,
  onSelectMigration,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const sidebarContent = (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <button
          type="button"
          onClick={() => {
            onSelectTab('setup');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-white">
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            PressPort
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Workspace Navigation */}
      <nav aria-label="Workspace Navigation" className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-2.5 pb-2 text-xs font-medium text-slate-500">Migration Workflow</p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const disabled = item.requiresResult && !activeMigration;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'bg-blue-50 text-blue-800'
                      : disabled
                        ? 'cursor-not-allowed text-slate-400'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-blue-700' : disabled ? 'text-slate-300' : 'text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'pages' && activeMigration && (
                    <span className="font-mono text-xs tabular-nums text-slate-500">
                      {activeMigration.metrics.pagesMigrated}
                    </span>
                  )}
                  {item.id === 'assets' && activeMigration && (
                    <span className="font-mono text-xs tabular-nums text-slate-500">
                      {activeMigration.assets.length}
                    </span>
                  )}
                  {item.id === 'logs' && exportLogsCount > 0 && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        failedExportsCount > 0 ? 'font-semibold text-red-700' : 'text-slate-500'
                      }`}
                    >
                      {exportLogsCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Recent Migrations in Session */}
        {history.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-5">
            <p className="px-2.5 pb-2 text-xs font-medium text-slate-500">Recent Migrations</p>
            <ul className="space-y-1">
              {history.map((item) => {
                const selected = activeMigration?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectMigration(item.id);
                        onCloseMobile();
                      }}
                      className={`w-full rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        selected
                          ? 'bg-slate-100 text-slate-950'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                    >
                      <div className="truncate text-sm font-medium">{item.siteName}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                        <span>{formatPlatformLabel(item.detectedPlatform)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.metrics.pagesMigrated} {item.metrics.pagesMigrated === 1 ? 'page' : 'pages'}</span>
                        <span aria-hidden="true">·</span>
                        <span>-{item.metrics.jsPercentSaved}% JS</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Quiet Footer Summary */}
      <div className="border-t border-slate-200 px-5 py-3.5 text-xs text-slate-500">
        WordPress WXR 1.2 · Zero-CDN Export
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:block">{sidebarContent}</div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
