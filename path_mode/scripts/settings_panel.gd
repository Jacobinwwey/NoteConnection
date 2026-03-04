class_name SettingsPanel
extends PopupPanel

signal settings_changed(settings: Dictionary)

const SETTINGS_FILE := "user://settings.cfg"

@onready var _auto_reconstruct_check: CheckBox = $VBoxContainer/AutoReconstructCheck

var _retain_history_check: CheckBox
var _focus_mode_check: CheckBox

var _settings: Dictionary = {
	"auto_reconstruct": true,
	"retain_history": true,
	"focus_mode": true, # Default enabled
	"background_file": "Default (Dark Color)"
	# "theme": "colorful" 
}

var _background_option: OptionButton

func _ready() -> void:
	_load_settings()
	_update_ui()
	
	if _auto_reconstruct_check:
		_auto_reconstruct_check.toggled.connect(_on_auto_reconstruct_toggled)
		
	## Dynamically add checkboxes
	var vbox = $VBoxContainer
	if vbox:
		# Retain History
		_retain_history_check = CheckBox.new()
		_retain_history_check.text = "Retain Learning History"
		_retain_history_check.tooltip_text = "If checked, progress is saved between sessions."
		vbox.add_child(_retain_history_check)
		_retain_history_check.button_pressed = _settings.get("retain_history", true)
		_retain_history_check.toggled.connect(_on_retain_history_toggled)
		
		# Focus Mode (New)
		_focus_mode_check = CheckBox.new()
		_focus_mode_check.text = "Focus on this node"
		_focus_mode_check.tooltip_text = "Highlight incoming nodes for the central node and dim others."
		vbox.add_child(_focus_mode_check)
		_focus_mode_check.button_pressed = _settings.get("focus_mode", true)
		_focus_mode_check.toggled.connect(_on_focus_mode_toggled)

		vbox.add_child(HSeparator.new())

		# Background Selector
		var bg_hbox = HBoxContainer.new()
		vbox.add_child(bg_hbox)
		var bg_label = Label.new()
		bg_label.text = "Background Env:"
		bg_hbox.add_child(bg_label)
		
		_background_option = OptionButton.new()
		_background_option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bg_hbox.add_child(_background_option)
		_populate_background_options()
		_background_option.item_selected.connect(_on_background_selected)

func _update_ui() -> void:
	if _auto_reconstruct_check:
		_auto_reconstruct_check.button_pressed = _settings.get("auto_reconstruct", true)
	if _retain_history_check:
		_retain_history_check.button_pressed = _settings.get("retain_history", true)
	if _focus_mode_check:
		_focus_mode_check.button_pressed = _settings.get("focus_mode", true)
	
	if _background_option:
		var current_bg = _settings.get("background_file", "Default (Dark Color)")
		for i in range(_background_option.item_count):
			if _background_option.get_item_text(i) == current_bg:
				_background_option.select(i)
				break

func _populate_background_options() -> void:
	if not _background_option:
		return
	_background_option.clear()
	_background_option.add_item("Default (Dark Color)")
	
	var dir_path := "E:/Knowledge_project/NoteConnection_app/path_mode/assets/backgrounds/"
	var dir := DirAccess.open(dir_path)
	if dir:
		dir.list_dir_begin()
		var file_name := dir.get_next()
		while file_name != "":
			if not dir.current_is_dir() and not file_name.ends_with(".import"):
				var ext = file_name.get_extension().to_lower()
				if ext in ["hdr", "exr", "png", "jpg", "jpeg"]:
					_background_option.add_item(file_name)
			file_name = dir.get_next()
		dir.list_dir_end()
	else:
		push_warning("Could not open backgrounds directory: " + dir_path)

func _on_background_selected(index: int) -> void:
	if not _background_option:
		return
	var selected_file = _background_option.get_item_text(index)
	_settings["background_file"] = selected_file
	_save_settings()
	settings_changed.emit(_settings)

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

func _save_settings() -> void:
	var config = ConfigFile.new()
	for key in _settings:
		config.set_value("path_mode", key, _settings[key])
	config.save(SETTINGS_FILE)

func _load_settings() -> void:
	var config = ConfigFile.new()
	var err = config.load(SETTINGS_FILE)
	if err == OK:
		for key in _settings.keys():
			_settings[key] = config.get_value("path_mode", key, _settings[key])
	else:
		_save_settings() # Create default

func get_setting(key: String, default = null):
	return _settings.get(key, default)
