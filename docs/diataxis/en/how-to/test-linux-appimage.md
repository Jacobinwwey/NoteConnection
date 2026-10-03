# How-To: Test the Linux AppImage

Build release AppImages on Ubuntu 22.04 with glibc 2.35, matching the AppImage catalog's Linux baseline and the artifact architecture. Use a normal desktop user and an isolated test profile for application testing. The Linux desktop release matrix pins `ubuntu-22.04` so a moving runner image cannot silently raise the minimum glibc version.

## Build and verify the final artifact

Install the usual Tauri Linux build dependencies and the artifact verifier tools:

```bash
sudo apt-get install desktop-file-utils libgdk-pixbuf2.0-bin squashfs-tools
npm ci
npm run tauri:build:mini
npm run verify:appimage -- src-tauri/target/release/bundle/appimage/NoteConnection_1.8.0_amd64.AppImage src-tauri/bin/server-x86_64-unknown-linux-gnu
sha256sum src-tauri/target/release/bundle/appimage/*.AppImage
```

Substitute the actual release filename. `verify:appimage` reads the final SquashFS manifest, checks that packaged files are readable and executables/directories usable by users other than the build owner, then extracts into a fresh temporary directory with `unsquashfs`. This preserves stored permissions; the AppImage runtime's `--appimage-extract` can replace directory modes with 0700.

The verifier rejects absolute, escaping, dangling, or cyclic integration links, checks `.DirIcon`, the root desktop entry, `AppRun`, `AppRun.wrapped`, the desktop `Exec` target and themed icon, validates the desktop file with `desktop-file-validate`, and decodes the icon with GDK Pixbuf. The required second argument is the original server sidecar from the same build: the packaged server must match its complete SHA-256, including the appended pkg payload. It deletes its temporary extraction on success or failure. The Linux release workflow runs it before either artifact upload.

Run the regression suite with:

```bash
npm test -- --runInBand src/appimage.portability.test.ts src/appimage.patchelf.test.ts src/simulation.worker.offline.test.ts
```

## Verify application behavior

The artifact gate checks packaging. Also launch the actual final AppImage on Ubuntu 22.04 from a directory outside the repository as a normal user. Use isolated XDG config/data directories, `NOTE_CONNECTION_CONFIG_PATH`, and disposable Markdown notes; keep the operating-system home and toolchain caches in their normal locations. Confirm a real visible window, successful graph loading, note reading, switching into and out of Path mode, and clean shutdown of the server and Godot sidecars. Retain the exact artifact SHA-256, source commit, installed Tauri CLI version, command output, and screenshots with the test report.

For catalog acceptance, repeat launch as a different user from the packaged file owner under the catalog's Xvfb/firejail environment. A launch as the build owner can hide mode 0770 defects. A process remaining alive does not establish that a window rendered. Classify missing FUSE, display, or firejail support separately from failures in the artifact.

Load a graph with external network access disabled while preserving loopback access to the local backend. Confirm separated node positions in force and DAG layouts. The simulation worker uses the existing bundled D3 library; a CDN import can leave all nodes at their initial positions even though graph APIs and the initial catalog screenshot pass. The offline worker test loads the real packaged scripts, rejects external origins, and verifies simulation output.

## Keep the glibc build baseline compatible

Native Ubuntu 22.04 testing showed that both the published image and a packaging-corrected image built on Ubuntu 24.04 failed before opening a window: the main executable required `GLIBC_2.39`, and bundled libraries required `GLIBC_2.38`. Ubuntu 22.04 provides glibc 2.35. Correct icons, launcher permissions, and intact sidecar bytes do not establish compatibility with that runtime.

Rebuild the executable and bundled libraries on the supported Ubuntu 22.04 baseline, then launch the resulting final artifact there. Preserve the target OS and `ldd --version` output with native acceptance evidence. A successful launch on a newer build host cannot prove this older runtime requirement.

## Why the CLI version matters

[AppImage catalog PR 8838](https://github.com/AppImage/appimage.github.io/pull/8838) exposed two defects in the packaging chain used by the published 1.8.0 image: `.DirIcon` pointed at an absolute CI build path, and `AppRun.wrapped` had mode 0770. The image contained the icon bytes, but another machine could not resolve the link; a user outside the stored owner/group could not execute the wrapped launcher.

The npm Tauri CLI embeds the bundler. CLI 2.11.4 includes the [relative symlink fix](https://github.com/tauri-apps/tauri/pull/15596); CLI 2.12.0 updates linuxdeploy to [normalize launcher permissions](https://github.com/tauri-apps/tauri/issues/16155). The repository requires CLI 2.12.1 and locks its platform packages to that version, incorporating both corrections. `Exec=npm` names the existing bundled Cargo executable and is valid. Repacking the published image by hand is useful for diagnosis but does not verify a corrected release build.

## Preserve the pkg sidecar during packaging

Native testing also exposed a separate failure after the window opened: linuxdeploy rewrote the server ELF's RPATH, moving pkg's appended payload while leaving its embedded offsets unchanged. Node then crashed before application startup. Upgrading the CLI alone does not prevent this transformation.

The existing Linux build runner selects `scripts/appimage-patchelf.js` through linuxdeploy's supported `PATCHELF` setting. The adapter suppresses only `--set-rpath` for the exact product AppDir's `usr/bin/server`, after verifying its bytes match the original sidecar. It forwards read queries and operations on other executables/libraries to the resolved original patchelf, including a caller-specified `PATCHELF`. A changed server fails immediately. Keep using `npm run tauri:build:mini` (or its existing runner); invoking `npx tauri build` directly bypasses this packaging boundary.

Dependency discovery remains enabled. The bundled AppRun provides `LD_LIBRARY_PATH`, inherited by the server, so the sidecar can load the libraries linuxdeploy collects without rewriting the completed pkg executable. Final-artifact byte comparison prevents future packaging changes from silently corrupting it. Verify healthy backend responses through a real AppImage launch as well as the byte comparison.
