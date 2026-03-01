extends CanvasLayer

## Path Mode UI Controller
## Handles button interactions, progress display, completed nodes sidebar,
## navigation history, tree panel, and edit mode for unmark completion

class_name PathModeUI

signal mark_complete_pressed
signal sidebar_toggled(visible: bool)
signal completed_node_clicked(node_id: String)
signal return_pressed
signal return_to_node(node_id: String)
signal tree_node_clicked(node_id: String)
signal unmark_requested(node_id: String)
signal mark_node_requested(node_id: String)
signal node_toggle_requested(node_id: String) # New
signal node_expand_prereqs_requested(node_id: String) # New
signal node_collapse_prereqs_requested(node_id: String) # New
signal collapse_all_requested() # New
signal settings_updated(settings: Dictionary)
signal exit_requested

const TREE_VIEW_SCENE = preload("res://scenes/tree_view_panel.tscn")
const SETTINGS_SCENE = preload("res://scenes/settings_panel.tscn")

@onready var mode_label: Label = $MarginContainer/VBoxContainer/ModeLabel
@onready var progress_label: Label = $MarginContainer/VBoxContainer/ProgressLabel
@onready var mark_complete_btn: Button = $MarginContainer/VBoxContainer/MarkCompleteButton
@onready var sidebar_header: Button = $GoldStarSidebar/HeaderButton
@onready var completed_list: ItemList = $GoldStarSidebar/CompletedList

## Navigation state
var _sidebar_visible: bool = true
var _completed_nodes: Dictionary = {} # id -> label
var _is_browsing: bool = false
var _learning_position: String = "" # Original position before browsing
var _nav_history: Array[String] = [] # Stack of visited nodes while browsing

## Edit mode state
var _edit_mode: bool = false

## Dynamic UI elements (created in code since they're conditional)
var _return_button: MenuButton = null
var _edit_button: Button = null
var _tree_panel: VBoxContainer = null
var _tree_view = null # TreeViewPanel instance
var _settings_panel = null # SettingsPanel instance
var _settings_button: Button = null
var _mode_option: OptionButton = null
var _strategy_option: OptionButton = null
var _target_button: Button = null
var _history_button: Button = null
var _exit_button: Button = null
var _history_popup: PopupPanel = null
var _history_list: ItemList = null
var _target_popup: PopupPanel = null
var _target_filter_input: LineEdit = null
var _target_list: ItemList = null

var _current_mode: String = "domain"
var _current_strategy: String = "foundational"
var _current_target_id: String = ""
var _current_target_label: String = ""
var _current_central_id: String = ""
var _target_nodes: Array[Dictionary] = []

## Tree panel fullscreen state
var _is_tree_fullscreen: bool = false
var _tree_panel_default_offsets: Dictionary = {}


func _ready() -> void:
	_create_dynamic_ui()
	_connect_signals()
	_setup_initial_state()


func _create_dynamic_ui() -> void:
	## Create Return button (hidden by default)
	_return_button = MenuButton.new()
	_return_button.text = "← Return"
	_return_button.visible = false
	_return_button.flat = false
	
	## Add to top-left VBox after progress label
	var vbox := $MarginContainer/VBoxContainer as VBoxContainer
	if vbox:
		vbox.add_child(_return_button)
		vbox.move_child(_return_button, 3) # After MarkCompleteButton
		
		## Path mode controls row (migrated from web toolbar in Tauri flow)
		var control_row := HBoxContainer.new()
		control_row.name = "PathControlRow"
		control_row.add_theme_constant_override("separation", 10)
		vbox.add_child(control_row)
		vbox.move_child(control_row, 4) # After Return button
		
		var mode_title := Label.new()
		mode_title.text = "Mode"
		control_row.add_child(mode_title)
		
		_mode_option = OptionButton.new()
		_mode_option.custom_minimum_size = Vector2(120, 34)
		_mode_option.add_item("Domain", 0)
		_mode_option.add_item("Diffusion", 1)
		control_row.add_child(_mode_option)
		_apply_option_style(_mode_option)
		
		var strategy_title := Label.new()
		strategy_title.text = "Strategy"
		control_row.add_child(strategy_title)
		
		_strategy_option = OptionButton.new()
		_strategy_option.custom_minimum_size = Vector2(130, 34)
		_strategy_option.add_item("Foundational", 0)
		_strategy_option.add_item("Core", 1)
		control_row.add_child(_strategy_option)
		_apply_option_style(_strategy_option)

		_target_button = Button.new()
		_target_button.text = "Target: Auto"
		_target_button.custom_minimum_size = Vector2(160, 34)
		control_row.add_child(_target_button)
		_apply_button_style(_target_button, Color(0.18, 0.24, 0.31, 1.0), Color(0.24, 0.31, 0.4, 1.0), Color(0.14, 0.19, 0.25, 1.0), Color(0.36, 0.5, 0.66, 1.0), Color(0.92, 0.97, 1.0, 1.0))
		
		var layout_title := Label.new()
		layout_title.text = "Layout: Track (Focus)"
		layout_title.modulate = Color(0.7, 0.85, 1.0, 1.0)
		control_row.add_child(layout_title)
		
		var spacer := Control.new()
		spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		control_row.add_child(spacer)
		
		_history_button = Button.new()
		_history_button.text = "History"
		_history_button.custom_minimum_size = Vector2(88, 34)
		control_row.add_child(_history_button)
		
		_exit_button = Button.new()
		_exit_button.text = "Exit"
		_exit_button.custom_minimum_size = Vector2(72, 34)
		control_row.add_child(_exit_button)

	## Lightweight visual polish for key actions
	if mark_complete_btn:
		mark_complete_btn.text = "Complete"
		mark_complete_btn.custom_minimum_size = Vector2(140, 38)
		_apply_button_style(mark_complete_btn, Color(0.9, 0.55, 0.15, 1.0), Color(1.0, 0.66, 0.22, 1.0), Color(0.78, 0.42, 0.08, 1.0), Color(0.25, 0.18, 0.1, 1.0), Color(0.09, 0.08, 0.07, 1.0))
	
	## Create Edit button in sidebar header area
	_edit_button = Button.new()
	_edit_button.text = "Edit"
	_edit_button.toggle_mode = true
	var sidebar := $GoldStarSidebar as VBoxContainer
	if sidebar:
		var header_row := HBoxContainer.new()
		header_row.name = "EditRow"
		sidebar.add_child(header_row)
		sidebar.move_child(header_row, 1) # After HeaderButton
		header_row.add_child(_edit_button)
		_edit_button.size_flags_horizontal = Control.SIZE_SHRINK_END
		
		# Add Settings Button to the same row
		_settings_button = Button.new()
		_settings_button.text = "⚙"
		_settings_button.tooltip_text = "Settings"
		header_row.add_child(_settings_button)
		_apply_button_style(_edit_button, Color(0.2, 0.24, 0.3, 1.0), Color(0.27, 0.31, 0.4, 1.0), Color(0.14, 0.18, 0.24, 1.0), Color(0.42, 0.46, 0.58, 1.0), Color(0.92, 0.95, 1.0, 1.0))
		_apply_button_style(_settings_button, Color(0.18, 0.22, 0.28, 1.0), Color(0.24, 0.3, 0.38, 1.0), Color(0.14, 0.18, 0.24, 1.0), Color(0.35, 0.44, 0.56, 1.0), Color(0.88, 0.94, 1.0, 1.0))
		
	## Create Settings Panel
	if SETTINGS_SCENE:
		_settings_panel = SETTINGS_SCENE.instantiate()
		add_child(_settings_panel)

	## Create Diffusion Target Picker
	_target_popup = PopupPanel.new()
	_target_popup.name = "TargetPopup"
	_target_popup.size = Vector2i(460, 520)
	_target_popup.visible = false
	add_child(_target_popup)

	var target_vbox := VBoxContainer.new()
	target_vbox.name = "VBox"
	target_vbox.offset_left = 12
	target_vbox.offset_top = 12
	target_vbox.offset_right = 448
	target_vbox.offset_bottom = 508
	_target_popup.add_child(target_vbox)

	var title := Label.new()
	title.text = "Select Diffusion Target"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 18)
	target_vbox.add_child(title)

	_target_filter_input = LineEdit.new()
	_target_filter_input.placeholder_text = "Search node..."
	target_vbox.add_child(_target_filter_input)

	_target_list = ItemList.new()
	_target_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_target_list.select_mode = ItemList.SELECT_SINGLE
	target_vbox.add_child(_target_list)

	var target_actions := HBoxContainer.new()
	target_vbox.add_child(target_actions)

	var close_target_btn := Button.new()
	close_target_btn.text = "Close"
	close_target_btn.custom_minimum_size = Vector2(88, 34)
	target_actions.add_child(close_target_btn)
	_apply_button_style(close_target_btn, Color(0.23, 0.26, 0.3, 1.0), Color(0.29, 0.33, 0.38, 1.0), Color(0.18, 0.21, 0.25, 1.0), Color(0.42, 0.47, 0.55, 1.0), Color(0.95, 0.97, 1.0, 1.0))
	close_target_btn.pressed.connect(func():
		if _target_popup:
			_target_popup.hide()
	)

	## Create Navigation History Popup
	_history_popup = PopupPanel.new()
	_history_popup.name = "HistoryPopup"
	_history_popup.size = Vector2i(420, 520)
	_history_popup.visible = false
	add_child(_history_popup)

	var history_margin := MarginContainer.new()
	history_margin.add_theme_constant_override("margin_left", 12)
	history_margin.add_theme_constant_override("margin_top", 12)
	history_margin.add_theme_constant_override("margin_right", 12)
	history_margin.add_theme_constant_override("margin_bottom", 12)
	_history_popup.add_child(history_margin)

	var history_vbox := VBoxContainer.new()
	history_vbox.add_theme_constant_override("separation", 8)
	history_margin.add_child(history_vbox)

	var history_title := Label.new()
	history_title.text = "Navigation History"
	history_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	history_title.add_theme_font_size_override("font_size", 18)
	history_vbox.add_child(history_title)

	_history_list = ItemList.new()
	_history_list.select_mode = ItemList.SELECT_SINGLE
	_history_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	history_vbox.add_child(_history_list)

	var history_actions := HBoxContainer.new()
	history_vbox.add_child(history_actions)

	var clear_history_btn := Button.new()
	clear_history_btn.text = "Clear"
	clear_history_btn.custom_minimum_size = Vector2(88, 34)
	history_actions.add_child(clear_history_btn)
	_apply_button_style(clear_history_btn, Color(0.23, 0.26, 0.3, 1.0), Color(0.29, 0.33, 0.38, 1.0), Color(0.18, 0.21, 0.25, 1.0), Color(0.42, 0.47, 0.55, 1.0), Color(0.95, 0.97, 1.0, 1.0))
	clear_history_btn.pressed.connect(func():
		_end_browsing()
		_refresh_history_popup()
	)

	var history_spacer := Control.new()
	history_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	history_actions.add_child(history_spacer)

	var close_history_btn := Button.new()
	close_history_btn.text = "Close"
	close_history_btn.custom_minimum_size = Vector2(88, 34)
	history_actions.add_child(close_history_btn)
	_apply_button_style(close_history_btn, Color(0.23, 0.26, 0.3, 1.0), Color(0.29, 0.33, 0.38, 1.0), Color(0.18, 0.21, 0.25, 1.0), Color(0.42, 0.47, 0.55, 1.0), Color(0.95, 0.97, 1.0, 1.0))
	close_history_btn.pressed.connect(func():
		if _history_popup:
			_history_popup.hide()
	)
	
	## Create Tree Panel (left sidebar) with proper sizing
	_tree_panel = VBoxContainer.new()
	_tree_panel.name = "TreePanel"
	## Use anchors for left side positioning
	_tree_panel.anchor_left = 0.0
	_tree_panel.anchor_top = 0.0
	_tree_panel.anchor_right = 0.0
	_tree_panel.anchor_bottom = 1.0
	_tree_panel.offset_left = 20
	_tree_panel.offset_top = 220 # Keep clear from top control row
	_tree_panel.offset_right = 250 # 230px wide
	_tree_panel.offset_bottom = -20
	_tree_panel.custom_minimum_size = Vector2(200, 200)
	_tree_panel.z_index = -1
	add_child(_tree_panel)
	
	var header_hbox := HBoxContainer.new()
	_tree_panel.add_child(header_hbox)
	
	var tree_header := Label.new()
	tree_header.text = "Learning Path"
	tree_header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tree_header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header_hbox.add_child(tree_header)
	
	var collapse_btn := Button.new()
	collapse_btn.text = "[-]"
	collapse_btn.tooltip_text = "Collapse All Nodes"
	collapse_btn.focus_mode = Control.FOCUS_NONE
	collapse_btn.pressed.connect(func(): collapse_all_requested.emit())
	header_hbox.add_child(collapse_btn)
	
	## Instantiate new Tree View Panel
	if TREE_VIEW_SCENE:
		_tree_view = TREE_VIEW_SCENE.instantiate()
		_tree_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
		_tree_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_tree_panel.add_child(_tree_view)
	
	if _history_button:
		_apply_button_style(_history_button, Color(0.15, 0.21, 0.3, 1.0), Color(0.21, 0.29, 0.4, 1.0), Color(0.11, 0.17, 0.24, 1.0), Color(0.33, 0.47, 0.63, 1.0), Color(0.9, 0.96, 1.0, 1.0))
	if _exit_button:
		_apply_button_style(_exit_button, Color(0.26, 0.19, 0.21, 1.0), Color(0.34, 0.23, 0.26, 1.0), Color(0.2, 0.14, 0.16, 1.0), Color(0.62, 0.3, 0.34, 1.0), Color(1.0, 0.92, 0.92, 1.0))

	if mode_label:
		mode_label.add_theme_color_override("font_color", Color(0.82, 0.92, 1.0, 1.0))
	if progress_label:
		progress_label.add_theme_color_override("font_color", Color(0.9, 0.95, 1.0, 1.0))
		progress_label.add_theme_font_size_override("font_size", 16)


func _apply_button_style(button: Button, normal_color: Color, hover_color: Color, pressed_color: Color, border_color: Color, font_color: Color) -> void:
	if not button:
		return
	
	var normal := StyleBoxFlat.new()
	normal.bg_color = normal_color
	normal.border_color = border_color
	normal.border_width_left = 1
	normal.border_width_top = 1
	normal.border_width_right = 1
	normal.border_width_bottom = 1
	normal.corner_radius_top_left = 10
	normal.corner_radius_top_right = 10
	normal.corner_radius_bottom_left = 10
	normal.corner_radius_bottom_right = 10
	normal.content_margin_left = 12
	normal.content_margin_right = 12
	normal.content_margin_top = 6
	normal.content_margin_bottom = 6
	
	var hover := normal.duplicate() as StyleBoxFlat
	hover.bg_color = hover_color
	
	var pressed := normal.duplicate() as StyleBoxFlat
	pressed.bg_color = pressed_color
	
	var focus := normal.duplicate() as StyleBoxFlat
	focus.border_color = Color(0.62, 0.84, 1.0, 1.0)
	focus.border_width_left = 2
	focus.border_width_top = 2
	focus.border_width_right = 2
	focus.border_width_bottom = 2
	
	button.add_theme_stylebox_override("normal", normal)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", pressed)
	button.add_theme_stylebox_override("focus", focus)
	button.add_theme_color_override("font_color", font_color)
	button.add_theme_color_override("font_hover_color", font_color)
	button.add_theme_color_override("font_pressed_color", font_color)
	button.add_theme_color_override("font_focus_color", font_color)


func _apply_option_style(option: OptionButton) -> void:
	if not option:
		return
	
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.16, 0.2, 0.28, 0.95)
	style.border_color = Color(0.35, 0.48, 0.68, 1.0)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 8
	style.content_margin_right = 8
	option.add_theme_stylebox_override("normal", style)
	option.add_theme_stylebox_override("hover", style)
	option.add_theme_stylebox_override("pressed", style)
	option.add_theme_stylebox_override("focus", style)
	option.add_theme_color_override("font_color", Color(0.92, 0.97, 1.0, 1.0))


func _connect_signals() -> void:
	## Mark Complete button
	if mark_complete_btn:
		mark_complete_btn.pressed.connect(_on_mark_complete_pressed)
	
	## Sidebar toggle
	if sidebar_header:
		sidebar_header.pressed.connect(_on_sidebar_header_pressed)
	
	## Completed list item click
	if completed_list:
		completed_list.item_clicked.connect(_on_completed_item_clicked)
	
	## Return button popup
	if _return_button:
		_return_button.get_popup().id_pressed.connect(_on_return_menu_selected)
		_return_button.about_to_popup.connect(_on_return_about_to_popup)
	
	## Edit button toggle
	if _edit_button:
		_edit_button.toggled.connect(_on_edit_toggled)
		
	## Settings button
	if _settings_button and _settings_panel:
		_settings_button.pressed.connect(func(): _settings_panel.popup_centered())
		_settings_panel.settings_changed.connect(_on_settings_panel_changed)
	
	if _mode_option:
		_mode_option.item_selected.connect(_on_mode_selected)
	if _strategy_option:
		_strategy_option.item_selected.connect(_on_strategy_selected)
	if _target_button:
		_target_button.pressed.connect(_on_target_pressed)
	if _history_button:
		_history_button.pressed.connect(_on_history_pressed)
	if _exit_button:
		_exit_button.pressed.connect(_on_exit_pressed)
	if _history_list:
		_history_list.item_activated.connect(_on_history_item_activated)
		_history_list.item_clicked.connect(func(index: int, _at: Vector2, _mouse_button: int):
			_on_history_item_activated(index)
		)
	if _target_filter_input:
		_target_filter_input.text_changed.connect(_on_target_filter_changed)
	if _target_list:
		_target_list.item_activated.connect(_on_target_item_activated)
		_target_list.item_clicked.connect(func(index: int, _at: Vector2, _mouse_button: int):
			_on_target_item_activated(index)
		)
	
	## Tree View signals
	if _tree_view:
		_tree_view.node_navigate_requested.connect(func(id): tree_node_clicked.emit(id))
		_tree_view.node_mark_complete_requested.connect(func(id): mark_node_requested.emit(id))
		_tree_view.node_unmark_requested.connect(func(id): unmark_requested.emit(id))
		_tree_view.node_toggle_requested.connect(func(id): node_toggle_requested.emit(id))
		_tree_view.node_expand_prereqs_requested.connect(func(id): node_expand_prereqs_requested.emit(id)) # New
		_tree_view.node_collapse_prereqs_requested.connect(func(id): node_collapse_prereqs_requested.emit(id)) # New
		_tree_view.collapse_all_requested.connect(func(): collapse_all_requested.emit()) # New
		_tree_view.fullscreen_requested.connect(_on_tree_fullscreen_requested)

func _on_settings_panel_changed(settings: Dictionary) -> void:
	_emit_runtime_config(settings)
	if _tree_view and _tree_view.has_method("update_settings"):
		_tree_view.update_settings(settings)


func _setup_initial_state() -> void:
	update_progress(0, 0)
	_update_sidebar_header()
	_update_target_button_state()
	_emit_runtime_config()


## Called when Mark Complete button is pressed
func _on_mark_complete_pressed() -> void:
	print("[PathModeUI] Mark Complete pressed")
	mark_complete_pressed.emit()


func _on_mode_selected(index: int) -> void:
	_current_mode = "domain" if index == 0 else "diffusion"
	var mode_name := "Domain Learning" if _current_mode == "domain" else "Diffusion Learning"
	update_mode(mode_name)
	if _current_mode == "diffusion":
		_ensure_valid_diffusion_target()
	_update_target_button_state()
	_emit_runtime_config()
	if _current_mode == "diffusion":
		_on_target_pressed()


func _on_strategy_selected(index: int) -> void:
	_current_strategy = "foundational" if index == 0 else "core"
	_emit_runtime_config()


func _on_target_pressed() -> void:
	if _current_mode != "diffusion":
		return
	if not _target_popup:
		return
	_ensure_valid_diffusion_target()
	_populate_target_list(_target_filter_input.text if _target_filter_input else "")
	_target_popup.popup_centered()
	if _target_filter_input:
		_target_filter_input.grab_focus()


func _on_target_filter_changed(text: String) -> void:
	_populate_target_list(text)


func _on_target_item_activated(index: int) -> void:
	if not _target_list:
		return
	var node_id := _target_list.get_item_metadata(index) as String
	if node_id.is_empty():
		return
	_select_target(node_id)
	if _target_popup:
		_target_popup.hide()


func _select_target(node_id: String) -> void:
	for node in _target_nodes:
		var id: String = node.get("id", "")
		if id == node_id:
			_current_target_id = id
			_current_target_label = node.get("label", id)
			break
	_update_target_button_state()
	_emit_runtime_config()


func _populate_target_list(filter_text: String = "") -> void:
	if not _target_list:
		return
	_target_list.clear()
	var filter_lower := filter_text.to_lower()
	for node in _target_nodes:
		var id: String = node.get("id", "")
		var label: String = node.get("label", id)
		if id.is_empty():
			continue
		if not filter_lower.is_empty():
			var id_match := id.to_lower().contains(filter_lower)
			var label_match := label.to_lower().contains(filter_lower)
			if not id_match and not label_match:
				continue
		var idx := _target_list.add_item(label)
		_target_list.set_item_metadata(idx, id)
		if id == _current_target_id:
			_target_list.select(idx)


func _ensure_valid_diffusion_target() -> void:
	if _current_mode != "diffusion":
		return
	if not _current_target_id.is_empty():
		return

	if not _current_central_id.is_empty():
		_current_target_id = _current_central_id
		_current_target_label = _current_central_id
		for node in _target_nodes:
			if node.get("id", "") == _current_central_id:
				_current_target_label = node.get("label", _current_central_id)
				break
		return

	if _target_nodes.size() > 0:
		var first := _target_nodes[0]
		_current_target_id = first.get("id", "")
		_current_target_label = first.get("label", _current_target_id)


func _update_target_button_state() -> void:
	if not _target_button:
		return
	var enabled := _current_mode == "diffusion"
	_target_button.disabled = not enabled
	if not enabled:
		_target_button.text = "Target: Domain Auto"
		_target_button.tooltip_text = "Switch mode to Diffusion to pick a target."
		return

	_ensure_valid_diffusion_target()
	var label := _current_target_label if not _current_target_label.is_empty() else _current_target_id
	if label.is_empty():
		label = "Select"
	var display := label
	if display.length() > 26:
		display = display.substr(0, 23) + "..."
	_target_button.text = "Target: %s" % display
	_target_button.tooltip_text = "Current Diffusion target: %s" % label


func _on_exit_pressed() -> void:
	exit_requested.emit()


func _on_history_pressed() -> void:
	if not _history_popup:
		return
	_refresh_history_popup()
	_history_popup.popup_centered()


func _refresh_history_popup() -> void:
	if not _history_list:
		return

	_history_list.clear()

	if _learning_position != "":
		var learning_label: String = String(_completed_nodes.get(_learning_position, _learning_position))
		var learn_idx := _history_list.add_item("↩ Return to learning: %s" % learning_label)
		_history_list.set_item_metadata(learn_idx, "__RETURN_TO_LEARNING__")

	if _nav_history.is_empty():
		var empty_idx := _history_list.add_item("(No navigation history yet)")
		_history_list.set_item_disabled(empty_idx, true)
		return

	## Show latest visited node first.
	for i in range(_nav_history.size() - 1, -1, -1):
		var node_id: String = _nav_history[i]
		var label: String = _completed_nodes.get(node_id, node_id)
		var idx := _history_list.add_item(label)
		_history_list.set_item_metadata(idx, node_id)


func _on_history_item_activated(index: int) -> void:
	if not _history_list:
		return
	var node_id := _history_list.get_item_metadata(index) as String
	if node_id.is_empty():
		return

	if node_id == "__RETURN_TO_LEARNING__":
		_end_browsing()
		return_pressed.emit()
		if _history_popup:
			_history_popup.hide()
		return

	return_to_node.emit(node_id)
	if _history_popup:
		_history_popup.hide()


func _emit_runtime_config(extra: Dictionary = {}) -> void:
	var config: Dictionary = {
		"mode": _current_mode,
		"strategy": _current_strategy,
		"layout": "orbital"
	}
	if _current_mode == "diffusion":
		_ensure_valid_diffusion_target()
		if not _current_target_id.is_empty():
			config["targetId"] = _current_target_id
	for key in extra.keys():
		config[key] = extra[key]
	settings_updated.emit(config)


## Toggle sidebar visibility
func _on_sidebar_header_pressed() -> void:
	_sidebar_visible = not _sidebar_visible
	
	if completed_list:
		completed_list.visible = _sidebar_visible
	
	_update_sidebar_header()
	sidebar_toggled.emit(_sidebar_visible)


func _update_sidebar_header() -> void:
	if sidebar_header:
		var icon := "[v]" if _sidebar_visible else "[>]"
		sidebar_header.text = "%s Completed Nodes: %d" % [icon, _completed_nodes.size()]


## Handle click on completed node in sidebar
func _on_completed_item_clicked(index: int, _at: Vector2, _mouse_button: int) -> void:
	var node_id := completed_list.get_item_metadata(index) as String
	if node_id.is_empty():
		return
	
	## In edit mode, unmark instead of navigate
	if _edit_mode:
		print("[PathModeUI] Unmark requested:", node_id)
		unmark_requested.emit(node_id)
		return
	
	print("[PathModeUI] Completed node clicked:", node_id)
	completed_node_clicked.emit(node_id)


## === Navigation History ===

## Call before switching to a completed node to save current position
func start_browsing(current_central_id: String) -> void:
	if current_central_id.is_empty():
		return
	if not _is_browsing:
		_learning_position = current_central_id
		_is_browsing = true
		_nav_history.clear()
	if _nav_history.is_empty() or _nav_history[_nav_history.size() - 1] != current_central_id:
		_nav_history.append(current_central_id)
	_update_return_button()
	_refresh_history_popup()


func _update_return_button() -> void:
	if _return_button:
		_return_button.visible = _is_browsing


func _on_return_about_to_popup() -> void:
	var popup := _return_button.get_popup()
	popup.clear()
	
	## Add "Return to learning" as first option
	popup.add_item("↩ Return to learning", 0)
	popup.add_separator()
	
	## Add history items
	for i in range(_nav_history.size()):
		var node_id: String = _nav_history[i]
		var label: String = _completed_nodes.get(node_id, node_id)
		popup.add_item(label, i + 1)


func _on_return_menu_selected(id: int) -> void:
	if id == 0:
		## Return to learning position
		_end_browsing()
		return_pressed.emit()
	else:
		## Return to specific node in history
		var history_idx := id - 1
		if history_idx >= 0 and history_idx < _nav_history.size():
			var node_id: String = _nav_history[history_idx]
			return_to_node.emit(node_id)


## End browsing mode and return to learning
func _end_browsing() -> void:
	_is_browsing = false
	_nav_history.clear()
	_update_return_button()
	_refresh_history_popup()


func get_learning_position() -> String:
	return _learning_position


## === Edit Mode ===

func _on_edit_toggled(pressed: bool) -> void:
	_edit_mode = pressed
	_edit_button.text = "Done" if pressed else "Edit"
	_refresh_completed_list()


func _refresh_completed_list() -> void:
	if not completed_list:
		return
	
	completed_list.clear()
	for node_id in _completed_nodes:
		var label: String = _completed_nodes[node_id]
		var display := "★ %s" % label if not _edit_mode else "✕ %s" % label
		var idx := completed_list.add_item(display)
		completed_list.set_item_metadata(idx, node_id)


## === Tree Panel ===

## Build tree from path nodes
## nodes: Array of {id, label, parentId}
func build_tree(nodes: Array, completed_ids: Array, current_id: String) -> void:
	if _tree_view:
		_tree_view.set_tree_data(nodes, completed_ids, current_id)

## Update tree using pre-calculated layout
func update_tree_layout(layout_data: Dictionary, completed_ids: Array, current_id: String) -> void:
	if _tree_view:
		_tree_view.set_tree_layout(layout_data, completed_ids, current_id)

# Legacy functions removed (_create_tree_item, _on_tree_item_selected)

## === Tree Panel Fullscreen ===

func _on_tree_fullscreen_requested(expand: bool) -> void:
	if expand:
		_expand_tree_panel()
	else:
		_shrink_tree_panel()

func _expand_tree_panel() -> void:
	if _is_tree_fullscreen or not _tree_panel: return
	
	# Save current offsets for restoration
	_tree_panel_default_offsets = {
		"left": _tree_panel.offset_left,
		"top": _tree_panel.offset_top,
		"right": _tree_panel.offset_right,
		"bottom": _tree_panel.offset_bottom
	}
	
	# Expand to near-fullscreen (80% of viewport)
	_tree_panel.anchor_left = 0.1
	_tree_panel.anchor_right = 0.9
	_tree_panel.anchor_top = 0.05
	_tree_panel.anchor_bottom = 0.95
	_tree_panel.offset_left = 0
	_tree_panel.offset_right = 0
	_tree_panel.offset_top = 0
	_tree_panel.offset_bottom = 0
	
	_is_tree_fullscreen = true
	if _tree_view:
		_tree_view.set_fullscreen_mode(true)

func _shrink_tree_panel() -> void:
	if not _is_tree_fullscreen or not _tree_panel: return
	
	# Restore default anchors (left-side panel)
	_tree_panel.anchor_left = 0.0
	_tree_panel.anchor_right = 0.0
	_tree_panel.anchor_top = 0.0
	_tree_panel.anchor_bottom = 1.0
	
	# Restore offsets
	_tree_panel.offset_left = _tree_panel_default_offsets.get("left", 20)
	_tree_panel.offset_top = _tree_panel_default_offsets.get("top", 220)
	_tree_panel.offset_right = _tree_panel_default_offsets.get("right", 250)
	_tree_panel.offset_bottom = _tree_panel_default_offsets.get("bottom", -20)
	
	_is_tree_fullscreen = false
	if _tree_view:
		_tree_view.set_fullscreen_mode(false)


## === Public API ===

## Update available nodes for diffusion target selection.
## nodes: Array of {id, label, parentId}
func set_available_targets(nodes: Array, current_id: String) -> void:
	_current_central_id = current_id
	var combined := {}
	for existing in _target_nodes:
		var ex: Dictionary = existing if existing is Dictionary else {}
		var ex_id: String = ex.get("id", "")
		if ex_id.is_empty():
			continue
		combined[ex_id] = ex.get("label", ex_id)

	for raw in nodes:
		var node: Dictionary = raw if raw is Dictionary else {}
		var id: String = node.get("id", "")
		if id.is_empty():
			continue
		combined[id] = node.get("label", id)

	_target_nodes.clear()
	for id in combined.keys():
		_target_nodes.append({
			"id": id,
			"label": combined[id]
		})

	_target_nodes.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return String(a.get("label", "")).to_lower() < String(b.get("label", "")).to_lower()
	)

	if _current_mode == "diffusion":
		_ensure_valid_diffusion_target()
	_update_target_button_state()
	_populate_target_list(_target_filter_input.text if _target_filter_input else "")


## Update the progress display
func update_progress(completed: int, total: int) -> void:
	if progress_label:
		progress_label.text = "Progress: %d of %d" % [completed, total]


## Update the mode label
func update_mode(mode_name: String) -> void:
	if mode_label:
		mode_label.text = "Path Mode: %s" % mode_name


## Add a completed node to the sidebar
func add_completed_node(node_id: String, label: String) -> void:
	if _completed_nodes.has(node_id):
		return # Already added
	
	_completed_nodes[node_id] = label
	
	if completed_list:
		var display := "★ %s" % label if not _edit_mode else "✕ %s" % label
		var idx := completed_list.add_item(display)
		completed_list.set_item_metadata(idx, node_id)
	
	_update_sidebar_header()


## Remove a completed node from sidebar
func remove_completed_node(node_id: String) -> void:
	if not _completed_nodes.has(node_id):
		return
	
	_completed_nodes.erase(node_id)
	
	## Find and remove from list
	if completed_list:
		for i in range(completed_list.item_count):
			if completed_list.get_item_metadata(i) == node_id:
				completed_list.remove_item(i)
				break
	
	_update_sidebar_header()


## Clear all completed nodes
func clear_completed_nodes() -> void:
	_completed_nodes.clear()
	if completed_list:
		completed_list.clear()
	_update_sidebar_header()


## Get all completed node IDs
func get_completed_ids() -> Array[String]:
	var ids: Array[String] = []
	for id in _completed_nodes.keys():
		ids.append(id)
	return ids
	
## Get auto-reconstruct setting
func get_auto_reconstruct_setting() -> bool:
	if _settings_panel:
		return _settings_panel.get_setting("auto_reconstruct", true)
	return true
