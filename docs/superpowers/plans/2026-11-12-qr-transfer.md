# QR Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user re-show an account's `otpauth://` QR from the Share screen, and export chosen accounts to Google Authenticator as a series of `otpauth-migration://` QR codes.

**Architecture:** One shared `QrOverlay` component (a dialog over the current screen that pages through QR "frames") is used by both features. Part 1 adds a "Move to another app" section to `ShareModal` that opens the overlay with `buildOTPAuthURL(account)`. Part 2 adds a protobuf encoder next to the existing decoder in `migration-parser.ts`, a `TransferExport` selection screen, and an export card that opens it.

**Tech Stack:** React 18, TypeScript, Tailwind, `lucide-react`, `otpauth`, `qrcode-generator` (via `drawQR`). Own test runner (`test/run.ts`, `check`/`scenario` from `test/harness.ts`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-12-qr-transfer-design.md` (Russian). Read it before Task 1.

## Global Constraints

- No new dependency, no new permission in `public/manifest.json`, no new network request, no new `track(...)` event.
- Never `console.*` a secret, an `otpauth://` URL or a migration URL.
- Every new i18n key: declared in `src/utils/i18n-keys.ts` and present in all 20 files in `src/utils/locales/`. The ru/en strings below are fixed copy; the other 18 locales are the implementer's careful translation in the tone of the strings around them.
- QR always drawn black on a white field in both themes, padding as quiet zone (as `ShareModal` does now).
- Steam accounts: no change in Part 1 (Share stays hidden for them); in Part 2 they are listed but cannot be selected.
- Commits: style of the repo (imperative, plain English), each ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Spec and plan docs live only on our `master`, never on a `feat/*` branch.
- Publishing an issue or PR, and pushing, happen only after the user approves the text.

## Review Focus

1. An account whose secret cannot be decoded (`isUsableSecret` false) in the export list must be shown as not selectable, never passed to the encoder — one bad record must not kill the whole export. Test in Task 5.
2. Batching at the edges — 10 accounts → 1 QR, 11 → 2, and long labels that would push a QR past readability close a batch early. Test in Task 5.
3. Unicode and colons in issuer/name (`"Acme: Inc"`, `"Банк"`, emoji) survive `parseMigrationURL(buildMigrationURLs(...))`. Test in Task 5.
4. Escape in the QR overlay closes only the overlay, the Share screen stays. E2E in Task 3.
5. A non-standard account (period 60, 8 digits, SHA256) in Share still gets its QR and shows the warning naming exactly those settings. Test in Task 1, E2E in Task 3.

---

## Part 1 — QR on the Share screen (PR 1)

### Task 0: Branches

**Files:** none in `src/`.

- [ ] **Step 1: Remotes and branches**

```bash
git remote add upstream https://github.com/authenticator-sh/2fa.git
git fetch upstream
git checkout main && git merge --ff-only upstream/main
git checkout -b master
git add docs/superpowers/specs/2026-11-12-qr-transfer-design.md docs/superpowers/plans/2026-11-12-qr-transfer.md
git commit -m "Docs: QR transfer design and plan"
git checkout main && git checkout -b feat/share-qr-transfer
```
Expected: `git log --oneline -1 feat/share-qr-transfer` equals `upstream/main`; `docs/superpowers` absent on that branch. Push of `master` waits for the user's go (Task 4).

### Task 1: Which settings are non-standard

**Files:**
- Create: `src/utils/transfer.ts`
- Create: `test/transfer.test.ts`
- Modify: `test/run.ts` (add `['moving accounts to another app by QR', () => import('./transfer.test')]` after the share suite)

**Interfaces:**
- Produces: `export type NonStandardParam = { kind: 'period'; value: number } | { kind: 'digits'; value: number } | { kind: 'algorithm'; value: string };`
  `export function nonStandardParams(account: Account): NonStandardParam[]` — standard is period 30, digits 6, SHA1, read through `totpParams(account)` and `account.algorithm`; order period, digits, algorithm; Steam accounts return `[]`.

- [ ] **Step 1: Failing test** — `export async function run()` with `scenario('Non-standard settings are named, standard ones are not')`:
  - `{period:30,digits:6,algorithm:'SHA1'}` → `[]`
  - `{period:60,digits:8,algorithm:'SHA256'}` → `[{kind:'period',value:60},{kind:'digits',value:8},{kind:'algorithm',value:'SHA256'}]`
  - `{digits:7}` (rest standard) → `[{kind:'digits',value:7}]`
  - a record with `period`/`digits` missing (as imported from an old file) → `[]` (repaired to defaults by `totpParams`)
  - a Steam account → `[]`
- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement `nonStandardParams` in `src/utils/transfer.ts`.
- [ ] **Step 4:** `npm test` → all suites pass, `npm run typecheck` clean.
- [ ] **Step 5:** Commit `Name an account's non-standard OTP settings`.

### Task 2: `QrOverlay`

**Files:**
- Create: `src/components/QrOverlay.tsx`
- Modify: `src/utils/i18n-keys.ts`, all 20 `src/utils/locales/*.ts`

**Interfaces:**
- Consumes: `drawQR(text): Promise<QRDrawing>` from `@/utils/qr-encode`; `useEscapeLayer`, `useReturnFocus` from `@/hooks/useLayer`.
- Produces:
  ```ts
  export interface QrFrame { caption: string; text: string; note?: string }
  export function QrOverlay(props: { frames: QrFrame[]; language: Language; onClose: () => void; lastHint?: string }): JSX.Element
  ```
  `lastHint` is shown under the QR on the last frame only when `frames.length > 1`.

Behaviour (spec «Общий компонент»): `fixed inset-0 z-[60] bg-black/40` backdrop (above the `z-50` screens it opens over); centred card `max-w-sm max-h-full overflow-y-auto`; caption (truncate, `title`), QR via `drawQR(frames[i].text)` re-drawn when `i` changes, on throw show `qr.failed` instead; `qr.scanHint`; optional `note` in the amber box style used by `share.caution`; `qr.permanentWarning` in the same amber box; when `frames.length > 1`: Back / `qr.position` / Next row (Back disabled on first, Next disabled on last); primary button `share.done` closes. Esc via `useEscapeLayer(onClose)`; backdrop click closes; `role="dialog" aria-modal="true" aria-label={caption}`; SVG `role="img" aria-label={t('qr.scanHint')}`; root has `data-testid="qr-overlay"`.

New keys (ru / en):

| key | ru | en |
|---|---|---|
| `qr.scanHint` | Отсканируйте в приложении-аутентификаторе на телефоне. | Scan it with the authenticator app on your phone. |
| `qr.permanentWarning` | Кто отсканирует этот код, получит постоянный доступ к кодам аккаунта. | Whoever scans this gets permanent access to the account's codes. |
| `qr.position` | {0} из {1} | {0} of {1} |
| `qr.next` | Далее | Next |
| `qr.failed` | Не удалось нарисовать QR-код. | Couldn't draw the QR code. |

Back uses existing `common.back`; Done uses existing `share.done`.

- [ ] **Step 1:** Add the keys to `i18n-keys.ts` (own comment block `// The QR overlay: an account, or a batch of them, shown for another app to scan.`) and to all 20 locales.
- [ ] **Step 2:** Implement `QrOverlay`.
- [ ] **Step 3:** `npm run typecheck` clean, `npm test` passes (i18n suite checks locales).
- [ ] **Step 4:** Commit `Add an overlay that shows one or more QR codes to scan`.

### Task 3: Share screen — "Move to another app"

**Files:**
- Modify: `src/components/ShareModal.tsx`
- Modify: `src/utils/i18n-keys.ts`, all 20 locales
- Modify: `e2e/accounts.spec.ts` (or a new `e2e/share.spec.ts` using `e2e/fixtures.ts`)

**Interfaces:**
- Consumes: `QrOverlay`, `QrFrame` (Task 2); `nonStandardParams` (Task 1); `buildOTPAuthURL` from `@/utils/qr-parser`; `accountLabel`.

Changes:
- `share.title` value: ru «Поделиться», en "Share" (and the same sense in all locales). Update the key's comment in `i18n-keys.ts` — the screen now also moves the account.
- First step only (`!link`): above the form a section heading `share.temporaryTitle`; below the submit button a divider and the section `share.transferTitle` with one full-width row button: `QrCode` icon (lucide), bold `share.transferShow`, small `share.transferHint`. Click → `QrOverlay` with one frame `{ caption: accountLabel(account), text: buildOTPAuthURL(account), note }`, where `note` is `t('qr.nonStandard', list)` when `nonStandardParams(account)` is non-empty, `list` joined with ", " from `qr.paramPeriod` / `qr.paramDigits` / the algorithm name as is.
- The URL is built on click, kept only in component state, cleared on close.

New keys:

| key | ru | en |
|---|---|---|
| `share.temporaryTitle` | Временный доступ по ссылке | Temporary access by link |
| `share.transferTitle` | Перенос в другое приложение | Move to another app |
| `share.transferShow` | Показать QR-код | Show QR code |
| `share.transferHint` | Google Authenticator, Aegis и другие. Доступ будет постоянным. | Google Authenticator, Aegis and others. Access is permanent. |
| `qr.nonStandard` | Нестандартные параметры: {0}. Не все приложения их поддерживают — Google Authenticator может показывать неверные коды. | Non-standard settings: {0}. Not every app supports them — Google Authenticator may show wrong codes. |
| `qr.paramPeriod` | период {0} с | {0}s period |
| `qr.paramDigits` | {0} цифр | {0} digits |

- [ ] **Step 1: Failing e2e** — test `the Share screen shows an account's QR, and Escape closes only the QR`: `addAccountByHand(page, 'qr@example.com')`, open Share from the card (`title="Share"`), expect heading "Temporary access by link" and button "Show QR code"; click it → `getByTestId('qr-overlay')` visible with an `svg[role=img]` and text "qr@example.com"; press Escape → overlay hidden, heading "Share" still visible.
- [ ] **Step 2:** `npm run test:e2e -- -g "Share screen"` → FAIL.
- [ ] **Step 3:** Implement the ShareModal changes and keys.
- [ ] **Step 4:** `npm run test:e2e` → all pass; `npm run verify` → pass.
- [ ] **Step 5:** Commit `Show an account's QR on the Share screen to add it to another app`.

### Task 4: Ship Part 1

- [ ] **Step 1:** `npm run verify` and `npm run test:e2e` pass; `npm run build` → `dist/`.
- [ ] **Step 2:** Ask the user to load `dist/` unpacked, scan the QR with Google Authenticator on the phone and compare the code with the extension (and the warning on a non-standard account if they have one). Wait for "works".
- [ ] **Step 3:** Draft in English: issue "Show an account's QR code to add it to another authenticator" (scenario: the site shows the QR once; the previous extension let you re-show it; Share only gives a temporary link) and PR per `.github/PULL_REQUEST_TEMPLATE.md` with `Closes #N`, checklist ticked from real results, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Show both to the user; publish only after "yes".
- [ ] **Step 4:** After "yes": `git push -u origin feat/share-qr-transfer`; `gh issue create -R authenticator-sh/2fa`; `gh pr create -R authenticator-sh/2fa --base main --head gentslava:feat/share-qr-transfer`; `gh issue comment N -R authenticator-sh/2fa --body "PR: <url>"`.
- [ ] **Step 5:** `git checkout master && git merge --no-ff feat/share-qr-transfer && git push -u origin master` (master push also after the user's go).

---

## Part 2 — Export to Google Authenticator (PR 2)

Branch: `git checkout feat/share-qr-transfer && git checkout -b feat/export-google-authenticator`.

### Task 5: Migration encoder

**Files:**
- Modify: `src/utils/migration-parser.ts` (encoder beside the decoder)
- Modify: `test/transfer.test.ts`

**Interfaces:**
- Consumes: `nonStandardParams` (Task 1), `isSteamAccount`, `isUsableSecret`, `cleanSecret` from `@/utils/totp`; `OTPAuth.Secret.fromBase32` from `otpauth`.
- Produces:
  ```ts
  export type MigrationSkipReason = 'steam' | 'secret' | 'period' | 'params';
  export function migrationSkipReason(account: Account): MigrationSkipReason | null;
  export const MIGRATION_BATCH_ACCOUNTS = 10;
  export const MIGRATION_MAX_URL_LENGTH = 1500;
  export interface MigrationBatch { url: string; accounts: Account[] }
  export function buildMigrationURLs(accounts: Account[], batchId?: number): { batches: MigrationBatch[]; skipped: { account: Account; reason: MigrationSkipReason }[] };
  ```
- Reason order: `steam` → `secret` (`!isUsableSecret`) → `period` (any `period` entry) → `params` (digits or algorithm entry).
- Encoding: `MigrationPayload` { 1: repeated `OtpParameters` (message), 2: version = 1, 3: batch_size, 4: batch_index, 5: batch_id }; `OtpParameters` { 1: secret bytes, 2: name = `account.name`, 3: issuer = `account.issuer`, 4: algorithm = 1 (SHA1), 5: digits = 1 (six), 6: type = 2 (TOTP) }. Strings UTF-8. URL `otpauth-migration://offline?data=` + `encodeURIComponent(standard base64)`. `batchId` defaults to a random non-negative 31-bit integer from `crypto.getRandomValues`.
- Batching: fill a batch until it has 10 accounts or adding the next account would make its URL longer than 1500 characters (a single account longer than that still gets its own batch). `batch_size` and `batch_index` written after batching is known.

- [ ] **Step 1: Failing tests** — scenarios:
  - `Every exported account reads back as itself`: 3 accounts incl. issuer `"Acme: Inc"`, name `"Банк 🙂"`, empty issuer → `parseMigrationURL(batches[0].url)` gives the same `secret` (`cleanSecret`-equal), `name`, `issuer`, `algorithm 'SHA1'`, `digits 6`, `type 'totp'`; `unreadable === 0`; `batchIndex 0`, `batchSize 1`.
  - `Ten fit in one code, eleven take two`: 10 → `batches.length === 1`; 11 → 2, second has 1 account, parsed `batchSize === 2`, `batchIndex` 0 and 1.
  - `Long labels close a batch early`: 10 accounts with 200-char names → every `url.length <= 1500` except a batch of one, and the accounts across batches total 10 in original order.
  - `What cannot go is named, not dropped`: Steam → `'steam'`; secret `'!!!'` → `'secret'`; period 60 → `'period'`; digits 8 → `'params'`; SHA256 → `'params'`; none of them in any batch; `skipped.length` equals their count.
  - `URLs are ASCII`: every `url` matches `/^[\x21-\x7e]+$/`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement (varint/length-delimited writers mirroring the decoder's helpers; a file comment noting the pair is one format read from both ends, as `buildOTPAuthURL` does).
- [ ] **Step 4:** `npm test`, `npm run typecheck` → pass.
- [ ] **Step 5:** Commit `Write Google Authenticator migration codes`.

### Task 6: Selection screen and export card

**Files:**
- Create: `src/components/TransferExport.tsx`
- Modify: `src/components/ExportImport.tsx`
- Modify: `src/utils/i18n-keys.ts`, all 20 locales
- Create: `e2e/transfer-export.spec.ts`

**Interfaces:**
- Consumes: `buildMigrationURLs`, `migrationSkipReason` (Task 5); `QrOverlay` (Task 2); `ModalHeader`; `accountLabel`.
- Produces: `export function TransferExport(props: { accounts: Account[]; language: Language; onClose: () => void }): JSX.Element`.

Behaviour:
- `ExportImport`: a last card in the export choice dialog — icon `QrCode`, title `export.ga`, hint `export.gaHint`, outline button `export.gaChoose`. Click: load accounts with `JSON.parse(await exportAccounts())`; if `quarantinedCount() > 0` ask the same `confirmDialog` `runExport` asks (`export.warningPartial`); then close the choice dialog and render `TransferExport` with those accounts.
- `TransferExport`: full screen like `ShareModal` (`fixed inset-0 z-50`, `ModalHeader title={t('transfer.title')}`). Top row: `transfer.selected` (selected / selectable count) and a toggle button `transfer.selectAll` / `transfer.selectNone` (shows "Clear all" while all selectable are selected). List in the stored order: checkbox + `accountLabel`; selectable start checked; skipped rows disabled, unchecked, reason text on the right. Bottom sticky primary `transfer.next` with the count, disabled at 0. Next → `buildMigrationURLs(selected)` → `QrOverlay` with frames `{ caption: t('transfer.batchCaption', first, last, total), text: batch.url }` and `lastHint = t('transfer.lastHint', batches.length)`. Closing the overlay returns to the list with the selection kept.

New keys:

| key | ru | en |
|---|---|---|
| `export.ga` | В Google Authenticator | To Google Authenticator |
| `export.gaHint` | QR-коды для приложения на телефоне — до 10 аккаунтов в каждом. | QR codes for the app on your phone — up to 10 accounts each. |
| `export.gaChoose` | Выбрать аккаунты | Choose accounts |
| `transfer.title` | В Google Authenticator | To Google Authenticator |
| `transfer.selected` | Выбрано {0} из {1} | {0} of {1} selected |
| `transfer.selectAll` | Выбрать все | Select all |
| `transfer.selectNone` | Снять все | Clear all |
| `transfer.next` | Далее ({0}) | Next ({0}) |
| `transfer.skipSteam` | Steam не поддерживается | Steam isn't supported |
| `transfer.skipSecret` | ключ повреждён | damaged key |
| `transfer.skipPeriod` | период {0} с не поддерживается | {0}s period isn't supported |
| `transfer.skipParams` | нестандартные параметры — перенесите через «Поделиться» | non-standard settings — move it with Share |
| `transfer.batchCaption` | Аккаунты {0}–{1} из {2} | Accounts {0}–{1} of {2} |
| `transfer.lastHint` | Отсканируйте все коды по очереди — всего {0}. | Scan every code in turn — {0} in total. |

- [ ] **Step 1: Failing e2e** — `export to Google Authenticator lets you choose accounts and pages through codes`: add 11 accounts by pasting 11 `otpauth://` links (`otherSecret(i)`) the way the existing test "a list of otpauth:// links goes in straight from the first-run guide" does — imports are not held to the free limit, adding by hand may be — then Settings → Export → "Choose accounts"; expect "11 of 11 selected"; uncheck one → "10 of 11 selected", button "Next (10)"; click → overlay with "Accounts 1–10 of 10" and no Next/position row; close; check it back → "Next (11)" → overlay "1 of 2", Next → "2 of 2" and text "Scan every code in turn — 2 in total."; "Clear all" → Next disabled.
- [ ] **Step 2:** `npm run test:e2e -- -g "Google Authenticator"` → FAIL.
- [ ] **Step 3:** Implement `TransferExport`, the card and the keys.
- [ ] **Step 4:** `npm run test:e2e` and `npm run verify` → pass.
- [ ] **Step 5:** Commit `Export chosen accounts to Google Authenticator as QR codes`.

### Task 7: Ship Part 2

- [ ] **Step 1:** `npm run verify`, `npm run test:e2e` pass; `npm run build`.
- [ ] **Step 2:** User scans with Google Authenticator on the phone: one batch, a two-batch series (11+ accounts or a test profile), and confirms codes match and skipped accounts are absent. Wait for "works". If GA turns out to handle 8 digits / SHA256 correctly, ask whether to widen `migrationSkipReason` (one place) before shipping.
- [ ] **Step 3:** Draft issue "Export to Google Authenticator via migration QR codes" and PR (base `main`, head `gentslava:feat/export-google-authenticator`, body says it builds on PR 1 and lists its own commits), `Closes #M`. Show the user; publish only after "yes".
- [ ] **Step 4:** After "yes": push, `gh issue create`, `gh pr create`, `gh issue comment M` with the PR link.
- [ ] **Step 5:** `git checkout master && git merge --no-ff feat/export-google-authenticator && git push`; `npm run build` on `master` for the user's own install.
