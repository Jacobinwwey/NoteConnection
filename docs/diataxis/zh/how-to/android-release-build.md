# 操作指南：Android 发布构建与 ProGuard/R8 配置

在构建签名的、经过代码混淆的 Android APK/AAB 发布包时使用本指南。

## 前置条件

- Android SDK 34+ 及 Build Tools
- Rust Android 目标 (`rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android`)
- JDK 21（推荐 Temurin）

## Tauri Android 构建

```bash
npm run tauri:android:init
npm run tauri:android:build
```

输出: `src-tauri/gen/android/app/build/outputs/apk/release/`

## ProGuard / R8 Keep 规则

将以下内容放入 `src-tauri/gen/android/app/proguard-rules.pro`:

```proguard
# NoteConnection — Tauri WebView + Sidecar
-keep class com.noteconnection.app.** { *; }

# Tauri IPC 桥接 (JNI)
-keep class org.tauri.tauri.** { *; }
-keepclassmembers class org.tauri.tauri.** { *; }

# WebView JavaScript 接口
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Rust sidecar 进程 — 不要剥离 native 方法
-keepclasseswithmembernames class * {
    native <methods>;
}

# Serde JSON 序列化 (sidecar IPC 使用)
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes EnclosingMethod

# 保留 Kotlin 元数据以供反射路由
-keep class kotlin.Metadata { *; }

# OkHttp (Tauri HTTP 插件使用)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# WebView 渲染 — 防止资源类被剥离
-keepclassmembers class * extends android.webkit.WebView {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}
```

## 验证

构建发布 APK 后，验证 ProGuard 处理:

```bash
# 检查 mapping 文件是否存在（用于崩溃堆栈反混淆）
ls src-tauri/gen/android/app/build/outputs/mapping/release/mapping.txt

# 验证 sidecar 二进制文件已打包
unzip -l src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk | grep "lib/.*\.so"
```

## 故障排除

| 现象 | 可能原因 | 修复方法 |
|---|---|---|
| 启动时 `UnsatisfiedLinkError` | Native 库被剥离 | 添加 `-keepclasseswithmembernames class * { native <methods>; }` |
| WebView 白屏 | JS 接口被剥离 | 添加 `@JavascriptInterface` keep 规则 |
| Sidecar 无法启动 | 二进制未打包 | 验证 Rust target triple 与 APK ABI 匹配 |
| Tauri 类 `ClassNotFoundException` | Tauri JNI 被剥离 | 添加 `-keep class org.tauri.tauri.**` |
