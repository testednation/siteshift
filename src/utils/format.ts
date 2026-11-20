import type { PlatformType } from '../types/migration';

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatPlatformLabel(platform: PlatformType): string {
  switch (platform) {
    case 'wix':
      return 'Wix';
    case 'strikingly':
      return 'Strikingly';
    case 'squarespace':
      return 'Squarespace';
    case 'webflow':
      return 'Webflow';
    case 'weebly':
      return 'Weebly';
    default:
      return 'Static HTML';
  }
}

export function formatActionLabel(action: string): string {
  switch (action) {
    case 'strip':
      return 'Ignored (Stripped)';
    case 'replace_local':
      return 'Replaced (Local JS)';
    case 'localize':
      return 'Downloaded (Local)';
    case 'keep_inline':
      return 'Inlined in HTML';
    default:
      return action;
  }
}
