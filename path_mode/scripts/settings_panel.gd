class_name SettingsPanel
extends PopupPanel

signal settings_changed(settings: Dictionary)

const SETTINGS_FILE := "user://settings.cfg"
const PATH_MODE_SETTINGS_ENDPOINT := "/api/path-mode/settings"
const BACKGROUNDS_DIR := "res://assets/backgrounds"
const DEFAULT_READER_TOGGLE_SHORTCUT := "Ctrl+M"
const READER_MEDIA_SCALE_MIN := 0.10
const READER_MEDIA_SCALE_MAX := 3.00
const READER_MEDIA_SCALE_STEP := 0.01
const READER_MEDIA_SCALE_DEFAULT := 1.50
const READER_MEDIA_SCALE_MIGRATION_KEY := "reader_media_scale_migrated_20260308"
const BG_BRIGHTNESS_ACTUAL_MIN := 0.0
const BG_BRIGHTNESS_ACTUAL_MAX := 0.10
const BG_BRIGHTNESS_UI_MIN := 0.0
const BG_BRIGHTNESS_UI_MAX := 100.0
const BG_BRIGHTNESS_UI_STEP := 0.1

@onready var _auto_reconstruct_check: CheckBox = $MarginContainer/VBoxContainer/AutoReconstructCheck

var _retain_history_check: CheckBox
var _focus_mode_check: CheckBox
var _background_option: OptionButton
var _brightness_slider: HSlider
var _brightness_value_label: Label
var _reading_mode_option: OptionButton
var _reader_render_mode_option: OptionButton
var _reader_shortcut_input: LineEdit
var _reader_media_scale_slider: HSlider
var _reader_media_scale_label: Label
var _reader_debug_check: CheckBox
var _node_spacing_slider: HSlider
var _node_spacing_label: Label

var _background_files: Array[String] = []
var _runtime_base_url := ""
var _runtime_save_in_flight := false
var _runtime_save_pending := false

var _settings: Dictionary = {
	"auto_reconstruct": true,
	"retain_history": true,
	"focus_mode": true,
	"background": "",
	"bg_brightness": 0.10,
	"reading_mode": "window",
	"reader_render_mode": "render",
	"reader_toggle_source_shortcut": DEFAULT_READER_TOGGLE_SHORTCUT,
	"reader_media_scale": READER_MEDIA_SCALE_DEFAULT,
	"reader_debug": false,
	"node_spacing": 240.0
}

func _ready() -> void:
	size = Vector2i(460, 520)
	_scan_backgrounds()
	_runtime_base_url = _resolve_runtime_base_url()
	_load_settings()

	if _auto_reconstruct_check:
		_auto_reconstruct_check.toggled.connect(_on_auto_reconstruct_toggled)

	var vbox := $MarginContainer/VBoxContainer as VBoxContainer
	if vbox:
		_retain_history_check = CheckBox.new()
		_retain_history_check.text = "Retain Learning History"
		_retain_history_check.tooltip_text = "If checked, progress is saved between sessions."
		vbox.add_child(_retain_history_check)
		_retain_history_check.toggled.connect(_on_retain_history_toggled)

		_focus_mode_check = CheckBox.new()
		_focus_mode_check.text = "Focus on this node"
		_focus_mode_check.tooltip_text = "Highlight incoming nodes for the central node and dim others."
		vbox.add_child(_focus_mode_check)
		_focus_mode_check.toggled.connect(_on_focus_mode_toggled)

		var bg_hbox := HBoxContainer.new()
		bg_hbox.add_theme_constant_override("separation", 10)
		vbox.add_child(bg_hbox)

		var bg_label := Label.new()
		bg_label.text = "Background"
		bg_hbox.add_child(bg_label)

		_background_option = OptionButton.new()
		_background_option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bg_hbox.add_child(_background_option)
		_populate_background_options()
		_background_option.item_selected.connect(_on_background_selected)

		var bright_hbox := HBoxContainer.new()
		bright_hbox.add_theme_constant_override("separation", 10)
		vbox.add_child(bright_hbox)

		var bright_label := Label.new()
		bright_label.text = "Brightness"
		bright_label.custom_minimum_size = Vector2(85, 0)
		bright_hbox.add_child(bright_label)

		_brightness_slider = HSlider.new()
		_brightness_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_brightness_slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		_brightness_slider.min_value = BG_BRIGHTNESS_UI_MIN
		_brightness_slider.max_value = BG_BRIGHTNESS_UI_MAX
		_brightness_slider.step = BG_BRIGHTNESS_UI_STEP
		_brightness_slider.value = _brightness_actual_to_ui(float(_settings.get("bg_brightness", BG_BRIGHTNESS_ACTUAL_MAX)))
		bright_hbox.add_child(_brightness_slider)

		_brightness_value_label = Label.new()
		_brightness_value_label.text = _format_brightness_ui_value(_brightness_slider.value)
		_brightness_value_label.custom_minimum_size = Vector2(52, 0)
		_brightness_value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		bright_hbox.add_child(_brightness_value_label)

		_brightness_slider.value_changed.connect(func(value: float):
			if _brightness_value_label:
				_brightness_value_label.text = _format_brightness_ui_value(value)
			_on_brightness_changed(value)
		)

		var reading_mode_hbox := HBoxContainer.new()
		reading_mode_hbox.add_theme_constant_override("separation", 10)
		vbox.add_child(reading_mode_hbox)

		var reading_mode_label := Label.new()
		reading_mode_label.text = "Reader Mode"
		reading_mode_label.custom_minimum_size = Vector2(105, 0)
		reading_mode_hbox.add_child(reading_mode_label)

		_reading_mode_option = OptionButton.new()
		_reading_mode_option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_reading_mode_option.add_item("Window", 0)
		_reading_mode_option.add_item("Fullscreen", 1)
		reading_mode_hbox.add_child(_reading_mode_option)
		_reading_mode_option.item_selected.connect(_on_reading_mode_selected)

		var render_mode_hbox := HBoxContainer.new()
		render_mode_hbox.add_theme_constant_override("separation", 10)
		vbox.add_child(render_mode_hbox)

		var render_mode_label := Label.new()
		render_mode_label.text = "Block View"
		render_mode_label.custom_minimum_size = Vector2(105, 0)
		render_mode_hbox.add_child(render_mode_label)

		_reader_render_mode_option = OptionButton.new()
		_reader_render_mode_option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_reader_render_mode_option.add_item("Render", 0)
		_reader_render_mode_option.add_item("Source", 1)
		render_mode_hbox.add_child(_reader_render_mode_option)
		_reader_render_mode_option.item_selected.connect(_on_reader_render_mode_selected)

		var shortcut_hbox := HBoxContainer.new()
		shortcut_hbox.add_theme_constant_override("separation", 10)
		vbox.add_child(shortcut_hbox)

		var shortcut_label := Label.new()
		shortcut_label.text = "Toggle Shortcut"
		shortcut_label.custom_minimum_size = Vector2(105, 0)
		shortcut_hbox.add_child(shortcut_label)

		_reader_shortcut_input = LineEdit.new()
		_reader_shortcut_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_reader_shortcut_input.placeholder_text = DEFAULT_READER_TOGGLE_SHORTCUT
		_reader_shortcut_input.tooltip_text = "Example: Ctrl+M or Ctrl+Shift+M"
		shortcut_hbox.add_child(_reader_shortcut_input)
		_reader_shortcut_input.text_submitted.connect(_on_reader_shortcut_submitted)
		_reader_shortcut_input.focus_exited.connect(func():
			_on_reader_shortcut_submitted(_reader_shortcut_input.text)
		)

		var media_scale_hbox := HBoxContainer.new()
		media_scale_hbox.add_theme_constant_override("separation", 10)
		vbox.add_child(media_scale_hbox)

		var media_scale_label := Label.new()
		media_scale_label.text = "Media Scale"
		media_scale_label.custom_minimum_size = Vector2(105, 0)
		media_scale_hbox.add_child(media_scale_label)

		_reader_media_scale_slider = HSlider.new()
		_reader_media_scale_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_reader_media_scale_slider.min_value = READER_MEDIA_SCALE_MIN
		_reader_media_scale_slider.max_value = READER_MEDIA_SCALE_MAX
		_reader_media_scale_slider.step = READER_MEDIA_SCALE_STEP
		_reader_media_scale_slider.value = float(_settings.get("reader_media_scale", READER_MEDIA_SCALE_DEFAULT))
		media_scale_hbox.add_child(_reader_media_scale_slider)
		_reader_media_scale_slider.value_changed.connect(_on_reader_media_scale_changed)

		_reader_media_scale_label = Label.new()
		_reader_media_scale_label.custom_minimum_size = Vector2(48, 0)
		_reader_media_scale_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		media_scale_hbox.add_child(_reader_media_scale_label)

		_reader_debug_check = CheckBox.new()
		_reader_debug_check.text = "Enable Reader Debug Capture"
		_reader_debug_check.tooltip_text = "Export source/viewer/screen PNG diagnostics for the image viewer."
		vbox.add_child(_reader_debug_check)
		_reader_debug_check.toggled.connect(_on_reader_debug_toggled)

		var spacing_hbox := HBoxContainer.new()
		spacing_hbox.add_theme_constant_override("separation", 10)
		vbox.add_child(spacing_hbox)

		var spacing_label := Label.new()
		spacing_label.text = "Node Spacing"
		spacing_label.custom_minimum_size = Vector2(105, 0)
		spacing_hbox.add_child(spacing_label)

		_node_spacing_slider = HSlider.new()
		_node_spacing_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_node_spacing_slider.min_value = 100.0
		_node_spacing_slider.max_value = 600.0
		_node_spacing_slider.step = 10.0
		_node_spacing_slider.value = float(_settings.get("node_spacing", 240.0))
		spacing_hbox.add_child(_node_spacing_slider)
		
		_node_spacing_label = Label.new()
		_node_spacing_label.custom_minimum_size = Vector2(48, 0)
		_node_spacing_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		spacing_hbox.add_child(_node_spacing_label)
		
		_node_spacing_slider.value_changed.connect(_on_node_spacing_changed)

	_update_ui()

func _scan_backgrounds() -> void:
	_background_files.clear()
	var dir := DirAccess.open(BACKGROUNDS_DIR)
	if dir:
		dir.list_dir_begin()
		var file_name := dir.get_next()
		while file_name != "":
			if not dir.current_is_dir():
				if file_name.ends_with(".exr") or file_name.ends_with(".hdr"):
					if not _background_files.has(file_name):
						_background_files.append(file_name)
				elif file_name.ends_with(".exr.import") or file_name.ends_with(".hdr.import"):
					var real_name := file_name.replace(".import", "")
					if not _background_files.has(real_name):
						_background_files.append(real_name)
			file_name = dir.get_next()
	_background_files.sort()

func _populate_background_options() -> void:
	if not _background_option:
		return
	_background_option.clear()
	_background_option.add_item("Default (Dark)", 0)

	var current_bg: String = String(_settings.get("background", ""))
	var selected_idx := 0

	for i in range(_background_files.size()):
		var file := _background_files[i]
		var display_name := file.get_basename().replace("_", " ").capitalize()
		_background_option.add_item(display_name, i + 1)
		if file == current_bg:
			selected_idx = i + 1

	_background_option.select(selected_idx)

func _update_ui() -> void:
	if _auto_reconstruct_check:
		_auto_reconstruct_check.button_pressed = bool(_settings.get("auto_reconstruct", true))
	if _retain_history_check:
		_retain_history_check.button_pressed = bool(_settings.get("retain_history", true))
	if _focus_mode_check:
		_focus_mode_check.button_pressed = bool(_settings.get("focus_mode", true))
	if _background_option:
		_populate_background_options()
	if _brightness_slider:
		_brightness_slider.value = _brightness_actual_to_ui(float(_settings.get("bg_brightness", BG_BRIGHTNESS_ACTUAL_MAX)))
	if _brightness_value_label and _brightness_slider:
		_brightness_value_label.text = _format_brightness_ui_value(_brightness_slider.value)
	if _reading_mode_option:
		var reading_mode_value: String = String(_settings.get("reading_mode", "window"))
		_reading_mode_option.select(1 if reading_mode_value == "fullscreen" else 0)
	if _reader_render_mode_option:
		var render_mode_value: String = String(_settings.get("reader_render_mode", "render"))
		_reader_render_mode_option.select(1 if render_mode_value == "source" else 0)
	if _reader_shortcut_input:
		_reader_shortcut_input.text = String(_settings.get("reader_toggle_source_shortcut", DEFAULT_READER_TOGGLE_SHORTCUT))
	if _reader_media_scale_slider:
		_reader_media_scale_slider.value = clampf(float(_settings.get("reader_media_scale", READER_MEDIA_SCALE_DEFAULT)), READER_MEDIA_SCALE_MIN, READER_MEDIA_SCALE_MAX)
	if _reader_media_scale_label and _reader_media_scale_slider:
		_reader_media_scale_label.text = "%.2fx" % _reader_media_scale_slider.value
	if _reader_debug_check:
		_reader_debug_check.button_pressed = bool(_settings.get("reader_debug", false))
	if _node_spacing_slider:
		_node_spacing_slider.value = clampf(float(_settings.get("node_spacing", 240.0)), 100.0, 600.0)
	if _node_spacing_label and _node_spacing_slider:
		_node_spacing_label.text = "%d px" % int(_node_spacing_slider.value)

func _on_auto_reconstruct_toggled(pressed: bool) -> void:
	_settings["auto_reconstruct"] = pressed
	_save_and_emit()

func _on_retain_history_toggled(pressed: bool) -> void:
	_settings["retain_history"] = pressed
	_save_and_emit()

func _on_focus_mode_toggled(pressed: bool) -> void:
	_settings["focus_mode"] = pressed
	_save_and_emit()

func _on_background_selected(index: int) -> void:
	var bg_filename := ""
	if index > 0 and index - 1 < _background_files.size():
		bg_filename = _background_files[index - 1]
	_settings["background"] = bg_filename
	_save_and_emit()

func _on_brightness_changed(value: float) -> void:
	_settings["bg_brightness"] = _brightness_ui_to_actual(value)
	_save_and_emit()

func _on_reading_mode_selected(index: int) -> void:
	_settings["reading_mode"] = "fullscreen" if index == 1 else "window"
	_save_and_emit()

func _on_reader_render_mode_selected(index: int) -> void:
	_settings["reader_render_mode"] = "source" if index == 1 else "render"
	_save_and_emit()

func _on_reader_shortcut_submitted(raw_value: String) -> void:
	var normalized := _normalize_shortcut_value(raw_value)
	if _reader_shortcut_input:
		_reader_shortcut_input.text = normalized
	_settings["reader_toggle_source_shortcut"] = normalized
	_save_and_emit(false)

func _on_reader_media_scale_changed(value: float) -> void:
	var normalized_value := clampf(value, READER_MEDIA_SCALE_MIN, READER_MEDIA_SCALE_MAX)
	if _reader_media_scale_label:
		_reader_media_scale_label.text = "%.2fx" % normalized_value
	_settings["reader_media_scale"] = normalized_value
	_save_and_emit(false)


func _on_reader_debug_toggled(pressed: bool) -> void:
	_settings["reader_debug"] = pressed
	_save_and_emit(false)

func _on_node_spacing_changed(value: float) -> void:
	if _node_spacing_label:
		_node_spacing_label.text = "%d px" % int(value)
	_settings["node_spacing"] = value
	_save_and_emit(false)

func _normalize_shortcut_value(raw_value: String) -> String:
	var trimmed := raw_value.strip_edges()
	if trimmed.is_empty():
		return DEFAULT_READER_TOGGLE_SHORTCUT

	var has_ctrl := false
	var has_alt := false
	var has_shift := false
	var has_meta := false
	var key_token := ""
	for token in trimmed.split("+", false):
		var cleaned := token.strip_edges()
		if cleaned.is_empty():
			continue
		match cleaned.to_lower():
			"ctrl", "control", "ctl":
				has_ctrl = true
			"alt", "option":
				has_alt = true
			"shift":
				has_shift = true
			"cmd", "meta", "super", "win", "windows":
				has_meta = true
			_:
				key_token = cleaned.to_upper()

	if key_token.is_empty():
		key_token = "M"

	var parts: PackedStringArray = PackedStringArray()
	if has_ctrl:
		parts.append("Ctrl")
	if has_alt:
		parts.append("Alt")
	if has_shift:
		parts.append("Shift")
	if has_meta:
		parts.append("Meta")
	parts.append(key_token)
	return "+".join(parts)

func _save_and_emit(refresh_ui: bool = true) -> void:
	_save_settings()
	if refresh_ui:
		_update_ui()
	settings_changed.emit(_settings.duplicate(true))

func _save_settings() -> void:
	if _runtime_base_url.is_empty():
		_save_settings_local()
		return

	if _runtime_save_in_flight:
		_runtime_save_pending = true
		return

	_runtime_save_in_flight = true
	call_deferred("_save_settings_to_runtime_async")

func _save_settings_local() -> void:
	var config := ConfigFile.new()
	for key in _settings:
		config.set_value("path_mode", key, _settings[key])
	config.set_value("path_mode_meta", READER_MEDIA_SCALE_MIGRATION_KEY, true)
	config.save(SETTINGS_FILE)

func _load_settings() -> void:
	if not _runtime_base_url.is_empty():
		call_deferred("_load_settings_from_runtime_async")
		return
	_load_settings_local()

func _load_settings_local() -> void:
	var config := ConfigFile.new()
	var err := config.load(SETTINGS_FILE)
	if err == OK:
		for key in _settings.keys():
			_settings[key] = config.get_value("path_mode", key, _settings[key])
		var migrated_media_scale := bool(config.get_value("path_mode_meta", READER_MEDIA_SCALE_MIGRATION_KEY, false))
		if not migrated_media_scale:
			var legacy_scale: float = float(_settings.get("reader_media_scale", READER_MEDIA_SCALE_DEFAULT))
			_settings["reader_media_scale"] = clampf(legacy_scale / 3.0, READER_MEDIA_SCALE_MIN, READER_MEDIA_SCALE_MAX)
			config.set_value("path_mode_meta", READER_MEDIA_SCALE_MIGRATION_KEY, true)
			for key in _settings.keys():
				config.set_value("path_mode", key, _settings[key])
			config.save(SETTINGS_FILE)
		_normalize_settings_values()
	elif _runtime_base_url.is_empty():
		_save_settings_local()

func _normalize_settings_values() -> void:
	_settings["auto_reconstruct"] = bool(_settings.get("auto_reconstruct", true))
	_settings["retain_history"] = bool(_settings.get("retain_history", true))
	_settings["focus_mode"] = bool(_settings.get("focus_mode", true))
	_settings["background"] = String(_settings.get("background", ""))
	_settings["bg_brightness"] = clampf(
		float(_settings.get("bg_brightness", BG_BRIGHTNESS_ACTUAL_MAX)),
		BG_BRIGHTNESS_ACTUAL_MIN,
		BG_BRIGHTNESS_ACTUAL_MAX
	)

	var reading_mode := String(_settings.get("reading_mode", "window")).to_lower()
	_settings["reading_mode"] = "fullscreen" if reading_mode == "fullscreen" else "window"

	var render_mode := String(_settings.get("reader_render_mode", "render")).to_lower()
	_settings["reader_render_mode"] = "source" if render_mode == "source" else "render"

	_settings["reader_toggle_source_shortcut"] = _normalize_shortcut_value(
		String(_settings.get("reader_toggle_source_shortcut", DEFAULT_READER_TOGGLE_SHORTCUT))
	)
	_settings["reader_media_scale"] = clampf(
		float(_settings.get("reader_media_scale", READER_MEDIA_SCALE_DEFAULT)),
		READER_MEDIA_SCALE_MIN,
		READER_MEDIA_SCALE_MAX
	)
	_settings["reader_debug"] = bool(_settings.get("reader_debug", false))
	_settings["node_spacing"] = clampf(float(_settings.get("node_spacing", 240.0)), 100.0, 600.0)

func _brightness_actual_to_ui(value: float) -> float:
	if BG_BRIGHTNESS_ACTUAL_MAX <= BG_BRIGHTNESS_ACTUAL_MIN:
		return BG_BRIGHTNESS_UI_MIN
	var normalized := (clampf(value, BG_BRIGHTNESS_ACTUAL_MIN, BG_BRIGHTNESS_ACTUAL_MAX) - BG_BRIGHTNESS_ACTUAL_MIN) / (BG_BRIGHTNESS_ACTUAL_MAX - BG_BRIGHTNESS_ACTUAL_MIN)
	return clampf(normalized * BG_BRIGHTNESS_UI_MAX, BG_BRIGHTNESS_UI_MIN, BG_BRIGHTNESS_UI_MAX)

func _brightness_ui_to_actual(value: float) -> float:
	var normalized := clampf(value, BG_BRIGHTNESS_UI_MIN, BG_BRIGHTNESS_UI_MAX) / BG_BRIGHTNESS_UI_MAX
	return lerpf(BG_BRIGHTNESS_ACTUAL_MIN, BG_BRIGHTNESS_ACTUAL_MAX, normalized)

func _format_brightness_ui_value(value: float) -> String:
	return "%.1f" % clampf(value, BG_BRIGHTNESS_UI_MIN, BG_BRIGHTNESS_UI_MAX)

func _resolve_runtime_base_url() -> String:
	var explicit_base := OS.get_environment("NOTE_CONNECTION_BASE_URL").strip_edges()
	if not explicit_base.is_empty():
		return explicit_base.trim_suffix("/")

	var port_text := OS.get_environment("NOTE_CONNECTION_PORT").strip_edges()
	if port_text.is_valid_int():
		var port := int(port_text)
		if port > 0:
			return "http://127.0.0.1:%d" % port
	return ""

func _apply_remote_settings(remote_settings: Dictionary) -> void:
	for key in _settings.keys():
		if remote_settings.has(key):
			_settings[key] = remote_settings[key]
	_normalize_settings_values()

func _request_runtime_json(path_suffix: String, method: int, body: Dictionary = {}) -> Dictionary:
	if _runtime_base_url.is_empty():
		return {
			"ok": false,
			"error": "Runtime API unavailable."
		}

	var request := HTTPRequest.new()
	add_child(request)

	var url := "%s%s" % [_runtime_base_url, path_suffix]
	var headers := PackedStringArray()
	var auth_token := OS.get_environment("NOTE_CONNECTION_AUTH_TOKEN").strip_edges()
	if not auth_token.is_empty():
		headers.append("X-NoteConnection-Token: %s" % auth_token)
	var payload := ""
	if method != HTTPClient.METHOD_GET:
		headers.append("Content-Type: application/json")
		payload = JSON.stringify(body)

	var request_err := request.request(url, headers, method, payload)
	if request_err != OK:
		request.queue_free()
		return {
			"ok": false,
			"error": "HTTPRequest failed to start (%s)." % request_err
		}

	var response: Array = await request.request_completed
	request.queue_free()

	if response.size() < 4:
		return {
			"ok": false,
			"error": "Malformed HTTP response."
		}

	var response_code := int(response[1])
	var response_body := ""
	if response[3] is PackedByteArray:
		response_body = (response[3] as PackedByteArray).get_string_from_utf8()

	var decoded: Variant = JSON.parse_string(response_body)
	if typeof(decoded) != TYPE_DICTIONARY:
		if response_code >= 200 and response_code < 300:
			return {
				"ok": false,
				"error": "Invalid JSON response from runtime settings API."
			}
		return {
			"ok": false,
			"error": "Runtime settings API request failed (HTTP %d)." % response_code
		}

	var payload_dict: Dictionary = decoded
	if response_code < 200 or response_code >= 300:
		return {
			"ok": false,
			"error": String(payload_dict.get("error", "Runtime settings API request failed."))
		}

	return {
		"ok": true,
		"data": payload_dict
	}

func _load_settings_from_runtime_async() -> void:
	var result: Dictionary = await _request_runtime_json(PATH_MODE_SETTINGS_ENDPOINT, HTTPClient.METHOD_GET)
	if not bool(result.get("ok", false)):
		push_warning("[SettingsPanel] Failed to load TOML path_mode settings: %s" % String(result.get("error", "unknown")))
		_load_settings_local()
		_update_ui()
		settings_changed.emit(_settings.duplicate(true))
		return

	var payload: Dictionary = result.get("data", {})
	var remote_settings = payload.get("settings", {})
	if typeof(remote_settings) != TYPE_DICTIONARY:
		push_warning("[SettingsPanel] Runtime settings response does not contain a dictionary.")
		return

	_apply_remote_settings(remote_settings)
	_update_ui()
	settings_changed.emit(_settings.duplicate(true))

func _save_settings_to_runtime_async() -> void:
	var result: Dictionary = await _request_runtime_json(
		PATH_MODE_SETTINGS_ENDPOINT,
		HTTPClient.METHOD_POST,
		{
			"settings": _settings
		}
	)

	if bool(result.get("ok", false)):
		var payload: Dictionary = result.get("data", {})
		var remote_settings = payload.get("settings", {})
		if typeof(remote_settings) == TYPE_DICTIONARY:
			_apply_remote_settings(remote_settings)
	else:
		push_warning("[SettingsPanel] Failed to persist TOML path_mode settings: %s. Falling back to local cfg." % String(result.get("error", "unknown")))
		_save_settings_local()

	_runtime_save_in_flight = false
	if _runtime_save_pending:
		_runtime_save_pending = false
		_save_settings()

func get_all_settings() -> Dictionary:
	return _settings.duplicate(true)

func get_setting(key: String, default = null):
	return _settings.get(key, default)

func set_setting(key: String, value) -> void:
	_settings[key] = value
	if key == "reader_toggle_source_shortcut":
		_settings[key] = _normalize_shortcut_value(String(value))
	elif key == "reader_media_scale":
		_settings[key] = clampf(float(value), READER_MEDIA_SCALE_MIN, READER_MEDIA_SCALE_MAX)
	elif key == "node_spacing":
		_settings[key] = clampf(float(value), 100.0, 600.0)
	_update_ui()
	_save_settings()
	settings_changed.emit(_settings)
