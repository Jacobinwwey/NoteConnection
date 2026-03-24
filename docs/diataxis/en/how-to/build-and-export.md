# How-To: Build and Export

Use this guide when you need release artifacts for desktop and mobile.

## Desktop (Tauri)

```bash
npm run tauri:build
# or mini payload
npm run tauri:build:mini
```

## Android (Capacitor)

```bash
npm run mobile:build:capacitor
```

## Android (Tauri Android)

```bash
npm run tauri:android:init
npm run tauri:android:build
```

## Release Verification

Run targeted operational checks:

```bash
npm run verify:fixrisk:issues
npm run verify:sbom -- --strict 1
npm run verify:sbom:attestation -- --strict 1 --allow-missing 0
```

## Canonical Detailed Sources

- [docs/en/export.md](../../../en/export.md)
- [docs/en/README.md](../../../en/README.md)
- [docs/en/release_v1.6.0_report.md](../../../en/release_v1.6.0_report.md)
