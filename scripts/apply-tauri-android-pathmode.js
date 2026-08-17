const fs = require('fs');
const path = require('path');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function patchManifest(manifestPath) {
  let manifest = readText(manifestPath);
  let changed = false;

  if (!manifest.includes('xmlns:tools="http://schemas.android.com/tools"')) {
    manifest = manifest.replace(
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools">'
    );
    changed = true;
  }

  const providerMetaRegex =
    /(<meta-data\s+android:name="android\.support\.FILE_PROVIDER_PATHS"[\s\S]*?android:resource="[^"]+")([\s\S]*?\/>)/m;
  if (providerMetaRegex.test(manifest) && !manifest.includes('tools:replace="android:resource"')) {
    manifest = manifest.replace(
      providerMetaRegex,
      '$1\n            tools:replace="android:resource"$2'
    );
    changed = true;
  }

  if (!manifest.includes('PathmodeGodotActivity')) {
    const activityBlock = [
      '        <activity',
      '            android:name=".PathmodeGodotActivity"',
      '            android:exported="false"',
      '            android:label="Pathmode"',
      '            android:theme="@style/Theme.npm" />',
      ''
    ].join('\n');

    const providerIndex = manifest.indexOf('<provider');
    if (providerIndex === -1) {
      throw new Error(`Could not find <provider> tag in ${manifestPath}`);
    }

    manifest = `${manifest.slice(0, providerIndex)}${activityBlock}${manifest.slice(providerIndex)}`;
    changed = true;
  }

  if (changed) {
    writeText(manifestPath, manifest);
  }

  return changed;
}

function patchBuildGradle(appGradlePath) {
  let gradle = readText(appGradlePath);
  let changed = false;

  const versionVar = 'val godotAndroidVersion = System.getenv("NOTE_CONNECTION_GODOT_ANDROID_VERSION") ?: "4.6.0.stable"';
  const versionVarRegex = /val godotAndroidVersion = System\.getenv\("NOTE_CONNECTION_GODOT_ANDROID_VERSION"\) \?: "[^"]+"/;
  if (versionVarRegex.test(gradle)) {
    gradle = gradle.replace(versionVarRegex, versionVar);
    changed = true;
  } else {
    const androidBlockIndex = gradle.indexOf('\nandroid {');
    if (androidBlockIndex === -1) {
      throw new Error(`Could not find android block in ${appGradlePath}`);
    }
    gradle = `${gradle.slice(0, androidBlockIndex)}\n${versionVar}\n${gradle.slice(androidBlockIndex)}`;
    changed = true;
  }

  const depToken = 'implementation("org.godotengine:godot:$godotAndroidVersion")';
  if (!gradle.includes(depToken)) {
    const dependenciesRegex = /dependencies\s*\{([\s\S]*?)\n\}/m;
    const match = gradle.match(dependenciesRegex);
    if (!match) {
      throw new Error(`Could not find dependencies block in ${appGradlePath}`);
    }
    const originalBlock = match[0];
    const body = match[1];
    const replacement = `dependencies {${body}\n    ${depToken}\n}`;
    gradle = gradle.replace(originalBlock, replacement);
    changed = true;
  }

  if (changed) {
    writeText(appGradlePath, gradle);
  }

  return changed;
}

function patchKnowledgeBasePicker(appGradlePath) {
  const original = readText(appGradlePath);
  let gradle = original.replace(/\r/g, '');
  const dependency = 'implementation("androidx.documentfile:documentfile:1.0.1")';
  gradle = gradle.replace(
    /\)implementation\("androidx\.documentfile:documentfile:1\.0\.1"\)/g,
    `)\n    ${dependency}`
  );
  if (gradle.includes(dependency)) {
    if (gradle !== original) {
      writeText(appGradlePath, gradle);
      return true;
    }
    return false;
  }
  const dependenciesRegex = /dependencies\s*\{([\s\S]*?)\n\}/m;
  const match = gradle.match(dependenciesRegex);
  if (!match) {
    throw new Error(`Could not find dependencies block in ${appGradlePath}`);
  }
  gradle = gradle.replace(match[0], `dependencies {${match[1]}\n    ${dependency}\n}`);
  writeText(appGradlePath, gradle);
  return true;
}

function patchKnowledgeBaseActivity(mainActivityPath) {
  let source = readText(mainActivityPath).replace(/\r\n/g, '\n');
  let changed = false;
  if (!source.includes('import android.content.Intent')) {
    source = source.replace(
      /import android\.os\.Bundle\n/,
      'import android.content.Intent\nimport android.os.Bundle\n'
    );
    changed = true;
  }
  const callback = [
    '',
    '  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {',
    '    super.onActivityResult(requestCode, resultCode, data)',
    '    KnowledgeBasePickerBridge.handleActivityResult(this, requestCode, resultCode, data)',
    '  }',
    ''
  ].join('\n');
  if (!source.includes('KnowledgeBasePickerBridge.handleActivityResult')) {
    source = source.replace(/\n}\s*$/, `${callback}}\n`);
    changed = true;
  }
  if (!source.includes('KnowledgeBasePickerBridge.bindActivity(this)')) {
    source = source.replace(
      '    super.onCreate(savedInstanceState)\n',
      '    super.onCreate(savedInstanceState)\n    KnowledgeBasePickerBridge.bindActivity(this)\n'
    );
    changed = true;
  }
  if (changed) {
    writeText(mainActivityPath, source);
  }
  return changed;
}

function patchRootBuildGradle(rootGradlePath) {
  let gradle = readText(rootGradlePath);
  let changed = false;

  const kotlinVersion = process.env.NOTE_CONNECTION_ANDROID_KOTLIN_VERSION || '2.1.20';
  const kotlinPluginRegex = /classpath\("org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^"]+"\)/;
  const desired = `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")`;

  if (kotlinPluginRegex.test(gradle)) {
    gradle = gradle.replace(kotlinPluginRegex, desired);
    changed = true;
  }

  if (changed) {
    writeText(rootGradlePath, gradle);
  }

  return changed;
}

function normalizePackageFromNamespace(buildGradleContent) {
  const match = buildGradleContent.match(/namespace\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error('Could not resolve Android namespace from app/build.gradle.kts');
  }
  return match[1];
}

function renderTemplate(templatePath, pkgName) {
  const template = readText(templatePath);
  return template.replace(/__NOTE_PACKAGE__/g, pkgName);
}

function copyPathmodeAssets(repoRoot, androidAppDir) {
  const sourceDir = path.join(repoRoot, 'path_mode');
  const targetDir = path.join(androidAppDir, 'src', 'main', 'assets', 'path_mode');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Pathmode source directory not found: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      const normalized = srcPath.replace(/\\/g, '/');
      if (normalized.includes('/.godot/')) return false;
      if (normalized.endsWith('/.godot')) return false;
      return true;
    }
  });
}

function removePathmodeAssets(androidAppDir) {
  const targetDir = path.join(androidAppDir, 'src', 'main', 'assets', 'path_mode');
  fs.rmSync(targetDir, { recursive: true, force: true });
}

function removeFileIfPresent(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

function unpatchManifest(manifestPath) {
  let manifest = readText(manifestPath);
  manifest = manifest.replace(
    /\s*<activity\s+android:name="\.PathmodeGodotActivity"[\s\S]*?\/>\s*/m,
    '\n'
  );
  manifest = manifest.replace(/\s*tools:replace="android:resource"/g, '');
  if (!manifest.includes('tools:')) {
    manifest = manifest.replace(/\s+xmlns:tools="http:\/\/schemas\.android\.com\/tools"/, '');
  }
  writeText(manifestPath, manifest);
}

function unpatchBuildGradle(appGradlePath) {
  let gradle = readText(appGradlePath);
  gradle = gradle.replace(
    /\r?\n?val godotAndroidVersion = System\.getenv\("NOTE_CONNECTION_GODOT_ANDROID_VERSION"\) \?: "[^"]+"\r?\n?/g,
    '\n'
  );
  gradle = gradle.replace(
    /^\s*implementation\("org\.godotengine:godot:\$godotAndroidVersion"\)\s*\r?\n?/gm,
    ''
  );
  writeText(appGradlePath, gradle);
}

function main() {
  const allowMissing = process.argv.includes('--allow-missing');
  const disable = process.argv.includes('--disable');
  const repoRoot = path.resolve(__dirname, '..');
  const androidAppDir = path.join(repoRoot, 'src-tauri', 'gen', 'android', 'app');

  if (!fs.existsSync(androidAppDir)) {
    if (allowMissing) {
      console.warn('[Pathmode Android Patch] Tauri Android app project is missing; skipping patch.');
      process.exit(0);
    }
    console.error(`[Pathmode Android Patch] Missing directory: ${androidAppDir}`);
    process.exit(1);
  }

  const appGradlePath = path.join(androidAppDir, 'build.gradle.kts');
  const gradleContent = readText(appGradlePath);
  const packageName = normalizePackageFromNamespace(gradleContent);
  const rootGradlePath = path.join(repoRoot, 'src-tauri', 'gen', 'android', 'build.gradle.kts');
  const packageDir = path.join(androidAppDir, 'src', 'main', 'java', ...packageName.split('.'));
  const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
  const mainActivityPath = path.join(packageDir, 'MainActivity.kt');

  const templateDir = path.join(repoRoot, 'src-tauri', 'mobile', 'android');
  const bridgeTemplatePath = path.join(templateDir, 'PathmodeBridge.kt');
  const activityTemplatePath = path.join(templateDir, 'PathmodeGodotActivity.kt');
  const pickerTemplatePath = path.join(templateDir, 'KnowledgeBasePickerBridge.kt');

  writeText(
    path.join(packageDir, 'KnowledgeBasePickerBridge.kt'),
    renderTemplate(pickerTemplatePath, packageName)
  );
  const pickerGradleChanged = patchKnowledgeBasePicker(appGradlePath);
  const pickerActivityChanged = patchKnowledgeBaseActivity(mainActivityPath);

  if (disable) {
    removeFileIfPresent(path.join(packageDir, 'PathmodeBridge.kt'));
    removeFileIfPresent(path.join(packageDir, 'PathmodeGodotActivity.kt'));
    unpatchManifest(manifestPath);
    unpatchBuildGradle(appGradlePath);
    removePathmodeAssets(androidAppDir);
    console.log('[Pathmode Android Patch] Godot dependency, bridge, activity, and assets disabled for mobile-slim.');
    console.log(`[Pathmode Android Patch] Knowledge-base picker synced: ${pickerActivityChanged ? 'yes' : 'already patched'}`);
    return;
  }

  writeText(
    path.join(packageDir, 'PathmodeBridge.kt'),
    renderTemplate(bridgeTemplatePath, packageName)
  );
  writeText(
    path.join(packageDir, 'PathmodeGodotActivity.kt'),
    renderTemplate(activityTemplatePath, packageName)
  );

  const manifestChanged = patchManifest(manifestPath);
  const gradleChanged = patchBuildGradle(appGradlePath);
  const rootGradleChanged = patchRootBuildGradle(rootGradlePath);
  copyPathmodeAssets(repoRoot, androidAppDir);

  console.log(`[Pathmode Android Patch] Package: ${packageName}`);
  console.log(`[Pathmode Android Patch] Kotlin bridge/activity synced: ${packageDir}`);
  console.log(`[Pathmode Android Patch] Manifest updated: ${manifestChanged ? 'yes' : 'already patched'}`);
  console.log(`[Pathmode Android Patch] Gradle updated: ${gradleChanged ? 'yes' : 'already patched'}`);
  console.log(`[Pathmode Android Patch] Root Gradle updated: ${rootGradleChanged ? 'yes' : 'already patched'}`);
  console.log(`[Pathmode Android Patch] Knowledge-base picker Gradle updated: ${pickerGradleChanged ? 'yes' : 'already patched'}`);
  console.log(`[Pathmode Android Patch] Knowledge-base picker activity updated: ${pickerActivityChanged ? 'yes' : 'already patched'}`);
  console.log('[Pathmode Android Patch] Pathmode assets copied to Android assets/path_mode');
}

main();
