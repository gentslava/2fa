// Background service worker for Authenticator extension
// Manifest V3 requires a service worker instead of background scripts

import { COMMAND_ID, COPY_MENU_ID, MENU_ID, startQuickFill, syncContextMenu } from './quick-fill';
import { applyOpenMode, registerOpenMode } from './open-mode';
import { QUICK_FILL_ENABLED_KEY } from '@/utils/quick-fill';
import { restoreBadge, showUpdateBadge } from '@/utils/update-badge';
import { isUpstreamDataKey, removeUpstreamData } from '@/utils/privacy-cleanup';

void chrome.runtime.setUninstallURL('');
void removeUpstreamData();

chrome.runtime.onInstalled.addListener((details) => {
  void syncContextMenu();
  void applyOpenMode();

  if (details.reason === 'update') {
    // Unpacked extensions fire onInstalled('update') on every dev reload, even
    // without a version bump — only (re)arm the modal if this version hasn't
    // been acknowledged yet.
    const currentVersion = chrome.runtime.getManifest().version;
    chrome.storage.local.get('lastSeenWhatsNewVersion', (result) => {
      if (result.lastSeenWhatsNewVersion !== currentVersion) {
        chrome.storage.local.set({ pendingWhatsNew: currentVersion });
        showUpdateBadge(currentVersion).catch(() => {});
      }
    });
  }

});

// Menu items are stored by the browser and outlive the service worker, so this
// is not what keeps the item alive — it is what repairs it if the stored copy
// is ever lost, and what applies a language chosen on another device.
chrome.runtime.onStartup.addListener(() => {
  void syncContextMenu();
  void applyOpenMode();
  restoreBadge().catch(() => {});
  void removeUpstreamData();
});

chrome.storage.onChanged.addListener((changes, area) => {
  // Another browser still running upstream may reintroduce its sync metadata.
  if (area === 'sync' && Object.values(changes).some(change => change.newValue !== undefined) && Object.keys(changes).some(isUpstreamDataKey)) {
    void removeUpstreamData();
  }
  if (area !== 'local') return;
  if (QUICK_FILL_ENABLED_KEY in changes || 'language' in changes) void syncContextMenu();
});

// The "Open as" setting: popup, floating window or side panel. Its listeners
// are registered at the top level like everything else here, so they survive
// the worker being evicted and restarted.
// On every worker start, not only on install and startup: disabling and
// re-enabling the extension resets the action to the manifest's popup and the
// panel behaviour to off, while storage still holds the chosen mode — and
// neither of those events fires, so the icon quietly went back to a popup
// until the next browser restart.
void applyOpenMode();
registerOpenMode();
// Both entry points grant `activeTab` for this one invocation, which is what
// makes reading the tab's address and injecting into it possible without any
// host permission. Both are synchronous up to startQuickFill: it may have to
// open the side panel, and Chrome only allows that before the first await.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if ((info.menuItemId !== MENU_ID && info.menuItemId !== COPY_MENU_ID) || tab?.id === undefined) return;
  void startQuickFill({
    tabId: tab.id,
    windowId: tab.windowId,
    frameId: info.frameId,
    pageUrl: info.pageUrl || tab.url,
    mode: info.menuItemId === COPY_MENU_ID ? 'copy' : 'fill',
  });
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== COMMAND_ID || tab?.id === undefined) return;
  // No frame to aim at here: the shortcut says nothing about where the caret
  // is, so every frame is asked and only the focused one answers.
  //
  // Not gated on the "Right-click to insert a code" setting. That one promises
  // exactly what it says — an item in the right-click menu, described as such
  // in every language — and people switch it off to keep a crowded menu tidy,
  // not to lose a shortcut they pressed on purpose. The shortcut has its own
  // off switch, chrome://extensions/shortcuts, where Chrome lists it under the
  // extension's name.
  void startQuickFill({ tabId: tab.id, windowId: tab.windowId, pageUrl: tab.url });
});

export {};
