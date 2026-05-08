# How-To: Android Release Build with ProGuard/R8

Use this guide when building a signed, minified Android APK/AAB for production release.

## Prerequisites

- Android SDK 34+ with Build Tools
- Rust Android targets (`rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android`)
- JDK 21 (Temurin recommended)

## Tauri Android Build

```bash
npm run tauri:android:init
npm run tauri:android:build
```

Output: `src-tauri/gen/android/app/build/outputs/apk/release/`

## ProGuard / R8 Keep Rules

Place these in `src-tauri/gen/android/app/proguard-rules.pro`:

```proguard
# NoteConnection — Tauri WebView + Sidecar
-keep class com.noteconnection.app.** { *; }

# Tauri IPC bridge (JNI)
-keep class org.tauri.tauri.** { *; }
-keepclassmembers class org.tauri.tauri.** { *; }

# WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Rust sidecar process — do not strip native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Serde JSON serialization (used by sidecar IPC)
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes EnclosingMethod

# Keep Kotlin metadata for reflection-based routing
-keep class kotlin.Metadata { *; }

# OkHttp (used by Tauri HTTP plugin)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# WebView rendering — prevent stripping of resource classes
-keepclassmembers class * extends android.webkit.WebView {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}
```

## Verification

After building the release APK, verify ProGuard processing:

```bash
# Check that mapping file exists (for crash stacktrace deobfuscation)
ls src-tauri/gen/android/app/build/outputs/mapping/release/mapping.txt

# Verify sidecar binary is bundled
unzip -l src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk | grep "lib/.*\.so"
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `UnsatisfiedLinkError` at startup | Native libs stripped | Add `-keepclasseswithmembernames class * { native <methods>; }` |
| WebView blank screen | JS interface stripped | Add `@JavascriptInterface` keep rule |
| Sidecar fails to start | Binary not bundled | Verify Rust target triple matches APK ABI |
| `ClassNotFoundException` on Tauri classes | Tauri JNI stripped | Add `-keep class org.tauri.tauri.**` |
