class_name ReaderRenderClient
extends Node

const BASE_URL := "http://127.0.0.1:3000"
const JSON_HEADERS = ["Content-Type: application/json"]
const CACHE_VERSION := "reader-v2"

var _texture_cache: Dictionary = {}

func render_math_texture(source: String, display_mode: bool = true, scale: float = 2.6) -> Dictionary:
	var cache_key := "%s|math|%s|%s|%.2f" % [CACHE_VERSION, ("true" if display_mode else "false"), source, scale]
	if _texture_cache.has(cache_key):
		return {"ok": true, "texture": _texture_cache[cache_key]}
	return await _render_svg_texture(cache_key, "/api/render/math", {"source": source, "displayMode": display_mode}, scale)


func render_mermaid_texture(source: String, scale: float = 3.0) -> Dictionary:
	var cache_key := "%s|mermaid|%s|%.2f" % [CACHE_VERSION, source, scale]
	if _texture_cache.has(cache_key):
		return {"ok": true, "texture": _texture_cache[cache_key]}
	return await _render_svg_texture(cache_key, "/api/render/mermaid", {"source": source}, scale)


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


func _render_svg_texture(cache_key: String, endpoint: String, payload: Dictionary, scale: float) -> Dictionary:
	var response: Dictionary = await _post_json(endpoint, payload)
	if not bool(response.get("ok", false)):
		return response

	var svg := String(response.get("svg", ""))
	if svg.is_empty():
		return {"ok": false, "error": "Renderer returned empty SVG output."}

	var image := Image.new()
	var load_error := image.load_svg_from_string(svg, scale)
	if load_error != OK:
		return {"ok": false, "error": "Unable to decode rendered SVG (%s)." % error_string(load_error)}

	var texture := ImageTexture.create_from_image(image)
	_texture_cache[cache_key] = texture
	return {"ok": true, "texture": texture}


func _post_json(endpoint: String, payload: Dictionary) -> Dictionary:
	var request := HTTPRequest.new()
	request.use_threads = true
	add_child(request)

	var headers: PackedStringArray = PackedStringArray(JSON_HEADERS)
	var error := request.request(
		BASE_URL + endpoint,
		headers,
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
	var parsed_variant = JSON.parse_string(body_text)
	var parsed: Dictionary = parsed_variant if parsed_variant is Dictionary else {}
	if response_code < 200 or response_code >= 300:
		var error_message := String(parsed.get("error", body_text)).strip_edges()
		if error_message.is_empty():
			error_message = "Renderer returned HTTP %d." % response_code
		return {"ok": false, "error": error_message}

	parsed["ok"] = true
	return parsed
