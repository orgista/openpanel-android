<div align="center">

<img src="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" alt="OpenPanel icon" width="96">

# OpenPanel

**A managed kiosk launcher for Android tablets, Google TV and XR headsets.**

[![CI](https://img.shields.io/github/actions/workflow/status/orgista/openpanel-android/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/orgista/openpanel-android/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/orgista/openpanel-android/badge)](https://scorecard.dev/viewer/?uri=github.com/orgista/openpanel-android)
[![Latest release](https://img.shields.io/github/v/release/orgista/openpanel-releases?style=flat-square)](https://github.com/orgista/openpanel-releases/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%20%C2%B7%20Google%20TV%20%C2%B7%20XR-1c1e20?style=flat-square&logo=android&logoColor=white)](#compatibility)

[Download the APK](https://github.com/orgista/openpanel-releases/releases/latest) · [Build from source](#build-from-source) · [orgista.com](https://orgista.com)

</div>

---

OpenPanel shows an approved catalog of apps and keeps the device inside it. One APK
(`com.orgista.openpanel`) covers phones and tablets, Google TV and XR headsets. It can run
next to an MDM that owns the device (companion mode) or lock the device by itself
(standalone mode).

This repository holds the whole app: the Android project and native bridge at the root,
and the React UI in `src/`.

## Features

- **Approved apps only.** Lists and launches the apps you allow, through a native bridge (`SystemBridgePlugin`).
- **Companion mode.** When an MDM such as ArborXR is the Device Owner, it handles lockdown and OpenPanel is the launcher.
- **Standalone mode.** OpenPanel becomes the Home launcher and locks the device with device admin and lock task, or screen pinning when it is not Device Owner.
- **Settings without leaving the kiosk.** Wi-Fi and Bluetooth scan, connect, pair and forget; battery status.
- **One APK everywhere.** Tablets (`LAUNCHER`), Google TV (`LEANBACK_LAUNCHER`) and headsets as a 2D panel.
- **No secrets in the app.** App backup is off, and no signing keys or tokens live in the source.

## Install

Download the signed APK from the [Releases page](https://github.com/orgista/openpanel-releases/releases/latest),
then upload it to your MDM, or sideload it and use the standalone kiosk setup.

## Compatibility

| Platform | Minimum | Notes |
| --- | --- | --- |
| Android phone and tablet | Android 7.0 (API 24) | Landscape. Target SDK 36. |
| Google TV | Android 7.0 (API 24) | Listed through `LEANBACK_LAUNCHER`. |
| XR headsets | Android 7.0 (API 24) | Runs as a 2D panel. |

## Build from source

You need Node 22 or newer, JDK 21 and the Android SDK.

```bash
git clone https://github.com/orgista/openpanel-android.git && cd openpanel-android
npm ci
npm test && npm run typecheck
npm run build                # vite: src/ -> dist/
npx cap sync android         # copy the web bundle and plugins into the Android project
cd android && ./gradlew assembleDebug    # debug-signed, for development only
```

Release builds refuse to run unless `OPENPANEL_KEYSTORE_FILE`, `OPENPANEL_KEYSTORE_PASS`,
`OPENPANEL_KEY_ALIAS` and `OPENPANEL_KEY_PASS` are set. Java 17 fails Capacitor's source
level 21, so point `JAVA_HOME` at JDK 21.

## Releases

Signed APKs are published on [orgista/openpanel-releases](https://github.com/orgista/openpanel-releases/releases),
each with a `SHA256SUMS` file and a GitHub build attestation.

- **Versions** follow [Semantic Versioning](https://semver.org/). A version with a suffix (`v1.4.0-beta.1`) is a pre-release.
- **Cadence:** a release when a change is ready, and at least one maintenance release a month while the project is in active development. Security fixes ship within 7 days of a confirmed report.
- **Every release** has a [CHANGELOG](CHANGELOG.md) entry.
- **Support:** only the latest release gets fixes. Please update before reporting a bug.

This repository is a public copy of the source, updated with each release. Full policy:
[orgista release process](https://github.com/orgista/.github/blob/main/RELEASING.md).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING](https://github.com/orgista/.github/blob/main/CONTRIBUTING.md)
and the [Code of Conduct](https://github.com/orgista/.github/blob/main/CODE_OF_CONDUCT.md). Changes should pass CI.

## License

MIT. See [LICENSE](LICENSE). The OpenPanel name and icon are not covered by the license.
