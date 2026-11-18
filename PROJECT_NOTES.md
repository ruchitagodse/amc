# Asset Management System

## Initial audit
- Source `C:/Ruchita/Next/Universe_CC_tool/saashrms` is read only. No source environments, data, Git metadata, or credentials are copied.
- Source: Next 16 / React 19, Prisma/PostgreSQL asset records, Firebase identity and Storage, Redis-backed membership sessions. It does **not** use Firestore for assets.
- Existing asset master, governed category identifiers, vendors, allocation/history, maintenance and disposal are implemented. Their services depend on the larger HRMS (tenants, membership, notifications, Prisma and Redis); copying them unchanged would require the full HRMS and conflict with the requested independent Firestore demo.
- Reuse: workspace primitives, confirmation modal, CSV export, signed session-cookie implementation and shared errors copied from source. Asset fields, canonical statuses, identifier patterns and allocation/maintenance invariants retained in the independent domain adapter. Source UI design contract: white surfaces, restrained brand accents, compact operational tables.

## Architecture and implementation
- Next App Router; typed command domain; server-only authenticated API; transactional Firestore adapter and atomic local JSON demo adapter. Asset identifiers and history remain canonical; repair records extend existing lifecycle semantics.
- Firebase identity is verified server-side; signed HTTP-only sessions are revalidated against current Firebase user and administrator/tenant claims. Local fictional demo sessions are restricted to loopback requests and disabled in Firebase mode.
- This is a focused extraction/adaptation, not a claim that the original Prisma services run unchanged. No real employee fields or source database are imported.
- Progress and verification results are recorded below as implementation proceeds.

## Delivered modules
- Overview with store-derived counts, recent assets/activity and open repair summary; refreshed every 15 seconds.
- Asset Master create/edit/search/category and status filters/pagination/CSV; governed category counters; editable vendor directory.
- Employee allocations, transfers, returns and allocation history. Retirement requires a returned asset without open repairs.
- QR generation is recorded once; protected PNG endpoint, printable label, camera/image/URL scanning, strict same-origin asset URL validation and invalid-asset state.
- Damage and repair register: existing vendor selection, report date, description, estimate, actual cost, notes and enforced five-stage progression. Employee assignment is retained during repair and closed separately on return.
- Asset lifecycle uses the existing canonical mutation event stream rather than a second generated history. Commands are idempotent; Firestore transactions and a serialized atomic file adapter protect concurrent updates.

## Main files
- `components/workspace.tsx`, `components/scanner.tsx`, `app/globals.css`: operational workspace and responsive UI.
- `lib/domain.ts`, `lib/store.ts`, `lib/demo.ts`: validated workflows, storage adapters, repeatable fictional fixtures.
- `app/api/{session,state,commands,qr}/route.ts`, `lib/auth.ts`, `lib/firebase-admin.ts`: authenticated server boundary.
- `modules/auth-session/session-cookie.ts`, `components/ui/*`, `components/tenant/master-export-utils.ts`, `shared/errors/*`: source-derived reusable code.
- `scripts/seed.ts`, `scripts/provision-admin.ts`, `.env.example`, `firestore.rules`, `storage.rules`, `firebase.json`: independent configuration and demo setup.
- `tests/*`, `playwright.config.ts`, `README.md`: verification and run instructions.

## Deployment limits and pending acceptance
- No external Firebase account/project is provisioned. Cloud setup requires separate credentials and explicit project confirmation, as documented in README.
- A bounded single-document Firestore aggregate is appropriate for this demo, capped at 850 KB; a larger deployment needs per-entity collections. Local JSON mode supports a single server process and loopback access only.
- Physical mobile camera hardware, real printer output and Google/Microsoft provider configuration require acceptance in the target environment. Automated tests use generated QR images and a synthetic video stream, not a physical camera.
- Production dependency audit is clean after a patched gRPC override. Thirteen moderate findings remain in Firebase CLI development tooling; no forced breaking downgrade was applied.
- Original Prisma/Redis tenant-membership integration is intentionally not connected. This independent adapter uses Firebase administrator/tenant claims, checked against current user state on every request. No source HRMS data migration was attempted.

## Verification notes
- TypeScript and ESLint pass with no warnings. Eight domain/session tests pass, including the Dell repair scenario, invalid transitions/references, duplicate retries, transfers, category uniqueness, QR URL validation and signed-cookie tampering.
- Firebase emulators: two integration/rules tests pass after the gRPC dependency patch. Coverage includes transactional QR event uniqueness, repeatable Firestore seed, tenant isolation, disabled/downgraded administrators and denied direct Firestore/Storage access.
- QR testing found the initial decoder could not read one valid generated label. Replaced it with jsQR, verified that captured frame independently, and tested every fictional asset's label. Camera permission rejection and synthetic live-camera decoding pass; this does not substitute for physical-device acceptance.
- Responsive testing found absolutely positioned screen-reader table text extending the mobile page. The table scroll container now establishes its own containing block, preserving internal horizontal table scrolling.
- Final verification: production build passes; five Chromium end-to-end tests pass (including all 12 QR labels, synthetic camera, complete repair scenario, all master forms, mobile width and sign-out). Eight domain/session tests and two Firebase emulator integration/rules tests pass. Desktop and mobile screenshots reviewed in `test-results/`. No physical hardware/cloud-provider testing is claimed.

## Vercel deployment correction
- Live inspection confirmed that `/api/state`, `/api/session` and `/api/commands` returned empty HTTP 500 responses while `/login` loaded normally. Supplied runtime logs identified Firebase Admin 14 → jwks-rsa 4 → ESM-only jose 6 failing under CommonJS require.
- Reproduced the identical `ERR_REQUIRE_ESM` locally using `node --no-experimental-require-module`. Pinned Firebase Admin 13.10.0 (jwks-rsa 3.2.2 / jose 4.15.9) and added a subprocess regression test for Auth/Firestore imports under that restriction. Node runtime is pinned to 24.x.
- Firebase imports are now deferred until needed. Cloud configuration errors return JSON 503 with missing setting names; local file storage remains disallowed on Vercel. Added defensive response parsing, asset-state validation and a recovery state for empty/non-JSON responses, including handled session-fetch failures.
- Deployment needs the updated package files and a fresh Vercel build. Configure the separate Firebase project and cloud environment variables per README; the local seed file and localhost login are intentionally not deployed as cloud storage/authentication.
- Pinned a CommonJS-compatible UUID 11 release through overrides to remove security findings introduced by the compatible Firebase SDK dependency tree. Current production audit reports zero vulnerabilities; eleven moderate findings remain in development tooling.
- Verification after deployment correction: TypeScript and ESLint pass; production build passes; twelve unit/runtime tests, six browser tests and two Firebase emulator tests pass. The emulator integration server also runs with `--no-experimental-require-module`. The remote Vercel deployment has not been changed; it must be rebuilt from the updated code and lockfile before live verification.

## Employee management
- Added administrator-only `employee.save` through the existing validated command API, with create/edit forms in Employee Allocation. Names/departments are normalized and duplicate pairs rejected. Editing retains employee IDs and existing asset/allocation references.
- Employee records require no Firebase login or password. Employee self-service remains outside this phase.
- User narrowed this change to employee management; proposed mobile layout changes were removed. Existing mobile layout is preserved.
- Added a targeted employee domain test and browser workflow for create, edit, persistence, duplicate rejection, allocation and return. `TESTING.md` contains the manual employee walkthrough. A fictional test-build helper keeps browser checks isolated when local cloud credentials are configured.

## Repair completion and visible wording
- Added an explicit Repair status selector and named actions such as Mark as repaired and Mark as returned. The dialog shows the current saved status separately from the chosen update.
- Forward status updates can record completed work without inventing skipped milestones. Repaired/Returned require actual cost; Returned requires a saved Repaired state. Duplicate retries remain idempotent and backwards transitions are rejected.
- Removed the word requested by the user from login/footer/sidebar messages and future seed notes. The known legacy allocation-note label is rendered as Demonstration allocation while preserving original audit records.
- Verification: fourteen unit/runtime tests pass; the phone repair selector and complete repair browser walkthrough both pass, including actual-cost persistence and one lifecycle event per completion/return. TypeScript and ESLint pass. Screenshot reviewed at `test-results/mark-repaired-phone.png`.

## Enterprise desktop UI and public QR access
- Shared stylesheet updated to a white/light-gray/navy palette with teal/blue accents, consistent desktop typography, tables, cards, forms, buttons and modals. Existing workspace layouts and business modules are reused; no mobile redesign.
- New QR labels use server-generated 256-bit random tokens. Optional asset token/revocation fields and a private hashed lookup collection support anonymous reads across tenants without publishing database IDs. Lookup creation, rotation and deletion share the asset transaction.
- Public card and GET-only API use an explicit whitelist: public asset code, name, category, brand, model, status, condition. No employee/contact/serial/cost/vendor/notes or tenant/database identifiers are serialized. Admin APIs, QR PNG download and token mutations stay authenticated.
- Public scanner is accessible without login. Admin controls preview, revoke and regenerate public links with confirmation. Legacy labels stay private and must be replaced; brand/model can be filled through existing asset forms.
- Validation: TypeScript, ESLint and production build pass. Eighteen unit/runtime tests, five targeted browser tests and two Firebase emulator integration/rules tests pass. Tests verify anonymous scanning, the exact public-field allowlist, protected admin operations, token rotation/revocation, transaction-backed hashed lookups, all demo labels and existing repair workflows. Reviewed screenshots: `enterprise-dashboard.png`, `enterprise-asset-form.png`, `public-asset-card.png` in ignored `test-results/`.
