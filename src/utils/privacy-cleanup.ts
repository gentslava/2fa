// Remove state left by upstream's billing, telemetry and hosted backups.
// Account records, vault metadata, local snapshots and preferences are separate
// keys and are never read or rewritten here. No request is made to any server.

const OBSOLETE_KEYS = new Set([
  'codeSitesDaily',
  'siteOpenedAt',
  'bannersDismissed',
  'noticesRead',
  'noticesDismissed',
]);

export function isUpstreamDataKey(key: string): boolean {
  return /^(billing|cloudBackup|cloudSync)/.test(key) || OBSOLETE_KEYS.has(key);
}

export async function removeUpstreamData(): Promise<void> {
  await Promise.all((['local', 'sync', 'session'] as const).map(async name => {
    try {
      const area = chrome.storage[name];
      if (!area) return;
      const stored = await area.get(null);
      const keys = Object.keys(stored).filter(isUpstreamDataKey);
      if (keys.length) await area.remove(keys);
    } catch (error) {
      // A temporarily unavailable area is retried on the next worker start.
      console.warn(`Could not remove obsolete upstream state from ${name}`, error);
    }
  }));
}
