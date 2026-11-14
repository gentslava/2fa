// Privacy is a fork contract: no server policy can limit an addition, and
// migrating from upstream removes tracking state without touching accounts.

import { areas, backupRows, check, flush, resetState, scenario, setBackupRows } from './harness';
import type { Account } from '@/types';

const seeds = [
  'JBSWY3DPEHPK3PXP', 'KRSXG5CTMVRXEZLU', 'MFRGGZDFMZTWQ2LK',
  'NBSWY3DPEB3W64TM', 'ONSWG4TFORZTA5DI', 'PJSXG33VOQQDCMBA',
];

function account(index: number): Account {
  return { id: `privacy-${index}`, name: `test-${index}`, issuer: 'Privacy test', secret: seeds[index], algorithm: 'SHA1', digits: 6, period: 30, createdAt: Date.now() };
}

export async function run(): Promise<void> {
  const storage = await import('@/utils/storage');
  const { removeUpstreamData, isUpstreamDataKey } = await import('@/utils/privacy-cleanup');
  const backup = await import('@/utils/backup-file');
  const realFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    requests.push(String(input));
    throw new Error('No network expected');
  };
  try {
    scenario('A stale upstream policy cannot limit manual, batch, JSON or URI additions');
    await resetState();
    areas.local.billingPolicy = { free_limit: 0, ui: { import_free: false } };
    areas.local.billingEntitlement = null;
    check('manual add needs no license', await storage.addAccount(account(0)));
    const batch = await storage.addMultipleAccounts([account(1), account(2)]);
    check('a batch is admitted in full', batch.added === 2 && batch.leftOut === 0);
    const imported = await storage.importAccounts(JSON.stringify({ accounts: [account(3)] }));
    check('a file is admitted in full', imported.added === 1 && imported.leftOut === 0);
    const uri = await import('@/utils/uri-import');
    const pasted = await uri.importURIList(`otpauth://totp/Privacy?secret=${seeds[4]}`, 'en');
    check('a pasted link is admitted', pasted.added === 1);
    const duplicate = await storage.addAccount(account(0));
    check('duplicate protection still applies', !duplicate && (await storage.getAccounts()).length === 5);
    await flush();
    check('account operations make no network requests', requests.length === 0, requests.join());

    scenario('Upstream state is removed from every area, preserving authentication data');
    await resetState();
    const records = [account(0), { id: 'sealed', enc: 'synthetic-ciphertext', v: 'vault-id' }];
    const meta = { vaultId: 'vault-id', wrapped: 'synthetic-wrapped-key' };
    areas.local.authenticator_accounts = records;
    areas.local.vault_meta = meta;
    areas.local.darkMode = true;
    areas.local.billingInstall = { id: 'obsolete-install-id' };
    areas.local.billingEvents = [{ n: 'first_code' }];
    areas.local.billingOpens = [{ n: 12 }];
    areas.local.cloudBackupCode = { c: 'synthetic-recovery-code' };
    areas.local.cloudSyncState = { lastAt: 1 };
    areas.local.codeSitesDaily = { copy: 4 };
    areas.sync.authenticator_accounts_0 = records;
    areas.sync.vault_meta = meta;
    areas.sync.billingLicenseKey = 'obsolete-license';
    areas.sync.billingLegacy = true;
    areas.sync.cloudBackupCode = { c: 'synthetic-recovery-code' };
    areas.session.masterKey = 'synthetic-unlocked-key';
    areas.session.activeGroup = 'Work';
    areas.session.siteOpenedAt = 1;
    areas.session.billingHeldAdd = { accounts: [] };
    areas.session.cloudBackupPendingCode = 'synthetic-pending-code';
    const copies = [{ id: 'saved', timestamp: Date.now(), accounts: records, accountCount: 2 }];
    setBackupRows(copies);
    const before = JSON.stringify({ records, meta, copies });
    await removeUpstreamData();
    check('local, sync and session contain no upstream metadata', Object.values(areas).every(area => !Object.keys(area).some(isUpstreamDataKey)));
    check('local account records are byte-for-byte unchanged', JSON.stringify(areas.local.authenticator_accounts) === JSON.stringify(records));
    check('synced account records are unchanged', JSON.stringify(areas.sync.authenticator_accounts_0) === JSON.stringify(records));
    check('vault metadata is unchanged in both areas', JSON.stringify(areas.local.vault_meta) === JSON.stringify(meta) && JSON.stringify(areas.sync.vault_meta) === JSON.stringify(meta));
    check('local snapshots are unchanged', JSON.stringify(backupRows) === JSON.stringify(copies));
    check('preferences and unlocked state survive', areas.local.darkMode === true && areas.session.masterKey === 'synthetic-unlocked-key' && areas.session.activeGroup === 'Work');
    await removeUpstreamData();
    check('cleanup can run again without changing authentication data', before === JSON.stringify({ records: areas.local.authenticator_accounts, meta: areas.local.vault_meta, copies: backupRows }));
    check('cleanup makes no network requests', requests.length === 0);

    scenario('New exports contain no installation identity or billing marker');
    const plain = JSON.parse(backup.buildPlainBackupFile([account(0)]));
    const encryptedText = await backup.buildEncryptedBackupFile([account(0)], 'synthetic export password');
    const encrypted = JSON.parse(encryptedText);
    check('plain export has no legacy or installation fields', !('legacy' in plain) && !('sourceLink' in plain));
    check('encrypted export has no legacy or installation fields', !('legacy' in encrypted) && !('sourceLink' in encrypted));
    const opened = await backup.readEncryptedBackupFile(encryptedText, 'synthetic export password');
    check('encrypted export still restores the secret', opened.length === 1 && opened[0].secret === seeds[0]);
  } finally {
    globalThis.fetch = realFetch;
    await resetState();
  }
}
