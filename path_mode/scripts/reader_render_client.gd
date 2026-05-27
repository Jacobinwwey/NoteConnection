class_name ReaderRenderClient
extends Node

const DEFAULT_HOST := "127.0.0.1"
const DEFAULT_PORT := 3000
const JSON_HEADERS := ["Content-Type: application/json"]
const BINARY_PNG_HEADERS := ["Content-Type: image/png"]
const CACHE_VERSION := "reader-v8"
const RENDERED_IMAGE_TRIM_PADDING := 16
const RENDERED_IMAGE_BACKGROUND := Color8(5, 7, 11, 255)
const SVG_MAX_DIMENSION := 16384.0
const SVG_MIN_SCALE := 0.1
const DEFAULT_RUNTIME_MANIFEST_PATH := "res://../tmp/active-sidecar-runtime.json"
const RUNTIME_MANIFEST_ENV_KEY := "NOTE_CONNECTION_RUNTIME_MANIFEST"

var _texture_cache: Dictionary = {}
var _runtime_manifest_cache: Dictionary = {}
var _runtime_manifest_loaded: bool = false

func fetch_markdown_index(file_path: String, force_rebuild: bool = false) -> Dictionary:
	var normalized_path := file_path.strip_edges()
	if normalized_path.is_empty():
		return {"ok": false, "error": "Missing filePath for markdown index request."}
	var payload := {
		"filePath": normalized_path,
		"forceRebuild": force_rebuild
	}
	var response: Dictionary = await _post_json("/api/markdown/index", payload)
	return _normalize_markdown_response(response, "markdown/index")

func fetch_markdown_chunk(index_id: String, start_block: int, block_count: int) -> Dictionary:
	var normalized_index := index_id.strip_edges()
	if normalized_index.is_empty():
		return {"ok": false, "error": "Missing indexId for markdown chunk request."}
	var payload := {
		"indexId": normalized_index,
		"startBlock": max(0, start_block),
		"blockCount": max(1, block_count)
	}
	var response: Dictionary = await _post_json("/api/markdown/chunk", payload)
	return _normalize_markdown_response(response, "markdown/chunk")

func resolve_markdown_node(node_id: String, current_file_path: String = "") -> Dictionary:
	var normalized_node := node_id.strip_edges()
	if normalized_node.is_empty():
		return {"ok": false, "error": "Missing nodeId for markdown resolve-node request."}
	var payload := {
		"nodeId": normalized_node
	}
	var normalized_path := current_file_path.strip_edges()
	if not normalized_path.is_empty():
		payload["currentFilePath"] = normalized_path
	var response: Dictionary = await _post_json("/api/markdown/resolve-node", payload)
	return _normalize_markdown_response(response, "markdown/resolve-node")

func resolve_markdown_wiki(wiki_target: String, current_file_path: String) -> Dictionary:
	var normalized_wiki := wiki_target.strip_edges()
	var normalized_path := current_file_path.strip_edges()
	if normalized_wiki.is_empty() or normalized_path.is_empty():
		return {"ok": false, "error": "Missing wikiTarget or currentFilePath for markdown resolve-wiki request."}
	var payload := {
		"wikiTarget": normalized_wiki,
		"currentFilePath": normalized_path
	}
	var response: Dictionary = await _post_json("/api/markdown/resolve-wiki", payload)
	return _normalize_markdown_response(response, "markdown/resolve-wiki")

func _normalize_markdown_response(response: Dictionary, endpoint_name: String) -> Dictionary:
	if not bool(response.get("ok", false)):
		return response
	if bool(response.get("success", false)):
		response.erase("success")
		return response
	return {
		"ok": false,
		"error": String(response.get("error", "Unexpected markdown API response for %s." % endpoint_name))
	}

func render_math_texture(source: String, display_mode: bool = true, scale: float = 2.6, max_size: Vector2 = Vector2.ZERO) -> Dictionary:
	var cache_key := "%s|math|%s|%s|%.2f|%d|%d" % [
		CACHE_VERSION,
		("true" if display_mode else "false"),
		source,
		scale,
		int(round(max_size.x)),
		int(round(max_size.y))
	]
	if _texture_cache.has(cache_key):
		return {"ok": true, "texture": _texture_cache[cache_key]}
	var payload: Dictionary = {"source": source, "displayMode": display_mode}
	_append_render_request_payload(payload, max_size, scale)
	return await _render_texture(cache_key, "/api/render/math", payload)


func render_mermaid_texture(source: String, scale: float = 3.0, max_size: Vector2 = Vector2.ZERO) -> Dictionary:
	var renderer_preference := "auto"
	var cache_key := "%s|mermaid|%s|%s|%.2f|%d|%d" % [
		CACHE_VERSION,
		renderer_preference,
		source,
		scale,
		int(round(max_size.x)),
		int(round(max_size.y))
	]
	if _texture_cache.has(cache_key):
		return {"ok": true, "texture": _texture_cache[cache_key]}
	var payload: Dictionary = {
		"source": source,
		# Prefer frontend bridge when available, but allow server-side local fallback.
		"renderer": renderer_preference
	}
	_append_render_request_payload(payload, max_size, scale)
	return await _render_texture(cache_key, "/api/render/mermaid", payload)


func copy_texture_to_clipboard(texture: Texture2D) -> Dictionary:
	if texture == null:
		return {"ok": false, "error": "No rendered image is available to copy."}

	var image: Image = texture.get_image()
	if image == null:
		return {"ok": false, "error": "Unable to access the rendered image data."}

	var png_buffer: PackedByteArray = image.save_png_to_buffer()
	if png_buffer.is_empty():
		return {"ok": false, "error": "Unable to encode the rendered image as PNG."}

	var binary_response: Dictionary = await _post_binary("/api/clipboard/image-binary", png_buffer)
	if bool(binary_response.get("ok", false)):
		return binary_response

	# Backward-compatible fallback for older sidecars that only support base64 JSON route.
	var fallback_response: Dictionary = await _post_json("/api/clipboard/image", {"pngBase64": Marshalls.raw_to_base64(png_buffer)})
	if bool(fallback_response.get("ok", false)):
		fallback_response["transport"] = "base64-fallback"
		return fallback_response

	var binary_error := String(binary_response.get("error", "")).strip_edges()
	var fallback_error := String(fallback_response.get("error", "")).strip_edges()
	if not binary_error.is_empty() and not fallback_error.is_empty():
		return {
			"ok": false,
			"error": "Clipboard binary upload failed: %s; fallback failed: %s" % [binary_error, fallback_error]
		}
	if not fallback_error.is_empty():
		return {"ok": false, "error": fallback_error}
	if not binary_error.is_empty():
		return {"ok": false, "error": binary_error}
	return {"ok": false, "error": "Clipboard upload failed for both binary and base64 transports."}


func _append_render_request_payload(payload: Dictionary, max_size: Vector2, render_scale: float) -> void:
	if max_size.x > 0.0:
		payload["maxWidth"] = int(round(max_size.x))
	if max_size.y > 0.0:
		payload["maxHeight"] = int(round(max_size.y))
	if render_scale > 0.0:
		payload["renderScale"] = snappedf(render_scale, 0.05)


func _render_texture(cache_key: String, endpoint: String, payload: Dictionary) -> Dictionary:
	var response: Dictionary = await _post_json(endpoint, payload)
	if not bool(response.get("ok", false)):
		return response
	if endpoint == "/api/render/mermaid":
		var renderer_name := String(response.get("renderer", "")).strip_edges()
		var expected_renderers := PackedStringArray(["frontend-bridge", "local-resvg"])
		if not renderer_name.is_empty() and not expected_renderers.has(renderer_name):
			push_warning("ReaderRenderClient: Mermaid rendered by unexpected pipeline '%s'." % renderer_name)

	var texture := _texture_from_render_response(response)
	if texture == null:
		return {"ok": false, "error": "Renderer returned an unsupported image payload."}

	_texture_cache[cache_key] = texture
	return {"ok": true, "texture": texture}


func _texture_from_render_response(response: Dictionary) -> Texture2D:
	var png_base64 := String(response.get("pngBase64", "")).strip_edges()
	if not png_base64.is_empty():
		return _decode_png_texture(png_base64)

	push_warning("ReaderRenderClient: Renderer response did not include a PNG payload.")
	return null


func _decode_png_texture(png_base64: String) -> Texture2D:
	var png_buffer: PackedByteArray = Marshalls.base64_to_raw(png_base64)
	if png_buffer.is_empty():
		return null
	var image := Image.new()
	var load_error := image.load_png_from_buffer(png_buffer)
	if load_error != OK:
		push_warning("ReaderRenderClient: Unable to decode rendered PNG (%s)." % error_string(load_error))
		return null
	var trimmed_image := _trim_rendered_image(image)
	if trimmed_image != null:
		image = trimmed_image
	return ImageTexture.create_from_image(image)


func _trim_rendered_image(image: Image) -> Image:
	if image == null or image.is_empty():
		return image
	if image.get_width() <= 2 or image.get_height() <= 2:
		return image

	var left := image.get_width()
	var top := image.get_height()
	var right := -1
	var bottom := -1

	for y in range(image.get_height()):
		for x in range(image.get_width()):
			if _is_rendered_content_pixel(image.get_pixel(x, y)):
				left = mini(left, x)
				top = mini(top, y)
				right = maxi(right, x)
				bottom = maxi(bottom, y)

	if right < left or bottom < top:
		return image

	left = maxi(0, left - RENDERED_IMAGE_TRIM_PADDING)
	top = maxi(0, top - RENDERED_IMAGE_TRIM_PADDING)
	right = mini(image.get_width() - 1, right + RENDERED_IMAGE_TRIM_PADDING)
	bottom = mini(image.get_height() - 1, bottom + RENDERED_IMAGE_TRIM_PADDING)

	var trimmed_rect := Rect2i(left, top, right - left + 1, bottom - top + 1)
	if trimmed_rect.size.x <= 0 or trimmed_rect.size.y <= 0:
		return image
	if trimmed_rect.position == Vector2i.ZERO and trimmed_rect.size.x == image.get_width() and trimmed_rect.size.y == image.get_height():
		return image

	return image.get_region(trimmed_rect)


func _is_rendered_content_pixel(pixel: Color) -> bool:
	if pixel.a <= 0.03:
		return false
	var diff_r := absf(pixel.r - RENDERED_IMAGE_BACKGROUND.r)
	var diff_g := absf(pixel.g - RENDERED_IMAGE_BACKGROUND.g)
	var diff_b := absf(pixel.b - RENDERED_IMAGE_BACKGROUND.b)
	return maxf(diff_r, maxf(diff_g, diff_b)) > 0.03


func _post_json(endpoint: String, payload: Dictionary) -> Dictionary:
	var request := HTTPRequest.new()
	request.use_threads = true
	add_child(request)

	var error := request.request(
		_resolve_base_url() + endpoint,
		_build_json_headers(),
		HTTPClient.METHOD_POST,
		JSON.stringify(payload)
	)
	if error != OK:
		request.queue_free()
		return {"ok": false, "error": "HTTP request setup failed (%s)." % error_string(error)}

	var result: Array = await request.request_completed
	request.queue_free()

	if result.size() < 4:
		return {"ok": false, "error": "Renderer returned an incomplete HTTP response."}

	var request_result := int(result[0])
	var response_code := int(result[1])
	var body: PackedByteArray = result[3]
	if request_result != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "error": "HTTP request failed with result %d." % request_result}

	var body_text := body.get_string_from_utf8()
	var parsed_variant: Variant = JSON.parse_string(body_text)
	var parsed: Dictionary = parsed_variant if parsed_variant is Dictionary else {}
	if response_code < 200 or response_code >= 300:
		var error_message := String(parsed.get("error", body_text)).strip_edges()
		if error_message.is_empty():
			error_message = "Renderer returned HTTP %d." % response_code
		return {"ok": false, "error": error_message}

	parsed["ok"] = true
	return parsed


func _post_binary(endpoint: String, payload: PackedByteArray) -> Dictionary:
	var request := HTTPRequest.new()
	request.use_threads = true
	add_child(request)

	var error := request.request_raw(
		_resolve_base_url() + endpoint,
		_build_binary_headers(),
		HTTPClient.METHOD_POST,
		payload
	)
	if error != OK:
		request.queue_free()
		return {"ok": false, "error": "HTTP request setup failed (%s)." % error_string(error)}

	var result: Array = await request.request_completed
	request.queue_free()

	if result.size() < 4:
		return {"ok": false, "error": "Renderer returned an incomplete HTTP response."}

	var request_result := int(result[0])
	var response_code := int(result[1])
	var body: PackedByteArray = result[3]
	if request_result != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "error": "HTTP request failed with result %d." % request_result}

	var body_text := body.get_string_from_utf8()
	var parsed_variant: Variant = JSON.parse_string(body_text)
	var parsed: Dictionary = parsed_variant if parsed_variant is Dictionary else {}
	if response_code < 200 or response_code >= 300:
		var error_message := String(parsed.get("error", body_text)).strip_edges()
		if error_message.is_empty():
			error_message = "Renderer returned HTTP %d." % response_code
		return {"ok": false, "error": error_message}

	parsed["ok"] = true
	return parsed


func _resolve_base_url() -> String:
	var runtime_manifest := _read_runtime_manifest()
	var runtime_base_url := _trim_trailing_slashes(String(runtime_manifest.get("baseUrl", "")).strip_edges())
	if not runtime_base_url.is_empty():
		return runtime_base_url
	return "http://%s:%d" % [DEFAULT_HOST, _resolve_sidecar_port()]


func _resolve_sidecar_port() -> int:
	var port_text := OS.get_environment("NOTE_CONNECTION_PORT").strip_edges()
	if port_text.is_valid_int():
		var resolved_port := int(port_text)
		if resolved_port > 0:
			return resolved_port
	var runtime_manifest := _read_runtime_manifest()
	var manifest_port := int(runtime_manifest.get("port", 0))
	if manifest_port > 0:
		return manifest_port
	return DEFAULT_PORT


func _resolve_auth_token() -> String:
	var auth_token := OS.get_environment("NOTE_CONNECTION_AUTH_TOKEN").strip_edges()
	if not auth_token.is_empty():
		return auth_token
	var runtime_manifest := _read_runtime_manifest()
	return String(runtime_manifest.get("authToken", "")).strip_edges()


func _trim_trailing_slashes(raw_value: String) -> String:
	var value := String(raw_value)
	while value.ends_with("/"):
		value = value.left(value.length() - 1)
	return value


func _resolve_runtime_manifest_path() -> String:
	var env_path := OS.get_environment(RUNTIME_MANIFEST_ENV_KEY).strip_edges()
	if not env_path.is_empty():
		return env_path
	return ProjectSettings.globalize_path(DEFAULT_RUNTIME_MANIFEST_PATH)


func _read_runtime_manifest() -> Dictionary:
	if _runtime_manifest_loaded:
		return _runtime_manifest_cache

	_runtime_manifest_loaded = true
	var manifest_path := _resolve_runtime_manifest_path()
	if manifest_path.is_empty():
		return {}
	if not FileAccess.file_exists(manifest_path):
		return {}

	var file: FileAccess = FileAccess.open(manifest_path, FileAccess.READ)
	if file == null:
		return {}
	var raw_text: String = file.get_as_text()
	file.close()
	if raw_text.strip_edges().is_empty():
		return {}

	var parsed: Variant = JSON.parse_string(raw_text)
	if parsed is Dictionary:
		var parsed_dict: Dictionary = parsed
		_runtime_manifest_cache = parsed_dict
		return _runtime_manifest_cache

	push_warning("ReaderRenderClient: Runtime manifest is not a JSON object: %s" % manifest_path)
	return {}


func _build_json_headers() -> PackedStringArray:
	var headers: PackedStringArray = PackedStringArray(JSON_HEADERS)
	var auth_token := _resolve_auth_token()
	if not auth_token.is_empty():
		headers.append("X-NoteConnection-Token: %s" % auth_token)
	return headers


func _build_binary_headers() -> PackedStringArray:
	var headers: PackedStringArray = PackedStringArray(BINARY_PNG_HEADERS)
	var auth_token := _resolve_auth_token()
	if not auth_token.is_empty():
		headers.append("X-NoteConnection-Token: %s" % auth_token)
	return headers


func _resolve_svg_safe_scale(svg: String, requested_scale: float) -> float:
	var width := _extract_svg_numeric_attribute(svg, "width")
	var height := _extract_svg_numeric_attribute(svg, "height")
	if width <= 0.0 or height <= 0.0:
		var viewbox_size := _extract_svg_viewbox_dimensions(svg)
		width = maxf(width, viewbox_size.x)
		height = maxf(height, viewbox_size.y)
	if width <= 0.0 or height <= 0.0:
		return maxf(SVG_MIN_SCALE, requested_scale)

	var safe_scale := requested_scale
	if width * safe_scale > SVG_MAX_DIMENSION or height * safe_scale > SVG_MAX_DIMENSION:
		var width_scale_limit := SVG_MAX_DIMENSION / maxf(width, 1.0)
		var height_scale_limit := SVG_MAX_DIMENSION / maxf(height, 1.0)
		safe_scale = minf(safe_scale, minf(width_scale_limit, height_scale_limit))
	return maxf(SVG_MIN_SCALE, safe_scale)


func _extract_svg_numeric_attribute(svg: String, attribute_name: String) -> float:
	var regex := RegEx.new()
	var compile_error := regex.compile("%s\\s*=\\s*\"([0-9]+(?:\\.[0-9]+)?)" % attribute_name)
	if compile_error != OK:
		return 0.0
	var match := regex.search(svg)
	if match == null:
		return 0.0
	return float(match.get_string(1))


func _extract_svg_viewbox_dimensions(svg: String) -> Vector2:
	var regex := RegEx.new()
	var compile_error := regex.compile("viewBox\\s*=\\s*\"([^\"]+)\"")
	if compile_error != OK:
		return Vector2.ZERO
	var match := regex.search(svg)
	if match == null:
		return Vector2.ZERO

	var viewbox_text := String(match.get_string(1)).replace(",", " ")
	var raw_parts := viewbox_text.split(" ", false)
	var numeric_parts: Array[float] = []
	for raw_part in raw_parts:
		var part := String(raw_part).strip_edges()
		if part.is_empty():
			continue
		numeric_parts.append(float(part))
	if numeric_parts.size() < 4:
		return Vector2.ZERO
	return Vector2(numeric_parts[2], numeric_parts[3])
