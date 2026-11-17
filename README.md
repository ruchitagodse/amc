# AssetDesk — Asset Management System

Independent Next.js 16 / React 19 AMS demo, extracted and adapted from the source HRMS. The source project, credentials and client records are untouched. See [PROJECT_NOTES.md](PROJECT_NOTES.md) for the reuse boundary.

## Run the fictional local demo

Requires Node 24.x, matching the pinned deployment runtime.

```powershell
npm ci
npm run seed
npm run dev -- --hostname 127.0.0.1
```

Open [localhost:3000](http://localhost:3000), then select **Enter fictional demo**. No password or Firebase project is required in this mode. Data persists in ignored `.demo-data/state.json`. The seed is repeatable and preserves existing records. Local demo access is restricted to loopback URLs; do not deploy local mode as a shared service. Its atomic file adapter supports one Next server process only.

For a production-mode local demonstration:

```powershell
npm run build
npm run start -- --hostname 127.0.0.1
```

## Demonstration scenario

The initial seed contains 12 fictional assets, 5 employees and 2 vendors. The Dell Latitude starts available, ready for this walkthrough:

1. Open **Asset Master → Dell Latitude 5440**.
2. Select **Generate QR**, download PNG or print its label.
3. Select **Assign asset → Rahul Sharma**.
4. Open **Scan QR Code** and use the camera, upload the downloaded PNG, or paste the label URL.
5. Select **Report damage**, enter “Battery no longer holds charge”, choose **ABC Technologies**, and enter the date and estimate.
6. Advance **Sent to Vendor → Under Repair → Repaired → Returned**, recording actual cost and notes. Actual cost is required to complete the repair.
7. **Returned** in the repair register means received back from the vendor. Use **Return asset** to close Rahul's allocation and return the laptop to available inventory.
8. Review the complete lifecycle on the asset detail page and updated overview counts.

Dashboard counts refresh every 15 seconds and immediately after a change. Assigned includes assets with an active holder even while under repair; these counts intentionally overlap maintenance. All figures come from the active store.

## Separate Firebase configuration

No cloud project has been created or connected. Use a **new, dedicated demo project**; never use production credentials.

1. Copy `.env.example` to `.env.local`. Set `AMS_STORE=firestore`, a new `FIREBASE_PROJECT_ID`, matching `AMS_FIREBASE_PROJECT_CONFIRM`, service-account email/private key, and a random `SESSION_SECRET` of at least 32 characters.
2. Set the matching `NEXT_PUBLIC_FIREBASE_*` values. Enable email/password sign-in in Firebase Authentication. Google and Microsoft popup sign-in are also supported when those providers and authorized domains are configured in the separate Firebase project. All providers require a provisioned administrator account. Public Firebase app configuration is not a service-account secret.
3. Create an administrator in that isolated project's Firebase Authentication. Set `AMS_ADMIN_EMAIL` and `AMS_SEED_TENANT`, then run `npm run provision:admin`. The script assigns `role: tenant_admin` and the selected tenant ID to an **existing** user. It refuses users with conflicting existing tenant claims.
4. Run `npm run seed` with `AMS_SEED_TENANT` set. Only fictional records are added.
5. Deploy rules with `npx firebase deploy --only firestore:rules,storage --project YOUR_SEPARATE_PROJECT_ID` after reviewing the explicit project ID.
6. Rebuild after setting public Firebase values. Firebase mode disables the local demo login. Each API request rechecks the current user's enabled state, administrator claim and tenant claim. The signed session is HTTP-only and lasts seven days; role/tenant changes revoke access immediately.

All direct Firestore and Storage client access is denied. The server Admin SDK is the only data access path; server commands validate input, tenant context and lifecycle transitions. Scope is intentionally IT administrator only. No public employee endpoint or file uploads are exposed.

Firestore stores the bounded demo aggregate at `amsTenants/{tenantId}/state/current`, updated in transactions. This adapter deliberately caps payloads at 850 KB. Split into per-entity collections and indexed queries before a larger deployment. The source Prisma schema and HRMS data have not been migrated or modified.

## Vercel deployment

The local fictional demo is restricted to localhost and writes to `.demo-data`; it cannot serve as cloud storage. For Vercel, configure the separate Firebase project described above and add its values to the deployment environment before rebuilding:

Node is pinned to 24.x and Firebase Admin to a compatible 13.x release in `package.json`. Commit both `package.json` and `package-lock.json` and redeploy with the build cache disabled after updating from the original demo. This resolves the `jwks-rsa` / ESM-only `jose` startup error seen with Firebase Admin 14 in the deployed runtime. A regression test imports Auth and Firestore with `require(esm)` explicitly disabled.

- `AMS_STORE=firestore`
- `FIREBASE_PROJECT_ID` and matching `AMS_FIREBASE_PROJECT_CONFIRM`
- `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY`
- A stable random `SESSION_SECRET` of at least 32 characters
- Matching `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `AMS_PUBLIC_URL` set to the deployed HTTPS origin

Enable the required Firebase sign-in providers, authorize the deployed domain, provision a tenant administrator and run the seed locally against that separate project. Do not set emulator hosts on Vercel. Public Firebase values are included at build time: redeploy after setting or changing them. Never upload service-account JSON files or commit secrets.

After deploying, `/api/state` should return a JSON 401 before sign-in, or a JSON 503 naming missing configuration. An empty 500 from every API route indicates a function startup/runtime failure: inspect the first error in the deployment's Vercel Runtime Logs. The frontend now handles empty/non-JSON responses and stops showing an indefinite loading state; it cannot repair a remote server startup failure.

## Mobile QR demonstration

Physical mobile camera scanning requires a reachable HTTPS deployment configured in Firebase mode. Set `AMS_PUBLIC_URL` to that deployment's exact origin before creating/downloading labels. Sign in on the mobile device first. The local loopback-only demo cannot be opened from a phone on another device. Camera permissions must be allowed; image upload and URL entry are available as fallbacks. A QR holds only the asset detail URL, never employee or financial data.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:build
npm run test:e2e
npm run test:firebase
npm run build
```

The browser suite uses production output, a separate `state-e2e.json` fixture and port 3100. Firebase integration uses the `demo-ams` emulators only, ports 8080/9099/9199, and a temporary production server on port 3200. Java 21 is required for the emulators. `test:firebase` verifies transactions, tenant isolation, disabled/removed administrators, signed sessions, and Firestore/Storage rules. `npm run test:rules` runs only the rule suite.

Use **Employee Allocation → Add employee** to create staff records and **Edit** on their cards to update them. These are allocation records, not Firebase login accounts. See [TESTING.md](TESTING.md) for the employee testing walkthrough.

Physical camera hardware, configured Google/Microsoft providers, a real cloud deployment and real printer output require environment-specific acceptance testing. They are not claimed as tested by the automated suite. The runtime dependency audit is clean after a patched gRPC override; Firebase CLI development dependencies still report moderate advisories. No forced breaking downgrade is applied. Phase exclusions remain unchanged: no employee portal, approval workflows, email notifications, procurement, AMC, accounting or advanced analytics.
