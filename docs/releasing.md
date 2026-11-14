# Releasing

The [Build and release workflow](../.github/workflows/release.yml) runs on pushes
to `master`, pushes of `v*` tags, and manual **Run workflow** requests. It uses
Node.js 24, installs the locked dependencies, typechecks, builds once, checks
the emitted extension and packages that exact `dist/` tree. It does not launch
a browser.

## Download the build

[Download authenticator.zip](https://github.com/gentslava/2fa/releases/latest/download/authenticator.zip)
from the latest GitHub Release. Extract it and select the extracted directory
with **Load unpacked** in `chrome://extensions` with Developer mode enabled.

Every successful run also uploads an Actions artifact, retained for 30 days,
containing:

- `authenticator.zip` — extension files with `manifest.json` at the ZIP root.
- `authenticator.zip.sha256` — SHA-256 of the ZIP itself.
- `SHA256SUMS-v<version>.txt` — SHA-256 of every unpacked extension file.

## Publish a version

1. Set the same numeric version in `package.json`, both root-package version
   fields in `package-lock.json`, and `public/manifest.json`.
2. Describe the changes in `docs/release-notes/v<version>.md`.
3. Commit and push to `master`. The workflow creates tag `v<version>` at the
   exact build commit, uploads the checked assets to a draft release, and then
   publishes it as Latest.

An already published version is left unchanged. Subsequent commits at that
version still produce Actions artifacts; bump the version for another release.
An existing tag pointing to another commit is refused. A failed publication can
be rerun: an unpublished draft at the same commit is completed, while published
assets are preserved.

Alternatively, create and push a normal `v<version>` tag yourself, or run the
workflow manually on `master`. The tag must match the package and manifest
version. No custom secrets are required: the release job uses `GITHUB_TOKEN`
with `contents: write`. Build dependencies do not receive checkout credentials.

## Package locally

```bash
npm ci
npm run typecheck
npm run build
npm run check:bundle
npm run package:release
```

The ZIP and checksum files are written to `release/`. Packaging uses fixed ZIP
timestamps, stable file order and file permissions. It checks the existing
per-file checksums before archiving, so a stale or changed `dist/` is refused.

Verify a downloaded ZIP from the directory holding both the ZIP and its checksum:

```bash
shasum -a 256 -c authenticator.zip.sha256
```

After extracting, run the per-file checksum check from the extracted directory:

```bash
shasum -a 256 -c /path/to/SHA256SUMS-v<version>.txt
```

This repository does not publish to the upstream Chrome Web Store listing or
operate the upstream website. Its distribution metadata must describe the
network behavior in README: clock checks, optional browser-managed Google Sync,
and user-opened external pages.

## Appendix: permission justifications

The store keeps these per permission, 1,000 characters each, and asks again
whenever the permission set changes. They are here so the next release does not
have to reconstruct them from the code.

**contextMenus.** Quick fill. The extension adds two right-click menu items:
"Insert 2FA code" on text fields, which puts the current TOTP code into the
login form the user is looking at, and "Copy 2FA code for this site" elsewhere
on the page, which puts the same code on the clipboard — instead of making them
open the popup and copy it by hand.
`chrome.contextMenus` is the only API that can create those items, and it is used
for nothing else: these two items, plus a submenu listing the user's own saved accounts
when the site cannot be matched to exactly one of them. The menu is created by
the service worker from data the user entered themselves; nothing about the page
or their browsing is read to build it, and no item is added for advertising,
promotion or any other purpose. The click on either item is also the user gesture
that authorises everything the feature then does, which is why this is a menu
item and not something that happens on its own.

**storage.** Everything the extension holds is the user's own: their TOTP
accounts and the settings that describe how to show them. `chrome.storage.local`
is the primary copy; `chrome.storage.session` holds the unlocked vault key for as
long as the user's auto-lock setting allows, so it never touches disk;
`chrome.storage.sync` is a second copy through the user's own Google account, on
by default and removed from Google's servers when they turn it off. Nothing about
the pages they visit is sent to the operator. Without this permission the extension cannot remember a single
account between one click of the toolbar icon and the next, which is the whole
function.

**activeTab.** Two things, both started by the user's own click on the toolbar
icon. The hostname of the tab they were on is read so the account for that site
is offered first instead of making them search a list of a hundred; only the
hostname is used, and it is not stored or transmitted. And "Scan QR from screen"
captures that one visible tab, so somebody enrolling in 2FA can scan the code on
screen without photographing their own monitor. Both are limited to the tab that
was active when the click happened and to that one invocation - activeTab grants
nothing before the click and nothing after the tab navigates. The extension
declares no host permissions, so there is no access to any other tab, and no
browsing history is readable at all.

**sidePanel.** New in 1.13.0. Settings gained an "Open as" choice: the toolbar
icon can open the app in the usual popup, in a small floating window, or in
Chrome's side panel. A popup closes the instant it loses focus, which is wrong
for reading a code off the screen while typing it into a form on the page behind
it - the popup is gone before the code has been used. The side panel stays open
while the user moves between tabs. `chrome.sidePanel` is only used to register
the extension's own page as the panel's content and to open it on the user's
click; the panel shows the same account list as the popup and nothing else. It
reads no page and grants no access to one - the panel deliberately does not even
suggest the account for the current site, because that would need the `tabs`
permission. The option is hidden entirely on Chrome versions without a side
panel.

**scripting.** The same quick-fill feature has to put the generated code into the
field on the page, and `chrome.scripting.executeScript` is the only way to do
that. It runs once per user action - the right-click item above or its keyboard
shortcut - on that single tab, under the activeTab grant the user's own click
provides. The extension declares no host permissions and registers no content
scripts: nothing is injected until the user asks for a code, and the injected
function leaves nothing behind when it returns - no listeners, no globals, no
state. In the page it inspects input and textarea attributes
(autocomplete="one-time-code", name, id, placeholder) to find the box that should
receive the code, writes the code there and dispatches the events a form needs to
notice it. If no field accepts it, the code goes to the clipboard instead. It
never reads values the user has typed, page text or credentials, and nothing it
sees on the page is sent anywhere.
