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
