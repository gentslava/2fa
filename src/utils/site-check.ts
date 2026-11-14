// The warning before a code goes into a page that imitates the account's site.
// All checks and trusted-site choices stay on this device.
//
// See lookalike.ts for what counts as imitating, and why so little does.

import type { Account } from '@/types';
import { accountsForSite } from './account-sites';
import { lookalikeOf, referencesFor, type Lookalike } from './lookalike';
import { getBaseDomain, recordAccountUsage, siteHistory } from './suggestions';
import { isVaultEnabled } from './vault';

const ENABLED_KEY = 'siteWarnEnabled';
const TRUSTED_KEY = 'siteWarnTrusted';

type Trusted = Record<string, string[]>;

/** On unless switched off in Settings. */
export async function isSiteWarnEnabled(): Promise<boolean> {
  try {
    const found = await chrome.storage.local.get(ENABLED_KEY);
    return found[ENABLED_KEY] !== false;
  } catch {
    return true;
  }
}

export async function setSiteWarnEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
}

/**
 * Pages the user said were genuine for an account, kept apart from the usage
 * history because that one is off when suggestions are, and the answer must
 * hold either way. Held in memory-backed session storage while a vault is set
 * up, like the history: which services someone holds is what a vault protects.
 */
async function readTrusted(): Promise<Trusted> {
  try {
    const area = (await isVaultEnabled()) ? chrome.storage.session : chrome.storage.local;
    if (!area) return {};
    const found = await area.get(TRUSTED_KEY);
    const value = found[TRUSTED_KEY];
    return value && typeof value === 'object' ? (value as Trusted) : {};
  } catch {
    return {};
  }
}

async function writeTrusted(trusted: Trusted): Promise<void> {
  try {
    const vault = await isVaultEnabled();
    const area = vault ? chrome.storage.session : chrome.storage.local;
    if (vault) await chrome.storage.local.remove(TRUSTED_KEY).catch(() => {});
    await area?.set({ [TRUSTED_KEY]: trusted });
  } catch {
    // Forgetting an answer means asking once more, which is the safe side.
  }
}

/**
 * Whether this page imitates a site the account belongs on, or null.
 *
 * Null for a page the account was tied to by hand, used on before, or said to
 * be genuine; for one whose name is simply another account's (Strike when you
 * also hold Stripe); and for anything that is not a web page.
 */
export async function checkSite(hostname: string | null | undefined, account: Account, all: readonly Account[]): Promise<Lookalike | null> {
  if (!hostname) return null;
  try {
    if (!(await isSiteWarnEnabled())) return null;
    if (accountsForSite(hostname, [account]).length > 0) return null;
    const domain = getBaseDomain(hostname);
    const trusted = await readTrusted();
    if (trusted[domain]?.includes(account.id)) return null;

    const history = await siteHistory();
    const refs = referencesFor(account, history.get(account.id) ?? []);
    if (refs.length === 0) return null;
    const others = all
      .filter(other => other.id !== account.id)
      .flatMap(other => referencesFor(other, history.get(other.id) ?? []));
    return lookalikeOf(hostname, refs, others);
  } catch {
    return null;
  }
}

/** The user looked at the warning and said the page is the real one. */
export async function trustSite(hostname: string, accountId: string): Promise<void> {
  const domain = getBaseDomain(hostname);
  const trusted = await readTrusted();
  const ids = trusted[domain] ?? [];
  if (!ids.includes(accountId)) trusted[domain] = [...ids, accountId].slice(-20);
  await writeTrusted(trusted);
  // And it is evidence about the site, the same as a pick for it would be.
  await recordAccountUsage(hostname, accountId, 'site').catch(() => {});
}
