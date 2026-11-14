import { addAccountByHand, cards, expect, openPage, otherSecret, storedAccounts, test } from './fixtures';

test.afterEach(({ pageErrors }) => {
  expect(pageErrors, 'uncaught exceptions on extension pages').toEqual([]);
});

test('an old server policy cannot limit additions and no usage is sent upstream', async ({ context, extensionId }) => {
  const requests: string[] = [];
  context.on('request', request => requests.push(request.url()));
  const page = await openPage(context, extensionId, 'popup.html');
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      billingPolicy: { free_limit: 0, ui: { import_free: false, pro_in_settings: true } },
      billingEntitlement: null,
    });
  });
  for (let i = 1; i <= 6; i++) await addAccountByHand(page, `private${i}@example.com`, otherSecret(i));
  await page.reload();
  await expect(cards(page)).toHaveCount(6);
  expect(await storedAccounts(page)).toHaveLength(6);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByText(/Get Pro|Free plan|Cloud backup|Manage subscription/i)).toHaveCount(0);
  await expect(page.getByText('Backup & Restore', { exact: true })).toBeVisible();
  await expect(page.getByText('Sync across devices', { exact: true })).toBeVisible();
  // Exercise both entry points that used to start an automatic check-in.
  await openPage(context, extensionId, 'sidepanel.html');
  await page.waitForTimeout(1_000);
  expect(requests.filter(url => /authenticator\.sh|stripe\.com/.test(url))).toEqual([]);
  expect(context.pages().filter(tab => /^https?:/.test(tab.url()))).toHaveLength(0);
  const state = await page.evaluate(() => chrome.storage.local.get(['billingInstall', 'billingEvents', 'billingOpens', 'billingOnboarding', 'codeSitesDaily']));
  expect(state).toEqual({});
});

test('the browser blocks upstream API connections with the shipped network policy', async ({ context, extensionId }) => {
  const page = await openPage(context, extensionId, 'popup.html');
  const violation = await page.evaluate(() => new Promise<{ directive: string; blocked: string }>(resolve => {
    document.addEventListener('securitypolicyviolation', event => {
      resolve({ directive: event.effectiveDirective, blocked: event.blockedURI });
    }, { once: true });
    void fetch('https://api.authenticator.sh/v1/sync', { method: 'POST', body: '{}' }).catch(() => {});
  }));
  expect(violation.directive).toBe('connect-src');
  expect(violation.blocked).toContain('api.authenticator.sh');
});

test('upgrading cleans old metadata and keeps stored accounts and Google sync copies', async ({ context, extensionId }) => {
  const page = await openPage(context, extensionId, 'popup.html');
  await addAccountByHand(page, 'keep-private@example.com', otherSecret(1));
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      billingInstall: { id: 'obsolete-install-id' },
      billingEvents: [{ n: 'first_code' }],
      cloudBackupState: { on: true },
      cloudBackupCode: { c: 'synthetic-code' },
      codeSitesDaily: { copy: 4 },
    });
    // Seed the old synced copy explicitly: a fresh test profile's background
    // push can still be waiting for Chrome's initial sync download.
    const { authenticator_accounts: accounts } = await chrome.storage.local.get('authenticator_accounts');
    await chrome.storage.sync.set({ authenticator_accounts_0: accounts, billingLicenseKey: 'obsolete-license', billingLegacy: true });
    const synced = await chrome.storage.sync.get('authenticator_accounts_0');
    if (!Array.isArray(synced.authenticator_accounts_0) || synced.authenticator_accounts_0.length !== 1) throw new Error('upgrade fixture has no synced account');
  });

  const extensions = await context.newPage();
  await extensions.goto('chrome://extensions/');
  await extensions.evaluate(() => (chrome as any).developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }));
  const restarted = context.waitForEvent('serviceworker');
  await extensions.evaluate(id => (chrome as any).developerPrivate.reload(id, { failQuietly: true }), extensionId);
  await restarted;

  const reopened = await openPage(context, extensionId, 'popup.html');
  await expect(cards(reopened)).toHaveCount(1);
  expect((await storedAccounts(reopened))[0]).toMatchObject({ name: 'keep-private@example.com', secret: otherSecret(1) });
  await expect.poll(() => reopened.evaluate(async () => {
    const local = await chrome.storage.local.get(null);
    const sync = await chrome.storage.sync.get(null);
    return { obsolete: [...Object.keys(local), ...Object.keys(sync)].filter(key => /^(billing|cloudBackup|cloudSync|codeSitesDaily)/.test(key)), synced: Object.keys(sync).filter(key => key.startsWith('authenticator_accounts')) };
  })).toEqual({ obsolete: [], synced: ['authenticator_accounts_0'] });
});
