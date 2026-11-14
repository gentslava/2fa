<div align="center">

<img src=".github/assets/banner.png" alt="Authenticator" width="360">

**TOTP codes in Chrome. No billing, no analytics, no account limit.**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ebhcbenbgjmaebpgbldimndmfomjmphd?label=chrome%20web%20store&color=4285f4)](https://chromewebstore.google.com/detail/2FA/ebhcbenbgjmaebpgbldimndmfomjmphd)
[![Users](https://img.shields.io/chrome-web-store/users/ebhcbenbgjmaebpgbldimndmfomjmphd?label=users&color=4285f4)](https://chromewebstore.google.com/detail/2FA/ebhcbenbgjmaebpgbldimndmfomjmphd)
[![Rating](https://img.shields.io/chrome-web-store/rating/ebhcbenbgjmaebpgbldimndmfomjmphd?label=rating&color=e37400)](https://chromewebstore.google.com/detail/2FA/ebhcbenbgjmaebpgbldimndmfomjmphd/reviews)
[![Checks](https://img.shields.io/github/actions/workflow/status/authenticator-sh/2fa/checks.yml?branch=main&label=checks)](https://github.com/authenticator-sh/2fa/actions/workflows/checks.yml)
[![Host permissions: none](https://img.shields.io/badge/host_permissions-none-34a853)](#permissions)
[![License: MIT](https://img.shields.io/badge/license-MIT-4285f4)](LICENSE)

[Install](https://chromewebstore.google.com/detail/2FA/ebhcbenbgjmaebpgbldimndmfomjmphd) ·
[Website](https://authenticator.sh) ·
[How it works](https://authenticator.sh/how-it-works) ·
[Security](https://authenticator.sh/security) ·
[Privacy](https://authenticator.sh/privacy) ·
[FAQ](https://authenticator.sh/faq)

<img src=".github/assets/screenshot.png" alt="The extension's popup: a searchable list of accounts, each with its current code and the seconds left on it" width="440">

</div>

A privacy-focused TOTP authenticator for Chrome. This fork removes upstream's Pro billing, server-controlled account limits, telemetry, remote banners and hosted cloud backups. Accounts stay in browser storage, with optional sync through your own Google account — see [Where your data lives](#where-your-data-lives). No installation identifier or authentication usage is sent to the upstream operator.

## Features

- TOTP code generation (SHA-1, SHA-256, SHA-512; 6 to 10 digits, 7 included — it is issued in the wild). Counter-based HOTP is deliberately refused rather than stored as TOTP, which would look healthy and never once be valid.
- QR code import from image upload, the visible tab, or a camera
- Right-click a code field on any site to insert the code for it, or anywhere else on the page to copy it, without opening the popup (see [Inserting a code into a page](#inserting-a-code-into-a-page))
- **Websites for an account** — tie an account to the sites it is for (Edit
  Account → Websites, or right-click it → Use on this site). There it is
  pinned first and filled without asking; each subdomain can have an account
  of its own (see [Which account a site gets](#which-account-a-site-gets))
- **Optional password protection** — AES-256-GCM encryption of every account
  record and backup, with a recovery code so a forgotten password is not a
  dead end (see [Password protection](#password-protection))
- **Passkey unlock** — open a password-protected vault with Touch ID, Windows
  Hello or your phone through the WebAuthn PRF extension, with no new permission
  (see [Unlocking with a passkey](#unlocking-with-a-passkey))
- **Share an account's codes by link**, for five minutes to an hour — the link
  carries pre-computed codes, never the secret, and there is no server behind
  it (see [Sharing codes by link](#sharing-codes-by-link))
- **Move an account to another app** — Share → Show QR code shows the account's
  otpauth:// QR for Google Authenticator, Aegis and other apps; unlike the link,
  it carries the secret, and the access it gives is permanent
- **Export to Google Authenticator** — choose the accounts and scan them in as
  QR codes of up to ten each; any account Google Authenticator cannot carry is
  named on the list rather than left behind without a word
- **Open where you need it** — the toolbar icon can open the popup, a floating
  window, or Chrome's side panel; the last two stay put while you switch tabs,
  which a popup cannot do because it closes as soon as it loses focus
- **Groups and pins** — sort accounts into groups and filter the list by them;
  create, rename, reorder and delete groups, move many accounts at once, and
  pin the ones you use most to the top. Group names, their order and pins live
  inside the account records, so password protection encrypts them too
- **Right-click an account** to copy, pin, move, share, edit or delete it; from
  the keyboard, Enter in the search box copies the first match and the arrow
  keys walk the list
- **Password-protected backup files** on export
- Automatic local backups in IndexedDB with rotation (7 latest)
- Export and import for cross-device migration, including
  [Credential Exchange Format](#credential-exchange-format) — the FIDO Alliance
  interchange format other password managers and authenticators can read
- 20 UI languages, chosen from the browser's own language on first open and overridable in Settings
- Works fully offline — codes never need a connection, and the popup renders before any network request
- Free, with unlimited accounts and no license or server policy checks

## Permissions

The extension requests the **minimum permissions** required for its functionality:

| Permission   | Reason                                                                          |
|--------------|---------------------------------------------------------------------------------|
| `storage`    | Store accounts and settings in `chrome.storage` (local, session and optional sync) |
| `activeTab`  | Read the current tab's hostname to highlight the matching account, capture the tab for QR scanning, and — only when you pick the right-click item — insert a code into that tab |
| `contextMenus` | Add "Insert 2FA code" to the right-click menu on text fields, and "Copy 2FA code for this site" everywhere else on a page |
| `scripting`  | Run the insert routine in the tab, for that one invocation, under the `activeTab` grant the click provides |
| `sidePanel`  | Open the app in Chrome's side panel, when you pick that in Settings → Open as. It grants the extension nothing about the browser or its tabs: it is what lets an extension page be docked beside them |

Camera scanning needs no manifest permission: it uses the browser's standard
camera prompt on an extension page, granted per extension origin and revocable
in site settings. It is never requested until the scanner is opened.

The extension does **not** request:
- `host_permissions` of any kind
- Content scripts — nothing of this extension is declared to run on any page,
  and nothing of it is running on a page you have not invoked it from
- `tabs`, `cookies`, `webRequest`, or any other broad permissions

This means the extension **cannot read or modify any page on its own**. Two
things happen on your instruction and nowhere else: under `activeTab` it reads
the active tab's hostname while the popup is open, to highlight the account
matching that site — switchable off in Settings, which also erases the history
it collected — and it inserts a code into a page when you pick it out of the
right-click menu.

### Inserting a code into a page

Right-clicking a text field offers one item, "Insert 2FA code"; right-clicking
anywhere else on a page offers "Copy 2FA code for this site", which puts the
same code on the clipboard and never types it into a field. Both are removable
in Settings. The same action has a keyboard shortcut, `Ctrl+Shift+Y`
(`⌘⇧Y` on macOS), which can be changed or cleared at
`chrome://extensions/shortcuts`. Choosing either is what grants `activeTab`: for
that one invocation, in that one tab, the extension may put the code for the
site into the field you clicked. The grant ends with the invocation, nothing is
left behind in the page, and no code of ours runs there again until you ask
again.

### Which account a site gets

An account can carry websites, set by hand: Edit Account → Websites, or
right-click the account with the page open → **Use on** *that site*. They are
stored as hostnames, `www.` dropped, inside the account record — so password
protection encrypts them, and exports carry them. A website
covers itself and its subdomains, and the most specific one wins: with
`main.com` on one account and `sub1.main.com` on another, sub1.main.com gets
only the second, and main.com or sub2.main.com only the first. An account with
websites is never guessed for any other site.

Websites outrank everything below, and they count even with suggestions
switched off — that setting is about what is learned and guessed, and a site
you typed in is neither. One account on the site is inserted without asking;
several are all pinned at the top of the popup, and inserting picks the one
you used there before, or asks.

Without websites, which account is chosen is deliberately conservative. An account you have
already used *on that site* wins — inserted into a field there, or picked when
this asked you which account the site wanted. Failing that, the site's name has
to match exactly one account. Anything less certain — several plausible
accounts, none at all, or a locked vault — opens the popup and lets you pick,
because these forms often submit themselves on the last digit and a wrong code
spends one of the few attempts the service allows.

A code copied out of the popup is deliberately not treated as evidence about
the site behind it. Codes get copied for things that are not the page at all —
a VPN client, an SSH prompt, a phone — so a copy never displaces the account a
site names, and never authorises inserting anything on its own.

If the field will not take the code — some sites build their inputs in ways no
insertion survives — it is copied to your clipboard instead and a note in the
page says so. The fallback is the point: the worst case is the paste you would
have done anyway.

## Password protection

Password protection is **optional and off by default**. With it off, account
records are stored unencrypted in `chrome.storage.local`, protected by the OS
user account and the Chrome profile — the same model as most authenticator
extensions. With it on:

| Property            | Value                                                          |
|---------------------|----------------------------------------------------------------|
| Cipher              | AES-256-GCM (random 96-bit IV per record)                      |
| Key derivation      | PBKDF2-HMAC-SHA256, 600,000 iterations, 128-bit random salt    |
| Master key          | 256-bit random, generated once; the password only wraps it     |
| Fingerprints        | HMAC-SHA256 under an HKDF subkey of the master key             |
| Unlocked key store  | `chrome.storage.session` (memory only, cleared on browser exit) |
| Auto-lock           | Every open / 5 / 15 / 60 min idle / until browser closes       |

Design notes:

- **Two-level keys.** Data is never encrypted with a password-derived key
  directly. A random master key encrypts the records; PBKDF2 output only wraps
  that master key. Changing the password rewrites 32 bytes rather than
  re-encrypting every record — the bulk rewrite is where data gets lost.
- **Recovery code.** A 160-bit code independently wraps the same master key, so
  a forgotten password is recoverable. It is shown once, must be typed back to
  confirm, and is rotated after each use. A reset writes nothing until the
  replacement code has been typed back, so until then the old password and the
  old code both still work.
- **What is encrypted.** The entire account record except its `id` and
  fingerprint — including the service name, so a stolen profile leaks no
  metadata about which services the user has accounts with.
- **Backups too.** IndexedDB snapshots store the already-encrypted records.
  Enabling the vault wipes every pre-existing cleartext copy (local, sync and
  all snapshots) after a decrypt-and-compare round trip verifies the encrypted
  data reads back identically. Verification happens before anything is deleted.
- **Export files** carry their own salt and a password chosen at export time,
  independent of the vault, so a backup stays openable on a machine that has no
  vault configured.

**Threat model.** This protects data at rest: a stolen profile directory, an
infostealer that exfiltrates browser data, or account records reaching Google's
servers through Chrome sync. It does **not** protect against malware running as
the user while the vault is unlocked, or a keylogger capturing the password.

Crypto lives in [`src/utils/crypto.ts`](src/utils/crypto.ts) and
[`src/utils/vault.ts`](src/utils/vault.ts); no cryptographic primitive is
hand-rolled — all of it is WebCrypto.

## Unlocking with a passkey

Available once password protection is on, and off until you add one. A passkey
becomes a **third wrapper around the same master key**, alongside the password
and the recovery code.

| Property           | Value                                                        |
|--------------------|--------------------------------------------------------------|
| Mechanism          | WebAuthn `prf` extension, `eval.first` over a 256-bit stored salt |
| Key derivation     | HKDF-SHA256 over the 32-byte PRF output, `info` = `authenticator-vault-passkey-v1` |
| Relying party      | the extension's own origin; **no host permissions**          |
| User verification  | `required` — presence alone must not release the wrapper     |
| Stored in metadata | credential id, PRF salt, wrapped master key. Never the master key or the PRF output |

Design notes:

- **Additive, never exclusive.** `attachPasskey` only ever adds a wrapper;
  nothing in the codebase removes `wrappedByPassword` or `wrappedByRecovery`. A
  lost passkey costs convenience, not accounts — a passkey-only vault would be a
  new way to destroy every seed.
- **Verified before it is written.** The wrapper is built, unwrapped again and
  compared byte for byte with the key it came from, all in memory. Only a match
  reaches storage, so an authenticator that cannot reproduce its own PRF output
  never leaves behind a wrapper that opens nothing.
- **A password change does not break it.** Only the password wrapper is rebuilt;
  the master key is unchanged, so the passkey keeps working. Covered by a test,
  because the failure would have been silent until the day it mattered.
- **It runs in its own window.** [`src/passkey/`](src/passkey/) is a full
  extension page, opened with `chrome.windows.create({type: 'popup'})` — no
  permission required. Chrome destroys the action popup on focus loss and the
  authenticator prompt takes focus, so the ceremony cannot complete inside the
  popup at all; a window keeps it a dialog rather than an opened tab, and falls
  back to a tab if the window is refused.
- **Uneven platform support is expected.** PRF is solid on Android, Windows 11
  25H2+, macOS 15+ and iOS 18.4+, and absent on Firefox for Android. The setting
  hides itself where the API is missing and reports the case where an
  authenticator declines PRF rather than failing obscurely.
- **The popup listens instead of polling.** The ceremony happens in another
  context, so the popup subscribes to `chrome.storage.onChanged`: a session
  change re-reads the lock state, and a `vault_meta` change re-reads whether a
  passkey is registered. Without this the popup sat on its lock screen with the
  vault already unlocked behind it until it was closed and reopened, and the
  settings panel kept offering to add a passkey that already existed. After a
  successful unlock the ceremony window also tries `chrome.action.openPopup()`
  — best effort, since it needs a user gesture that the biometric prompt may
  have outlived and does not exist before Chrome 127 — and then closes itself.
- **A one-shot hand-off crosses the context boundary.** The ceremony page is a
  separate JS context, and with auto-lock on *every open* the unlocked key is
  deliberately never written to `chrome.storage.session` — so without a hand-off,
  registering a passkey is impossible on that setting and unlocking with one
  silently does nothing. Both were reproduced before the fix. `stageKeyHandoff`
  and `consumeKeyHandoff` pass the key once, under a separate session key, with a
  two-minute expiry; it is deleted on first read, refused when stale, and cleared
  by `lock()`. That keeps what auto-lock *every open* actually promises — the key
  does not outlive the popup that used it — while letting a biometric prompt in
  another window count as the authentication event for exactly one popup.

Implementation: [`src/utils/passkey.ts`](src/utils/passkey.ts) (ceremonies only,
holds no key material) and the passkey functions in
[`src/utils/vault.ts`](src/utils/vault.ts).

## Credential Exchange Format

CXF is the FIDO Alliance's JSON interchange format for credentials. It covers
TOTP secrets as well as passkeys, which makes it the first format this extension
can both write and read that other vendors also speak.

- **Export**: a third option next to the plain and password-protected files.
- **Import**: recognised automatically, so there is no format to choose.
- **The secret** is written as plain RFC 4648 Base32, byte for byte as stored. A
  test asserts the exact string, because a re-encoding bug here produces
  confidently wrong codes rather than a visible failure.
- **Every credential of every item** is examined on import. Password managers
  put a TOTP credential in the same login item as the password; walking only the
  first would drop the 2FA half of the file.
- **One bad row never costs the file.** Unreadable entries are counted and
  reported; the rest import.

CXP, the protocol half of the standard, is deliberately not implemented: it
negotiates provider-to-provider transfer through the operating system, which an
extension cannot do. Implementation: [`src/utils/cxf.ts`](src/utils/cxf.ts).

## Sharing codes by link

A link that shows another person a live code for one account, for a limited
time, in any browser and with nothing to install. Implementation:
[`src/utils/share.ts`](src/utils/share.ts); the page that opens it lives in the
site repository at `authenticator.sh/s`.

- **The secret never leaves the device.** TOTP is deterministic, so the codes
  for the next hour can be computed now and handed over on their own. The link
  holds that run — one code per period — and nothing that could produce a code
  after it. The time limit is not a rule the page enforces; it is the absence
  of any further codes.
- **An hour is the maximum**, and the page refuses longer runs. An hour of
  six-digit codes is about 550 characters: readable as a QR code from a screen,
  which is the one way to pass a link that leaves no copy in a messenger's
  cloud, and short enough for email clients that wrap at 998 characters.
- **There is no server.** The whole payload travels in the URL fragment, which
  browsers never send to a host. Nothing is uploaded when a link is made and
  nothing is stored when it is opened, so there is no database of shared codes
  to breach and no revocation that would be theatre.
- **Optional password.** Without one, the sixteen random bytes in the link are
  the key (HKDF-SHA256). With one, the key is PBKDF2 of the password salted
  with those bytes — the same stretching as the vault — so the link alone and
  the password alone are each useless. The two-byte header that says "ask for a
  password" is authenticated with the body, so it cannot be flipped in transit.
- **The two sides share a fixture, not code.** The extension seals links and
  the site opens them; `test/fixtures/share-vectors.json` pins the exact bytes
  for six cases and both repositories assert against it.

## Building from Source

### Prerequisites

- Node.js 20.x LTS
- npm 10.x

### Build

```bash
npm ci
npm run build
```

The resulting `dist/` directory is the unpacked extension.

### Load in Chrome (development)

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` directory

### Development

```bash
npm run dev
```

### Tests

```bash
npm test
npm run verify      # typecheck + npm test + check:deps
```

`npm run verify` needs internet access: its last step, `check:deps`, talks to
the real time sources the extension depends on (that is its whole point — see
`scripts/check-deps.ts`), so offline it fails even when the code is fine. Run
`npm run typecheck && npm test` for the offline part.

```bash
npm run build && npm run check:bundle   # check the built package in dist/
npm run test:e2e                        # the built extension in real Chromium
```

`check:bundle` reads the build rather than the source: it walks the service
worker's static imports and fails if any file it reaches contains `import()`
(Chrome refuses it in a service worker), and it checks that the manifest, the
default locale, the icons and every HTML page the extension opens are in the
package.

`test:e2e` builds into `.e2e-build/` — never `dist/` — and loads that unpacked
into Chromium with Playwright: adding an account and reading it back from
`chrome.storage.local`, the code on screen against one computed independently,
a delete seen from a second window, Undo, and a service worker that starts
without errors. The first run needs the browser: `npx playwright install
chromium`. External network is blocked inside the tests.

End-to-end scenarios for the storage and vault paths — enabling, locking,
password change, recovery-code reset, encrypted export, disabling — run against
real WebCrypto with `chrome.storage` and IndexedDB mocked. These cover the code
where a bug means permanent loss of a user's 2FA seeds, so they run the real
modules rather than stubs.

The passkey suite covers the wrapper rather than the WebAuthn ceremony, which
cannot run under Node: a stand-in PRF output proves that adding a passkey never
removes the password or recovery wrapper, that a password change and a
recovery-code reset both leave it working, and that neither the master key nor
the PRF output is ever written to metadata.

## Verifying the Chrome Web Store Build

To verify that the version published on the Chrome Web Store was built from this source code:

1. Download the `.crx` for the published version from the Chrome Web Store
2. Unzip it to a directory
3. Check out this repository at the matching git tag (e.g. `v1.13.2`)
4. Run `npm ci && npm run build` using **Node 20 LTS**
5. Compare the `dist/` directory contents with the unzipped `.crx`

Differences should only exist in:
- File ordering inside zips
- Whitespace differences in minified output across Node patch versions

For each release we publish `SHA256SUMS-v<version>.txt` — a SHA-256 for every file in the produced `dist/` — in [GitHub Releases](https://github.com/authenticator-sh/2fa/releases). It is in `sha256sum` format, so you can check your own build against it directly:

```bash
cd dist && sha256sum -c ../SHA256SUMS-v1.13.2.txt   # shasum -a 256 -c on macOS
```

## Architecture

```
src/
├── background/
│   ├── service-worker.ts    # MV3 service worker: install/uninstall URLs, menu, shortcut
│   ├── quick-fill.ts        # Right-click flow: pick account, generate, inject
│   └── quick-fill-page.ts   # The only code that ever runs in a page (injected on demand)
├── popup/
│   ├── App.tsx              # Main UI
│   └── index.tsx
├── scan/
│   └── App.tsx              # Camera QR scanner (own tab — see the file header)
├── passkey/
│   └── App.tsx              # Passkey ceremony (own tab — the popup dies on focus loss)
├── components/              # React components
├── hooks/
│   ├── useAccounts.ts       # Account state + auto-backup
│   ├── useVault.ts          # Lock/unlock state
│   └── useTOTP.ts           # TOTP refresh loop
├── utils/
│   ├── crypto.ts            # WebCrypto primitives (PBKDF2, AES-GCM, HKDF)
│   ├── vault.ts             # Vault lifecycle: unlock, auto-lock, recovery, passkey
│   ├── passkey.ts           # WebAuthn PRF ceremonies (no key material)
│   ├── storage.ts           # Local-primary storage, encryption layer, retry
│   ├── backup-file.ts       # Plain and password-protected export formats
│   ├── cxf.ts               # Credential Exchange Format read/write
│   ├── auto-backup.ts       # IndexedDB backup rotation (7 latest)
│   ├── vault-prompt.ts      # When to offer password protection
│   ├── time-sync.ts         # Optional clock-drift check
│   ├── totp.ts              # TOTP via OTPAuth
│   ├── qr-parser.ts         # QR decoding
│   ├── migration-parser.ts  # Google Authenticator export reader and writer
│   ├── suggestions.ts       # Which account belongs to the site you are on
│   └── screen-capture.ts    # captureVisibleTab wrapper (activeTab only)
└── types/
```

## Network Access

The only automatic HTTPS requests made by this fork are cached clock checks against the three time sources below. They contain no account information, installation identifier or usage events. The manifest's `connect-src` policy restricts extension requests to these hosts and local resources; the build check rejects upstream billing endpoints. No welcome or uninstall website opens automatically, and websites cannot message the extension.

Help, sharing and review links are opened only when you choose them. Those pages are external websites, with their own code and privacy policies. Optional Chrome Sync is provided by the browser through your Google account, separately from extension HTTPS requests.

| URL                                         | When                          | Purpose                        |
|---------------------------------------------|-------------------------------|--------------------------------|
| `https://chromewebstore.google.com/.../reviews` | User takes the rating prompt | Opens the Web Store review form |
| `https://www.authenticator.sh/support`      | User clicks "Help & support"  | Opens the support page         |
| `https://www.authenticator.sh/faq` (or `/<lang>/faq`) | User clicks the help icon, or "How do I fix this?" on the clock warning | Opens the answers, in the popup's language |
| `https://time.akamai.com/?iso`              | Popup open (optional, cached) | Clock drift detection for TOTP |
| `https://timeapi.io/api/time/current/zone?timeZone=UTC` | Popup open (optional, cached) | Clock drift detection for TOTP |
| `https://cloudflare.com/cdn-cgi/trace`      | Popup open (optional, cached) | Clock drift detection for TOTP |

Camera scanning uses `getUserMedia` on an extension page opened in a tab. That
needs no manifest permission — it goes through the browser's standard camera
prompt, granted per extension origin and revocable in site settings. It is
never requested until the user opens the scanner.

The clock-drift requests are unauthenticated GETs that carry no user data and
are cached. Any two of the three agreeing is enough, so one host going offline
does not disable the check — and when none of them can be reached, Settings
says so rather than reporting a clock it never measured. No fonts, scripts, or styles are loaded from remote
hosts — everything needed to render the popup is bundled.

## Fork privacy policy

There is no paid plan, license key, remotely supplied account limit, billing check-in, usage-event queue, remote banner or hosted cloud-backup client. All supported local features work without a license. Imports keep their validation and duplicate protection, without paid-plan limits.

On startup, the service worker removes obsolete upstream billing, telemetry and hosted-backup metadata from local, sync and session storage and clears any previously registered uninstall URL. Account records, vault metadata, local snapshots and preferences are preserved. Synced billing metadata reintroduced by another browser is removed again. Exports contain no installation identifier or billing marker; older backup files still import.

The cleanup is local and does not contact upstream to delete anything already sent there. Historical files under `docs/release-notes/` describe upstream versions and may mention features removed from this fork.

## Where your data lives

| Store | Contents | Default |
|-------|----------|---------|
| `chrome.storage.local` | Accounts (encrypted when password protection is on), settings, and — only while password protection is off — the per-site usage history | Always used; primary |
| `chrome.storage.session` | The unlocked master key, the selected group filter and the per-site usage history — memory only, cleared when the browser closes | Only while unlocked |
| `chrome.storage.sync` | A copy of the accounts and the vault metadata, replicated by Chrome **through the user's own Google account** | On, switchable off |
| IndexedDB | Seven rolling snapshots, in the same form as the primary store | Always used |

Two consequences worth stating plainly:

- **With password protection off, accounts sit in sync in the clear**, which
  means Chrome replicates them to Google. That is the user's own Google account
  and we never see them, but it is not "on the device only". Turning password
  protection on encrypts them before they are ever handed to sync; turning sync
  off in Settings stops the replication and removes what is already there.
- **The per-site usage history is not covered by the vault** while it is being
  collected. Enabling password protection deletes it, and it can be switched off
  independently.

This fork sends no authentication data or usage statistics to the upstream operator.

## Security

See [SECURITY.md](SECURITY.md) for the responsible disclosure policy.

Report security issues to **security@authenticator.sh** — please do **not** open a public issue for security bugs.

## Contributing

Bug reports and pull requests are welcome. Please read [CONTRIBUTING.md](.github/CONTRIBUTING.md) before submitting, and the [Code of Conduct](.github/CODE_OF_CONDUCT.md) for how we expect people to treat each other here.

## Docs

- [Installing from source](docs/install.md)
- [Release notes](docs/release-notes/) — what changed in each version
- [Release checklist](docs/releasing.md) and [review checklist](docs/review-checklist.md)

## Technology

- React 18, TypeScript, Tailwind CSS
- Vite (build)
- [OTPAuth](https://github.com/hectorm/otpauth) (TOTP/HOTP)
- [jsQR](https://github.com/cozmo/jsQR) (QR decoding, lazy-loaded)
- Lucide React (icons)

## License

[MIT](LICENSE)
