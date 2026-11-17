# Android / Bazaar release

Status: source implementation, not a store submission. Package: `ir.azmounbarg.app`; app label: آزمون‌برگ. Confirm package ownership before the first upload: the identifier and signing key must remain stable for upgrades.

## Build

Use Node 22.12+, JDK 21, Android SDK platform 36 and build tools 36.0.0. Set `JAVA_HOME` and `ANDROID_HOME` for your installation. This Mac has JDK 21 at `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` and an SDK at `/opt/homebrew/share/android-commandlinetools`.

```sh
npm ci
npm run android:sync
npm run android:debug
```

`android:sync` builds the shared Vue application and copies local assets/plugins into the committed Android project. There is no remote `server.url` or live-update service. Open `apps/frontend/android` in Android Studio to install/debug. Debug APKs go to `android-release/azmounbarg-debug.apk` after a successful Gradle build.

For a signed release set these variables in a secure shell/CI environment:

- `VITE_API_URL`: production HTTPS API origin, with no trailing `/api`.
- `VITE_SUPPORT_EMAIL`: monitored public support contact, included in the binary.
- `ANDROID_VERSION_CODE`, `ANDROID_VERSION_NAME`: increasing integer and public version.
- `ANDROID_KEYSTORE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`: your existing release identity. Back it up securely. Never commit a keystore or signing passwords.
- `ANDROID_FONT_LICENSE_EVIDENCE`: local file recording permission to distribute Dana and B Nazanin and embed B Nazanin in PDFs. The release command fails without it. Do not substitute an unverified assertion for permission from the rights holder.

```sh
npm run android:release
```

Outputs: `android-release/azmounbarg-release.apk` and `.aab`. Verify with Android SDK `apksigner verify --verbose` and `bundletool validate` before submission. Do not submit a debug APK. The script cannot validate the legal sufficiency of font evidence.

## Backend configuration

Configure production `APP_URL`, session/OTP secrets, MongoDB replica set, HTTPS reverse proxy and working email delivery. Phone login is shown only if the server has a real SMS adapter; the entry point currently does not wire a vendor adapter, so configure SMTP and use email until one is integrated. Console OTP is rejected in production.

Create three monthly **subscription** products in Bazaar. Do not configure consumables for recurring access. Set server-only `BAZAAR_API_TOKEN` (new Pishkhan API secret), `BAZAAR_RSA_PUBLIC_KEY` (receipt verification), `BAZAAR_TOKEN_SECRET` (stable encryption secret), `BAZAAR_PACKAGE_NAME`, `BAZAAR_SKU_STANDARD`, `BAZAAR_SKU_PROFESSIONAL`, `BAZAAR_SKU_PROFESSIONAL_AI`. Never put these values in `VITE_` variables. Retain the token encryption secret across deployments.

The UI fetches prices from Poolakey. Set Bazaar prices equal to or lower than the matching website prices. Purchase intents bind a signed developer payload to an app account. The backend verifies RSA signatures, package/product/token binding, ownership and provider state before granting access. Restore requires the original app account. Subscription reconciliation runs on foreground refresh, restore and a server timer every 15 minutes. Multiple servers are safe to repeat reconciliation; monitor `bazaar_reconcile_failed`. Cancellation preserves access through the verified paid period. Production mock checkout and confirmation are blocked.

Provider period responses expose initial start and current expiry. Monthly quota IDs derive from the original anchor and verified monthly cycle; no new quota is created by polling. Check real renewal dates, refunds and cancellation against Bazaar test products before launch. Offline entitlement snapshots never authorize server operations.

## Required release checks

1. Configure real products, contact details, privacy disclosures and retention practices; review the Persian privacy/terms pages with the actual operator and providers. Publish `/privacy` on the production site.
2. Obtain redistribution/embedding permission for bundled proprietary fonts or replace them with the included OFL fonts and retest layout. Current source preserves existing document fonts.
3. Test a real purchase, restore after reinstall, cross-account rejection, interrupted verification, cancellation, renewal, expiry and refund on Bazaar-installed Android. Local signed-receipt tests are not a real payment test.
4. Install on Android 7/API24 and a current Android version. Verify Persian/English keyboards, keyboard-open layouts, Back, rotation, background/process restart, private images/fonts, system file picker, PDF save and share. Upgrade a signed installation with pending drafts; verify no draft loss.
5. Capture genuine device screenshots, supply reviewer login instructions using a working OTP channel, set the appropriate age/category/content disclosures and provide a monitored support address.
6. Run `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:pdf`, then verify the final signed artifacts. Recheck current Bazaar console requirements when submitting.

No signing credentials, Bazaar account access, real purchase receipt or permission to publish were supplied in this session. No production deployment or store upload has been performed.

## Local provider outage simulation

The Postman mock is generated from the documented verification subset, with an explicit 503 response. Owner mock discovery was unavailable because the CLI was signed out. It is deliberately not a substitute for the provider success contract.

```sh
postman simulation run postman/simulations/bazaar-outage/bazaar-outage/bazaar-outage.sim.yaml --port 4019 --no-history --output ndjson
# In a separate terminal:
node scripts/bazaar-outage-check.mjs
```

The check runs the real billing service against local HTTP through a test-only fetch redirect. It asserts a recoverable 503 and zero entitlements. It cannot contact the real provider. The context file records scope and evidence.

## Verification recorded in this workspace

- `npm test`: 83 passed, including native challenge binding, hashed/revocable sessions, signed receipt ownership/idempotency, cancellation/outage/refund behavior and production mock-payment blocking.
- Desktop Chromium + phone regression: 60 passed (two workers). Focused phone/offline/storage-exhaustion checks also passed 6/6 after final persistence changes (`tests/browser/mobile.spec.js`).
- `npm run test:offline`: production service-worker test passed with the browser genuinely offline, including reload, preview, recovery and reconnect sync.
- `npm run test:pdf`: completed the PDF fixture set. `npm run build` and Capacitor sync passed.
- Local Postman HTTP 503 check passed; the simulation recorded the real verification request and no entitlement was created.
- Initial Firefox attempt could not launch on this machine: Playwright's installed Firefox reports “Could not find profile folder,” including when using `/private/tmp`. Firefox application behavior remains unverified.
- Android Gradle build was attempted but not completed: SDK manager could not obtain platform 36; Google repository requests returned HTTP 404 in this environment. The long Gradle distribution download was stopped after that prerequisite failure. No APK/AAB, signed upgrade or physical-device validation is claimed.

## Retry — 2026-11-15

- Android SDK retry: SDK Manager still could not fetch platform 36 or build tools 36.0.0. Direct Google repository checks returned HTTP 404. Gradle was retried, then stopped because the required SDK remains unavailable; no APK/AAB was generated.
- No Android device was connected to adb. Device, signed-upgrade and live Bazaar purchase checks remain pending.
- Configuration presence was checked without printing secrets: Bazaar API key/public key and all three product identifiers, signing configuration, public support email and font-license evidence are absent. SMTP configuration exists, but delivery was not tested by sending an unsolicited email.
- The user chose to preserve Dana and B Nazanin pending license evidence. No font substitution was made; distribution still requires permission.
- Firefox launch was repaired by assigning a temporary macOS app-data home (`CFFIXED_USER_HOME`) in the Firefox-only Playwright launch options. Personal Firefox profiles are untouched. The app-data directory lives under the OS temporary directory; macOS manages its lifetime. Automatic recursive cleanup is deliberately avoided because macOS can protect synthetic subdirectories and block worker exit. See https://github.com/microsoft/playwright/issues/42768 for the upstream issue.

- Final Firefox retry: all 31 tests passed in 1.1 minutes and the test process exited successfully after the app-data cleanup adjustment.

## Successful Android build — 2026-11-15

Repository access recovered on the latest retry. Android SDK 36, Build Tools 36.0.0 and Gradle 8.14.3 installed successfully. `npm run android:debug` completed all 336 tasks and produced `android-release/azmounbarg-debug.apk` (about 7.8 MB). `apksigner verify --verbose` passed with APK signature v2. Package `ir.azmounbarg.app`, version 1.0.0/code 1, minimum API 24 and target API 36 were verified with aapt. This supersedes the earlier SDK/build blocker.

This artifact is debug-signed for testing, not the signed Bazaar release. No Android device was connected for installation/runtime checks. Release credentials, Bazaar configuration, support details and font-license evidence remain required.

### Temporary font placeholder

At the user's request, release builds currently fall back to `docs/android/font-license-evidence.txt` if `ANDROID_FONT_LICENSE_EVIDENCE` is unset or points to a missing file. This permits building with the empty placeholder and prints a notice. It does not verify font permissions. Set the variable to a valid evidence file when the permissions are obtained.

The Android build script now auto-detects the installed Homebrew JDK 21 and SDK on this Mac when the environment variables are absent. Java is checked before the web build, and the absolute APK path is printed only after a successful native build and copy. Explicit valid environment settings remain supported.
