extends PopupPanel
class_name NoteMDEmbedPanel

signal open_full_workspace_requested

const DEFAULT_HOST := "127.0.0.1"
const DEFAULT_PORT := 3000
const RUNTIME_MANIFEST_ENV_KEY := "NOTE_CONNECTION_RUNTIME_MANIFEST"
const DEFAULT_RUNTIME_MANIFEST_PATH := "res://../tmp/active-sidecar-runtime.json"
const JSON_HEADERS := ["Content-Type: application/json"]

var _file_path_input: LineEdit = null
var _output_file_path_input: LineEdit = null
var _folder_path_input: LineEdit = null
var _output_folder_path_input: LineEdit = null
var _status_log: RichTextLabel = null
var _process_file_button: Button = null
var _process_folder_button: Button = null
var _open_full_workspace_button: Button = null
var _picker_dialog: FileDialog = null
var _picker_target_input: LineEdit = null
var _busy: bool = false
var _runtime_manifest_cache: Dictionary = {}
var _runtime_manifest_loaded: bool = false


func _ready() -> void:
	size = Vector2(860, 560)
	_build_ui()


func open_panel() -> void:
	popup_centered_ratio(0.8)
	_append_status("NoteMD embedded panel is ready.")


func _build_ui() -> void:
	var shell := MarginContainer.new()
	shell.add_theme_constant_override("margin_left", 16)
	shell.add_theme_constant_override("margin_right", 16)
	shell.add_theme_constant_override("margin_top", 14)
	shell.add_theme_constant_override("margin_bottom", 14)
	add_child(shell)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 10)
	shell.add_child(root)

	var title := Label.new()
	title.text = "NoteMD Embedded Workspace (Godot)"
	title.add_theme_font_size_override("font_size", 20)
	root.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Pick files/folders and run NoteMD tasks without leaving PathMode."
	subtitle.modulate = Color(0.78, 0.86, 0.95, 1.0)
	root.add_child(subtitle)

	var reminder := Label.new()
	reminder.text = "Reminder: Convert PDF to Markdown (.md) with Mineru before importing."
	reminder.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	reminder.modulate = Color(0.96, 0.88, 0.58, 1.0)
	root.add_child(reminder)

	var file_panel := PanelContainer.new()
	root.add_child(file_panel)

	var file_box := VBoxContainer.new()
	file_box.add_theme_constant_override("separation", 6)
	file_panel.add_child(file_box)

	var file_title := Label.new()
	file_title.text = "File Task"
	file_title.add_theme_font_size_override("font_size", 15)
	file_box.add_child(file_title)

	_file_path_input = _create_picker_row(
		file_box,
		"File Path",
		"Select a markdown file...",
		false
	)
	_output_file_path_input = _create_picker_row(
		file_box,
		"Output File Path (optional)",
		"Select output markdown file...",
		false
	)

	_process_file_button = Button.new()
	_process_file_button.text = "Process File"
	_process_file_button.custom_minimum_size = Vector2(120, 34)
	_process_file_button.pressed.connect(_on_process_file_pressed)
	file_box.add_child(_process_file_button)

	var folder_panel := PanelContainer.new()
	root.add_child(folder_panel)

	var folder_box := VBoxContainer.new()
	folder_box.add_theme_constant_override("separation", 6)
	folder_panel.add_child(folder_box)

	var folder_title := Label.new()
	folder_title.text = "Folder Task"
	folder_title.add_theme_font_size_override("font_size", 15)
	folder_box.add_child(folder_title)

	_folder_path_input = _create_picker_row(
		folder_box,
		"Folder Path",
		"Select a folder...",
		true
	)
	_output_folder_path_input = _create_picker_row(
		folder_box,
		"Output Folder Path (optional)",
		"Select output folder...",
		true
	)

	_process_folder_button = Button.new()
	_process_folder_button.text = "Process Folder"
	_process_folder_button.custom_minimum_size = Vector2(130, 34)
	_process_folder_button.pressed.connect(_on_process_folder_pressed)
	folder_box.add_child(_process_folder_button)

	var action_row := HBoxContainer.new()
	action_row.add_theme_constant_override("separation", 8)
	root.add_child(action_row)

	_open_full_workspace_button = Button.new()
	_open_full_workspace_button.text = "Open Full Workspace (Tauri)"
	_open_full_workspace_button.custom_minimum_size = Vector2(210, 34)
	_open_full_workspace_button.pressed.connect(func():
		open_full_workspace_requested.emit()
	)
	action_row.add_child(_open_full_workspace_button)

	var close_button := Button.new()
	close_button.text = "Close"
	close_button.custom_minimum_size = Vector2(88, 34)
	close_button.pressed.connect(func():
		hide()
	)
	action_row.add_child(close_button)

	var log_title := Label.new()
	log_title.text = "Status"
	log_title.add_theme_font_size_override("font_size", 15)
	root.add_child(log_title)

	_status_log = RichTextLabel.new()
	_status_log.fit_content = false
	_status_log.custom_minimum_size = Vector2(0, 120)
	_status_log.scroll_active = true
	_status_log.selection_enabled = true
	root.add_child(_status_log)

	_picker_dialog = FileDialog.new()
	_picker_dialog.access = FileDialog.ACCESS_FILESYSTEM
	_picker_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	_picker_dialog.use_native_dialog = true
	_picker_dialog.file_selected.connect(_on_picker_file_selected)
	_picker_dialog.dir_selected.connect(_on_picker_dir_selected)
	add_child(_picker_dialog)


func _create_picker_row(parent: VBoxContainer, label_text: String, placeholder_text: String, select_folder: bool) -> LineEdit:
	var title := Label.new()
	title.text = label_text
	parent.add_child(title)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	parent.add_child(row)

	var input := LineEdit.new()
	input.placeholder_text = placeholder_text
	input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(input)

	var browse := Button.new()
	browse.text = "Browse..."
	browse.custom_minimum_size = Vector2(94, 34)
	browse.pressed.connect(func():
		_open_picker(input, select_folder)
	)
	row.add_child(browse)

	return input


func _open_picker(target_input: LineEdit, select_folder: bool) -> void:
	if not _picker_dialog:
		return
	_picker_target_input = target_input
	_picker_dialog.file_mode = FileDialog.FILE_MODE_OPEN_DIR if select_folder else FileDialog.FILE_MODE_OPEN_FILE
	_picker_dialog.popup_centered_ratio(0.7)


func _on_picker_file_selected(path: String) -> void:
	if _picker_target_input:
		_picker_target_input.text = path


func _on_picker_dir_selected(path: String) -> void:
	if _picker_target_input:
		_picker_target_input.text = path


func _on_process_file_pressed() -> void:
	var file_path := String(_file_path_input.text).strip_edges()
	if file_path.is_empty():
		_append_status("File path is required.", true)
		return
	if file_path.to_lower().ends_with(".pdf"):
		_append_status("PDF is not supported directly. Convert PDF to .md with Mineru first.", true)
		return

	var payload: Dictionary = {
		"filePath": file_path
	}
	var output_path := String(_output_file_path_input.text).strip_edges()
	if not output_path.is_empty():
		payload["outputPath"] = output_path

	_submit_request("/api/notemd/process-file", payload, "File processing completed.")


func _on_process_folder_pressed() -> void:
	var folder_path := String(_folder_path_input.text).strip_edges()
	if folder_path.is_empty():
		_append_status("Folder path is required.", true)
		return

	var payload: Dictionary = {
		"folderPath": folder_path
	}
	var output_folder_path := String(_output_folder_path_input.text).strip_edges()
	if not output_folder_path.is_empty():
		payload["outputFolderPath"] = output_folder_path

	_submit_request("/api/notemd/process-folder", payload, "Folder processing completed.")


func _submit_request(endpoint: String, payload: Dictionary, success_prefix: String) -> void:
	if _busy:
		_append_status("A request is already running. Please wait...", true)
		return

	var request := HTTPRequest.new()
	request.use_threads = true
	add_child(request)

	var headers := PackedStringArray(JSON_HEADERS)
	var auth_token := _resolve_auth_token()
	if not auth_token.is_empty():
		headers.append("X-NoteConnection-Token: %s" % auth_token)

	var url := "%s%s" % [_resolve_base_url(), endpoint]
	var setup_error := request.request(url, headers, HTTPClient.METHOD_POST, JSON.stringify(payload))
	if setup_error != OK:
		request.queue_free()
		_append_status("Request setup failed: %s" % error_string(setup_error), true)
		return

	_set_busy(true)
	_append_status("Sending request to %s ..." % endpoint)

	request.request_completed.connect(func(result: int, response_code: int, _response_headers: PackedStringArray, body: PackedByteArray):
		request.queue_free()
		_set_busy(false)

		var body_text := body.get_string_from_utf8()
		var parsed_variant: Variant = JSON.parse_string(body_text)
		var parsed: Dictionary = parsed_variant if parsed_variant is Dictionary else {}

		if result != HTTPRequest.RESULT_SUCCESS:
			_append_status("Network request failed with code %d." % result, true)
			return

		if response_code < 200 or response_code >= 300:
			var message := String(parsed.get("error", body_text)).strip_edges()
			if message.is_empty():
				message = "Server returned HTTP %d." % response_code
			_append_status(message, true)
			return

		var summary := _build_success_summary(endpoint, parsed)
		_append_status("%s %s" % [success_prefix, summary])
	, CONNECT_ONE_SHOT)


func _set_busy(is_busy: bool) -> void:
	_busy = is_busy
	if _process_file_button:
		_process_file_button.disabled = is_busy
	if _process_folder_button:
		_process_folder_button.disabled = is_busy
	if _open_full_workspace_button:
		_open_full_workspace_button.disabled = is_busy


func _build_success_summary(endpoint: String, response_payload: Dictionary) -> String:
	var result_variant: Variant = response_payload.get("result", {})
	var result: Dictionary = result_variant if result_variant is Dictionary else {}
	if endpoint == "/api/notemd/process-file":
		var link_count := int(result.get("linkCount", 0))
		return "Wiki-links inserted: %d." % link_count
	if endpoint == "/api/notemd/process-folder":
		var processed := int(result.get("processedFiles", 0))
		var total := int(result.get("totalFiles", 0))
		return "Processed %d/%d files." % [processed, total]
	return "Done."


func _append_status(message: String, is_error: bool = false) -> void:
	if not _status_log:
		return
	var timestamp := Time.get_time_string_from_system()
	var color := "#ff8e8e" if is_error else "#d6f2ff"
	_status_log.append_text("[color=%s]%s %s[/color]\n" % [color, timestamp, message])
	_status_log.scroll_to_line(max(_status_log.get_line_count() - 1, 0))


func _resolve_base_url() -> String:
	var runtime_manifest := _read_runtime_manifest()
	var runtime_base_url := _trim_trailing_slashes(String(runtime_manifest.get("baseUrl", "")).strip_edges())
	if not runtime_base_url.is_empty():
		return runtime_base_url
	return "http://%s:%d" % [DEFAULT_HOST, _resolve_sidecar_port(runtime_manifest)]


func _resolve_sidecar_port(runtime_manifest: Dictionary) -> int:
	var port_text := OS.get_environment("NOTE_CONNECTION_PORT").strip_edges()
	if port_text.is_valid_int():
		var resolved_port := int(port_text)
		if resolved_port > 0:
			return resolved_port
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

	var file := FileAccess.open(manifest_path, FileAccess.READ)
	if file == null:
		return {}
	var raw_text := file.get_as_text()
	file.close()
	if raw_text.strip_edges().is_empty():
		return {}

	var parsed_variant: Variant = JSON.parse_string(raw_text)
	if parsed_variant is Dictionary:
		_runtime_manifest_cache = parsed_variant
		return _runtime_manifest_cache
	return {}
