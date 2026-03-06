class_name SettingsPanel
extends PopupPanel

signal settings_changed(settings: Dictionary)

const SETTINGS_FILE := "user://settings.cfg"
const BACKGROUNDS_DIR := "res://assets/backgrounds"

@onready var _auto_reconstruct_check: CheckBox = $MarginContainer/VBoxContainer/AutoReconstructCheck

var _retain_history_check: CheckBox
var _focus_mode_check: CheckBox
var _background_option: OptionButton
var _reading_mode_option: OptionButton

var _background_files: Array[String] = []

var _settings: Dictionary = {
	"auto_reconstruct": true,
	"retain_history": true,
	"focus_mode": true,
	"background": "belfast_sunset_puresky_4k.exr",
	"bg_brightness": 1.0,
	"reading_mode": "window"
}

func _ready() -> void:
	size = Vector2i(420, 360)
	_scan_backgrounds()
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

		var brightness_slider := HSlider.new()
		brightness_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		brightness_slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		brightness_slider.min_value = 0.01
		brightness_slider.max_value = 10.0
		brightness_slider.step = 0.05
		brightness_slider.value = _settings.get("bg_brightness", 1.0)
		bright_hbox.add_child(brightness_slider)

		var bright_val_label := Label.new()
		bright_val_label.text = "%.1fx" % brightness_slider.value
		bright_val_label.custom_minimum_size = Vector2(42, 0)
		bright_val_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		bright_hbox.add_child(bright_val_label)

		brightness_slider.value_changed.connect(func(value: float):
			bright_val_label.text = "%.1fx" % value
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
		_auto_reconstruct_check.button_pressed = _settings.get("auto_reconstruct", true)
	if _retain_history_check:
		_retain_history_check.button_pressed = _settings.get("retain_history", true)
	if _focus_mode_check:
		_focus_mode_check.button_pressed = _settings.get("focus_mode", true)
	if _background_option:
		_populate_background_options()
	if _reading_mode_option:
		var reading_mode_value: String = String(_settings.get("reading_mode", "window"))
		_reading_mode_option.select(1 if reading_mode_value == "fullscreen" else 0)

func _on_auto_reconstruct_toggled(pressed: bool) -> void:
	_settings["auto_reconstruct"] = pressed
	_save_settings()
	settings_changed.emit(_settings)

func _on_retain_history_toggled(pressed: bool) -> void:
	_settings["retain_history"] = pressed
	_save_settings()
	settings_changed.emit(_settings)

func _on_focus_mode_toggled(pressed: bool) -> void:
	_settings["focus_mode"] = pressed
	_save_settings()
	settings_changed.emit(_settings)

func _on_background_selected(index: int) -> void:
	var bg_filename := ""
	if index > 0 and index - 1 < _background_files.size():
		bg_filename = _background_files[index - 1]

	_settings["background"] = bg_filename
	_save_settings()
	settings_changed.emit(_settings)

func _on_brightness_changed(value: float) -> void:
	_settings["bg_brightness"] = value
	_save_settings()
	settings_changed.emit(_settings)

func _on_reading_mode_selected(index: int) -> void:
	_settings["reading_mode"] = "fullscreen" if index == 1 else "window"
	_save_settings()
	settings_changed.emit(_settings)

func _save_settings() -> void:
	var config := ConfigFile.new()
	for key in _settings:
		config.set_value("path_mode", key, _settings[key])
	config.save(SETTINGS_FILE)

func _load_settings() -> void:
	var config := ConfigFile.new()
	var err := config.load(SETTINGS_FILE)
	if err == OK:
		for key in _settings.keys():
			_settings[key] = config.get_value("path_mode", key, _settings[key])
	else:
		_save_settings()

func get_all_settings() -> Dictionary:
	return _settings.duplicate(true)

func get_setting(key: String, default = null):
	return _settings.get(key, default)
