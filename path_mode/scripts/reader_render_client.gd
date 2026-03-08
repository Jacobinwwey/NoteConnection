class_name ReaderRenderClient
extends Node

const DEFAULT_HOST := "127.0.0.1"
const DEFAULT_PORT := 3000
const JSON_HEADERS := ["Content-Type: application/json"]
const CACHE_VERSION := "reader-v7"
const SVG_MAX_DIMENSION := 16384.0
const SVG_MIN_SCALE := 0.1

var _texture_cache: Dictionary = {}

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
	var renderer_preference := "frontend"
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
		# Mermaid text is currently reliable in the frontend bridge renderer.
		# Keep this explicit to avoid textless local-resvg outputs.
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

	return await _post_json("/api/clipboard/image", {"pngBase64": Marshalls.raw_to_base64(png_buffer)})


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
		var renderer_name := String(response.get("renderer", ""))
		if not renderer_name.is_empty() and renderer_name != "frontend-bridge":
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
	return ImageTexture.create_from_image(image)


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


func _resolve_base_url() -> String:
	return "http://%s:%d" % [DEFAULT_HOST, _resolve_sidecar_port()]


func _resolve_sidecar_port() -> int:
	var port_text := OS.get_environment("NOTE_CONNECTION_PORT").strip_edges()
	if port_text.is_valid_int():
		var resolved_port := int(port_text)
		if resolved_port > 0:
			return resolved_port
	return DEFAULT_PORT


func _resolve_auth_token() -> String:
	return OS.get_environment("NOTE_CONNECTION_AUTH_TOKEN").strip_edges()


func _build_json_headers() -> PackedStringArray:
	var headers: PackedStringArray = PackedStringArray(JSON_HEADERS)
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
