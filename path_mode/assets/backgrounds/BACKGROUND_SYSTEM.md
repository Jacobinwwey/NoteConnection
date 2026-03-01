# Background System Architecture

## English Document

### 1. Resource Location

For testing purposes and for bundling default background options with the app, please place your image resources (e.g., HDRI `.hdr`/`.exr` panoramas, or high-resolution `.jpg`/`.png` textures) in the following directory:

`E:\Knowledge_project\NoteConnection_app\path_mode\assets\backgrounds\`

_Note: You can save your test images directly into this folder now._

### 2. Implementation Strategy (Godot GDScript Patterns)

Based on Godot 4 best practices, the visual background will be implemented using a `WorldEnvironment` node combined with a `PanoramaSkyMaterial` (for 3D skyboxes that wrap around the bubbles realistically) or a `CanvasLayer` with a `TextureRect` (for flat 2D backdrops).

#### Phase 1: Built-in Testing (Static)

We load static assets directly from the `res://` protocol during development.

- **Example Path**: `res://path_mode/assets/backgrounds/test_bg.jpg`
- **Mechanism**: Configured directly in the `main.tscn` WorldEnvironment.

#### Phase 2: User-Uploaded Backgrounds (Dynamic)

To support users uploading their own backgrounds at runtime, the application must load images dynamically from the user's OS file system (outside of the packaged `.pck` application binary).

- **Mechanism**: Use Godot's `Image.load(absolute_path)` and `ImageTexture.create_from_image()` pattern.

```gdscript
# Example Pattern for Dynamic External Loading (Phase 2)
func load_external_background(absolute_file_path: String) -> void:
    var img := Image.new()
    var err := img.load(absolute_file_path)
    if err == OK:
        var texture := ImageTexture.create_from_image(img)
        apply_background_texture(texture)
    else:
        push_error("Failed to load user background: " + str(err))
```

---

## 中文文档

### 1. 资源存放位置

为了进行测试以及在应用中内置默认背景选项，请将您的图像资源（例如，HDRI `.hdr`/`.exr` 全景图，或高分辨率的 `.jpg`/`.png` 纹理）放置在以下目录中：

`E:\Knowledge_project\NoteConnection_app\path_mode\assets\backgrounds\`

_注意：您现在可以直接将测试图像保存到此文件夹中。_

### 2. 实施策略 (Godot GDScript 模式)

基于 Godot 4 的最佳实践，视觉背景将使用 `WorldEnvironment` 节点结合 `PanoramaSkyMaterial`（用于逼真环绕气泡的 3D 天空盒）或带有 `TextureRect` 的 `CanvasLayer`（用于扁平的 2D 背景）来实现。

#### 阶段 1：内置测试 (静态)

在开发期间，我们直接从 `res://` 协议加载静态资源。

- **示例路径**: `res://path_mode/assets/backgrounds/test_bg.jpg`
- **机制**: 直接在 `main.tscn` 的 WorldEnvironment 中配置。

#### 阶段 2：用户上传的背景 (动态)

为了支持用户在运行时上传自己的背景，应用程序必须从用户的操作系统文件系统中动态加载图像（而不是从打包好的 `.pck` 应用程序二进制文件中加载）。

- **机制**: 使用 Godot 的 `Image.load(absolute_path)` 和 `ImageTexture.create_from_image()` 模式。

```gdscript
# 动态外部加载的示例模式 (阶段 2)
func load_external_background(absolute_file_path: String) -> void:
    var img := Image.new()
    var err := img.load(absolute_file_path)
    if err == OK:
        var texture := ImageTexture.create_from_image(img)
        apply_background_texture(texture)
    else:
        push_error("Failed to load user background: " + str(err))
```
