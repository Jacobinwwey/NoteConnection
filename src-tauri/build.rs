fn main() {
    let native_windows_test = std::env::var_os("CARGO_FEATURE_NATIVE_WINDOW_TESTS").is_some()
        && std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    if native_windows_test {
        // Tauri embeds Common Controls v6 only in application binaries. Wry's
        // libtest executable also imports TaskDialogIndirect; without activation
        // it fails in the Windows loader before any test can execute. Let the
        // linker emit the manifest for every artifact in this explicit test build.
        let attributes = tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new_without_app_manifest(),
        );
        tauri_build::try_build(attributes).expect("native window test build must configure Tauri");
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
    } else {
        tauri_build::build();
    }
}
