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
signal background_lock_toggled(is_locked: bool)
signal node_reader_requested(node_id: String)

const TREE_VIEW_SCENE = preload("res://scenes/tree_view_panel.tscn")
const SETTINGS_SCENE = preload("res://scenes/settings_panel.tscn")
const NOTEMD_EMBED_PANEL_SCRIPT = preload("res://scripts/notemd_embed_panel.gd")
const READER_RENDER_CLIENT_SCRIPT = preload("res://scripts/reader_render_client.gd")
const READER_IMAGE_CANVAS_SCRIPT = preload("res://scripts/reader_image_canvas.gd")
const SETTINGS_ICON := "⚙"
const BG_UNLOCKED_ICON := "🔓"
const BG_LOCKED_ICON := "🔒"
const READER_DISPLAY_MATH_PREVIEW_MAX_SIZE := Vector2(560.0, 180.0)
const READER_DISPLAY_MERMAID_PREVIEW_MAX_SIZE := Vector2(620.0, 420.0)
const READER_DISPLAY_MATH_PREVIEW_MIN_SIZE := Vector2(320.0, 72.0)
const READER_DISPLAY_MERMAID_PREVIEW_MIN_SIZE := Vector2(420.0, 220.0)
const READER_MEDIA_PAGE_MARGIN := 72.0
const READER_MEDIA_PAGE_MIN_WIDTH := 120.0
const READER_MEDIA_PAGE_MAX_WIDTH := 760.0
const READER_MEDIA_PAGE_MIN_HEIGHT := 96.0
const READER_MEDIA_PAGE_MAX_HEIGHT := 620.0
const READER_MEDIA_PAGE_FIT_RATIO := 0.92
const READER_MEDIA_DEFAULT_PREVIEW_MAX_SIZE := Vector2(560.0, 460.0)
const READER_DISPLAY_MATH_RENDER_SCALE := 2.4
const READER_INLINE_MATH_RENDER_SCALE := 2.1
const READER_INLINE_MATH_MAX_HEIGHT_MULTIPLIER := 1.08
const READER_DISPLAY_INLINE_MATH_MAX_HEIGHT_MULTIPLIER := 1.26
const READER_INLINE_MATH_MAX_WIDTH_MULTIPLIER := 5.6
const READER_DISPLAY_INLINE_MATH_MAX_WIDTH := 240.0
const READER_IMAGE_FRAME_MIN_SIZE := Vector2(360.0, 260.0)
const READER_IMAGE_VIEWER_BACKGROUND := Color(0.012, 0.014, 0.018, 1.0)
const READER_MEDIA_SCALE_MIN := 0.10
const READER_MEDIA_SCALE_MAX := 3.00
const READER_MEDIA_SCALE_STEP := 0.01
const READER_MEDIA_SCALE_DEFAULT := 1.50
const DEFAULT_READER_TOGGLE_SHORTCUT := "Ctrl+M"
const UI_TEXTS := {
	"en": {
		"close_confirm_title": "Confirm Close Action",
		"close_confirm_text": "Select what to do:\n\n- Return to Main Interface\n- Close All Windows",
		"close_all_windows": "Close All Windows",
		"return_to_main": "Return to Main Interface",
		"mode_domain": "Domain",
		"mode_diffusion": "Diffusion",
		"strategy_foundational": "Foundational",
		"strategy_core": "Core",
		"history": "History",
		"exit": "Exit",
		"target_auto": "Target: Auto",
		"select_diffusion_targets": "Select Diffusion Targets",
		"search_node": "Search node...",
		"close": "Close",
		"navigation_history": "Navigation History",
		"clear": "Clear",
		"learning_path": "Learning Path",
		"collapse_panel": "Collapse Panel",
		"progress_template": "Progress: %d of %d",
		"path_mode_template": "Path Mode: %s",
		"targets_selected": "Targets: %d Selected",
		"targets_none": "Targets: None",
		"select_domain_targets": "Select Domain Targets",
		"target_label": "Target: %s",
		"current_diffusion_target": "Current Diffusion target: %s",
		"current_diffusion_targets": "Current Diffusion targets: %s",
		"target_select_fallback": "Select",
		"complete": "Complete",
		"cancel_completion": "Cancel Completion"
	},
	"zh": {
		"close_confirm_title": "确认关闭操作",
		"close_confirm_text": "请选择要执行的操作：\n\n- 返回主界面\n- 关闭全部窗口",
		"close_all_windows": "关闭全部窗口",
		"return_to_main": "返回主界面",
		"mode_domain": "领域",
		"mode_diffusion": "扩散",
		"strategy_foundational": "基础",
		"strategy_core": "核心",
		"history": "历史",
		"exit": "退出",
		"target_auto": "目标：自动",
		"select_diffusion_targets": "选择扩散目标",
		"search_node": "搜索节点...",
		"close": "关闭",
		"navigation_history": "导航历史",
		"clear": "清空",
		"learning_path": "学习路径",
		"collapse_panel": "折叠面板",
		"progress_template": "进度：%d / %d",
		"path_mode_template": "路径模式：%s",
		"targets_selected": "目标：已选择 %d 项",
		"targets_none": "目标：无",
		"select_domain_targets": "选择领域目标",
		"target_label": "目标：%s",
		"current_diffusion_target": "当前扩散目标：%s",
		"current_diffusion_targets": "当前扩散目标：%s",
		"target_select_fallback": "选择",
		"complete": "完成",
		"cancel_completion": "取消完成"
	}
}

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
var _notemd_button: Button = null
var _exit_button: Button = null
var _history_popup: PopupPanel = null
var _history_list: ItemList = null
var _target_popup: PopupPanel = null
var _target_filter_input: LineEdit = null
var _target_list: ItemList = null
var _bg_lock_button: Button = null
var _reader_overlay: ColorRect = null
var _reader_panel: PanelContainer = null
var _reader_panel_style: StyleBoxFlat = null
var _reader_title_label: Label = null
var _reader_meta_label: Label = null
var _reader_mode_badge: Label = null
var _reader_lock_button: Button = null
var _reader_zoom_out_button: Button = null
var _reader_zoom_in_button: Button = null
var _reader_zoom_label: Label = null
var _reader_view_mode_button: Button = null
var _reader_media_scale_slider: HSlider = null
var _reader_media_scale_value_label: Label = null
var _reader_status_label: Label = null
var _reader_media_debug_panel: PanelContainer = null
var _reader_media_debug_label: Label = null
var _reader_media_debug_entries: Array[String] = []
var _reader_media_debug_block_counter: int = 0
var _reader_media_layout_dirty: bool = false
var _reader_toast_panel: PanelContainer = null
var _reader_toast_label: Label = null
var _reader_toast_tween: Tween = null
var _reader_scroll: ScrollContainer = null
var _reader_blocks: VBoxContainer = null
var _reader_current_node: Dictionary = {}
var _reader_current_zoom: float = 1.0
var _reader_is_locked: bool = true
var _reader_image_overlay: ColorRect = null
var _reader_image_frame: Panel = null
var _reader_image_viewport: Control = null
var _reader_image_surface: Control = null
var _reader_image_canvas: Node2D = null
var _reader_image_content_rect: Rect2 = Rect2()
var _reader_image_resize_handle: ColorRect = null
var _reader_image_title_label: Label = null
var _reader_image_zoom_label: Label = null
var _reader_image_current_texture: Texture2D = null
var _reader_image_zoom: float = 1.0
var _reader_image_pan: Vector2 = Vector2.ZERO
var _reader_image_dragging: bool = false
var _reader_image_drag_origin: Vector2 = Vector2.ZERO
var _reader_image_pan_origin: Vector2 = Vector2.ZERO
var _reader_image_base_size: Vector2 = Vector2.ZERO
var _reader_image_drawn_size: Vector2 = Vector2.ZERO
var _reader_image_frame_size: Vector2 = Vector2.ZERO
var _reader_image_frame_resizing: bool = false
var _reader_image_frame_resize_origin: Vector2 = Vector2.ZERO
var _reader_image_frame_size_origin: Vector2 = Vector2.ZERO
var _reader_image_touch_points: Dictionary = {}
var _reader_image_last_pinch_distance: float = 0.0
var _reader_image_last_pinch_center: Vector2 = Vector2.ZERO
var _reader_image_debug_capture_id: int = 0
var _reader_debug_mermaid_export_counter: int = 0
var _reader_render_client = null
var _reader_render_revision: int = 0
var _reader_renderable_blocks: Array[Dictionary] = []
var _ui_language: String = "en"
var _target_popup_title_label: Label = null
var _history_popup_title_label: Label = null
var _target_popup_close_button: Button = null
var _history_popup_clear_button: Button = null
var _history_popup_close_button: Button = null
var _tree_header_label: Label = null
var _tree_collapse_button: Button = null

var _current_mode: String = "diffusion"
var _current_strategy: String = "foundational"
var _current_target_id: String = ""
var _current_diffusion_target_ids: Array[String] = []
var _current_domain_target_ids: Array[String] = []
var _current_target_label: String = ""
var _current_central_id: String = ""
var _target_nodes: Array[Dictionary] = []
var _ws_client: Node = null
var _close_confirm_dialog: ConfirmationDialog = null
var _notemd_embed_panel: PopupPanel = null
var _close_request_handled_by_signal: bool = false

## Tree panel fullscreen state
var _is_tree_fullscreen: bool = false
var _tree_panel_default_offsets: Dictionary = {} # Stores anchor + offset layout

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if is_image_viewer_open():
			close_image_viewer()
			get_viewport().set_input_as_handled()
			return
		if is_reader_open():
			close_reader()
			get_viewport().set_input_as_handled()
			return

	if _handle_reader_unhandled_input(event):
		get_viewport().set_input_as_handled()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if _close_request_handled_by_signal:
			return
		_handle_window_close_request()


func _ready() -> void:
	## Prevent OS close requests from auto-quitting before custom confirmation dialog runs.
	## 防止系统关闭请求在确认弹窗前自动退出。
	if get_tree():
		get_tree().auto_accept_quit = false
	var main_window := get_window()
	if main_window and not main_window.close_requested.is_connected(_on_window_close_requested):
		main_window.close_requested.connect(_on_window_close_requested)

	_ws_client = get_node_or_null("../WsClient")
	_setup_close_confirmation_dialog()
	_setup_notemd_embed_panel()
	_create_dynamic_ui()
	_connect_signals()
	set_ui_language(_resolve_startup_ui_language())
	_setup_initial_state()


func _handle_window_close_request() -> void:
	if _should_confirm_shutdown_from_close():
		_show_close_project_confirmation()
	else:
		get_tree().quit()


func _on_window_close_requested() -> void:
	_close_request_handled_by_signal = true
	_handle_window_close_request()
	call_deferred("_clear_close_request_signal_guard")


func _clear_close_request_signal_guard() -> void:
	_close_request_handled_by_signal = false


func _read_env_bool(env_name: String) -> int:
	var raw_value := OS.get_environment(env_name).strip_edges().to_lower()
	if raw_value.is_empty():
		return -1
	if raw_value == "1" or raw_value == "true" or raw_value == "yes" or raw_value == "on":
		return 1
	if raw_value == "0" or raw_value == "false" or raw_value == "no" or raw_value == "off":
		return 0
	return -1


func _resolve_startup_ui_language() -> String:
	var env_language := OS.get_environment("NOTE_CONNECTION_UI_LANGUAGE").strip_edges().to_lower()
	if env_language.begins_with("zh"):
		return "zh"
	return "en"


func _resolve_ui_text(key: String, fallback: String = "") -> String:
	var bundle: Dictionary = UI_TEXTS.get(_ui_language, UI_TEXTS.get("en", {}))
	var value = bundle.get(key, null)
	if value == null and _ui_language != "en":
		var default_bundle: Dictionary = UI_TEXTS.get("en", {})
		value = default_bundle.get(key, null)
	if value == null:
		return fallback
	return String(value)


func _apply_ui_language() -> void:
	if _close_confirm_dialog:
		_close_confirm_dialog.title = _resolve_ui_text("close_confirm_title", _close_confirm_dialog.title)
		_close_confirm_dialog.dialog_text = _resolve_ui_text("close_confirm_text", _close_confirm_dialog.dialog_text)
		var ok_button := _close_confirm_dialog.get_ok_button()
		if ok_button:
			ok_button.text = _resolve_ui_text("close_all_windows", ok_button.text)
		var cancel_button := _close_confirm_dialog.get_cancel_button()
		if cancel_button:
			cancel_button.text = _resolve_ui_text("return_to_main", cancel_button.text)

	if _mode_option and _mode_option.item_count >= 2:
		_mode_option.set_item_text(0, _resolve_ui_text("mode_domain", _mode_option.get_item_text(0)))
		_mode_option.set_item_text(1, _resolve_ui_text("mode_diffusion", _mode_option.get_item_text(1)))

	if _strategy_option and _strategy_option.item_count >= 2:
		_strategy_option.set_item_text(0, _resolve_ui_text("strategy_foundational", _strategy_option.get_item_text(0)))
		_strategy_option.set_item_text(1, _resolve_ui_text("strategy_core", _strategy_option.get_item_text(1)))

	if _history_button:
		_history_button.text = _resolve_ui_text("history", _history_button.text)
	if _exit_button:
		_exit_button.text = _resolve_ui_text("exit", _exit_button.text)

	if _target_popup_title_label:
		_target_popup_title_label.text = _resolve_ui_text("select_diffusion_targets", _target_popup_title_label.text)
	if _target_filter_input:
		_target_filter_input.placeholder_text = _resolve_ui_text("search_node", _target_filter_input.placeholder_text)
	if _target_popup_close_button:
		_target_popup_close_button.text = _resolve_ui_text("close", _target_popup_close_button.text)
	if _history_popup_title_label:
		_history_popup_title_label.text = _resolve_ui_text("navigation_history", _history_popup_title_label.text)
	if _history_popup_clear_button:
		_history_popup_clear_button.text = _resolve_ui_text("clear", _history_popup_clear_button.text)
	if _history_popup_close_button:
		_history_popup_close_button.text = _resolve_ui_text("close", _history_popup_close_button.text)
	if _tree_header_label:
		_tree_header_label.text = _resolve_ui_text("learning_path", _tree_header_label.text)
	if _tree_collapse_button:
		_tree_collapse_button.tooltip_text = _resolve_ui_text("collapse_panel", _tree_collapse_button.tooltip_text)

	if _target_button:
		_target_button.text = _resolve_ui_text("target_auto", _target_button.text)
	if mark_complete_btn:
		var current_complete_text := mark_complete_btn.text
		var en_cancel := String(UI_TEXTS.get("en", {}).get("cancel_completion", "Cancel Completion"))
		var zh_cancel := String(UI_TEXTS.get("zh", {}).get("cancel_completion", "取消完成"))
		if current_complete_text == en_cancel or current_complete_text == zh_cancel:
			mark_complete_btn.text = _resolve_ui_text("cancel_completion", current_complete_text)
		else:
			mark_complete_btn.text = _resolve_ui_text("complete", current_complete_text)

	_update_target_button_state()


func set_ui_language(language: String) -> void:
	var normalized := "en"
	if String(language).strip_edges().to_lower().begins_with("zh"):
		normalized = "zh"
	_ui_language = normalized
	_apply_ui_language()


func _is_single_window_mode() -> bool:
	var explicit_mode := _read_env_bool("NOTE_CONNECTION_SINGLE_WINDOW_MODE")
	if explicit_mode == 1:
		return true
	if explicit_mode == 0:
		return false

	var env_hidden := OS.get_environment("NOTE_CONNECTION_START_HIDDEN").strip_edges()
	if env_hidden == "1" or env_hidden.to_lower() == "true":
		return true

	var host_port := OS.get_environment("NOTE_CONNECTION_PORT").strip_edges()
	var host_bridge_port := OS.get_environment("NOTE_CONNECTION_BRIDGE_PORT").strip_edges()
	var force_visible := OS.get_environment("NOTE_CONNECTION_FORCE_VISIBLE").strip_edges().to_lower()
	if (not host_port.is_empty() or not host_bridge_port.is_empty()) and force_visible != "1" and force_visible != "true":
		return true

	var args := OS.get_cmdline_args()
	return "--nc-start-hidden" in args or "--minimized" in args


func _should_confirm_shutdown_from_close() -> bool:
	var explicit_confirm := _read_env_bool("NOTE_CONNECTION_CONFIRM_CLOSE_FROM_GODOT")
	if explicit_confirm == 1:
		return true
	if explicit_confirm == 0:
		return false
	return _is_single_window_mode()


func _setup_close_confirmation_dialog() -> void:
	if _close_confirm_dialog:
		return

	_close_confirm_dialog = ConfirmationDialog.new()
	_close_confirm_dialog.name = "CloseProjectConfirmationDialog"
	_close_confirm_dialog.title = _resolve_ui_text("close_confirm_title", "Confirm Close Action")
	_close_confirm_dialog.dialog_text = _resolve_ui_text("close_confirm_text", "Select what to do:\n\n- Return to Main Interface\n- Close All Windows")
	_close_confirm_dialog.min_size = Vector2i(520, 180)
	_close_confirm_dialog.exclusive = true
	_close_confirm_dialog.confirmed.connect(_on_close_project_confirmed)
	_close_confirm_dialog.canceled.connect(_on_close_project_return_to_main)
	add_child(_close_confirm_dialog)

	var ok_button := _close_confirm_dialog.get_ok_button()
	if ok_button:
		ok_button.text = _resolve_ui_text("close_all_windows", "Close All Windows")
	var cancel_button := _close_confirm_dialog.get_cancel_button()
	if cancel_button:
		cancel_button.text = _resolve_ui_text("return_to_main", "Return to Main Interface")


func _setup_notemd_embed_panel() -> void:
	if _notemd_embed_panel or NOTEMD_EMBED_PANEL_SCRIPT == null:
		return

	var panel_instance = NOTEMD_EMBED_PANEL_SCRIPT.new()
	if panel_instance == null:
		push_warning("[PathModeUI] Failed to instantiate embedded NoteMD panel.")
		return

	_notemd_embed_panel = panel_instance as PopupPanel
	if _notemd_embed_panel == null:
		push_warning("[PathModeUI] Embedded NoteMD panel is not a PopupPanel.")
		return

	_notemd_embed_panel.name = "EmbeddedNoteMDPanel"
	add_child(_notemd_embed_panel)

	if _notemd_embed_panel.has_signal("open_full_workspace_requested"):
		_notemd_embed_panel.open_full_workspace_requested.connect(_on_notemd_open_full_workspace_requested)


func _show_close_project_confirmation() -> void:
	if not _close_confirm_dialog:
		_setup_close_confirmation_dialog()
	if not _close_confirm_dialog:
		return

	if _close_confirm_dialog.visible:
		return

	_close_confirm_dialog.popup_centered()


func _on_close_project_confirmed() -> void:
	print("[PathModeUI] User confirmed full project shutdown from Godot close button.")

	var shutdown_requested := false
	if _ws_client and _ws_client.has_method("send_request_app_shutdown"):
		_ws_client.send_request_app_shutdown()
		shutdown_requested = true
	elif _ws_client and _ws_client.has_method("send_message"):
		_ws_client.send_message({
			"type": "requestAppShutdown",
			"payload": {
				"source": "godot_close_request"
			}
		})
		shutdown_requested = true

	if not shutdown_requested:
		push_warning("[PathModeUI] Unable to reach WsClient for full shutdown request. Quitting Godot as fallback.")
		get_tree().quit()
		return

	## Fallback guard: if host app does not exit in time, quit Godot process
	## to avoid leaving a zombie fullscreen window.
	## 兜底策略：若宿主应用未及时退出，则关闭 Godot 进程，避免残留窗口。
	var force_quit_timer := get_tree().create_timer(1.0)
	force_quit_timer.timeout.connect(func():
		get_tree().quit()
	)


func _on_close_project_return_to_main() -> void:
	print("[PathModeUI] User chose to return to the main interface from Godot close prompt.")
	_on_exit_pressed()


func _ensure_reader_render_client() -> void:
	if _reader_render_client == null:
		_reader_render_client = READER_RENDER_CLIENT_SCRIPT.new()
		_reader_render_client.name = "ReaderRenderClient"
		add_child(_reader_render_client)


func _create_dynamic_ui() -> void:
	## Create Return button (hidden by default)
	_return_button = MenuButton.new()
	_return_button.text = "<- Return"
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
		_mode_option.add_item(_resolve_ui_text("mode_domain", "Domain"), 0)
		_mode_option.add_item(_resolve_ui_text("mode_diffusion", "Diffusion"), 1)
		_mode_option.select(1)
		control_row.add_child(_mode_option)
		_apply_option_style(_mode_option)
		
		var strategy_title := Label.new()
		strategy_title.text = "Strategy"
		control_row.add_child(strategy_title)
		
		_strategy_option = OptionButton.new()
		_strategy_option.custom_minimum_size = Vector2(130, 34)
		_strategy_option.add_item(_resolve_ui_text("strategy_foundational", "Foundational"), 0)
		_strategy_option.add_item(_resolve_ui_text("strategy_core", "Core"), 1)
		control_row.add_child(_strategy_option)
		_apply_option_style(_strategy_option)

		_target_button = Button.new()
		_target_button.text = _resolve_ui_text("target_auto", "Target: Auto")
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
		_history_button.text = _resolve_ui_text("history", "History")
		_history_button.custom_minimum_size = Vector2(88, 34)
		control_row.add_child(_history_button)

		_notemd_button = Button.new()
		_notemd_button.text = "NoteMD"
		_notemd_button.custom_minimum_size = Vector2(90, 34)
		control_row.add_child(_notemd_button)
		
		_exit_button = Button.new()
		_exit_button.text = _resolve_ui_text("exit", "Exit")
		_exit_button.custom_minimum_size = Vector2(72, 34)
		control_row.add_child(_exit_button)
		
		# Background lock button
		_bg_lock_button = Button.new()
		_bg_lock_button.text = BG_UNLOCKED_ICON
		_bg_lock_button.tooltip_text = "Lock Background (camera won't rotate sky)"
		_bg_lock_button.toggle_mode = true
		_bg_lock_button.custom_minimum_size = Vector2(44, 34)
		control_row.add_child(_bg_lock_button)

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
		# Convert sidebar to use DraggablePanel
		sidebar.set_script(preload("res://scripts/draggable_panel.gd"))
		sidebar.set("min_size", Vector2(220, 180))
		sidebar.set("resize_margin", 14)
		sidebar.set("dynamic_resize_margin_max", 28)
		
		var sidebar_header_shell := MarginContainer.new()
		sidebar_header_shell.name = "SidebarHeaderShell"
		sidebar_header_shell.add_theme_constant_override("margin_left", 14)
		sidebar_header_shell.add_theme_constant_override("margin_top", 12)
		sidebar_header_shell.add_theme_constant_override("margin_right", 14)
		sidebar_header_shell.add_theme_constant_override("margin_bottom", 6)
		sidebar.add_child(sidebar_header_shell)
		sidebar.move_child(sidebar_header_shell, 0) # Before HeaderButton
		
		var sidebar_header_row := HBoxContainer.new()
		sidebar_header_row.name = "SidebarHeaderRow"
		sidebar_header_row.mouse_filter = Control.MOUSE_FILTER_PASS
		sidebar_header_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sidebar_header_row.add_theme_constant_override("separation", 8)
		sidebar_header_shell.add_child(sidebar_header_row)
		
		var sidebar_drag_grip := _create_panel_drag_grip("Move completed panel")
		sidebar_header_row.add_child(sidebar_drag_grip)
		
		# Move existing HeaderButton into the new row
		if sidebar_header:
			var header_parent := sidebar_header.get_parent()
			if header_parent:
				header_parent.remove_child(sidebar_header)
			sidebar_header_row.add_child(sidebar_header)
			sidebar_header.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		
		# Add collapse button to the sidebar
		var sidebar_collapse_btn := Button.new()
		sidebar_collapse_btn.text = "✖"
		sidebar_collapse_btn.tooltip_text = "Collapse Panel"
		sidebar_collapse_btn.focus_mode = Control.FOCUS_NONE
		sidebar_collapse_btn.custom_minimum_size = Vector2(28, 28)
		_apply_button_style(sidebar_collapse_btn, Color(0.1, 0.13, 0.18, 0.0), Color(0.17, 0.22, 0.3, 0.5), Color(0.07, 0.1, 0.14, 0.8), Color(0.45, 0.6, 0.82, 0.95), Color(0.9, 0.96, 1.0, 1.0))
		sidebar_collapse_btn.pressed.connect(func():
			if sidebar.has_method("collapse"):
				sidebar.call("collapse", "☰", HORIZONTAL_ALIGNMENT_RIGHT)
		)
		sidebar_header_row.add_child(sidebar_collapse_btn)
		
		# Keep sidebar resizing away from actionable header controls.
		if sidebar.has_method("setup_drag_handle"):
			sidebar.call("setup_drag_handle", sidebar_drag_grip)
		else:
			push_warning("[PathModeUI] GoldStarSidebar is missing DraggablePanel behavior; drag support disabled.")
		if sidebar.has_method("register_interaction_exclusion"):
			sidebar.call("register_interaction_exclusion", sidebar_header)
			sidebar.call("register_interaction_exclusion", sidebar_collapse_btn)
		if sidebar.has_signal("collapsed_state_changed"):
			sidebar.collapsed_state_changed.connect(func(is_collapsed: bool):
				_sidebar_visible = not is_collapsed
				sidebar_toggled.emit(_sidebar_visible)
				_update_sidebar_header()
			)
		
		var edit_row := HBoxContainer.new()
		edit_row.name = "EditRow"
		sidebar.add_child(edit_row)
		sidebar.move_child(edit_row, 1) # After SidebarHeaderRow
		edit_row.add_child(_edit_button)
		_edit_button.size_flags_horizontal = Control.SIZE_SHRINK_END
		
		_apply_button_style(_edit_button, Color(0.2, 0.24, 0.3, 1.0), Color(0.27, 0.31, 0.4, 1.0), Color(0.14, 0.18, 0.24, 1.0), Color(0.42, 0.46, 0.58, 1.0), Color(0.92, 0.95, 1.0, 1.0))
		
	## Create Settings button as an independent floating control in the top-right corner.
	_settings_button = Button.new()
	_settings_button.text = SETTINGS_ICON
	_settings_button.tooltip_text = "Settings"
	_settings_button.custom_minimum_size = Vector2(44, 44)
	_settings_button.anchor_left = 1.0
	_settings_button.anchor_right = 1.0
	_settings_button.anchor_top = 0.0
	_settings_button.anchor_bottom = 0.0
	_settings_button.offset_left = -60
	_settings_button.offset_top = 58 # Below the top control row
	_settings_button.offset_right = -16
	_settings_button.offset_bottom = 102
	add_child(_settings_button)
	_apply_button_style(_settings_button, Color(0.12, 0.15, 0.2, 0.88), Color(0.18, 0.24, 0.32, 0.95), Color(0.08, 0.1, 0.14, 0.95), Color(0.4, 0.5, 0.7, 0.9), Color(0.92, 0.96, 1.0, 1.0))
		
	## Create Settings Panel
	if SETTINGS_SCENE:
		var settings_instance = SETTINGS_SCENE.instantiate()
		if settings_instance:
			_settings_panel = settings_instance
			add_child(_settings_panel)
		else:
			push_error("[PathModeUI] Failed to instantiate SettingsPanel scene.")
	if _settings_button and _settings_panel == null:
		_settings_button.disabled = true
		_settings_button.tooltip_text = "Settings unavailable"

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

	_target_popup_title_label = Label.new()
	_target_popup_title_label.text = _resolve_ui_text("select_diffusion_targets", "Select Diffusion Targets")
	_target_popup_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_target_popup_title_label.add_theme_font_size_override("font_size", 18)
	target_vbox.add_child(_target_popup_title_label)

	_target_filter_input = LineEdit.new()
	_target_filter_input.placeholder_text = _resolve_ui_text("search_node", "Search node...")
	target_vbox.add_child(_target_filter_input)

	_target_list = ItemList.new()
	_target_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_target_list.select_mode = ItemList.SELECT_SINGLE
	target_vbox.add_child(_target_list)

	var target_actions := HBoxContainer.new()
	target_vbox.add_child(target_actions)

	_target_popup_close_button = Button.new()
	_target_popup_close_button.text = _resolve_ui_text("close", "Close")
	_target_popup_close_button.custom_minimum_size = Vector2(88, 34)
	target_actions.add_child(_target_popup_close_button)
	_apply_button_style(_target_popup_close_button, Color(0.23, 0.26, 0.3, 1.0), Color(0.29, 0.33, 0.38, 1.0), Color(0.18, 0.21, 0.25, 1.0), Color(0.42, 0.47, 0.55, 1.0), Color(0.95, 0.97, 1.0, 1.0))
	_target_popup_close_button.pressed.connect(func():
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

	_history_popup_title_label = Label.new()
	_history_popup_title_label.text = _resolve_ui_text("navigation_history", "Navigation History")
	_history_popup_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_history_popup_title_label.add_theme_font_size_override("font_size", 18)
	history_vbox.add_child(_history_popup_title_label)

	_history_list = ItemList.new()
	_history_list.select_mode = ItemList.SELECT_SINGLE
	_history_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	history_vbox.add_child(_history_list)

	var history_actions := HBoxContainer.new()
	history_vbox.add_child(history_actions)

	_history_popup_clear_button = Button.new()
	_history_popup_clear_button.text = _resolve_ui_text("clear", "Clear")
	_history_popup_clear_button.custom_minimum_size = Vector2(88, 34)
	history_actions.add_child(_history_popup_clear_button)
	_apply_button_style(_history_popup_clear_button, Color(0.23, 0.26, 0.3, 1.0), Color(0.29, 0.33, 0.38, 1.0), Color(0.18, 0.21, 0.25, 1.0), Color(0.42, 0.47, 0.55, 1.0), Color(0.95, 0.97, 1.0, 1.0))
	_history_popup_clear_button.pressed.connect(func():
		_end_browsing()
		_refresh_history_popup()
	)

	var history_spacer := Control.new()
	history_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	history_actions.add_child(history_spacer)

	_history_popup_close_button = Button.new()
	_history_popup_close_button.text = _resolve_ui_text("close", "Close")
	_history_popup_close_button.custom_minimum_size = Vector2(88, 34)
	history_actions.add_child(_history_popup_close_button)
	_apply_button_style(_history_popup_close_button, Color(0.23, 0.26, 0.3, 1.0), Color(0.29, 0.33, 0.38, 1.0), Color(0.18, 0.21, 0.25, 1.0), Color(0.42, 0.47, 0.55, 1.0), Color(0.95, 0.97, 1.0, 1.0))
	_history_popup_close_button.pressed.connect(func():
		if _history_popup:
			_history_popup.hide()
	)
	
	## Create Tree Panel (left sidebar) with proper sizing
	_tree_panel = VBoxContainer.new()
	_tree_panel.name = "TreePanel"
	_tree_panel.set_script(preload("res://scripts/draggable_panel.gd"))
	_tree_panel.set("min_size", Vector2(260, 220))
	_tree_panel.set("resize_margin", 18)
	_tree_panel.set("dynamic_resize_margin_max", 40)
	
	## Use anchors for left side positioning
	_tree_panel.anchor_left = 0.0
	_tree_panel.anchor_top = 0.0
	_tree_panel.anchor_right = 0.0
	_tree_panel.anchor_bottom = 0.0
	_tree_panel.offset_left = 20
	_tree_panel.offset_top = 220 # Keep clear from top control row
	_tree_panel.offset_right = 250 # 230px wide
	_tree_panel.offset_bottom = get_viewport().size.y - 20
	_tree_panel.custom_minimum_size = Vector2(200, 200)
	_tree_panel.z_index = -1
	add_child(_tree_panel)
	
	var tree_header_shell := MarginContainer.new()
	tree_header_shell.name = "TreeHeaderShell"
	tree_header_shell.add_theme_constant_override("margin_left", 18)
	tree_header_shell.add_theme_constant_override("margin_top", 14)
	tree_header_shell.add_theme_constant_override("margin_right", 18)
	tree_header_shell.add_theme_constant_override("margin_bottom", 8)
	_tree_panel.add_child(tree_header_shell)
	
	var header_hbox := HBoxContainer.new()
	header_hbox.mouse_filter = Control.MOUSE_FILTER_PASS
	header_hbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_hbox.add_theme_constant_override("separation", 10)
	tree_header_shell.add_child(header_hbox)
	
	header_hbox.mouse_filter = Control.MOUSE_FILTER_STOP
	if _tree_panel.has_method("setup_drag_handle"):
		_tree_panel.call("setup_drag_handle", header_hbox)
	else:
		push_warning("[PathModeUI] TreePanel is missing DraggablePanel behavior; drag support disabled.")
	
	_tree_header_label = Label.new()
	_tree_header_label.text = _resolve_ui_text("learning_path", "Learning Path")
	_tree_header_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tree_header_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_tree_header_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header_hbox.add_child(_tree_header_label)

	_tree_collapse_button = Button.new()
	_tree_collapse_button.text = "✖"
	_tree_collapse_button.tooltip_text = _resolve_ui_text("collapse_panel", "Collapse Panel")
	_tree_collapse_button.focus_mode = Control.FOCUS_NONE
	_tree_collapse_button.custom_minimum_size = Vector2(28, 28)
	_apply_button_style(_tree_collapse_button, Color(0.1, 0.13, 0.18, 0.0), Color(0.17, 0.22, 0.3, 0.5), Color(0.07, 0.1, 0.14, 0.8), Color(0.45, 0.6, 0.82, 0.95), Color(0.9, 0.96, 1.0, 1.0))
	_tree_collapse_button.pressed.connect(func():
		if _tree_panel and _tree_panel.has_method("collapse"):
			_tree_panel.call("collapse", "☰", HORIZONTAL_ALIGNMENT_LEFT)
	)
	header_hbox.add_child(_tree_collapse_button)
	if _tree_panel.has_method("register_interaction_exclusion"):
		_tree_panel.call("register_interaction_exclusion", _tree_collapse_button)
	
	## Instantiate new Tree View Panel
	if TREE_VIEW_SCENE:
		var tree_view_instance = TREE_VIEW_SCENE.instantiate()
		if tree_view_instance is Control:
			_tree_view = tree_view_instance
			_tree_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
			_tree_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_tree_panel.add_child(_tree_view)
			if _tree_panel.has_method("register_interaction_exclusion"):
				for node_path in [
					NodePath("VBoxContainer/Header/ExpandButton"),
					NodePath("VBoxContainer/Header/ShrinkButton"),
					NodePath("VBoxContainer/Header/StyleOption")
				]:
					var header_control := _tree_view.get_node_or_null(node_path) as Control
					if header_control:
						_tree_panel.call("register_interaction_exclusion", header_control)
		else:
			push_error("[PathModeUI] Failed to instantiate TreeViewPanel scene.")
			_tree_panel.add_child(_create_panel_unavailable_notice("Learning path panel is unavailable. Check tree_view_panel.tscn and its scripts."))
	
	_create_reader_overlay()
	
	if _history_button:
		_apply_button_style(_history_button, Color(0.15, 0.21, 0.3, 1.0), Color(0.21, 0.29, 0.4, 1.0), Color(0.11, 0.17, 0.24, 1.0), Color(0.33, 0.47, 0.63, 1.0), Color(0.9, 0.96, 1.0, 1.0))
	if _notemd_button:
		_apply_button_style(_notemd_button, Color(0.11, 0.27, 0.24, 1.0), Color(0.15, 0.34, 0.29, 1.0), Color(0.08, 0.2, 0.17, 1.0), Color(0.22, 0.56, 0.48, 1.0), Color(0.92, 1.0, 0.98, 1.0))
	if _exit_button:
		_apply_button_style(_exit_button, Color(0.26, 0.19, 0.21, 1.0), Color(0.34, 0.23, 0.26, 1.0), Color(0.2, 0.14, 0.16, 1.0), Color(0.62, 0.3, 0.34, 1.0), Color(1.0, 0.92, 0.92, 1.0))

	if mode_label:
		mode_label.add_theme_color_override("font_color", Color(0.82, 0.92, 1.0, 1.0))
	if progress_label:
		progress_label.add_theme_color_override("font_color", Color(0.9, 0.95, 1.0, 1.0))
		progress_label.add_theme_font_size_override("font_size", 16)


func _create_panel_drag_grip(tooltip_text: String) -> Button:
	var grip := Button.new()
	grip.text = "Move"
	grip.tooltip_text = tooltip_text
	grip.focus_mode = Control.FOCUS_NONE
	grip.custom_minimum_size = Vector2(62, 28)
	grip.add_theme_font_size_override("font_size", 12)
	_apply_button_style(grip, Color(0.1, 0.13, 0.18, 0.92), Color(0.17, 0.22, 0.3, 0.98), Color(0.07, 0.1, 0.14, 0.98), Color(0.45, 0.6, 0.82, 0.95), Color(0.9, 0.96, 1.0, 1.0))
	return grip


func _create_panel_unavailable_notice(message: String) -> Control:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.09, 0.12, 0.18, 0.98)
	style.border_color = Color(0.42, 0.55, 0.78, 0.96)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	panel.add_theme_stylebox_override("panel", style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)
	var label := Label.new()
	label.text = message
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_color_override("font_color", Color(0.88, 0.93, 1.0, 0.98))
	label.add_theme_font_size_override("font_size", 14)
	margin.add_child(label)
	return panel


func _create_reader_overlay() -> void:
	if _reader_overlay:
		return

	_reader_overlay = ColorRect.new()
	_reader_overlay.name = "ReaderOverlay"
	_reader_overlay.anchor_right = 1.0
	_reader_overlay.anchor_bottom = 1.0
	_reader_overlay.color = Color(0.02, 0.03, 0.05, 0.82)
	_reader_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	_reader_overlay.visible = false
	add_child(_reader_overlay)

	_reader_panel = PanelContainer.new()
	_reader_panel.name = "ReaderPanel"
	_reader_panel.anchor_left = 0.12
	_reader_panel.anchor_top = 0.08
	_reader_panel.anchor_right = 0.88
	_reader_panel.anchor_bottom = 0.92
	_reader_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	_reader_panel.resized.connect(_on_reader_container_resized)
	_reader_overlay.add_child(_reader_panel)

	_reader_panel_style = StyleBoxFlat.new()
	_reader_panel_style.bg_color = Color(0.06, 0.08, 0.12, 0.98)
	_reader_panel_style.border_color = Color(0.36, 0.48, 0.68, 0.94)
	_reader_panel_style.border_width_left = 2
	_reader_panel_style.border_width_top = 2
	_reader_panel_style.border_width_right = 2
	_reader_panel_style.border_width_bottom = 2
	_reader_panel_style.corner_radius_top_left = 20
	_reader_panel_style.corner_radius_top_right = 20
	_reader_panel_style.corner_radius_bottom_left = 20
	_reader_panel_style.corner_radius_bottom_right = 20
	_reader_panel_style.shadow_color = Color(0.0, 0.0, 0.0, 0.45)
	_reader_panel_style.shadow_size = 18
	_reader_panel.add_theme_stylebox_override("panel", _reader_panel_style)

	var panel_margin := MarginContainer.new()
	panel_margin.anchor_right = 1.0
	panel_margin.anchor_bottom = 1.0
	panel_margin.add_theme_constant_override("margin_left", 20)
	panel_margin.add_theme_constant_override("margin_top", 18)
	panel_margin.add_theme_constant_override("margin_right", 20)
	panel_margin.add_theme_constant_override("margin_bottom", 20)
	_reader_panel.add_child(panel_margin)

	var panel_vbox := VBoxContainer.new()
	panel_vbox.anchor_right = 1.0
	panel_vbox.anchor_bottom = 1.0
	panel_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel_vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel_vbox.add_theme_constant_override("separation", 14)
	panel_margin.add_child(panel_vbox)

	var header_row := HBoxContainer.new()
	header_row.add_theme_constant_override("separation", 10)
	panel_vbox.add_child(header_row)

	_reader_title_label = Label.new()
	_reader_title_label.text = "Reader"
	_reader_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_reader_title_label.add_theme_font_size_override("font_size", 24)
	_reader_title_label.add_theme_color_override("font_color", Color(0.95, 0.97, 1.0, 1.0))
	header_row.add_child(_reader_title_label)

	_reader_mode_badge = Label.new()
	_reader_mode_badge.text = "Window"
	_reader_mode_badge.custom_minimum_size = Vector2(92, 30)
	_reader_mode_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_reader_mode_badge.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_reader_mode_badge.add_theme_font_size_override("font_size", 12)
	_reader_mode_badge.add_theme_color_override("font_color", Color(0.85, 0.91, 1.0, 0.95))
	header_row.add_child(_reader_mode_badge)

	_reader_lock_button = Button.new()
	_reader_lock_button.focus_mode = Control.FOCUS_NONE
	_reader_lock_button.text = "Locked"
	_reader_lock_button.tooltip_text = "Unlock to enable reader scaling."
	_reader_lock_button.pressed.connect(_toggle_reader_lock)
	header_row.add_child(_reader_lock_button)
	_apply_button_style(_reader_lock_button, Color(0.13, 0.18, 0.25, 1.0), Color(0.19, 0.25, 0.35, 1.0), Color(0.09, 0.13, 0.2, 1.0), Color(0.38, 0.5, 0.72, 1.0), Color(0.95, 0.97, 1.0, 1.0))

	_reader_zoom_out_button = Button.new()
	_reader_zoom_out_button.focus_mode = Control.FOCUS_NONE
	_reader_zoom_out_button.text = "A-"
	_reader_zoom_out_button.tooltip_text = "Reduce reader zoom"
	_reader_zoom_out_button.pressed.connect(func(): _zoom_reader(-0.1))
	header_row.add_child(_reader_zoom_out_button)
	_apply_button_style(_reader_zoom_out_button, Color(0.13, 0.18, 0.25, 1.0), Color(0.19, 0.25, 0.35, 1.0), Color(0.09, 0.13, 0.2, 1.0), Color(0.38, 0.5, 0.72, 1.0), Color(0.95, 0.97, 1.0, 1.0))

	_reader_zoom_label = Label.new()
	_reader_zoom_label.text = "100%"
	_reader_zoom_label.custom_minimum_size = Vector2(58, 0)
	_reader_zoom_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_reader_zoom_label.add_theme_color_override("font_color", Color(0.78, 0.85, 0.96, 0.95))
	header_row.add_child(_reader_zoom_label)

	_reader_zoom_in_button = Button.new()
	_reader_zoom_in_button.focus_mode = Control.FOCUS_NONE
	_reader_zoom_in_button.text = "A+"
	_reader_zoom_in_button.tooltip_text = "Increase reader zoom"
	_reader_zoom_in_button.pressed.connect(func(): _zoom_reader(0.1))
	header_row.add_child(_reader_zoom_in_button)
	_apply_button_style(_reader_zoom_in_button, Color(0.13, 0.18, 0.25, 1.0), Color(0.19, 0.25, 0.35, 1.0), Color(0.09, 0.13, 0.2, 1.0), Color(0.38, 0.5, 0.72, 1.0), Color(0.95, 0.97, 1.0, 1.0))

	var close_btn := Button.new()
	close_btn.text = "Close"
	close_btn.focus_mode = Control.FOCUS_NONE
	close_btn.pressed.connect(close_reader)
	header_row.add_child(close_btn)
	_apply_button_style(close_btn, Color(0.2, 0.14, 0.16, 1.0), Color(0.28, 0.18, 0.2, 1.0), Color(0.16, 0.1, 0.12, 1.0), Color(0.58, 0.28, 0.32, 1.0), Color(1.0, 0.93, 0.93, 1.0))

	_reader_meta_label = Label.new()
	_reader_meta_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_reader_meta_label.add_theme_font_size_override("font_size", 12)
	_reader_meta_label.add_theme_color_override("font_color", Color(0.68, 0.76, 0.87, 0.95))
	panel_vbox.add_child(_reader_meta_label)

	var reader_controls_row := HBoxContainer.new()
	reader_controls_row.add_theme_constant_override("separation", 10)
	panel_vbox.add_child(reader_controls_row)

	var block_view_label := Label.new()
	block_view_label.text = "Blocks"
	block_view_label.custom_minimum_size = Vector2(48, 0)
	reader_controls_row.add_child(block_view_label)

	_reader_view_mode_button = Button.new()
	_reader_view_mode_button.focus_mode = Control.FOCUS_NONE
	_reader_view_mode_button.pressed.connect(_toggle_reader_render_mode)
	reader_controls_row.add_child(_reader_view_mode_button)
	_apply_button_style(_reader_view_mode_button, Color(0.13, 0.18, 0.25, 1.0), Color(0.19, 0.25, 0.35, 1.0), Color(0.09, 0.13, 0.2, 1.0), Color(0.38, 0.5, 0.72, 1.0), Color(0.95, 0.97, 1.0, 1.0))

	var media_scale_label := Label.new()
	media_scale_label.text = "Media"
	media_scale_label.custom_minimum_size = Vector2(48, 0)
	reader_controls_row.add_child(media_scale_label)

	_reader_media_scale_slider = HSlider.new()
	_reader_media_scale_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_reader_media_scale_slider.min_value = READER_MEDIA_SCALE_MIN
	_reader_media_scale_slider.max_value = READER_MEDIA_SCALE_MAX
	_reader_media_scale_slider.step = READER_MEDIA_SCALE_STEP
	_reader_media_scale_slider.value_changed.connect(_on_reader_media_scale_slider_changed)
	reader_controls_row.add_child(_reader_media_scale_slider)

	_reader_media_scale_value_label = Label.new()
	_reader_media_scale_value_label.custom_minimum_size = Vector2(52, 0)
	_reader_media_scale_value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	reader_controls_row.add_child(_reader_media_scale_value_label)

	_reader_status_label = Label.new()
	_reader_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_reader_status_label.add_theme_font_size_override("font_size", 11)
	_reader_status_label.add_theme_color_override("font_color", Color(0.64, 0.74, 0.87, 0.94))
	panel_vbox.add_child(_reader_status_label)

	_reader_media_debug_panel = PanelContainer.new()
	_reader_media_debug_panel.visible = false
	_reader_media_debug_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var reader_media_debug_style := StyleBoxFlat.new()
	reader_media_debug_style.bg_color = Color(0.05, 0.08, 0.12, 0.96)
	reader_media_debug_style.border_color = Color(0.42, 0.61, 0.85, 0.92)
	reader_media_debug_style.border_width_left = 1
	reader_media_debug_style.border_width_top = 1
	reader_media_debug_style.border_width_right = 1
	reader_media_debug_style.border_width_bottom = 1
	reader_media_debug_style.corner_radius_top_left = 10
	reader_media_debug_style.corner_radius_top_right = 10
	reader_media_debug_style.corner_radius_bottom_left = 10
	reader_media_debug_style.corner_radius_bottom_right = 10
	_reader_media_debug_panel.add_theme_stylebox_override("panel", reader_media_debug_style)
	var reader_media_debug_margin := MarginContainer.new()
	reader_media_debug_margin.add_theme_constant_override("margin_left", 10)
	reader_media_debug_margin.add_theme_constant_override("margin_top", 8)
	reader_media_debug_margin.add_theme_constant_override("margin_right", 10)
	reader_media_debug_margin.add_theme_constant_override("margin_bottom", 8)
	_reader_media_debug_panel.add_child(reader_media_debug_margin)
	_reader_media_debug_label = Label.new()
	_reader_media_debug_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_reader_media_debug_label.add_theme_font_size_override("font_size", 10)
	_reader_media_debug_label.add_theme_color_override("font_color", Color(0.82, 0.9, 1.0, 0.96))
	_reader_media_debug_label.custom_minimum_size = Vector2(0, 56)
	reader_media_debug_margin.add_child(_reader_media_debug_label)
	panel_vbox.add_child(_reader_media_debug_panel)

	_reader_toast_panel = PanelContainer.new()
	_reader_toast_panel.name = "ReaderToast"
	_reader_toast_panel.anchor_left = 1.0
	_reader_toast_panel.anchor_top = 0.0
	_reader_toast_panel.anchor_right = 1.0
	_reader_toast_panel.anchor_bottom = 0.0
	_reader_toast_panel.offset_left = -356
	_reader_toast_panel.offset_top = 24
	_reader_toast_panel.offset_right = -24
	_reader_toast_panel.offset_bottom = 78
	_reader_toast_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_reader_toast_panel.visible = false
	_reader_toast_panel.z_index = 8
	var reader_toast_style := StyleBoxFlat.new()
	reader_toast_style.bg_color = Color(0.1, 0.15, 0.23, 0.98)
	reader_toast_style.border_color = Color(0.45, 0.62, 0.88, 1.0)
	reader_toast_style.border_width_left = 1
	reader_toast_style.border_width_top = 1
	reader_toast_style.border_width_right = 1
	reader_toast_style.border_width_bottom = 1
	reader_toast_style.corner_radius_top_left = 14
	reader_toast_style.corner_radius_top_right = 14
	reader_toast_style.corner_radius_bottom_left = 14
	reader_toast_style.corner_radius_bottom_right = 14
	reader_toast_style.shadow_color = Color(0.0, 0.0, 0.0, 0.32)
	reader_toast_style.shadow_size = 10
	_reader_toast_panel.add_theme_stylebox_override("panel", reader_toast_style)
	var reader_toast_margin := MarginContainer.new()
	reader_toast_margin.add_theme_constant_override("margin_left", 12)
	reader_toast_margin.add_theme_constant_override("margin_top", 8)
	reader_toast_margin.add_theme_constant_override("margin_right", 12)
	reader_toast_margin.add_theme_constant_override("margin_bottom", 8)
	_reader_toast_panel.add_child(reader_toast_margin)
	_reader_toast_label = Label.new()
	_reader_toast_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_reader_toast_label.add_theme_font_size_override("font_size", 11)
	_reader_toast_label.add_theme_color_override("font_color", Color(0.96, 0.98, 1.0, 1.0))
	reader_toast_margin.add_child(_reader_toast_label)
	_reader_overlay.add_child(_reader_toast_panel)

	_reader_scroll = ScrollContainer.new()
	_reader_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_reader_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_reader_scroll.follow_focus = true
	_reader_scroll.resized.connect(_on_reader_container_resized)
	_reader_scroll.gui_input.connect(_on_reader_scroll_input)
	panel_vbox.add_child(_reader_scroll)

	var scroll_margin := MarginContainer.new()
	scroll_margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll_margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll_margin.add_theme_constant_override("margin_left", 6)
	scroll_margin.add_theme_constant_override("margin_right", 10)
	scroll_margin.add_theme_constant_override("margin_bottom", 4)
	_reader_scroll.add_child(scroll_margin)

	_reader_blocks = VBoxContainer.new()
	_reader_blocks.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_reader_blocks.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_reader_blocks.add_theme_constant_override("separation", 14)
	scroll_margin.add_child(_reader_blocks)

	_reader_overlay.gui_input.connect(_on_reader_overlay_input)
	_create_reader_image_overlay()
	_apply_reader_mode_setting()
	_sync_reader_controls_from_settings()
	_set_reader_lock(true)
	move_child(_reader_overlay, get_child_count() - 1)


func _create_reader_image_overlay() -> void:
	if _reader_image_overlay:
		return

	_reader_image_overlay = ColorRect.new()
	_reader_image_overlay.name = "ReaderImageOverlay"
	_reader_image_overlay.anchor_right = 1.0
	_reader_image_overlay.anchor_bottom = 1.0
	_reader_image_overlay.color = Color(0.0, 0.0, 0.0, 0.48)
	_reader_image_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	_reader_image_overlay.focus_mode = Control.FOCUS_NONE
	_reader_image_overlay.visible = false
	_reader_image_overlay.resized.connect(_on_reader_image_overlay_resized)
	add_child(_reader_image_overlay)

	_reader_image_frame = Panel.new()
	_reader_image_frame.name = "ImageFrame"
	_reader_image_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_reader_image_frame.focus_mode = Control.FOCUS_NONE
	var frame_style := StyleBoxFlat.new()
	frame_style.bg_color = Color(0.045, 0.05, 0.06, 0.992)
	frame_style.border_color = Color(0.54, 0.62, 0.74, 0.96)
	frame_style.border_width_left = 1
	frame_style.border_width_top = 1
	frame_style.border_width_right = 1
	frame_style.border_width_bottom = 1
	frame_style.corner_radius_top_left = 18
	frame_style.corner_radius_top_right = 18
	frame_style.corner_radius_bottom_left = 18
	frame_style.corner_radius_bottom_right = 18
	frame_style.shadow_color = Color(0.0, 0.0, 0.0, 0.42)
	frame_style.shadow_size = 20
	_reader_image_frame.add_theme_stylebox_override("panel", frame_style)
	_reader_image_overlay.add_child(_reader_image_frame)

	var header_row := HBoxContainer.new()
	header_row.name = "HeaderRow"
	header_row.anchor_right = 1.0
	header_row.offset_left = 18
	header_row.offset_top = 16
	header_row.offset_right = -18
	header_row.offset_bottom = 56
	header_row.add_theme_constant_override("separation", 10)
	_reader_image_frame.add_child(header_row)

	_reader_image_title_label = Label.new()
	_reader_image_title_label.text = "Image Preview"
	_reader_image_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_reader_image_title_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_reader_image_title_label.add_theme_font_size_override("font_size", 18)
	_reader_image_title_label.add_theme_color_override("font_color", Color(0.95, 0.97, 1.0, 1.0))
	header_row.add_child(_reader_image_title_label)

	var resize_hint := Label.new()
	resize_hint.text = "Drag corner to resize"
	resize_hint.custom_minimum_size = Vector2(138, 0)
	resize_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	resize_hint.add_theme_font_size_override("font_size", 11)
	resize_hint.add_theme_color_override("font_color", Color(0.67, 0.76, 0.88, 0.9))
	header_row.add_child(resize_hint)

	var zoom_out_btn := Button.new()
	zoom_out_btn.focus_mode = Control.FOCUS_NONE
	zoom_out_btn.text = "-"
	zoom_out_btn.tooltip_text = "Zoom out"
	zoom_out_btn.pressed.connect(func(): _adjust_reader_image_zoom(-0.15))
	header_row.add_child(zoom_out_btn)
	_apply_button_style(zoom_out_btn, Color(0.13, 0.18, 0.25, 1.0), Color(0.19, 0.25, 0.35, 1.0), Color(0.09, 0.13, 0.2, 1.0), Color(0.38, 0.5, 0.72, 1.0), Color(0.95, 0.97, 1.0, 1.0))

	_reader_image_zoom_label = Label.new()
	_reader_image_zoom_label.text = "100%"
	_reader_image_zoom_label.custom_minimum_size = Vector2(60, 0)
	_reader_image_zoom_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_reader_image_zoom_label.add_theme_color_override("font_color", Color(0.8, 0.86, 0.96, 0.95))
	header_row.add_child(_reader_image_zoom_label)

	var zoom_in_btn := Button.new()
	zoom_in_btn.focus_mode = Control.FOCUS_NONE
	zoom_in_btn.text = "+"
	zoom_in_btn.tooltip_text = "Zoom in"
	zoom_in_btn.pressed.connect(func(): _adjust_reader_image_zoom(0.15))
	header_row.add_child(zoom_in_btn)
	_apply_button_style(zoom_in_btn, Color(0.13, 0.18, 0.25, 1.0), Color(0.19, 0.25, 0.35, 1.0), Color(0.09, 0.13, 0.2, 1.0), Color(0.38, 0.5, 0.72, 1.0), Color(0.95, 0.97, 1.0, 1.0))

	var close_btn := Button.new()
	close_btn.focus_mode = Control.FOCUS_NONE
	close_btn.text = "Close"
	close_btn.pressed.connect(close_image_viewer)
	header_row.add_child(close_btn)
	_apply_button_style(close_btn, Color(0.2, 0.14, 0.16, 1.0), Color(0.28, 0.18, 0.2, 1.0), Color(0.16, 0.1, 0.12, 1.0), Color(0.58, 0.28, 0.32, 1.0), Color(1.0, 0.93, 0.93, 1.0))

	_reader_image_viewport = Control.new()
	_reader_image_viewport.name = "ImageViewport"
	_reader_image_viewport.focus_mode = Control.FOCUS_NONE
	_reader_image_viewport.anchor_right = 1.0
	_reader_image_viewport.anchor_bottom = 1.0
	_reader_image_viewport.offset_left = 16
	_reader_image_viewport.offset_top = 68
	_reader_image_viewport.offset_right = -16
	_reader_image_viewport.offset_bottom = -16
	_reader_image_viewport.clip_contents = true
	_reader_image_viewport.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_reader_image_viewport.modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_viewport.self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_viewport.material = null
	_reader_image_frame.add_child(_reader_image_viewport)
	_reader_image_viewport.resized.connect(_on_reader_image_viewport_resized)

	var viewport_background := ColorRect.new()
	viewport_background.name = "ImageViewportBackground"
	viewport_background.anchor_right = 1.0
	viewport_background.anchor_bottom = 1.0
	viewport_background.color = READER_IMAGE_VIEWER_BACKGROUND
	viewport_background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	viewport_background.focus_mode = Control.FOCUS_NONE
	viewport_background.modulate = Color(1.0, 1.0, 1.0, 1.0)
	viewport_background.self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	viewport_background.material = null
	_reader_image_viewport.add_child(viewport_background)

	_reader_image_surface = Control.new()
	_reader_image_surface.name = "ImageSurfaceHost"
	_reader_image_surface.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_reader_image_surface.focus_mode = Control.FOCUS_NONE
	_reader_image_surface.clip_contents = false
	_reader_image_surface.modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_surface.self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_surface.material = null
	_reader_image_viewport.add_child(_reader_image_surface)

	_reader_image_canvas = READER_IMAGE_CANVAS_SCRIPT.new()
	_reader_image_canvas.name = "ImageCanvas"
	_reader_image_canvas.position = Vector2.ZERO
	_reader_image_surface.add_child(_reader_image_canvas)



	_reader_image_resize_handle = ColorRect.new()
	_reader_image_resize_handle.name = "ResizeHandle"
	_reader_image_resize_handle.focus_mode = Control.FOCUS_NONE
	_reader_image_resize_handle.anchor_left = 1.0
	_reader_image_resize_handle.anchor_top = 1.0
	_reader_image_resize_handle.anchor_right = 1.0
	_reader_image_resize_handle.anchor_bottom = 1.0
	_reader_image_resize_handle.offset_left = -26
	_reader_image_resize_handle.offset_top = -26
	_reader_image_resize_handle.offset_right = -10
	_reader_image_resize_handle.offset_bottom = -10
	_reader_image_resize_handle.color = Color(0.46, 0.68, 0.98, 0.9)
	_reader_image_resize_handle.mouse_filter = Control.MOUSE_FILTER_PASS
	_reader_image_resize_handle.mouse_default_cursor_shape = Control.CURSOR_BDIAGSIZE
	_reader_image_frame.add_child(_reader_image_resize_handle)

	_reader_image_overlay.gui_input.connect(_on_reader_image_overlay_input)
	move_child(_reader_image_overlay, get_child_count() - 1)


func _style_reader_image_scrollbar(scrollbar: ScrollBar) -> void:
	if scrollbar == null:
		return
	scrollbar.focus_mode = Control.FOCUS_NONE
	var track := StyleBoxFlat.new()
	track.bg_color = Color(0.05, 0.065, 0.09, 0.86)
	track.corner_radius_top_left = 8
	track.corner_radius_top_right = 8
	track.corner_radius_bottom_left = 8
	track.corner_radius_bottom_right = 8
	var grabber := StyleBoxFlat.new()
	grabber.bg_color = Color(0.34, 0.44, 0.58, 0.9)
	grabber.corner_radius_top_left = 8
	grabber.corner_radius_top_right = 8
	grabber.corner_radius_bottom_left = 8
	grabber.corner_radius_bottom_right = 8
	var grabber_hover: StyleBoxFlat = grabber.duplicate() as StyleBoxFlat
	grabber_hover.bg_color = Color(0.42, 0.55, 0.72, 0.94)
	var grabber_pressed: StyleBoxFlat = grabber.duplicate() as StyleBoxFlat
	grabber_pressed.bg_color = Color(0.5, 0.64, 0.84, 0.98)
	scrollbar.add_theme_stylebox_override("scroll", track)
	scrollbar.add_theme_stylebox_override("scroll_focus", track)
	scrollbar.add_theme_stylebox_override("grabber", grabber)
	scrollbar.add_theme_stylebox_override("grabber_highlight", grabber_hover)
	scrollbar.add_theme_stylebox_override("grabber_pressed", grabber_pressed)


func _on_reader_overlay_input(event: InputEvent) -> void:
	if not is_reader_open():
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if _reader_panel and not _reader_panel.get_global_rect().has_point(event.global_position):
			close_reader()
			_reader_overlay.accept_event()


func _on_reader_scroll_input(event: InputEvent) -> void:
	if _reader_is_locked:
		return
	if event is InputEventMouseButton and event.pressed and event.ctrl_pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_zoom_reader(0.1)
			_reader_scroll.accept_event()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_zoom_reader(-0.1)
			_reader_scroll.accept_event()


func _handle_reader_unhandled_input(event: InputEvent) -> bool:
	if is_reader_open() and event is InputEventKey and event.pressed and not event.echo:
		if _matches_reader_toggle_shortcut(event):
			_toggle_reader_render_mode()
			return true
		if _handle_reader_zoom_shortcut(event):
			return true

	if is_image_viewer_open() and event is InputEventMagnifyGesture:
		_zoom_reader_image_by_factor(event.factor)
		return true

	if is_reader_open() and not _reader_is_locked and event is InputEventMagnifyGesture:
		_reader_current_zoom = clamp(_reader_current_zoom * event.factor, 0.75, 2.6)
		_apply_reader_zoom()
		return true

	return false

func open_reader(node: Dictionary) -> void:
	_ensure_reader_render_client()
	if not _reader_overlay:
		_create_reader_overlay()
	if not _reader_overlay or node.is_empty():
		return

	_reader_current_node = node.duplicate(true)
	var title := String(node.get("label", node.get("id", "Untitled")))
	var metadata_variant = node.get("metadata", {})
	var metadata: Dictionary = metadata_variant if metadata_variant is Dictionary else {}
	var filepath := String(metadata.get("filepath", node.get("filepath", "")))

	_reader_title_label.text = title
	_reader_meta_label.text = filepath if not filepath.is_empty() else "Godot Reader"
	_reader_current_zoom = 1.0
	_apply_reader_mode_setting()
	_sync_reader_controls_from_settings()
	_set_reader_lock(true)
	_start_reader_document_render("Loading content...", filepath)
	_start_reader_document_render_from_node(_reader_current_node, filepath)
	if _reader_toast_panel:
		_reader_toast_panel.hide()
	_reader_overlay.show()
	move_child(_reader_overlay, get_child_count() - 1)
	_update_reader_media_debug_overlay()

func _start_reader_document_render_from_node(node: Dictionary, fallback_filepath: String) -> void:
	var protocol_result: Dictionary = await _load_reader_content_via_markdown_protocol(node, fallback_filepath)
	if bool(protocol_result.get("ok", false)):
		var protocol_blocks_variant: Variant = protocol_result.get("blocks", [])
		var protocol_blocks: Array = protocol_blocks_variant if protocol_blocks_variant is Array else []
		var resolved_filepath := String(protocol_result.get("filePath", fallback_filepath)).strip_edges()
		var target_block_id := int(protocol_result.get("targetBlockId", -1))
		if protocol_blocks.is_empty():
			protocol_blocks = [{"type": "paragraph", "text": "No note content is available for this node yet."}]
		_reader_meta_label.text = resolved_filepath if not resolved_filepath.is_empty() else _reader_meta_label.text
		_start_reader_blocks_render(protocol_blocks, resolved_filepath, target_block_id)
		return

	var fallback_content := _resolve_reader_content(node)
	_start_reader_document_render(fallback_content, fallback_filepath)

func _load_reader_content_via_markdown_protocol(node: Dictionary, fallback_filepath: String) -> Dictionary:
	if _reader_render_client == null:
		return {"ok": false, "error": "Reader render client is unavailable."}

	var resolved_file_path := String(fallback_filepath).strip_edges()
	var node_id := String(node.get("id", "")).strip_edges()
	var target_block_id := -1
	var pre_resolved_variant = node.get("_reader_resolve_target", {})
	var pre_resolved: Dictionary = pre_resolved_variant if pre_resolved_variant is Dictionary else {}
	if not pre_resolved.is_empty():
		resolved_file_path = String(pre_resolved.get("filePath", resolved_file_path)).strip_edges()
		target_block_id = int(pre_resolved.get("targetBlockId", target_block_id))
	if target_block_id < 0 and not node_id.is_empty():
		var resolve_response: Dictionary = await _reader_render_client.resolve_markdown_node(node_id, resolved_file_path)
		if bool(resolve_response.get("ok", false)):
			resolved_file_path = String(resolve_response.get("filePath", resolved_file_path)).strip_edges()
			target_block_id = int(resolve_response.get("targetBlockId", -1))

	if resolved_file_path.is_empty():
		return {"ok": false, "error": "No markdown file path was resolved for the reader node."}

	var index_response: Dictionary = await _reader_render_client.fetch_markdown_index(resolved_file_path)
	if not bool(index_response.get("ok", false)):
		return index_response
	var index_id := String(index_response.get("indexId", "")).strip_edges()
	if index_id.is_empty():
		return {"ok": false, "error": "Markdown index API did not return indexId."}

	var block_count := 36
	var chunk_source: Variant = index_response.get("blocksSummary", {})
	if chunk_source is Dictionary:
		var summary: Dictionary = chunk_source
		var suggested_chunk := int(summary.get("chunkBlockSize", block_count))
		if suggested_chunk > 0:
			block_count = suggested_chunk
	block_count = clampi(block_count, 1, 512)

	var start_block := 0
	var has_more := true
	var chunks_guard := 0
	var render_blocks: Array[Dictionary] = []
	while has_more and chunks_guard < 100000:
		chunks_guard += 1
		var chunk_response: Dictionary = await _reader_render_client.fetch_markdown_chunk(index_id, start_block, block_count)
		if not bool(chunk_response.get("ok", false)):
			return chunk_response
		var blocks_variant: Variant = chunk_response.get("blocks", [])
		var blocks: Array = blocks_variant if blocks_variant is Array else []
		if blocks.is_empty():
			has_more = false
			break
		for block_variant in blocks:
			var block: Dictionary = block_variant if block_variant is Dictionary else {}
			var converted_blocks: Array = _convert_markdown_protocol_block(block)
			for converted_variant in converted_blocks:
				var converted: Dictionary = converted_variant if converted_variant is Dictionary else {}
				if converted.is_empty():
					continue
				render_blocks.append(converted)
		start_block = int(chunk_response.get("nextStartBlock", start_block + blocks.size()))
		has_more = bool(chunk_response.get("hasMore", false))

	if render_blocks.is_empty():
		return {"ok": false, "error": "Markdown chunk API returned empty content."}

	return {
		"ok": true,
		"blocks": render_blocks,
		"filePath": resolved_file_path,
		"targetBlockId": target_block_id
	}

func _convert_markdown_protocol_block(protocol_block: Dictionary) -> Array:
	var block_id := int(protocol_block.get("id", -1))
	var block_type := String(protocol_block.get("type", "paragraph")).strip_edges().to_lower()
	var text := String(protocol_block.get("text", ""))
	var normalized_blocks: Array = []

	if not text.strip_edges().is_empty():
		var parsed_blocks: Array = _parse_markdown_blocks(text)
		if not parsed_blocks.is_empty():
			for parsed_variant in parsed_blocks:
				var parsed: Dictionary = parsed_variant if parsed_variant is Dictionary else {}
				if parsed.is_empty():
					continue
				parsed["_protocol_block_id"] = block_id
				normalized_blocks.append(parsed)
			return normalized_blocks

	var fallback_block: Dictionary = {}
	match block_type:
		"heading":
			fallback_block = {"type": "heading", "level": 1, "text": text.strip_edges()}
		"blockquote":
			fallback_block = {"type": "blockquote", "text": text.strip_edges()}
		"list", "list_item":
			fallback_block = {
				"type": "list",
				"ordered": false,
				"items": [
					{"text": text.strip_edges()}
				]
			}
		"table":
			fallback_block = {"type": "table", "headers": [], "rows": []}
		"code":
			fallback_block = {"type": "code", "language": "", "text": text}
		"rule":
			fallback_block = {"type": "rule"}
		_:
			if text.strip_edges().is_empty():
				return []
			fallback_block = {"type": "paragraph", "text": text.strip_edges()}

	fallback_block["_protocol_block_id"] = block_id
	normalized_blocks.append(fallback_block)
	return normalized_blocks


func close_reader() -> void:
	_reader_render_revision += 1
	close_image_viewer()
	if _reader_overlay:
		_reader_overlay.hide()
	if _reader_toast_panel:
		_reader_toast_panel.hide()
	_update_reader_media_debug_overlay()


func is_reader_open() -> bool:
	return _reader_overlay != null and _reader_overlay.visible


func _prepare_texture_for_reader_image_viewer(texture: Texture2D) -> Texture2D:
	if texture == null:
		return null
	var source_image: Image = texture.get_image()
	if source_image == null or source_image.is_empty():
		return texture
	var working_image: Image = source_image.duplicate()
	if working_image == null or working_image.is_empty():
		return texture
	working_image.convert(Image.FORMAT_RGBA8)
	working_image.fix_alpha_edges()
	var flattened_image: Image = Image.create(working_image.get_width(), working_image.get_height(), false, Image.FORMAT_RGBA8)
	if flattened_image == null or flattened_image.is_empty():
		return texture
	flattened_image.fill(READER_IMAGE_VIEWER_BACKGROUND)
	flattened_image.blend_rect(working_image, Rect2i(0, 0, working_image.get_width(), working_image.get_height()), Vector2i.ZERO)
	var flattened_texture: ImageTexture = ImageTexture.create_from_image(flattened_image)
	return flattened_texture if flattened_texture != null else texture


func _resolve_reader_image_debug_dir() -> String:
	var dir_path := ProjectSettings.globalize_path("res://../tmp/godot-reader-debug")
	var dir_error := DirAccess.make_dir_recursive_absolute(dir_path)
	if dir_error != OK and dir_error != ERR_ALREADY_EXISTS:
		push_warning("PathModeUI: Unable to create reader debug directory (%s)." % error_string(dir_error))
		return ""
	return dir_path


func _sanitize_reader_debug_slug(value: String) -> String:
	var slug := value.strip_edges().to_lower().replace(" ", "-")
	var invalid_chars := RegEx.new()
	if invalid_chars.compile("[^a-z0-9._-]+") == OK:
		slug = invalid_chars.sub(slug, "-", true)
	while slug.contains("--"):
		slug = slug.replace("--", "-")
	while slug.begins_with("-"):
		slug = slug.substr(1)
	while slug.ends_with("-"):
		slug = slug.left(slug.length() - 1)
	return slug if not slug.is_empty() else "image"


func _save_reader_debug_image(image: Image, file_name: String) -> void:
	if image == null or image.is_empty():
		return
	var debug_dir := _resolve_reader_image_debug_dir()
	if debug_dir.is_empty():
		return
	var export_image: Image = image.duplicate()
	if export_image == null or export_image.is_empty():
		return
	var save_error := export_image.save_png("%s/%s" % [debug_dir, file_name])
	if save_error != OK:
		push_warning("PathModeUI: Failed to save reader debug image (%s)." % error_string(save_error))


func _save_reader_debug_texture(texture: Texture2D, file_name: String) -> void:
	if texture == null:
		return
	var image: Image = texture.get_image()
	if image == null or image.is_empty():
		return
	_save_reader_debug_image(image, file_name)


func _write_reader_debug_text(file_name: String, content: String) -> void:
	var debug_dir := _resolve_reader_image_debug_dir()
	if debug_dir.is_empty():
		return
	var file := FileAccess.open("%s/%s" % [debug_dir, file_name], FileAccess.WRITE)
	if file == null:
		push_warning("PathModeUI: Failed to open reader debug text file: %s" % file_name)
		return
	file.store_string(content)


func _export_reader_mermaid_block_debug_artifacts(source_text: String, texture: Texture2D, note_filepath: String, block_id: int) -> void:
	if texture == null or not OS.is_debug_build() or not _is_reader_debug_enabled():
		return
	_reader_debug_mermaid_export_counter += 1
	var prefix := "%04d-mermaid-%s" % [
		_reader_debug_mermaid_export_counter,
		_sanitize_reader_debug_slug(_reader_title_label.text if _reader_title_label != null else "reader")
	]
	if block_id >= 0:
		prefix += "-block-%03d" % block_id
	var image_name := "%s-preview.png" % prefix
	var source_name := "%s-source.mmd" % prefix
	var metadata_name := "%s-meta.json" % prefix
	_save_reader_debug_texture(texture, image_name)
	_write_reader_debug_text(source_name, source_text)
	var debug_dir := _resolve_reader_image_debug_dir()
	if debug_dir.is_empty():
		return
	var metadata := {
		"kind": "mermaid",
		"title": _reader_title_label.text if _reader_title_label != null else "",
		"filePath": note_filepath,
		"blockId": block_id,
		"textureWidth": texture.get_width(),
		"textureHeight": texture.get_height(),
		"imagePath": "%s/%s" % [debug_dir, image_name],
		"sourcePath": "%s/%s" % [debug_dir, source_name],
		"renderRevision": _reader_render_revision,
		"exportedAtUnix": Time.get_unix_time_from_system(),
	}
	_write_reader_debug_text(metadata_name, JSON.stringify(metadata, "  "))


func _crop_reader_debug_image(image: Image, rect: Rect2) -> Image:
	if image == null or image.is_empty():
		return null
	var left := maxi(0, int(floor(rect.position.x)))
	var top := maxi(0, int(floor(rect.position.y)))
	var right := mini(image.get_width(), int(ceil(rect.position.x + rect.size.x)))
	var bottom := mini(image.get_height(), int(ceil(rect.position.y + rect.size.y)))
	if right <= left or bottom <= top:
		return null
	return image.get_region(Rect2i(left, top, right - left, bottom - top))


func _get_reader_image_content_global_rect() -> Rect2:
	if _reader_image_viewport == null or _reader_image_content_rect.size.x <= 0.0 or _reader_image_content_rect.size.y <= 0.0:
		return Rect2()
	var viewport_global_rect: Rect2 = _reader_image_viewport.get_global_rect()
	var global_position: Vector2 = viewport_global_rect.position - _reader_image_pan + _reader_image_content_rect.position
	return Rect2(global_position, _reader_image_content_rect.size)


func _capture_reader_image_debug_frame(capture_id: int, prefix: String) -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	if capture_id != _reader_image_debug_capture_id or not is_image_viewer_open() or _reader_image_frame == null:
		return
	var viewport_texture: Texture2D = get_viewport().get_texture()
	if viewport_texture == null:
		return
	var frame_image: Image = viewport_texture.get_image()
	if frame_image == null or frame_image.is_empty():
		return
	frame_image.flip_y()
	_save_reader_debug_image(frame_image, "%s-screen-full.png" % prefix)
	var frame_crop: Image = _crop_reader_debug_image(frame_image, _reader_image_frame.get_global_rect())
	if frame_crop != null and not frame_crop.is_empty():
		_save_reader_debug_image(frame_crop, "%s-screen-frame.png" % prefix)
	var texture_global_rect: Rect2 = _get_reader_image_content_global_rect()
	if texture_global_rect.size.x > 0.0 and texture_global_rect.size.y > 0.0:
		var texture_crop: Image = _crop_reader_debug_image(frame_image, texture_global_rect)
		if texture_crop != null and not texture_crop.is_empty():
			_save_reader_debug_image(texture_crop, "%s-screen-texture.png" % prefix)
	var debug_dir := _resolve_reader_image_debug_dir()
	if not debug_dir.is_empty():
		print("[ReaderDebug] Saved image viewer debug capture: %s/%s" % [debug_dir, prefix])


func _export_reader_image_debug_artifacts(source_texture: Texture2D, viewer_texture: Texture2D, title: String) -> void:
	if not OS.is_debug_build() or not _is_reader_debug_enabled():
		return
	_reader_image_debug_capture_id += 1
	var prefix := "%04d-%s" % [_reader_image_debug_capture_id, _sanitize_reader_debug_slug(title)]
	_save_reader_debug_texture(source_texture, "%s-source.png" % prefix)
	_save_reader_debug_texture(viewer_texture, "%s-viewer.png" % prefix)
	call_deferred("_capture_reader_image_debug_frame", _reader_image_debug_capture_id, prefix)


func open_image_viewer(texture: Texture2D, title: String = "") -> void:
	if not texture:
		return
	if not _reader_image_overlay:
		_create_reader_image_overlay()

	var viewer_texture: Texture2D = _prepare_texture_for_reader_image_viewer(texture)
	_reader_image_current_texture = viewer_texture if viewer_texture != null else texture
	_reader_image_content_rect = Rect2()
	_reader_image_overlay.color = Color(0.0, 0.0, 0.0, 0.48)
	_reader_image_overlay.modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_frame.modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_frame.self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_frame.material = null
	_reader_image_viewport.modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_viewport.self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_viewport.material = null
	_reader_image_surface.modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_surface.self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	_reader_image_surface.material = null
	if _reader_image_canvas and _reader_image_canvas.has_method("set_render_texture"):
		_reader_image_canvas.call("set_render_texture", _reader_image_current_texture)
	if _reader_image_canvas and _reader_image_canvas.has_method("set_background"):
		_reader_image_canvas.call("set_background", READER_IMAGE_VIEWER_BACKGROUND)
	_reader_image_title_label.text = title if not title.is_empty() else "Image Preview"
	_export_reader_image_debug_artifacts(texture, _reader_image_current_texture, _reader_image_title_label.text)
	_reader_image_zoom = 1.0
	_reader_image_pan = Vector2.ZERO
	_reader_image_dragging = false
	_reader_image_frame_resizing = false
	_reader_image_frame_size = _resolve_default_reader_image_frame_size()
	_reader_image_touch_points.clear()
	_reader_image_last_pinch_distance = 0.0
	_reader_image_last_pinch_center = Vector2.ZERO
	_reader_image_overlay.show()
	move_child(_reader_image_overlay, get_child_count() - 1)
	_apply_reader_image_frame_layout()
	_apply_reader_image_transform()
	call_deferred("_center_reader_image_view")

func close_image_viewer() -> void:
	_reader_image_dragging = false
	_reader_image_frame_resizing = false
	_reader_image_touch_points.clear()
	_reader_image_last_pinch_distance = 0.0
	_reader_image_last_pinch_center = Vector2.ZERO
	if _reader_image_overlay:
		_reader_image_overlay.hide()

func is_image_viewer_open() -> bool:
	return _reader_image_overlay != null and _reader_image_overlay.visible


func _toggle_reader_lock() -> void:
	_set_reader_lock(not _reader_is_locked)


func _set_reader_lock(locked: bool) -> void:
	_reader_is_locked = locked
	if _reader_lock_button:
		_reader_lock_button.text = "Locked" if locked else "Unlocked"
		_reader_lock_button.tooltip_text = "Unlock to enable reader scaling." if locked else "Lock to freeze the current reader scale."
	if _reader_zoom_out_button:
		_reader_zoom_out_button.disabled = locked
	if _reader_zoom_in_button:
		_reader_zoom_in_button.disabled = locked


func _zoom_reader(delta: float) -> void:
	if _reader_is_locked:
		return
	_reader_current_zoom = clamp(_reader_current_zoom + delta, 0.75, 2.6)
	_apply_reader_zoom()


func _apply_reader_zoom() -> void:
	if _reader_zoom_label:
		_reader_zoom_label.text = "%d%%" % int(round(_reader_current_zoom * 100.0))
	_reader_media_debug_entries.clear()
	_reader_media_debug_block_counter = 0
	_reader_media_layout_dirty = false
	if _reader_blocks:
		_apply_reader_zoom_recursive(_reader_blocks)
		if _reader_media_layout_dirty:
			_refresh_reader_layout_after_media_resize()
	_update_reader_media_debug_overlay()


func _apply_reader_zoom_recursive(control: Control) -> void:
	if control.has_meta("reader_base_font_size"):
		var base_font_size := float(control.get_meta("reader_base_font_size"))
		var scaled_font_size: int = int(maxf(11.0, round(base_font_size * _reader_current_zoom)))
		if control is Label:
			(control as Label).add_theme_font_size_override("font_size", scaled_font_size)
		elif control is RichTextLabel:
			var rich_label := control as RichTextLabel
			rich_label.add_theme_font_size_override("normal_font_size", scaled_font_size)
			rich_label.add_theme_font_size_override("bold_font_size", scaled_font_size)
			rich_label.add_theme_font_size_override("italics_font_size", scaled_font_size)
			rich_label.add_theme_font_size_override("mono_font_size", maxi(10, scaled_font_size - 1))
		elif control is TextEdit:
			(control as TextEdit).add_theme_font_size_override("font_size", scaled_font_size)

	if control.has_meta("reader_base_size"):
		var base_size_variant: Variant = control.get_meta("reader_base_size")
		if base_size_variant is Vector2 and control is TextureRect:
			var texture_rect := control as TextureRect
			var base_size := base_size_variant as Vector2
			var scaled_size: Vector2 = (base_size_variant as Vector2) * _reader_current_zoom
			var media_scalable := bool(control.get_meta("reader_media_scalable", false))
			var media_scale := _get_reader_media_scale_setting()
			if media_scalable:
				scaled_size *= media_scale
			var limit_size := _resolve_reader_control_media_limit(control)
			scaled_size = _fit_size_within(scaled_size, limit_size, false)
			var previous_size := texture_rect.custom_minimum_size
			texture_rect.custom_minimum_size = scaled_size
			texture_rect.size = scaled_size
			texture_rect.update_minimum_size()
			if previous_size.distance_to(scaled_size) > 0.5:
				_reader_media_layout_dirty = true
			if _is_reader_debug_enabled():
				var combined_min := texture_rect.get_combined_minimum_size()
				var actual_size := texture_rect.size
				_reader_media_debug_block_counter += 1
				var control_name := String(texture_rect.name).strip_edges()
				if control_name.is_empty():
					control_name = "TextureRect"
				var debug_line := "#%02d %s base=%0.1fx%0.1f min=%0.1fx%0.1f combined=%0.1fx%0.1f size=%0.1fx%0.1f limit=%0.1fx%0.1f media=%0.2f zoom=%0.2f scalable=%s" % [
					_reader_media_debug_block_counter,
					control_name,
					base_size.x,
					base_size.y,
					scaled_size.x,
					scaled_size.y,
					combined_min.x,
					combined_min.y,
					actual_size.x,
					actual_size.y,
					limit_size.x,
					limit_size.y,
					media_scale,
					_reader_current_zoom,
					str(media_scalable)
				]
				_reader_media_debug_entries.append(debug_line)

	for child in control.get_children():
		if child is Control:
			_apply_reader_zoom_recursive(child)


func _refresh_reader_layout_after_media_resize() -> void:
	if _reader_blocks == null:
		return
	_reader_blocks.update_minimum_size()
	if _reader_blocks is Container:
		(_reader_blocks as Container).queue_sort()
	var ancestor: Node = _reader_blocks.get_parent()
	while ancestor:
		if ancestor is Control:
			(ancestor as Control).update_minimum_size()
		if ancestor is Container:
			(ancestor as Container).queue_sort()
		ancestor = ancestor.get_parent()
	call_deferred("_enforce_reader_render_horizontal_fit")


func _enforce_reader_render_horizontal_fit() -> void:
	if _reader_scroll == null:
		return
	if _get_reader_render_mode_setting() == "render":
		_reader_scroll.scroll_horizontal = 0


func _apply_reader_mode_setting(mode_override: String = "") -> void:
	if not _reader_panel:
		return

	var reader_mode := mode_override
	if reader_mode.is_empty():
		reader_mode = String(get_setting("reading_mode", "window"))

	if reader_mode == "fullscreen":
		_reader_panel.anchor_left = 0.02
		_reader_panel.anchor_top = 0.02
		_reader_panel.anchor_right = 0.98
		_reader_panel.anchor_bottom = 0.98
		if _reader_panel_style:
			_reader_panel_style.corner_radius_top_left = 12
			_reader_panel_style.corner_radius_top_right = 12
			_reader_panel_style.corner_radius_bottom_left = 12
			_reader_panel_style.corner_radius_bottom_right = 12
	else:
		_reader_panel.anchor_left = 0.12
		_reader_panel.anchor_top = 0.08
		_reader_panel.anchor_right = 0.88
		_reader_panel.anchor_bottom = 0.92
		if _reader_panel_style:
			_reader_panel_style.corner_radius_top_left = 20
			_reader_panel_style.corner_radius_top_right = 20
			_reader_panel_style.corner_radius_bottom_left = 20
			_reader_panel_style.corner_radius_bottom_right = 20

	if _reader_mode_badge:
		_reader_mode_badge.text = "Fullscreen" if reader_mode == "fullscreen" else "Window"


func _sync_reader_controls_from_settings() -> void:
	var render_mode := _get_reader_render_mode_setting()
	if _reader_view_mode_button:
		_reader_view_mode_button.text = "View: %s" % ("Source" if render_mode == "source" else "Render")
		_reader_view_mode_button.tooltip_text = "Toggle formula and Mermaid blocks with %s." % _get_reader_toggle_shortcut_string()
	var media_scale := _get_reader_media_scale_setting()
	if _reader_media_scale_slider:
		_reader_media_scale_slider.set_block_signals(true)
		_reader_media_scale_slider.value = media_scale
		_reader_media_scale_slider.set_block_signals(false)
	if _reader_media_scale_value_label:
		_reader_media_scale_value_label.text = "%.2fx" % media_scale
	_set_reader_status(_build_reader_status_hint())
	for renderable_block in _reader_renderable_blocks:
		_apply_reader_renderable_block_mode(renderable_block, render_mode)
	if _reader_blocks:
		_apply_reader_zoom()
	else:
		_update_reader_media_debug_overlay()


func _build_reader_status_hint() -> String:
	var base_hint := "Toggle formula and Mermaid blocks with %s. Ctrl/Cmd + mouse wheel or Ctrl/Cmd +/-/0 adjusts reader zoom when unlocked. Esc closes the reader." % _get_reader_toggle_shortcut_string()
	if _is_reader_debug_enabled():
		return "%s Reader debug capture is enabled." % base_hint
	return base_hint


func _set_reader_status(message: String) -> void:
	if _reader_status_label:
		_reader_status_label.text = message


func _update_reader_media_debug_overlay() -> void:
	if _reader_media_debug_panel == null or _reader_media_debug_label == null:
		return
	var debug_visible := _is_reader_debug_enabled() and is_reader_open()
	_reader_media_debug_panel.visible = debug_visible
	if not debug_visible:
		_reader_media_debug_label.text = ""
		return
	var page_limit := _get_reader_media_page_limit()
	var scroll_size := _reader_scroll.size if _reader_scroll else Vector2.ZERO
	var panel_size := _reader_panel.size if _reader_panel else Vector2.ZERO
	if _reader_media_debug_entries.is_empty():
		_reader_media_debug_label.text = "Media Debug: no TextureRect blocks tracked.\npage_limit=%0.1fx%0.1f scroll=%0.1fx%0.1f panel=%0.1fx%0.1f media=%0.2f zoom=%0.2f" % [
			page_limit.x,
			page_limit.y,
			scroll_size.x,
			scroll_size.y,
			panel_size.x,
			panel_size.y,
			_get_reader_media_scale_setting(),
			_reader_current_zoom
		]
		return
	var max_lines := mini(_reader_media_debug_entries.size(), 16)
	var lines := PackedStringArray()
	lines.append("page_limit=%0.1fx%0.1f scroll=%0.1fx%0.1f panel=%0.1fx%0.1f media=%0.2f zoom=%0.2f" % [
		page_limit.x,
		page_limit.y,
		scroll_size.x,
		scroll_size.y,
		panel_size.x,
		panel_size.y,
		_get_reader_media_scale_setting(),
		_reader_current_zoom
	])
	for line_index in range(max_lines):
		lines.append(_reader_media_debug_entries[line_index])
	if _reader_media_debug_entries.size() > max_lines:
		lines.append("... (%d more blocks)" % (_reader_media_debug_entries.size() - max_lines))
	_reader_media_debug_label.text = "Media Debug (%d blocks)\n%s" % [_reader_media_debug_entries.size(), "\n".join(lines)]


func _show_reader_toast(message: String, tone: String = "info") -> void:
	_set_reader_status(message)
	if _reader_toast_panel == null or _reader_toast_label == null:
		return

	var toast_style := _reader_toast_panel.get_theme_stylebox("panel") as StyleBoxFlat
	if toast_style:
		match tone:
			"success":
				toast_style.bg_color = Color(0.08, 0.2, 0.16, 0.98)
				toast_style.border_color = Color(0.28, 0.82, 0.62, 1.0)
			"warning":
				toast_style.bg_color = Color(0.24, 0.16, 0.08, 0.98)
				toast_style.border_color = Color(0.95, 0.73, 0.28, 1.0)
			_:
				toast_style.bg_color = Color(0.1, 0.15, 0.23, 0.98)
				toast_style.border_color = Color(0.45, 0.62, 0.88, 1.0)

	_reader_toast_label.text = message
	_reader_toast_panel.modulate = Color(1.0, 1.0, 1.0, 0.0)
	_reader_toast_panel.show()
	if _reader_toast_tween and _reader_toast_tween.is_running():
		_reader_toast_tween.kill()
	_reader_toast_tween = create_tween()
	_reader_toast_tween.tween_property(_reader_toast_panel, "modulate:a", 1.0, 0.14)
	_reader_toast_tween.tween_interval(1.8)
	_reader_toast_tween.tween_property(_reader_toast_panel, "modulate:a", 0.0, 0.24)
	_reader_toast_tween.finished.connect(func():
		if _reader_toast_panel:
			_reader_toast_panel.hide()
			_reader_toast_panel.modulate = Color(1.0, 1.0, 1.0, 1.0)
		if is_reader_open():
			_set_reader_status(_build_reader_status_hint())
	)


func _get_reader_render_mode_setting() -> String:
	var render_mode := String(get_setting("reader_render_mode", "render")).to_lower()
	return "source" if render_mode == "source" else "render"


func _get_reader_media_scale_setting() -> float:
	return clampf(float(get_setting("reader_media_scale", READER_MEDIA_SCALE_DEFAULT)), READER_MEDIA_SCALE_MIN, READER_MEDIA_SCALE_MAX)


func _is_reader_debug_enabled() -> bool:
	return bool(get_setting("reader_debug", false))


func _get_reader_toggle_shortcut_string() -> String:
	return _normalize_reader_shortcut_string(String(get_setting("reader_toggle_source_shortcut", DEFAULT_READER_TOGGLE_SHORTCUT)))


func _persist_reader_setting(key: String, value) -> void:
	if _settings_panel and _settings_panel.has_method("set_setting"):
		_settings_panel.set_setting(key, value)


func _toggle_reader_render_mode() -> void:
	var next_mode := "source" if _get_reader_render_mode_setting() == "render" else "render"
	_persist_reader_setting("reader_render_mode", next_mode)
	_sync_reader_controls_from_settings()
	_show_reader_toast("Reader blocks switched to %s mode." % ("source" if next_mode == "source" else "render"))


func _on_reader_media_scale_slider_changed(value: float) -> void:
	_persist_reader_setting("reader_media_scale", value)
	_sync_reader_controls_from_settings()


func _normalize_reader_shortcut_string(raw_value: String) -> String:
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


func _event_to_shortcut_string(event: InputEventKey) -> String:
	var key_text := OS.get_keycode_string(event.keycode).strip_edges()
	if key_text.is_empty():
		key_text = OS.get_keycode_string(event.physical_keycode).strip_edges()
	if key_text.is_empty():
		return ""

	var parts: PackedStringArray = PackedStringArray()
	if event.ctrl_pressed:
		parts.append("Ctrl")
	if event.alt_pressed:
		parts.append("Alt")
	if event.shift_pressed:
		parts.append("Shift")
	if event.meta_pressed:
		parts.append("Meta")
	parts.append(key_text.to_upper())
	return "+".join(parts)


func _matches_reader_toggle_shortcut(event: InputEventKey) -> bool:
	return _event_to_shortcut_string(event) == _get_reader_toggle_shortcut_string()


func _handle_reader_zoom_shortcut(event: InputEventKey) -> bool:
	if not _is_reader_zoom_shortcut(event):
		return false
	if _reader_is_locked:
		_show_reader_toast("Unlock the reader to adjust zoom with the keyboard.", "warning")
		return true

	match event.keycode:
		KEY_EQUAL, KEY_PLUS, KEY_KP_ADD:
			_zoom_reader(0.1)
			_show_reader_toast("Reader zoom set to %s." % _reader_zoom_label.text)
		KEY_MINUS, KEY_KP_SUBTRACT:
			_zoom_reader(-0.1)
			_show_reader_toast("Reader zoom set to %s." % _reader_zoom_label.text)
		KEY_0, KEY_KP_0:
			_reader_current_zoom = 1.0
			_apply_reader_zoom()
			_show_reader_toast("Reader zoom reset to 100%.")
		_:
			return false
	return true


func _is_reader_zoom_shortcut(event: InputEventKey) -> bool:
	var has_zoom_modifier := event.ctrl_pressed or event.meta_pressed
	if not has_zoom_modifier or event.alt_pressed:
		return false
	match event.keycode:
		KEY_EQUAL, KEY_PLUS, KEY_KP_ADD, KEY_MINUS, KEY_KP_SUBTRACT, KEY_0, KEY_KP_0:
			return true
		_:
			return false

func _start_reader_document_render(raw_content: String, note_filepath: String) -> void:
	_reader_debug_mermaid_export_counter = 0
	_reader_render_revision += 1
	var render_revision := _reader_render_revision
	_render_reader_document_async(raw_content, note_filepath, render_revision)

func _start_reader_blocks_render(blocks: Array, note_filepath: String, target_block_id: int = -1) -> void:
	_reader_debug_mermaid_export_counter = 0
	_reader_render_revision += 1
	var render_revision := _reader_render_revision
	_render_reader_blocks_async(blocks, note_filepath, render_revision, target_block_id)

func _render_reader_document_async(raw_content: String, note_filepath: String, render_revision: int) -> void:
	var blocks := _parse_markdown_blocks(raw_content)
	_render_reader_blocks_async(blocks, note_filepath, render_revision, -1)

func _render_reader_blocks_async(blocks: Array, note_filepath: String, render_revision: int, target_block_id: int = -1) -> void:
	if not _reader_blocks:
		return

	_clear_reader_blocks()
	_reader_blocks.add_child(_make_reader_notice_block("Rendering note content..."))
	await get_tree().process_frame
	if render_revision != _reader_render_revision or not _reader_blocks:
		return

	_clear_reader_blocks()
	if blocks.is_empty():
		_reader_blocks.add_child(_make_reader_notice_block("No note content is available for this node yet."))
		_apply_reader_zoom()
		call_deferred("_reset_reader_scroll")
		return

	var target_control: Control = null
	for block_variant in blocks:
		if render_revision != _reader_render_revision or not _reader_blocks:
			return
		var block: Dictionary = block_variant if block_variant is Dictionary else {}
		if block.is_empty():
			continue
		var control_variant = await _build_reader_block_async(block, note_filepath, render_revision)
		if render_revision != _reader_render_revision or not _reader_blocks:
			return
		var control := control_variant as Control
		if control:
			_reader_blocks.add_child(control)
			_apply_reader_zoom_recursive(control)
			control.update_minimum_size()
			var protocol_block_id := int(block.get("_protocol_block_id", -1))
			if protocol_block_id >= 0:
				control.set_meta("protocol_block_id", protocol_block_id)
				if target_block_id >= 0 and protocol_block_id == target_block_id and target_control == null:
					target_control = control

	_apply_reader_zoom()
	if target_control:
		call_deferred("_focus_reader_block_control", target_control)
	else:
		call_deferred("_reset_reader_scroll")

func _focus_reader_block_control(target_control: Control) -> void:
	if _reader_scroll == null or target_control == null:
		_reset_reader_scroll()
		return
	var content_top := _reader_blocks.global_position.y if _reader_blocks else 0.0
	var target_top := target_control.global_position.y - content_top
	var desired_scroll := maxi(0.0, target_top - (_reader_scroll.size.y * 0.35))
	_reader_scroll.scroll_vertical = int(desired_scroll)


func _clear_reader_blocks() -> void:
	_reader_renderable_blocks.clear()
	_set_reader_status(_build_reader_status_hint())
	if not _reader_blocks:
		return
	for child in _reader_blocks.get_children():
		child.queue_free()


func _build_reader_block_async(block: Dictionary, note_filepath: String, render_revision: int) -> Control:
	var block_type := String(block.get("type", "paragraph"))
	if block_type == "math":
		return await _build_reader_math_block_async(String(block.get("text", "")), render_revision)
	if block_type == "code":
		var language := String(block.get("language", "")).strip_edges().to_lower()
		if language == "mermaid":
			return await _build_reader_mermaid_block_async(
				String(block.get("text", "")),
				note_filepath,
				int(block.get("_protocol_block_id", -1)),
				render_revision
			)
		if language == "math" or language == "latex":
			return await _build_reader_math_block_async(String(block.get("text", "")), render_revision)
	if _block_contains_inline_math(block):
		match block_type:
			"heading":
				return await _build_reader_heading_async(block, render_revision)
			"blockquote":
				return await _build_reader_blockquote_async(block, render_revision)
			"list":
				return await _build_reader_list_async(block, render_revision)
			"table":
				return await _build_reader_table_async(block, render_revision)
			_:
				return await _build_reader_paragraph_async(block, render_revision)
	return _build_reader_block(block, note_filepath)


func _build_reader_heading_async(block: Dictionary, render_revision: int) -> Control:
	var level: int = clampi(int(block.get("level", 1)), 1, 6)
	var font_sizes := {1: 32, 2: 28, 3: 24, 4: 21, 5: 18, 6: 16}
	var heading_size: int = int(font_sizes.get(level, 18))
	var heading: RichTextLabel = await _make_reader_markdown_label_async(
		String(block.get("text", "")),
		heading_size,
		Color(0.94, 0.97, 1.0, 1.0),
		render_revision
	)
	if heading == null:
		return null
	return heading


func _build_reader_blockquote_async(block: Dictionary, render_revision: int) -> Control:
	var quote_panel := PanelContainer.new()
	var quote_style := StyleBoxFlat.new()
	quote_style.bg_color = Color(0.09, 0.13, 0.18, 0.96)
	quote_style.border_color = Color(0.43, 0.59, 0.82, 0.95)
	quote_style.border_width_left = 4
	quote_style.corner_radius_top_left = 10
	quote_style.corner_radius_top_right = 10
	quote_style.corner_radius_bottom_left = 10
	quote_style.corner_radius_bottom_right = 10
	quote_panel.add_theme_stylebox_override("panel", quote_style)
	var quote_margin := MarginContainer.new()
	quote_margin.add_theme_constant_override("margin_left", 14)
	quote_margin.add_theme_constant_override("margin_top", 12)
	quote_margin.add_theme_constant_override("margin_right", 14)
	quote_margin.add_theme_constant_override("margin_bottom", 12)
	quote_panel.add_child(quote_margin)
	var quote_styles: Dictionary = {"italic": true}
	var quote_label: RichTextLabel = await _make_reader_markdown_label_async(
		String(block.get("text", "")),
		16,
		Color(0.86, 0.91, 0.98, 1.0),
		render_revision,
		quote_styles
	)
	if quote_label == null:
		return null
	quote_margin.add_child(quote_label)
	return quote_panel


func _build_reader_list_async(block: Dictionary, render_revision: int) -> Control:
	var list_box := VBoxContainer.new()
	list_box.add_theme_constant_override("separation", 8)
	var items_variant = block.get("items", [])
	var items: Array = items_variant if items_variant is Array else []
	var ordered := bool(block.get("ordered", false))
	for item_index in range(items.size()):
		if render_revision != _reader_render_revision:
			return null
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 8)
		var item_data: Dictionary = items[item_index] if items[item_index] is Dictionary else {"text": String(items[item_index])}
		var task_state := String(item_data.get("task_state", ""))
		var marker := Label.new()
		marker.text = "%d." % (item_index + 1) if ordered else ("[x]" if task_state == "done" else ("[ ]" if task_state == "todo" else "-"))
		marker.custom_minimum_size = Vector2(34, 0)
		marker.add_theme_font_size_override("font_size", 16)
		marker.add_theme_color_override("font_color", Color(0.78, 0.86, 0.98, 0.95) if task_state != "done" else Color(0.58, 0.68, 0.8, 0.95))
		marker.set_meta("reader_base_font_size", 16)
		row.add_child(marker)
		var item_styles: Dictionary = {}
		if task_state == "done":
			item_styles["dim"] = true
		var item_label: RichTextLabel = await _make_reader_markdown_label_async(
			String(item_data.get("text", "")),
			16,
			Color(0.86, 0.9, 0.97, 1.0),
			render_revision,
			item_styles
		)
		if item_label == null:
			return null
		item_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(item_label)
		list_box.add_child(row)
	return list_box


func _build_reader_table_async(block: Dictionary, render_revision: int) -> Control:
	var wrapper := PanelContainer.new()
	var wrapper_style := StyleBoxFlat.new()
	wrapper_style.bg_color = Color(0.07, 0.09, 0.13, 0.97)
	wrapper_style.border_color = Color(0.2, 0.31, 0.45, 1.0)
	wrapper_style.border_width_left = 1
	wrapper_style.border_width_top = 1
	wrapper_style.border_width_right = 1
	wrapper_style.border_width_bottom = 1
	wrapper_style.corner_radius_top_left = 12
	wrapper_style.corner_radius_top_right = 12
	wrapper_style.corner_radius_bottom_left = 12
	wrapper_style.corner_radius_bottom_right = 12
	wrapper.add_theme_stylebox_override("panel", wrapper_style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 10)
	wrapper.add_child(margin)
	var rows_box := VBoxContainer.new()
	rows_box.add_theme_constant_override("separation", 4)
	margin.add_child(rows_box)
	var headers_variant = block.get("headers", [])
	var headers: Array = headers_variant if headers_variant is Array else []
	if not headers.is_empty():
		var header_row: Control = await _create_reader_table_row_async(headers, true, render_revision)
		if header_row == null:
			return null
		rows_box.add_child(header_row)
	var rows_variant = block.get("rows", [])
	var rows: Array = rows_variant if rows_variant is Array else []
	for row_variant in rows:
		if render_revision != _reader_render_revision:
			return null
		var row_values: Array = row_variant if row_variant is Array else []
		var table_row: Control = await _create_reader_table_row_async(row_values, false, render_revision)
		if table_row == null:
			return null
		rows_box.add_child(table_row)
	return wrapper


func _create_reader_table_row_async(values: Array, is_header: bool, render_revision: int) -> Control:
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 4)
	for value in values:
		if render_revision != _reader_render_revision:
			return null
		var cell: Control = await _create_reader_table_cell_async(String(value), is_header, render_revision)
		if cell == null:
			return null
		row.add_child(cell)
	return row


func _create_reader_table_cell_async(cell_text: String, is_header: bool, render_revision: int) -> Control:
	var cell := PanelContainer.new()
	cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cell.custom_minimum_size = Vector2(110, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.14, 0.18, 0.24, 0.98) if is_header else Color(0.09, 0.12, 0.17, 0.96)
	style.border_color = Color(0.3, 0.42, 0.58, 1.0) if is_header else Color(0.18, 0.28, 0.4, 1.0)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	cell.add_theme_stylebox_override("panel", style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 8)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 8)
	margin.add_theme_constant_override("margin_bottom", 8)
	cell.add_child(margin)
	var cell_styles: Dictionary = {}
	if is_header:
		cell_styles["bold"] = true
	var cell_label: RichTextLabel = await _make_reader_markdown_label_async(
		cell_text,
		14 if not is_header else 15,
		Color(0.9, 0.95, 1.0, 1.0),
		render_revision,
		cell_styles
	)
	if cell_label == null:
		return null
	margin.add_child(cell_label)
	return cell


func _build_reader_paragraph_async(block: Dictionary, render_revision: int) -> Control:
	var paragraph_label: RichTextLabel = await _make_reader_markdown_label_async(
		String(block.get("text", "")),
		16,
		Color(0.86, 0.9, 0.97, 1.0),
		render_revision
	)
	return paragraph_label


func _block_contains_inline_math(block: Dictionary) -> bool:
	var block_type := String(block.get("type", "paragraph"))
	match block_type:
		"heading", "blockquote", "paragraph":
			return _contains_inline_math(String(block.get("text", "")))
		"list":
			var items_variant = block.get("items", [])
			var items: Array = items_variant if items_variant is Array else []
			for item_variant in items:
				var item_data: Dictionary = item_variant if item_variant is Dictionary else {"text": String(item_variant)}
				if _contains_inline_math(String(item_data.get("text", ""))):
					return true
			return false
		"table":
			var headers_variant = block.get("headers", [])
			var headers: Array = headers_variant if headers_variant is Array else []
			for header_value in headers:
				if _contains_inline_math(String(header_value)):
					return true
			var rows_variant = block.get("rows", [])
			var rows: Array = rows_variant if rows_variant is Array else []
			for row_variant in rows:
				var row_values: Array = row_variant if row_variant is Array else []
				for cell_value in row_values:
					if _contains_inline_math(String(cell_value)):
						return true
			return false
		_:
			return false

func _build_reader_math_block_async(source_text: String, render_revision: int) -> Control:
	var accent_color := Color(0.42, 0.62, 0.96, 1.0)
	var normalized_source := source_text.strip_edges()
	if normalized_source.is_empty():
		return _build_reader_renderable_block(
			"Math",
			"",
			_make_reader_notice_block("Formula block is empty."),
			null,
			accent_color
		)
	if _reader_render_client == null:
		return _build_reader_renderable_block("Math", normalized_source, _build_reader_math_block(normalized_source), null, accent_color)

	var max_size: Vector2 = _get_reader_math_display_max_size()
	var result: Dictionary = await _reader_render_client.render_math_texture(normalized_source, true, READER_DISPLAY_MATH_RENDER_SCALE, max_size)
	if render_revision != _reader_render_revision:
		return null
	if bool(result.get("ok", false)):
		var texture := result.get("texture", null) as Texture2D
		if texture:
			var render_panel := _build_reader_svg_panel(texture, "", "Formula", max_size, accent_color)
			return _build_reader_renderable_block("Math", normalized_source, render_panel, texture, accent_color)
	return _build_reader_renderable_block(
		"Math",
		normalized_source,
		_build_reader_render_failure_block(
			"Math rendering is temporarily unavailable.",
			normalized_source,
			String(result.get("error", "Unknown math render error.")),
			true
		),
		null,
		accent_color
	)


func _build_reader_mermaid_block_async(source_text: String, note_filepath: String, block_id: int, render_revision: int) -> Control:
	var accent_color := Color(0.38, 0.82, 0.7, 1.0)
	var normalized_source := source_text.strip_edges()
	if normalized_source.is_empty():
		return _build_reader_renderable_block(
			"Mermaid",
			"",
			_make_reader_notice_block("Mermaid block is empty."),
			null,
			accent_color
		)
	if _reader_render_client == null:
		return _build_reader_renderable_block("Mermaid", normalized_source, _build_mermaid_fallback_block(normalized_source), null, accent_color)

	var max_size: Vector2 = _get_reader_mermaid_display_max_size()
	var result: Dictionary = await _reader_render_client.render_mermaid_texture(normalized_source, 3.0, max_size)
	if render_revision != _reader_render_revision:
		return null
	if bool(result.get("ok", false)):
		var texture := result.get("texture", null) as Texture2D
		if texture:
			_export_reader_mermaid_block_debug_artifacts(normalized_source, texture, note_filepath, block_id)
			var render_panel := _build_reader_svg_panel(texture, "", "Mermaid Diagram", max_size, accent_color)
			return _build_reader_renderable_block("Mermaid", normalized_source, render_panel, texture, accent_color)
	return _build_reader_renderable_block(
		"Mermaid",
		normalized_source,
		_build_reader_render_failure_block(
			"Mermaid rendering is temporarily unavailable.",
			normalized_source,
			String(result.get("error", "Unknown Mermaid render error.")),
			false
		),
		null,
		accent_color
	)


func _build_reader_svg_panel(texture: Texture2D, badge_text: String, viewer_title: String, max_size: Vector2, accent_color: Color) -> Control:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.focus_mode = Control.FOCUS_NONE
	panel.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.038, 0.042, 0.052, 0.985)
	style.border_color = accent_color
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 14
	style.corner_radius_top_right = 14
	style.corner_radius_bottom_left = 14
	style.corner_radius_bottom_right = 14
	panel.add_theme_stylebox_override("panel", style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 12)
	panel.add_child(margin)
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	box.add_theme_constant_override("separation", 10)
	margin.add_child(box)
	if not badge_text.is_empty():
		var badge := Label.new()
		badge.text = badge_text
		badge.add_theme_font_size_override("font_size", 12)
		badge.add_theme_color_override("font_color", accent_color)
		badge.set_meta("reader_base_font_size", 12)
		badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(badge)
	var texture_rect := TextureRect.new()
	texture_rect.texture = texture
	texture_rect.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	texture_rect.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	# Allow custom_minimum_size-driven downscaling instead of clamping to source texture dimensions.
	texture_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	texture_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var resolved_max_size: Vector2 = _resolve_reader_requested_media_limit(max_size)
	var preview_size: Vector2 = _fit_size_within(Vector2(texture.get_width(), texture.get_height()), resolved_max_size, true)
	preview_size = _expand_reader_render_preview_size(preview_size, resolved_max_size, viewer_title)
	texture_rect.custom_minimum_size = preview_size
	# Scale from the already page-fitted preview size so the media slider
	# actually changes visible size instead of being absorbed by max-size clamping.
	texture_rect.set_meta("reader_base_size", preview_size)
	texture_rect.set_meta("reader_max_size", max_size)
	texture_rect.set_meta("reader_media_scalable", true)
	texture_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(texture_rect)
	var hint := Label.new()
	hint.text = "Click to inspect and resize"
	hint.add_theme_font_size_override("font_size", 11)
	hint.add_theme_color_override("font_color", Color(0.66, 0.75, 0.9, 0.88))
	hint.set_meta("reader_base_font_size", 11)
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(hint)
	panel.gui_input.connect(func(event: InputEvent):
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			panel.accept_event()
			if not event.pressed:
				open_image_viewer(texture, viewer_title)
	)
	return panel


func _build_reader_renderable_block(kind: String, source_text: String, render_content: Control, texture: Texture2D, accent_color: Color) -> Control:
	var wrapper := PanelContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var wrapper_style := StyleBoxFlat.new()
	wrapper_style.bg_color = Color(0.04, 0.07, 0.11, 0.97)
	wrapper_style.border_color = accent_color
	wrapper_style.border_width_left = 1
	wrapper_style.border_width_top = 1
	wrapper_style.border_width_right = 1
	wrapper_style.border_width_bottom = 1
	wrapper_style.corner_radius_top_left = 14
	wrapper_style.corner_radius_top_right = 14
	wrapper_style.corner_radius_bottom_left = 14
	wrapper_style.corner_radius_bottom_right = 14
	wrapper.add_theme_stylebox_override("panel", wrapper_style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	wrapper.add_child(margin)
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	box.add_theme_constant_override("separation", 10)
	margin.add_child(box)

	var header_row := HBoxContainer.new()
	header_row.add_theme_constant_override("separation", 8)
	box.add_child(header_row)

	var badge := Label.new()
	badge.text = kind.to_upper()
	badge.add_theme_font_size_override("font_size", 11)
	badge.add_theme_color_override("font_color", accent_color)
	badge.set_meta("reader_base_font_size", 11)
	header_row.add_child(badge)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_row.add_child(spacer)

	var mode_badge_panel := PanelContainer.new()
	var mode_badge_style := StyleBoxFlat.new()
	mode_badge_style.bg_color = Color(0.12, 0.18, 0.28, 0.98)
	mode_badge_style.border_color = accent_color
	mode_badge_style.border_width_left = 1
	mode_badge_style.border_width_top = 1
	mode_badge_style.border_width_right = 1
	mode_badge_style.border_width_bottom = 1
	mode_badge_style.corner_radius_top_left = 11
	mode_badge_style.corner_radius_top_right = 11
	mode_badge_style.corner_radius_bottom_left = 11
	mode_badge_style.corner_radius_bottom_right = 11
	mode_badge_panel.add_theme_stylebox_override("panel", mode_badge_style)
	var mode_badge_margin := MarginContainer.new()
	mode_badge_margin.add_theme_constant_override("margin_left", 8)
	mode_badge_margin.add_theme_constant_override("margin_top", 4)
	mode_badge_margin.add_theme_constant_override("margin_right", 8)
	mode_badge_margin.add_theme_constant_override("margin_bottom", 4)
	mode_badge_panel.add_child(mode_badge_margin)
	var mode_badge_label := Label.new()
	mode_badge_label.add_theme_font_size_override("font_size", 10)
	mode_badge_label.add_theme_color_override("font_color", Color(0.9, 0.95, 1.0, 1.0))
	mode_badge_margin.add_child(mode_badge_label)
	header_row.add_child(mode_badge_panel)

	var mode_button := Button.new()
	mode_button.focus_mode = Control.FOCUS_NONE
	mode_button.pressed.connect(_toggle_reader_render_mode)
	header_row.add_child(mode_button)
	_apply_button_style(mode_button, Color(0.12, 0.16, 0.22, 1.0), Color(0.18, 0.24, 0.32, 1.0), Color(0.08, 0.11, 0.17, 1.0), accent_color, Color(0.95, 0.97, 1.0, 1.0))

	var copy_button := Button.new()
	copy_button.focus_mode = Control.FOCUS_NONE
	header_row.add_child(copy_button)
	_apply_button_style(copy_button, Color(0.18, 0.15, 0.11, 1.0), Color(0.26, 0.21, 0.15, 1.0), Color(0.13, 0.1, 0.07, 1.0), Color(0.92, 0.71, 0.3, 1.0), Color(1.0, 0.97, 0.9, 1.0))

	var render_holder := VBoxContainer.new()
	render_holder.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	render_holder.add_child(render_content)
	box.add_child(render_holder)

	var source_panel := PanelContainer.new()
	source_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var source_style := StyleBoxFlat.new()
	source_style.bg_color = Color(0.03, 0.05, 0.08, 0.98)
	source_style.border_color = Color(0.18, 0.26, 0.38, 1.0)
	source_style.border_width_left = 1
	source_style.border_width_top = 1
	source_style.border_width_right = 1
	source_style.border_width_bottom = 1
	source_style.corner_radius_top_left = 10
	source_style.corner_radius_top_right = 10
	source_style.corner_radius_bottom_left = 10
	source_style.corner_radius_bottom_right = 10
	source_panel.add_theme_stylebox_override("panel", source_style)
	var source_margin := MarginContainer.new()
	source_margin.add_theme_constant_override("margin_left", 10)
	source_margin.add_theme_constant_override("margin_top", 10)
	source_margin.add_theme_constant_override("margin_right", 10)
	source_margin.add_theme_constant_override("margin_bottom", 10)
	source_panel.add_child(source_margin)
	var source_edit := TextEdit.new()
	source_edit.editable = false
	source_edit.wrap_mode = TextEdit.LINE_WRAPPING_NONE
	source_edit.custom_minimum_size = Vector2(0, 180)
	source_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	source_edit.text = source_text
	source_edit.set_meta("reader_base_font_size", 14)
	source_margin.add_child(source_edit)
	box.add_child(source_panel)

	var record: Dictionary = {
		"wrapper": wrapper,
		"render_holder": render_holder,
		"source_holder": source_panel,
		"mode_button": mode_button,
        "mode_badge": mode_badge_label,
        "mode_badge_style": mode_badge_style,
        "copy_button": copy_button,
		"source_text": source_text,
		"texture": texture,
		"kind": kind
	}
	_reader_renderable_blocks.append(record)
	copy_button.pressed.connect(func():
		copy_button.disabled = true
		await _copy_reader_renderable_block(record)
		copy_button.disabled = false
		_apply_reader_renderable_block_mode(record, _get_reader_render_mode_setting())
	)
	_apply_reader_renderable_block_mode(record, _get_reader_render_mode_setting())
	return _wrap_reader_centered_block(wrapper)


func _apply_reader_renderable_block_mode(record: Dictionary, mode: String) -> void:
	var render_holder := record.get("render_holder", null) as Control
	var source_holder := record.get("source_holder", null) as Control
	var wrapper := record.get("wrapper", null) as Control
	var is_source_mode := mode == "source"
	if render_holder:
		render_holder.visible = not is_source_mode
	if source_holder:
		source_holder.visible = is_source_mode
		source_holder.size_flags_horizontal = Control.SIZE_EXPAND_FILL if is_source_mode else Control.SIZE_SHRINK_CENTER
		source_holder.custom_minimum_size = Vector2.ZERO
	if render_holder:
		render_holder.size_flags_horizontal = Control.SIZE_EXPAND_FILL if is_source_mode else Control.SIZE_SHRINK_CENTER
	if wrapper:
		# Source mode benefits from full-width code readability;
		# render mode should shrink with media scaling.
		wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL if is_source_mode else Control.SIZE_SHRINK_CENTER
	var mode_button := record.get("mode_button", null) as Button
	if mode_button:
		mode_button.text = "Mode: %s" % ("Source" if is_source_mode else "Render")
		mode_button.tooltip_text = "Switch %s blocks to %s mode." % [String(record.get("kind", "renderable block")).to_lower(), ("render" if is_source_mode else "source")]
	var mode_badge := record.get("mode_badge", null) as Label
	if mode_badge:
		mode_badge.text = "SOURCE" if is_source_mode else "RENDER"
		mode_badge.add_theme_color_override("font_color", Color(1.0, 0.96, 0.9, 1.0) if is_source_mode else Color(0.9, 0.95, 1.0, 1.0))
	var mode_badge_style := record.get("mode_badge_style", null) as StyleBoxFlat
	if mode_badge_style:
		if is_source_mode:
			mode_badge_style.bg_color = Color(0.28, 0.18, 0.08, 0.98)
			mode_badge_style.border_color = Color(0.96, 0.72, 0.26, 1.0)
		else:
			mode_badge_style.bg_color = Color(0.12, 0.18, 0.28, 0.98)
			mode_badge_style.border_color = Color(0.4, 0.65, 0.96, 1.0)
	var copy_button := record.get("copy_button", null) as Button
	if copy_button:
		var texture := record.get("texture", null) as Texture2D
		var use_image_copy := not is_source_mode and texture != null
		copy_button.text = "Copy PNG" if use_image_copy else "Copy Code"
		copy_button.tooltip_text = "Copy the rendered image." if use_image_copy else "Copy the source text."

func _copy_reader_renderable_block(record: Dictionary) -> void:
	var kind := String(record.get("kind", "Block"))
	var mode := _get_reader_render_mode_setting()
	var source_text := String(record.get("source_text", ""))
	var texture := record.get("texture", null) as Texture2D
	if mode == "source" or texture == null or _reader_render_client == null:
		DisplayServer.clipboard_set(source_text)
		_show_reader_toast("%s source copied to the clipboard." % kind, "success")
		return

	var result: Dictionary = await _reader_render_client.copy_texture_to_clipboard(texture)
	if bool(result.get("ok", false)):
		_show_reader_toast("%s image copied to the clipboard." % kind, "success")
		return

	DisplayServer.clipboard_set(source_text)
	_show_reader_toast("Image copy failed for %s. The source text was copied instead." % kind, "warning")

func _build_reader_render_failure_block(title: String, source_text: String, error_message: String, use_math_fallback: bool) -> Control:
	var wrapper := VBoxContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	wrapper.add_theme_constant_override("separation", 10)
	var notice_text := title
	if _is_reader_debug_enabled():
		var normalized_error := error_message.strip_edges()
		if not normalized_error.is_empty():
			notice_text = "%s\n\n%s" % [title, normalized_error]
	wrapper.add_child(_make_reader_notice_block(notice_text))
	if use_math_fallback:
		wrapper.add_child(_build_reader_math_block(source_text))
	else:
		wrapper.add_child(_build_mermaid_fallback_block(source_text))
	return wrapper


func _reset_reader_scroll() -> void:
	if _reader_scroll:
		_reader_scroll.scroll_vertical = 0
		_reader_scroll.scroll_horizontal = 0


func _resolve_reader_content(node: Dictionary) -> String:
	var content := String(node.get("content", "")).strip_edges()
	if not content.is_empty():
		return content

	var metadata_variant = node.get("metadata", {})
	var metadata: Dictionary = metadata_variant if metadata_variant is Dictionary else {}
	var filepath := String(metadata.get("filepath", node.get("filepath", ""))).strip_edges()
	if filepath.is_empty():
		return "No note content is available for this node yet."

	var file := FileAccess.open(filepath, FileAccess.READ)
	if file == null:
		return "Unable to load the source note.\n\n%s" % filepath

	var loaded_content := file.get_as_text()
	file.close()
	if loaded_content.strip_edges().is_empty():
		return "The source note is empty.\n\n%s" % filepath

	return loaded_content


func _build_reader_block(block: Dictionary, note_filepath: String) -> Control:
	var block_type := String(block.get("type", "paragraph"))
	match block_type:
		"heading":
			var heading := Label.new()
			heading.text = String(block.get("text", ""))
			heading.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var level: int = clampi(int(block.get("level", 1)), 1, 6)
			var font_sizes := {1: 32, 2: 28, 3: 24, 4: 21, 5: 18, 6: 16}
			var heading_size := int(font_sizes.get(level, 18))
			heading.add_theme_font_size_override("font_size", heading_size)
			heading.add_theme_color_override("font_color", Color(0.94, 0.97, 1.0, 1.0))
			heading.set_meta("reader_base_font_size", heading_size)
			return heading
		"blockquote":
			var quote_panel := PanelContainer.new()
			var quote_style := StyleBoxFlat.new()
			quote_style.bg_color = Color(0.09, 0.13, 0.18, 0.96)
			quote_style.border_color = Color(0.43, 0.59, 0.82, 0.95)
			quote_style.border_width_left = 4
			quote_style.corner_radius_top_left = 10
			quote_style.corner_radius_top_right = 10
			quote_style.corner_radius_bottom_left = 10
			quote_style.corner_radius_bottom_right = 10
			quote_panel.add_theme_stylebox_override("panel", quote_style)
			var quote_margin := MarginContainer.new()
			quote_margin.add_theme_constant_override("margin_left", 14)
			quote_margin.add_theme_constant_override("margin_top", 12)
			quote_margin.add_theme_constant_override("margin_right", 14)
			quote_margin.add_theme_constant_override("margin_bottom", 12)
			quote_panel.add_child(quote_margin)
			var quote_label := _make_reader_rich_text("[i]%s[/i]" % _markdown_to_bbcode(String(block.get("text", ""))), 16, Color(0.86, 0.91, 0.98, 1.0), true)
			quote_margin.add_child(quote_label)
			return quote_panel
		"list":
			var list_box := VBoxContainer.new()
			list_box.add_theme_constant_override("separation", 8)
			var items_variant = block.get("items", [])
			var items: Array = items_variant if items_variant is Array else []
			var ordered := bool(block.get("ordered", false))
			for item_index in range(items.size()):
				var row := HBoxContainer.new()
				row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row.add_theme_constant_override("separation", 8)
				var item_data: Dictionary = items[item_index] if items[item_index] is Dictionary else {"text": String(items[item_index])}
				var task_state := String(item_data.get("task_state", ""))
				var marker := Label.new()
				marker.text = "%d." % (item_index + 1) if ordered else ("[x]" if task_state == "done" else ("[ ]" if task_state == "todo" else "-"))
				marker.custom_minimum_size = Vector2(34, 0)
				marker.add_theme_font_size_override("font_size", 16)
				marker.add_theme_color_override("font_color", Color(0.78, 0.86, 0.98, 0.95) if task_state != "done" else Color(0.58, 0.68, 0.8, 0.95))
				marker.set_meta("reader_base_font_size", 16)
				row.add_child(marker)
				var item_bbcode := _markdown_to_bbcode(String(item_data.get("text", "")))
				if task_state == "done":
					item_bbcode = "[color=#8da1b8]%s[/color]" % item_bbcode
				var item_label := _make_reader_rich_text(item_bbcode, 16, Color(0.86, 0.9, 0.97, 1.0), true)
				item_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row.add_child(item_label)
				list_box.add_child(row)
			return list_box
		"table":
			return _build_reader_table(block)
		"math":
			return _build_reader_math_block(String(block.get("text", "")))
		"code":
			var code_panel := PanelContainer.new()
			var code_style := StyleBoxFlat.new()
			code_style.bg_color = Color(0.04, 0.06, 0.09, 0.98)
			code_style.border_color = Color(0.19, 0.28, 0.4, 1.0)
			code_style.border_width_left = 1
			code_style.border_width_top = 1
			code_style.border_width_right = 1
			code_style.border_width_bottom = 1
			code_style.corner_radius_top_left = 12
			code_style.corner_radius_top_right = 12
			code_style.corner_radius_bottom_left = 12
			code_style.corner_radius_bottom_right = 12
			code_panel.add_theme_stylebox_override("panel", code_style)
			var code_margin := MarginContainer.new()
			code_margin.add_theme_constant_override("margin_left", 14)
			code_margin.add_theme_constant_override("margin_top", 12)
			code_margin.add_theme_constant_override("margin_right", 14)
			code_margin.add_theme_constant_override("margin_bottom", 12)
			code_panel.add_child(code_margin)
			var code_box := VBoxContainer.new()
			code_box.add_theme_constant_override("separation", 8)
			code_margin.add_child(code_box)
			var language := String(block.get("language", "")).strip_edges()
			if not language.is_empty():
				var language_label := Label.new()
				language_label.text = language.to_upper()
				language_label.add_theme_font_size_override("font_size", 11)
				language_label.add_theme_color_override("font_color", Color(0.55, 0.72, 1.0, 0.92))
				language_label.set_meta("reader_base_font_size", 11)
				code_box.add_child(language_label)
				if language == "mermaid":
					code_box.add_child(_build_mermaid_fallback_block(String(block.get("text", ""))))
				elif language == "math" or language == "latex":
					code_box.add_child(_build_reader_math_block(String(block.get("text", ""))))
			var code_label := _make_reader_rich_text(String(block.get("text", "")), 14, Color(0.88, 0.92, 0.98, 1.0), false)
			code_label.autowrap_mode = TextServer.AUTOWRAP_OFF
			code_box.add_child(code_label)
			return code_panel
		"image":
			var image_source := String(block.get("path", "")).strip_edges()
			var alt_text := String(block.get("alt", "")).strip_edges()
			var resolved_path := _resolve_reader_asset_path(image_source, note_filepath)
			if resolved_path.begins_with("http://") or resolved_path.begins_with("https://"):
				return _make_reader_notice_block("Remote image preview is not supported in the native Godot reader yet.\n\n%s" % resolved_path)
			var texture := _load_reader_texture(resolved_path)
			if texture == null:
				return _make_reader_notice_block("Image preview unavailable.\n\n%s" % image_source)
			var image_panel := PanelContainer.new()
			image_panel.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			image_panel.mouse_filter = Control.MOUSE_FILTER_STOP
			image_panel.focus_mode = Control.FOCUS_NONE
			image_panel.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
			var image_style := StyleBoxFlat.new()
			image_style.bg_color = Color(0.038, 0.042, 0.052, 0.985)
			image_style.border_color = Color(0.18, 0.26, 0.38, 1.0)
			image_style.border_width_left = 1
			image_style.border_width_top = 1
			image_style.border_width_right = 1
			image_style.border_width_bottom = 1
			image_style.corner_radius_top_left = 12
			image_style.corner_radius_top_right = 12
			image_style.corner_radius_bottom_left = 12
			image_style.corner_radius_bottom_right = 12
			image_panel.add_theme_stylebox_override("panel", image_style)
			var image_margin := MarginContainer.new()
			image_margin.add_theme_constant_override("margin_left", 10)
			image_margin.add_theme_constant_override("margin_top", 10)
			image_margin.add_theme_constant_override("margin_right", 10)
			image_margin.add_theme_constant_override("margin_bottom", 10)
			image_panel.add_child(image_margin)
			var image_box := VBoxContainer.new()
			image_box.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			image_box.add_theme_constant_override("separation", 8)
			image_margin.add_child(image_box)
			var texture_rect := TextureRect.new()
			texture_rect.texture = texture
			texture_rect.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			texture_rect.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			# Allow custom_minimum_size-driven downscaling instead of clamping to source texture dimensions.
			texture_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			texture_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			var image_max_size: Vector2 = Vector2.ZERO
			var preview_size: Vector2 = _fit_size_within(Vector2(texture.get_width(), texture.get_height()), _resolve_reader_requested_media_limit(image_max_size), false)
			texture_rect.custom_minimum_size = preview_size
			# Use preview size as scaling baseline so slider adjustments are visible.
			texture_rect.set_meta("reader_base_size", preview_size)
			texture_rect.set_meta("reader_max_size", image_max_size)
			texture_rect.set_meta("reader_media_scalable", true)
			texture_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
			image_box.add_child(texture_rect)
			if not alt_text.is_empty():
				var caption := Label.new()
				caption.text = alt_text
				caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				caption.add_theme_font_size_override("font_size", 13)
				caption.add_theme_color_override("font_color", Color(0.72, 0.79, 0.9, 0.95))
				caption.set_meta("reader_base_font_size", 13)
				image_box.add_child(caption)
			image_panel.gui_input.connect(func(event: InputEvent):
				if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
					image_panel.accept_event()
					if not event.pressed:
						open_image_viewer(texture, alt_text if not alt_text.is_empty() else image_source)
			)
			return _wrap_reader_centered_block(image_panel)
		"rule":
			return HSeparator.new()
		_:
			return _make_reader_rich_text(_markdown_to_bbcode(String(block.get("text", ""))), 16, Color(0.86, 0.9, 0.97, 1.0), true)

func _build_reader_table(block: Dictionary) -> Control:
	var wrapper := PanelContainer.new()
	var wrapper_style := StyleBoxFlat.new()
	wrapper_style.bg_color = Color(0.07, 0.09, 0.13, 0.97)
	wrapper_style.border_color = Color(0.2, 0.31, 0.45, 1.0)
	wrapper_style.border_width_left = 1
	wrapper_style.border_width_top = 1
	wrapper_style.border_width_right = 1
	wrapper_style.border_width_bottom = 1
	wrapper_style.corner_radius_top_left = 12
	wrapper_style.corner_radius_top_right = 12
	wrapper_style.corner_radius_bottom_left = 12
	wrapper_style.corner_radius_bottom_right = 12
	wrapper.add_theme_stylebox_override("panel", wrapper_style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 10)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 10)
	margin.add_theme_constant_override("margin_bottom", 10)
	wrapper.add_child(margin)
	var rows_box := VBoxContainer.new()
	rows_box.add_theme_constant_override("separation", 4)
	margin.add_child(rows_box)
	var headers_variant = block.get("headers", [])
	var headers: Array = headers_variant if headers_variant is Array else []
	if not headers.is_empty():
		rows_box.add_child(_create_reader_table_row(headers, true))
	var rows_variant = block.get("rows", [])
	var rows: Array = rows_variant if rows_variant is Array else []
	for row_variant in rows:
		var row_values: Array = row_variant if row_variant is Array else []
		rows_box.add_child(_create_reader_table_row(row_values, false))
	return wrapper


func _create_reader_table_row(values: Array, is_header: bool) -> Control:
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 4)
	for value in values:
		row.add_child(_create_reader_table_cell(String(value), is_header))
	return row


func _create_reader_table_cell(cell_text: String, is_header: bool) -> Control:
	var cell := PanelContainer.new()
	cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cell.custom_minimum_size = Vector2(110, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.14, 0.18, 0.24, 0.98) if is_header else Color(0.09, 0.12, 0.17, 0.96)
	style.border_color = Color(0.3, 0.42, 0.58, 1.0) if is_header else Color(0.18, 0.28, 0.4, 1.0)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	cell.add_theme_stylebox_override("panel", style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 8)
	margin.add_theme_constant_override("margin_top", 8)
	margin.add_theme_constant_override("margin_right", 8)
	margin.add_theme_constant_override("margin_bottom", 8)
	cell.add_child(margin)
	var bbcode_text := _markdown_to_bbcode(cell_text)
	if is_header:
		bbcode_text = "[b]%s[/b]" % bbcode_text
	margin.add_child(_make_reader_rich_text(bbcode_text, 14 if not is_header else 15, Color(0.9, 0.95, 1.0, 1.0), true))
	return cell


func _build_reader_math_block(math_text: String) -> Control:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.1, 0.16, 0.98)
	style.border_color = Color(0.37, 0.49, 0.76, 0.96)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	panel.add_theme_stylebox_override("panel", style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	panel.add_child(margin)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	margin.add_child(box)
	var badge := Label.new()
	badge.text = "Math"
	badge.add_theme_font_size_override("font_size", 11)
	badge.add_theme_color_override("font_color", Color(0.65, 0.78, 1.0, 0.95))
	badge.set_meta("reader_base_font_size", 11)
	box.add_child(badge)
	box.add_child(_make_reader_rich_text(math_text, 16, Color(0.92, 0.95, 1.0, 1.0), false))
	return panel


func _build_mermaid_fallback_block(source_text: String) -> Control:
	var lines := source_text.split("\n")
	var relations: Array[String] = []
	for raw_line in lines:
		var trimmed := String(raw_line).strip_edges()
		if trimmed.is_empty() or trimmed.begins_with("graph") or trimmed.begins_with("flowchart") or trimmed.begins_with("subgraph") or trimmed == "end":
			continue
		var relation := trimmed
		for arrow in ["-.->", "-->", "==>", "---", "-->|"]:
			if trimmed.contains(arrow):
				var parts := trimmed.split(arrow)
				if parts.size() >= 2:
					relation = "%s -> %s" % [String(parts[0]).strip_edges(), String(parts[1]).strip_edges()]
					break
		relations.append(relation)
		if relations.size() >= 6:
			break
	if relations.is_empty():
		return _make_reader_notice_block("Mermaid diagram rendering is not available natively yet. The source block is shown below.")
	return _make_reader_notice_block("Mermaid semantic preview:\n%s" % _join_strings(relations, "\n"))

func _make_reader_notice_block(text: String) -> Control:
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.11, 0.16, 0.95)
	style.border_color = Color(0.25, 0.35, 0.52, 0.96)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 10
	style.corner_radius_top_right = 10
	style.corner_radius_bottom_left = 10
	style.corner_radius_bottom_right = 10
	panel.add_theme_stylebox_override("panel", style)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)
	margin.add_child(_make_reader_rich_text(text, 14, Color(0.8, 0.86, 0.96, 0.98), false))
	return panel


func _make_reader_rich_text(text: String, base_font_size: int, font_color: Color, use_bbcode: bool) -> RichTextLabel:
	var label := RichTextLabel.new()
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.fit_content = true
	label.scroll_active = false
	label.selection_enabled = true
	label.bbcode_enabled = use_bbcode
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_color_override("default_color", font_color)
	label.add_theme_font_size_override("normal_font_size", base_font_size)
	label.add_theme_font_size_override("bold_font_size", base_font_size)
	label.add_theme_font_size_override("italics_font_size", base_font_size)
	label.add_theme_font_size_override("mono_font_size", maxi(10, base_font_size - 1))
	label.set_meta("reader_base_font_size", base_font_size)
	label.meta_clicked.connect(_on_reader_meta_clicked)
	label.text = text
	return label


func _make_reader_markdown_label_async(raw_text: String, base_font_size: int, font_color: Color, render_revision: int, base_styles: Dictionary = {}) -> RichTextLabel:
	if _reader_render_client == null or not _contains_inline_math(raw_text):
		var bbcode_text: String = _markdown_to_bbcode(raw_text)
		if bool(base_styles.get("italic", false)):
			bbcode_text = "[i]%s[/i]" % bbcode_text
		if bool(base_styles.get("bold", false)):
			bbcode_text = "[b]%s[/b]" % bbcode_text
		if bool(base_styles.get("dim", false)):
			bbcode_text = "[color=#8da1b8]%s[/color]" % bbcode_text
		return _make_reader_rich_text(bbcode_text, base_font_size, font_color, true)

	var label: RichTextLabel = _make_reader_rich_text("", base_font_size, font_color, false)
	label.clear()
	var root_styles: Dictionary = _clone_reader_style_dictionary(base_styles)
	var segments: Array = _parse_reader_inline_segments(raw_text, root_styles)
	var completed: bool = await _append_reader_inline_segments_async(label, segments, base_font_size, font_color, render_revision)
	if not completed:
		return null
	return label


func _append_reader_inline_segments_async(label: RichTextLabel, segments: Array, base_font_size: int, font_color: Color, render_revision: int) -> bool:
	for segment_variant in segments:
		if render_revision != _reader_render_revision:
			return false
		var segment: Dictionary = segment_variant if segment_variant is Dictionary else {}
		var segment_type := String(segment.get("type", "text"))
		var segment_text := String(segment.get("text", ""))
		var styles_variant = segment.get("styles", {})
		var styles: Dictionary = styles_variant if styles_variant is Dictionary else {}
		if segment_type == "math":
			segment_text = segment_text.strip_edges()
			if segment_text.is_empty():
				continue
			var display_mode := bool(segment.get("display_mode", false))
			if display_mode:
				label.add_text("\n")
			var render_max_size: Vector2 = _get_reader_math_display_max_size() if display_mode else Vector2.ZERO
			var result: Dictionary = await _reader_render_client.render_math_texture(segment_text, display_mode, READER_DISPLAY_MATH_RENDER_SCALE if display_mode else READER_INLINE_MATH_RENDER_SCALE, render_max_size)
			if render_revision != _reader_render_revision:
				return false
			if bool(result.get("ok", false)):
				var texture := result.get("texture", null) as Texture2D
				if texture != null:
					var inline_size: Vector2 = _calculate_reader_inline_math_size(texture, base_font_size, display_mode)
					label.add_image(texture, int(round(inline_size.x)), int(round(inline_size.y)))
				else:
					_append_reader_inline_math_fallback(label, segment_text, base_font_size, display_mode)
			else:
				_append_reader_inline_math_fallback(label, segment_text, base_font_size, display_mode)
			if display_mode:
				label.add_text("\n")
			continue

		var meta_target := String(segment.get("target", ""))
		_append_reader_text_run(label, segment_text, base_font_size, font_color, styles, meta_target)
	return true


func _append_reader_text_run(label: RichTextLabel, text: String, base_font_size: int, font_color: Color, styles: Dictionary, meta_target: String = "") -> void:
	if text.is_empty():
		return
	var push_count: int = 0
	var effective_font_size: int = base_font_size
	if bool(styles.get("code", false)):
		effective_font_size = maxi(10, base_font_size - 1)
	label.push_font_size(effective_font_size)
	push_count += 1
	var resolved_color: Color = _resolve_reader_inline_color(font_color, styles, not meta_target.is_empty())
	label.push_color(resolved_color)
	push_count += 1
	if bool(styles.get("code", false)):
		label.push_bgcolor(Color(0.07, 0.1, 0.15, 1.0))
		push_count += 1
	if bool(styles.get("bold", false)):
		label.push_bold()
		push_count += 1
	if bool(styles.get("italic", false)):
		label.push_italics()
		push_count += 1
	if not meta_target.is_empty():
		label.push_meta(meta_target)
		push_count += 1
	label.add_text(text)
	for _pop_index in range(push_count):
		label.pop()


func _append_reader_inline_math_fallback(label: RichTextLabel, source_text: String, base_font_size: int, display_mode: bool) -> void:
	var push_count: int = 0
	label.push_font_size(base_font_size)
	push_count += 1
	label.push_color(Color(0.78, 0.85, 1.0, 1.0))
	push_count += 1
	label.push_bgcolor(Color(0.09, 0.13, 0.2, 1.0))
	push_count += 1
	label.add_text(("\\[%s\\]" % source_text) if display_mode else ("$%s$" % source_text))
	for _pop_index in range(push_count):
		label.pop()


func _resolve_reader_inline_color(font_color: Color, styles: Dictionary, has_meta: bool) -> Color:
	if bool(styles.get("code", false)):
		return Color(1.0, 0.84, 0.54, 1.0)
	if has_meta:
		return Color(0.56, 0.78, 1.0, 1.0)
	if bool(styles.get("dim", false)):
		return Color(0.55, 0.63, 0.72, 1.0)
	return font_color


func _calculate_reader_inline_math_size(texture: Texture2D, base_font_size: int, display_mode: bool) -> Vector2:
	var raw_size := Vector2(texture.get_width(), texture.get_height())
	if raw_size.x <= 0.0 or raw_size.y <= 0.0:
		var fallback_size := maxf(16.0, float(base_font_size) * 0.95)
		return Vector2(fallback_size, fallback_size)
	if display_mode:
		return _fit_size_within(raw_size, _get_reader_math_display_max_size(), false)
	var max_height: float = maxf(18.0, float(base_font_size) * READER_INLINE_MATH_MAX_HEIGHT_MULTIPLIER)
	var max_width: float = maxf(96.0, float(base_font_size) * READER_INLINE_MATH_MAX_WIDTH_MULTIPLIER)
	var width_scale: float = max_width / raw_size.x
	var height_scale: float = max_height / raw_size.y
	var scale_factor: float = minf(1.0, minf(width_scale, height_scale))
	if scale_factor <= 0.0:
		scale_factor = 1.0
	return raw_size * scale_factor

func _contains_inline_math(text: String) -> bool:
	return not _find_reader_inline_math_match(text, 0).is_empty()


func _parse_reader_inline_segments(text: String, inherited_styles: Dictionary = {}) -> Array:
	var segments: Array = []
	var buffer := ""
	var index: int = 0
	while index < text.length():
		if text.substr(index, 2) == "[[":
			var wiki_close := text.find("]]", index + 2)
			if wiki_close != -1:
				_flush_reader_inline_buffer(segments, buffer, inherited_styles)
				buffer = ""
				var wiki_inner := text.substr(index + 2, wiki_close - index - 2).strip_edges()
				if not wiki_inner.is_empty():
					var pipe_index := wiki_inner.find("|")
					var wiki_target := wiki_inner
					var wiki_label := wiki_inner
					if pipe_index != -1:
						wiki_target = wiki_inner.substr(0, pipe_index).strip_edges()
						wiki_label = wiki_inner.substr(pipe_index + 1).strip_edges()
					segments.append({
						"type": "link",
						"text": wiki_label,
						"target": "wiki:%s" % wiki_target,
						"styles": _clone_reader_style_dictionary(inherited_styles)
					})
				index = wiki_close + 2
				continue

		if text.substr(index, 1) == "[":
			var label_end := text.find("](", index + 1)
			if label_end != -1:
				var link_end := text.find(")", label_end + 2)
				if link_end != -1:
					_flush_reader_inline_buffer(segments, buffer, inherited_styles)
					buffer = ""
					segments.append({
						"type": "link",
						"text": text.substr(index + 1, label_end - index - 1),
						"target": text.substr(label_end + 2, link_end - label_end - 2).strip_edges(),
						"styles": _clone_reader_style_dictionary(inherited_styles)
					})
					index = link_end + 1
					continue

		if text.substr(index, 1) == "`":
			var code_end := text.find("`", index + 1)
			if code_end != -1:
				_flush_reader_inline_buffer(segments, buffer, inherited_styles)
				buffer = ""
				var code_styles: Dictionary = _clone_reader_style_dictionary(inherited_styles)
				code_styles["code"] = true
				segments.append({
					"type": "text",
					"text": text.substr(index + 1, code_end - index - 1),
					"styles": code_styles
				})
				index = code_end + 1
				continue

		var inline_math: Dictionary = _find_reader_inline_math_match(text, index)
		if not inline_math.is_empty() and int(inline_math.get("start", -1)) == index:
			_flush_reader_inline_buffer(segments, buffer, inherited_styles)
			buffer = ""
			segments.append({
				"type": "math",
				"text": String(inline_math.get("text", "")).strip_edges(),
				"display_mode": bool(inline_math.get("display_mode", false)),
				"styles": _clone_reader_style_dictionary(inherited_styles)
			})
			index = int(inline_math.get("end", index + 1))
			continue

		if text.substr(index, 2) == "**":
			var bold_end := text.find("**", index + 2)
			if bold_end != -1:
				_flush_reader_inline_buffer(segments, buffer, inherited_styles)
				buffer = ""
				var bold_styles: Dictionary = _clone_reader_style_dictionary(inherited_styles)
				bold_styles["bold"] = true
				var bold_segments: Array = _parse_reader_inline_segments(text.substr(index + 2, bold_end - index - 2), bold_styles)
				for nested_segment in bold_segments:
					segments.append(nested_segment)
				index = bold_end + 2
				continue

		if text.substr(index, 2) == "~~":
			var strike_end := text.find("~~", index + 2)
			if strike_end != -1:
				_flush_reader_inline_buffer(segments, buffer, inherited_styles)
				buffer = ""
				var strike_styles: Dictionary = _clone_reader_style_dictionary(inherited_styles)
				strike_styles["dim"] = true
				var strike_segments: Array = _parse_reader_inline_segments(text.substr(index + 2, strike_end - index - 2), strike_styles)
				for nested_segment in strike_segments:
					segments.append(nested_segment)
				index = strike_end + 2
				continue

		if text.substr(index, 1) == "*":
			var italic_end := text.find("*", index + 1)
			if italic_end != -1:
				_flush_reader_inline_buffer(segments, buffer, inherited_styles)
				buffer = ""
				var italic_styles: Dictionary = _clone_reader_style_dictionary(inherited_styles)
				italic_styles["italic"] = true
				var italic_segments: Array = _parse_reader_inline_segments(text.substr(index + 1, italic_end - index - 1), italic_styles)
				for nested_segment in italic_segments:
					segments.append(nested_segment)
				index = italic_end + 1
				continue

		buffer += text.substr(index, 1)
		index += 1

	_flush_reader_inline_buffer(segments, buffer, inherited_styles)
	return segments


func _flush_reader_inline_buffer(segments: Array, buffer: String, styles: Dictionary) -> void:
	if buffer.is_empty():
		return
	segments.append({
		"type": "text",
		"text": buffer,
		"styles": _clone_reader_style_dictionary(styles)
	})


func _clone_reader_style_dictionary(source: Dictionary) -> Dictionary:
	var cloned_variant = source.duplicate(true)
	return cloned_variant if cloned_variant is Dictionary else {}


func _find_reader_inline_math_match(text: String, start_index: int) -> Dictionary:
	var best_match: Dictionary = {}

	var paren_start := text.find("\\(", start_index)
	if paren_start != -1:
		var paren_end := text.find("\\)", paren_start + 2)
		if paren_end != -1:
			var paren_text := text.substr(paren_start + 2, paren_end - paren_start - 2).strip_edges()
			if not paren_text.is_empty():
				best_match = _select_reader_inline_math_candidate(best_match, {
					"start": paren_start,
					"end": paren_end + 2,
					"text": paren_text,
					"display_mode": false
				})

	var bracket_start := text.find("\\[", start_index)
	if bracket_start != -1:
		var bracket_end := text.find("\\]", bracket_start + 2)
		if bracket_end != -1:
			var bracket_text := text.substr(bracket_start + 2, bracket_end - bracket_start - 2).strip_edges()
			if not bracket_text.is_empty():
				best_match = _select_reader_inline_math_candidate(best_match, {
					"start": bracket_start,
					"end": bracket_end + 2,
					"text": bracket_text,
					"display_mode": true
				})

	var dollar_start := _find_inline_dollar_math_start(text, start_index)
	if dollar_start != -1:
		var dollar_end := _find_inline_dollar_math_end(text, dollar_start + 1)
		if dollar_end != -1:
			var dollar_text := text.substr(dollar_start + 1, dollar_end - dollar_start - 1).strip_edges()
			if not dollar_text.is_empty():
				best_match = _select_reader_inline_math_candidate(best_match, {
					"start": dollar_start,
					"end": dollar_end + 1,
					"text": dollar_text,
					"display_mode": false
				})

	return best_match


func _select_reader_inline_math_candidate(current_match: Dictionary, candidate_match: Dictionary) -> Dictionary:
	if current_match.is_empty():
		return candidate_match
	if int(candidate_match.get("start", -1)) < int(current_match.get("start", -1)):
		return candidate_match
	return current_match


func _find_inline_dollar_math_start(text: String, start_index: int) -> int:
	var index: int = start_index
	while index < text.length():
		var found := text.find("$", index)
		if found == -1:
			return -1
		if found > 0 and text.substr(found - 1, 1) == "\\":
			index = found + 1
			continue
		if found + 1 < text.length() and text.substr(found + 1, 1) == "$":
			index = found + 2
			continue
		return found
	return -1


func _find_inline_dollar_math_end(text: String, start_index: int) -> int:
	var index: int = start_index
	while index < text.length():
		var found := text.find("$", index)
		if found == -1:
			return -1
		if found > 0 and text.substr(found - 1, 1) == "\\":
			index = found + 1
			continue
		if found + 1 < text.length() and text.substr(found + 1, 1) == "$":
			index = found + 2
			continue
		return found
	return -1

func _on_reader_meta_clicked(meta: Variant) -> void:
	var value := String(meta).strip_edges()
	if value.is_empty():
		return
	if value.begins_with("wiki:"):
		var target := value.substr(5).strip_edges()
		if not target.is_empty():
			_open_reader_from_wiki_target(target)
		return
	if value.begins_with("http://") or value.begins_with("https://"):
		OS.shell_open(value)
		return
	if value.ends_with(".md") or value.ends_with(".markdown"):
		var note_id := value.get_file().get_basename()
		if not note_id.is_empty():
			close_reader()
			tree_node_clicked.emit(note_id)
			return
	var metadata_variant = _reader_current_node.get("metadata", {})
	var metadata: Dictionary = metadata_variant if metadata_variant is Dictionary else {}
	var filepath := String(metadata.get("filepath", _reader_current_node.get("filepath", "")))
	var resolved := _resolve_reader_asset_path(value, filepath)
	if not resolved.is_empty() and (resolved.contains("://") or resolved.contains(":") or resolved.begins_with("/")):
		OS.shell_open(resolved)

func _open_reader_from_wiki_target(target: String) -> void:
	if _reader_render_client == null:
		close_reader()
		tree_node_clicked.emit(target)
		return
	var metadata_variant = _reader_current_node.get("metadata", {})
	var metadata: Dictionary = metadata_variant if metadata_variant is Dictionary else {}
	var current_filepath := String(metadata.get("filepath", _reader_current_node.get("filepath", ""))).strip_edges()
	if current_filepath.is_empty():
		close_reader()
		tree_node_clicked.emit(target)
		return

	var resolve_response: Dictionary = await _reader_render_client.resolve_markdown_wiki(target, current_filepath)
	if not bool(resolve_response.get("ok", false)):
		close_reader()
		tree_node_clicked.emit(target)
		return

	var next_filepath := String(resolve_response.get("filePath", "")).strip_edges()
	if next_filepath.is_empty():
		close_reader()
		tree_node_clicked.emit(target)
		return

	var next_node: Dictionary = {
		"id": target,
		"label": next_filepath.get_file().get_basename(),
		"metadata": {
			"filepath": next_filepath
		},
		"_reader_resolve_target": resolve_response
	}
	open_reader(next_node)

func _parse_markdown_blocks(markdown: String) -> Array:
	var normalized := _normalize_reader_markdown(markdown)
	var lines := normalized.split("\n")
	var blocks: Array = []
	var index := 0

	while index < lines.size():
		var line := String(lines[index])
		var trimmed := line.strip_edges()
		if trimmed.is_empty():
			index += 1
			continue

		if trimmed == "$$":
			index += 1
			var math_lines: Array = []
			while index < lines.size() and String(lines[index]).strip_edges() != "$$":
				math_lines.append(String(lines[index]))
				index += 1
			if index < lines.size():
				index += 1
			var block_math_text := _join_strings(math_lines, "\n").strip_edges()
			if not block_math_text.is_empty():
				blocks.append({"type": "math", "text": block_math_text})
			continue
		if trimmed.begins_with("$$") and trimmed.ends_with("$$") and trimmed.length() > 4:
			var inline_block_math_text := trimmed.substr(2, trimmed.length() - 4).strip_edges()
			if not inline_block_math_text.is_empty():
				blocks.append({"type": "math", "text": inline_block_math_text})
			index += 1
			continue

		var code_fence := _parse_code_fence(trimmed)
		if not code_fence.is_empty():
			var fence_marker := String(code_fence.get("fence", "```"))
			var language := String(code_fence.get("language", ""))
			index += 1
			var code_lines: Array = []
			while index < lines.size():
				var code_line := String(lines[index])
				if code_line.strip_edges().begins_with(fence_marker):
					break
				code_lines.append(code_line)
				index += 1
			if index < lines.size():
				index += 1
			blocks.append({"type": "code", "language": language, "text": _join_strings(code_lines, "\n")})
			continue

		var heading := _parse_heading(trimmed)
		if not heading.is_empty():
			blocks.append(heading)
			index += 1
			continue

		if _is_horizontal_rule(trimmed):
			blocks.append({"type": "rule"})
			index += 1
			continue

		var table_block := _parse_table_block(lines, index)
		if not table_block.is_empty():
			blocks.append(table_block.get("block", {}))
			index = int(table_block.get("next_index", index + 1))
			continue

		var image_block := _parse_image_definition(trimmed)
		if not image_block.is_empty():
			blocks.append(image_block)
			index += 1
			continue

		if trimmed.begins_with(">"):
			var quote_lines: Array = []
			while index < lines.size() and String(lines[index]).strip_edges().begins_with(">"):
				quote_lines.append(_strip_blockquote_prefix(String(lines[index])))
				index += 1
			blocks.append({"type": "blockquote", "text": _join_strings(quote_lines, "\n").strip_edges()})
			continue

		var list_block := _parse_list_block(lines, index)
		if not list_block.is_empty():
			blocks.append(list_block.get("block", {}))
			index = int(list_block.get("next_index", index + 1))
			continue

		if _looks_like_math_expression(trimmed):
			var math_paragraph_lines: Array = []
			while index < lines.size():
				var math_line := String(lines[index]).strip_edges()
				if math_line.is_empty() or not _looks_like_math_expression(math_line):
					break
				math_paragraph_lines.append(math_line)
				index += 1
			blocks.append({"type": "math", "text": _join_strings(math_paragraph_lines, "\n").strip_edges()})
			continue

		var paragraph_lines: Array = []
		while index < lines.size():
			var paragraph_line := String(lines[index])
			var paragraph_trimmed := paragraph_line.strip_edges()
			if paragraph_trimmed.is_empty() or _starts_special_markdown_block(paragraph_trimmed, lines, index):
				break
			paragraph_lines.append(paragraph_trimmed)
			index += 1
		blocks.append({"type": "paragraph", "text": _join_strings(paragraph_lines, " ").strip_edges()})

	return blocks

func _starts_special_markdown_block(trimmed: String, lines: Array = [], index: int = -1) -> bool:
	if trimmed == "$$":
		return true
	if trimmed.begins_with("$$") and trimmed.ends_with("$$") and trimmed.length() > 4:
		return true
	if not _parse_code_fence(trimmed).is_empty():
		return true
	if not _parse_heading(trimmed).is_empty():
		return true
	if _is_horizontal_rule(trimmed):
		return true
	if trimmed.begins_with(">"):
		return true
	if not _parse_list_item(trimmed).is_empty():
		return true
	if not _parse_image_definition(trimmed).is_empty():
		return true
	if index >= 0 and not lines.is_empty() and not _parse_table_block(lines, index).is_empty():
		return true
	if _looks_like_math_expression(trimmed):
		return true
	return false


func _looks_like_math_expression(text: String) -> bool:
	var trimmed := text.strip_edges()
	if trimmed.is_empty():
		return false
	if trimmed.begins_with("```") or trimmed.begins_with("~~~"):
		return false
	if trimmed.begins_with("#") or trimmed.begins_with(">"):
		return false

	var score := 0
	for marker in [
		"\\frac", "\\sum", "\\prod", "\\int", "\\left", "\\right", "\\approx", "\\mathbb",
		"\\mathbf", "\\mathrm", "\\Delta", "\\alpha", "\\beta", "\\gamma", "\\theta",
		"\\lambda", "\\mu", "\\sigma", "\\psi", "\\phi", "\\quad", "\\text", "\\leq", "\\geq"
	]:
		if trimmed.contains(marker):
			score += 2
	if trimmed.contains("_{") or trimmed.contains("^{"):
		score += 2
	if trimmed.contains("^"):
		score += 1
	if trimmed.contains("_"):
		score += 1
	if trimmed.contains("=") or trimmed.contains("\\approx") or trimmed.contains("\\sim") or trimmed.contains("\\to"):
		score += 1

	var symbol_count := 0
	for marker in ["\\", "^", "_", "{", "}", "=", "+", "-", "/", "*", "(", ")", "[", "]", "|"]:
		symbol_count += trimmed.count(marker)
	if symbol_count >= maxi(4, int(trimmed.length() * 0.15)):
		score += 1

	var lowered := " %s " % trimmed.to_lower()
	var prose_penalty := 0
	for prose_word in [" the ", " and ", " when ", " where ", " using ", " with ", " from "]:
		if lowered.contains(prose_word):
			prose_penalty += 1

	return score >= 3 and prose_penalty < 2


func _normalize_reader_markdown(markdown: String) -> String:
	var normalized := markdown.replace("\r\n", "\n").replace("\r", "\n")
	var lines := normalized.split("\n")
	if not lines.is_empty() and String(lines[0]).strip_edges() == "---":
		for line_index in range(1, lines.size()):
			var candidate := String(lines[line_index]).strip_edges()
			if candidate == "---" or candidate == "...":
				var remaining := lines.slice(line_index + 1)
				normalized = _join_strings(remaining, "\n")
				break
	normalized = _auto_fix_inline_mermaid_fence_after_block_math(normalized)
	return normalized.strip_edges()


func _auto_fix_inline_mermaid_fence_after_block_math(markdown: String) -> String:
	if markdown.is_empty():
		return markdown
	if markdown.find("```mermaid") == -1 or markdown.find("$$") == -1:
		return markdown
	var inline_fence_pattern := RegEx.new()
	if inline_fence_pattern.compile("\\$\\$[ \\t]*```mermaid") != OK:
		return markdown
	return inline_fence_pattern.sub(markdown, "$$\n```mermaid", true)

func _parse_code_fence(trimmed: String) -> Dictionary:
	if trimmed.begins_with("```"):
		return {"fence": "```", "language": trimmed.substr(3).strip_edges()}
	if trimmed.begins_with("~~~"):
		return {"fence": "~~~", "language": trimmed.substr(3).strip_edges()}
	return {}


func _parse_heading(trimmed: String) -> Dictionary:
	var level := 0
	while level < trimmed.length() and trimmed.substr(level, 1) == "#":
		level += 1
	if level == 0 or level > 6:
		return {}
	if level >= trimmed.length() or trimmed.substr(level, 1) != " ":
		return {}
	return {
		"type": "heading",
		"level": level,
		"text": trimmed.substr(level + 1).strip_edges()
	}


func _is_horizontal_rule(trimmed: String) -> bool:
	var compact := trimmed.replace(" ", "")
	if compact.length() < 3:
		return false
	var first := compact.substr(0, 1)
	if first != "-" and first != "*" and first != "_":
		return false
	for idx in range(compact.length()):
		if compact.substr(idx, 1) != first:
			return false
	return true


func _parse_list_block(lines: Array, start_index: int) -> Dictionary:
	var first_item := _parse_list_item(String(lines[start_index]).strip_edges())
	if first_item.is_empty():
		return {}

	var ordered := bool(first_item.get("ordered", false))
	var items: Array = [first_item]
	var index := start_index + 1

	while index < lines.size():
		var trimmed := String(lines[index]).strip_edges()
		if trimmed.is_empty():
			index += 1
			break
		var parsed := _parse_list_item(trimmed)
		if parsed.is_empty() or bool(parsed.get("ordered", false)) != ordered:
			break
		items.append(parsed)
		index += 1

	return {"block": {"type": "list", "ordered": ordered, "items": items}, "next_index": index}


func _parse_list_item(trimmed: String) -> Dictionary:
	var body := ""
	var ordered := false
	if trimmed.length() >= 2:
		var marker := trimmed.substr(0, 1)
		if (marker == "-" or marker == "+" or marker == "*") and trimmed.substr(1, 1) == " ":
			body = trimmed.substr(2).strip_edges()
	if body.is_empty():
		var digit_count := 0
		while digit_count < trimmed.length() and _is_ascii_digit(trimmed.substr(digit_count, 1)):
			digit_count += 1
		if digit_count == 0 or digit_count + 1 >= trimmed.length():
			return {}
		var marker_pair := trimmed.substr(digit_count, 2)
		if marker_pair != ". " and marker_pair != ") ":
			return {}
		ordered = true
		body = trimmed.substr(digit_count + 2).strip_edges()
	var task_state := ""
	if body.length() >= 4 and body.begins_with("[") and body.substr(2, 1) == "]":
		var task_marker := body.substr(1, 1).to_lower()
		if task_marker == "x":
			task_state = "done"
			body = body.substr(4).strip_edges()
		elif task_marker == " ":
			task_state = "todo"
			body = body.substr(4).strip_edges()
	return {"ordered": ordered, "text": body, "task_state": task_state}


func _parse_table_block(lines: Array, start_index: int) -> Dictionary:
	if start_index + 1 >= lines.size():
		return {}
	var header_line := String(lines[start_index]).strip_edges()
	var divider_line := String(lines[start_index + 1]).strip_edges()
	if not header_line.contains("|") or not _is_table_alignment_row(divider_line):
		return {}
	var headers := _split_table_row(header_line)
	if headers.is_empty():
		return {}
	var rows: Array = []
	var index := start_index + 2
	while index < lines.size():
		var row_line := String(lines[index]).strip_edges()
		if row_line.is_empty() or not row_line.contains("|"):
			break
		var row := _split_table_row(row_line)
		row.resize(headers.size())
		rows.append(row)
		index += 1
	return {"block": {"type": "table", "headers": headers, "rows": rows}, "next_index": index}


func _is_table_alignment_row(line: String) -> bool:
	var cells := _split_table_row(line)
	if cells.is_empty():
		return false
	for cell in cells:
		var compact := String(cell).strip_edges()
		if compact.length() < 3:
			return false
		var dash_count := 0
		for char_index in range(compact.length()):
			var character := compact.substr(char_index, 1)
			if character == "-":
				dash_count += 1
			elif character != ":":
				return false
		if dash_count < 3:
			return false
	return true


func _split_table_row(line: String) -> Array[String]:
	var trimmed := line.strip_edges()
	if trimmed.begins_with("|"):
		trimmed = trimmed.substr(1)
	if trimmed.ends_with("|"):
		trimmed = trimmed.substr(0, trimmed.length() - 1)
	var raw_cells := trimmed.split("|", false)
	var cells: Array[String] = []
	for cell in raw_cells:
		cells.append(String(cell).strip_edges())
	return cells


func _parse_image_definition(trimmed: String) -> Dictionary:
	if not trimmed.begins_with("!["):
		return {}
	var alt_end := trimmed.find("](")
	var closing := trimmed.rfind(")")
	if alt_end == -1 or closing == -1 or closing <= alt_end + 2:
		return {}
	var alt_text := trimmed.substr(2, alt_end - 2)
	var raw_path := trimmed.substr(alt_end + 2, closing - alt_end - 2).strip_edges()
	var title_break := raw_path.find(" \"")
	if title_break == -1:
		title_break = raw_path.find(" '")
	if title_break != -1:
		raw_path = raw_path.substr(0, title_break).strip_edges()
	return {
		"type": "image",
		"alt": alt_text,
		"path": raw_path
	}


func _strip_blockquote_prefix(line: String) -> String:
	var trimmed := line.strip_edges()
	if trimmed.begins_with(">"):
		trimmed = trimmed.substr(1).strip_edges()
	return trimmed


func _is_ascii_digit(character: String) -> bool:
	return character >= "0" and character <= "9"


func _join_strings(values: Array, separator: String) -> String:
	var result := ""
	for idx in range(values.size()):
		if idx > 0:
			result += separator
		result += String(values[idx])
	return result

func _markdown_to_bbcode(raw_text: String) -> String:
	var result := ""
	var index := 0

	while index < raw_text.length():
		if raw_text.substr(index, 2) == "[[":
			var wiki_close := raw_text.find("]]", index + 2)
			if wiki_close != -1:
				var wiki_inner := raw_text.substr(index + 2, wiki_close - index - 2).strip_edges()
				if not wiki_inner.is_empty():
					var wiki_target := wiki_inner
					var wiki_label := wiki_inner
					var pipe_index := wiki_inner.find("|")
					if pipe_index != -1:
						wiki_target = wiki_inner.substr(0, pipe_index).strip_edges()
						wiki_label = wiki_inner.substr(pipe_index + 1).strip_edges()
					result += "[url=wiki:%s][color=#8fc8ff]%s[/color][/url]" % [_escape_bbcode(wiki_target), _escape_bbcode(wiki_label)]
					index = wiki_close + 2
					continue

		if raw_text.substr(index, 1) == "[":
			var label_end := raw_text.find("]", index + 1)
			if label_end != -1 and label_end + 1 < raw_text.length() and raw_text.substr(label_end + 1, 1) == "(":
				var link_end := raw_text.find(")", label_end + 2)
				if link_end != -1:
					var link_label := raw_text.substr(index + 1, label_end - index - 1)
					var link_target := raw_text.substr(label_end + 2, link_end - label_end - 2).strip_edges()
					result += "[url=%s][color=#8fc8ff]%s[/color][/url]" % [_escape_bbcode(link_target), _escape_bbcode(link_label)]
					index = link_end + 1
					continue

		if raw_text.substr(index, 2) == "$$":
			var block_math_end := raw_text.find("$$", index + 2)
			if block_math_end != -1:
				result += "[bgcolor=#162033][color=#c5d9ff]%s[/color][/bgcolor]" % _escape_bbcode(raw_text.substr(index + 2, block_math_end - index - 2))
				index = block_math_end + 2
				continue

		if raw_text.substr(index, 2) == "**":
			var bold_end := raw_text.find("**", index + 2)
			if bold_end != -1:
				result += "[b]%s[/b]" % _escape_bbcode(raw_text.substr(index + 2, bold_end - index - 2))
				index = bold_end + 2
				continue

		if raw_text.substr(index, 2) == "~~":
			var strike_end := raw_text.find("~~", index + 2)
			if strike_end != -1:
				result += "[color=#7f8ea3]%s[/color]" % _escape_bbcode(raw_text.substr(index + 2, strike_end - index - 2))
				index = strike_end + 2
				continue

		if raw_text.substr(index, 1) == "*":
			var italic_end := raw_text.find("*", index + 1)
			if italic_end != -1:
				result += "[i]%s[/i]" % _escape_bbcode(raw_text.substr(index + 1, italic_end - index - 1))
				index = italic_end + 1
				continue

		if raw_text.substr(index, 1) == "$":
			var inline_math_end := raw_text.find("$", index + 1)
			if inline_math_end != -1:
				result += "[bgcolor=#162033][color=#c5d9ff]%s[/color][/bgcolor]" % _escape_bbcode(raw_text.substr(index + 1, inline_math_end - index - 1))
				index = inline_math_end + 1
				continue

		if raw_text.substr(index, 1) == "`":
			var code_end := raw_text.find("`", index + 1)
			if code_end != -1:
				result += "[bgcolor=#101722][color=#ffd58a]%s[/color][/bgcolor]" % _escape_bbcode(raw_text.substr(index + 1, code_end - index - 1))
				index = code_end + 1
				continue

		result += _escape_bbcode(raw_text.substr(index, 1))
		index += 1

	return result

func _escape_bbcode(text: String) -> String:
	return text.replace("[", "[lb]").replace("]", "[rb]")


func _resolve_reader_asset_path(raw_path: String, note_filepath: String) -> String:
	var cleaned := raw_path.strip_edges().replace("\\", "/")
	if cleaned.begins_with("<") and cleaned.ends_with(">"):
		cleaned = cleaned.substr(1, cleaned.length() - 2).strip_edges()
	if cleaned.begins_with("res://") or cleaned.begins_with("user://"):
		return cleaned
	if cleaned.begins_with("http://") or cleaned.begins_with("https://"):
		return cleaned
	if cleaned.length() >= 2 and cleaned.substr(1, 1) == ":":
		return cleaned
	if cleaned.begins_with("/"):
		return cleaned
	if note_filepath.is_empty():
		return cleaned
	var base_dir := note_filepath.replace("\\", "/").get_base_dir()
	return base_dir.path_join(cleaned).simplify_path()


func _load_reader_texture(resolved_path: String) -> Texture2D:
	if resolved_path.is_empty():
		return null
	if ResourceLoader.exists(resolved_path):
		var resource: Resource = ResourceLoader.load(resolved_path)
		if resource is Texture2D:
			return resource as Texture2D

	var image := Image.load_from_file(resolved_path)
	if image == null or image.is_empty():
		return null
	return ImageTexture.create_from_image(image)


func _get_reader_media_page_limit() -> Vector2:
	var viewport_size: Vector2 = get_viewport().get_visible_rect().size
	var horizontal_padding: float = minf(READER_MEDIA_PAGE_MARGIN, 24.0)
	var vertical_padding: float = 24.0
	var available_width: float = 0.0
	# Use viewport/page width rather than _reader_blocks width.
	# _reader_blocks can shrink to content width and would under-estimate page size.
	if _reader_scroll and _reader_scroll.size.x > 0.0:
		available_width = maxf(1.0, _reader_scroll.size.x - 16.0)
	if available_width <= 0.0 and _reader_panel:
		available_width = maxf(1.0, _reader_panel.size.x - 52.0)
	if available_width <= 0.0:
		available_width = maxf(1.0, viewport_size.x * 0.72)

	var available_height: float = 0.0
	if _reader_scroll and _reader_scroll.size.y > 0.0:
		available_height = _reader_scroll.size.y
	if available_height <= 0.0 and _reader_panel:
		available_height = _reader_panel.size.y - 156.0
	if available_height <= 0.0:
		available_height = viewport_size.y * 0.6

	var effective_width: float = maxf(1.0, available_width - 6.0)
	var effective_height: float = maxf(1.0, available_height - 6.0)
	var width_budget: float = maxf(READER_MEDIA_PAGE_MIN_WIDTH, available_width - horizontal_padding)
	var height_budget: float = maxf(READER_MEDIA_PAGE_MIN_HEIGHT, available_height - vertical_padding)
	return Vector2(
		minf(clampf(width_budget, READER_MEDIA_PAGE_MIN_WIDTH, READER_MEDIA_PAGE_MAX_WIDTH), effective_width),
		minf(clampf(height_budget, READER_MEDIA_PAGE_MIN_HEIGHT, READER_MEDIA_PAGE_MAX_HEIGHT), effective_height)
	)

func _resolve_reader_requested_media_limit(requested_size: Vector2) -> Vector2:
	var page_limit: Vector2 = _get_reader_media_page_limit()
	page_limit.x = maxf(1.0, floor(page_limit.x * READER_MEDIA_PAGE_FIT_RATIO))
	var resolved_limit: Vector2 = page_limit
	if requested_size.x > 0.0:
		resolved_limit.x = minf(resolved_limit.x, requested_size.x)
	if requested_size.y > 0.0:
		resolved_limit.y = minf(resolved_limit.y, requested_size.y)
	resolved_limit.x = minf(resolved_limit.x, READER_MEDIA_DEFAULT_PREVIEW_MAX_SIZE.x)
	resolved_limit.y = minf(resolved_limit.y, READER_MEDIA_DEFAULT_PREVIEW_MAX_SIZE.y)
	resolved_limit.x = maxf(1.0, resolved_limit.x)
	resolved_limit.y = maxf(1.0, resolved_limit.y)
	return resolved_limit


func _resolve_reader_control_media_limit(control: Control) -> Vector2:
	var requested_size: Vector2 = Vector2.ZERO
	if control.has_meta("reader_max_size"):
		var requested_variant: Variant = control.get_meta("reader_max_size")
		if requested_variant is Vector2:
			requested_size = requested_variant as Vector2
	return _resolve_reader_requested_media_limit(requested_size)


func _expand_reader_render_preview_size(content_size: Vector2, max_size: Vector2, viewer_title: String) -> Vector2:
	if content_size.x <= 0.0 or content_size.y <= 0.0:
		return content_size
	var minimum_size := READER_DISPLAY_MATH_PREVIEW_MIN_SIZE if viewer_title == "Formula" else READER_DISPLAY_MERMAID_PREVIEW_MIN_SIZE
	if content_size.x >= minimum_size.x and content_size.y >= minimum_size.y:
		return content_size
	var width_scale := minimum_size.x / content_size.x
	var height_scale := minimum_size.y / content_size.y
	var scale_factor := maxf(width_scale, height_scale)
	return _fit_size_within(content_size * scale_factor, max_size, false)


func _get_reader_math_display_max_size() -> Vector2:
	var page_limit: Vector2 = _get_reader_media_page_limit()
	return Vector2(
		minf(page_limit.x, READER_DISPLAY_MATH_PREVIEW_MAX_SIZE.x),
		clampf(page_limit.y * 0.42, 96.0, READER_DISPLAY_MATH_PREVIEW_MAX_SIZE.y)
	)


func _get_reader_mermaid_display_max_size() -> Vector2:
	var page_limit: Vector2 = _get_reader_media_page_limit()
	return Vector2(
		minf(page_limit.x, READER_DISPLAY_MERMAID_PREVIEW_MAX_SIZE.x),
		minf(page_limit.y, READER_DISPLAY_MERMAID_PREVIEW_MAX_SIZE.y)
	)


func _fit_size_within(content_size: Vector2, max_size: Vector2, allow_upscale: bool = false) -> Vector2:
	var safe_max_size := Vector2(maxf(1.0, max_size.x), maxf(1.0, max_size.y))
	if content_size.x <= 0.0 or content_size.y <= 0.0:
		return safe_max_size
	var scale_factor: float = minf(safe_max_size.x / content_size.x, safe_max_size.y / content_size.y)
	if not allow_upscale:
		scale_factor = minf(scale_factor, 1.0)
	if scale_factor <= 0.0:
		scale_factor = 1.0
	return content_size * scale_factor


func _wrap_reader_centered_block(content: Control) -> Control:
	var center := CenterContainer.new()
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	center.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_child(content)
	return center


func _on_reader_container_resized() -> void:
	if is_reader_open():
		call_deferred("_apply_reader_zoom")


func _on_reader_image_overlay_resized() -> void:
	_apply_reader_image_frame_layout()
	if is_image_viewer_open():
		_apply_reader_image_transform()


func _resolve_default_reader_image_frame_size() -> Vector2:
	var overlay_size: Vector2 = _reader_image_overlay.size if _reader_image_overlay else get_viewport().get_visible_rect().size
	if overlay_size.x <= 0.0 or overlay_size.y <= 0.0:
		overlay_size = get_viewport().get_visible_rect().size
	var max_size := Vector2(maxf(READER_IMAGE_FRAME_MIN_SIZE.x, overlay_size.x - 40.0), maxf(READER_IMAGE_FRAME_MIN_SIZE.y, overlay_size.y - 40.0))
	return Vector2(
		clampf(overlay_size.x * 0.78, READER_IMAGE_FRAME_MIN_SIZE.x, max_size.x),
		clampf(overlay_size.y * 0.74, READER_IMAGE_FRAME_MIN_SIZE.y, max_size.y)
	)


func _apply_reader_image_frame_layout() -> void:
	if _reader_image_overlay == null or _reader_image_frame == null:
		return
	var overlay_size: Vector2 = _reader_image_overlay.size
	if overlay_size.x <= 0.0 or overlay_size.y <= 0.0:
		overlay_size = get_viewport().get_visible_rect().size
	var max_size := Vector2(maxf(READER_IMAGE_FRAME_MIN_SIZE.x, overlay_size.x - 40.0), maxf(READER_IMAGE_FRAME_MIN_SIZE.y, overlay_size.y - 40.0))
	_reader_image_frame_size.x = clampf(_reader_image_frame_size.x, READER_IMAGE_FRAME_MIN_SIZE.x, max_size.x)
	_reader_image_frame_size.y = clampf(_reader_image_frame_size.y, READER_IMAGE_FRAME_MIN_SIZE.y, max_size.y)
	_reader_image_frame.size = _reader_image_frame_size
	_reader_image_frame.position = (overlay_size - _reader_image_frame_size) * 0.5
	call_deferred("_clamp_reader_image_scroll_position")


func _point_hits_reader_image_resize_handle(global_point: Vector2) -> bool:
	return _reader_image_resize_handle != null and _reader_image_resize_handle.get_global_rect().has_point(global_point)


func _sync_reader_image_render_viewport_size() -> void:
	return


func _on_reader_image_viewport_resized() -> void:
	_sync_reader_image_render_viewport_size()
	if is_image_viewer_open():
		var focus := _capture_reader_image_focus()
		_apply_reader_image_transform()
		call_deferred("_restore_reader_image_focus", focus)


func _on_reader_image_overlay_input(event: InputEvent) -> void:
	if not is_image_viewer_open():
		return

	if event is InputEventScreenTouch:
		if event.pressed:
			if _reader_image_touch_points.is_empty() and _reader_image_frame and not _reader_image_frame.get_global_rect().has_point(event.position):
				close_image_viewer()
				_reader_image_overlay.accept_event()
				return
			_reader_image_touch_points[event.index] = event.position
			_reader_image_pan_origin = _get_reader_image_scroll_position()
			if _reader_image_touch_points.size() >= 2:
				var pinch_data := _get_reader_touch_pinch_data()
				_reader_image_last_pinch_distance = float(pinch_data.get("distance", 0.0))
				_reader_image_last_pinch_center = pinch_data.get("center", event.position)
		else:
			_reader_image_touch_points.erase(event.index)
			if _reader_image_touch_points.size() < 2:
				_reader_image_last_pinch_distance = 0.0
		_reader_image_overlay.accept_event()
		return

	if event is InputEventScreenDrag:
		_reader_image_touch_points[event.index] = event.position
		if _reader_image_touch_points.size() >= 2:
			var pinch_data := _get_reader_touch_pinch_data()
			var pinch_distance := float(pinch_data.get("distance", 0.0))
			var pinch_center: Vector2 = pinch_data.get("center", event.position)
			if _reader_image_last_pinch_distance > 0.0 and pinch_distance > 0.0:
				_zoom_reader_image_by_factor(pinch_distance / _reader_image_last_pinch_distance, pinch_center)
			_reader_image_last_pinch_distance = pinch_distance
			_reader_image_last_pinch_center = pinch_center
		else:
			_set_reader_image_scroll_position(_get_reader_image_scroll_position() - event.relative)
		_reader_image_overlay.accept_event()
		return

	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				if _reader_image_frame and not _reader_image_frame.get_global_rect().has_point(event.global_position):
					close_image_viewer()
					_reader_image_overlay.accept_event()
					return
				if _point_hits_reader_image_resize_handle(event.global_position):
					_reader_image_frame_resizing = true
					_reader_image_frame_resize_origin = event.global_position
					_reader_image_frame_size_origin = _reader_image_frame_size
					_reader_image_overlay.accept_event()
					return
				
				# Start dragging regardless of exact viewport collision for better UX
				_reader_image_dragging = true
				_reader_image_drag_origin = event.global_position
				_reader_image_pan_origin = _get_reader_image_scroll_position()
				_reader_image_overlay.accept_event()
			else:
				_reader_image_dragging = false
				_reader_image_frame_resizing = false
				_reader_image_overlay.accept_event()
			return

		if event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_adjust_reader_image_zoom(0.15, event.global_position)
			_reader_image_overlay.accept_event()
			return
		if event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_adjust_reader_image_zoom(-0.15, event.global_position)
			_reader_image_overlay.accept_event()
			return

	if event is InputEventMouseMotion:
		if _reader_image_frame_resizing:
			var resize_delta: Vector2 = event.global_position - _reader_image_frame_resize_origin
			_reader_image_frame_size = _reader_image_frame_size_origin + Vector2(resize_delta.x, resize_delta.y)
			_apply_reader_image_frame_layout()
			_apply_reader_image_transform()
			_reader_image_overlay.accept_event()
			return
		if _reader_image_dragging:
			_set_reader_image_scroll_position(_reader_image_pan_origin - (event.global_position - _reader_image_drag_origin))
			_reader_image_overlay.accept_event()

func _get_reader_touch_pinch_data() -> Dictionary:
	if _reader_image_touch_points.size() < 2:
		return {"distance": 0.0, "center": Vector2.ZERO}
	var keys := _reader_image_touch_points.keys()
	var first: Vector2 = _reader_image_touch_points[keys[0]]
	var second: Vector2 = _reader_image_touch_points[keys[1]]
	return {"distance": first.distance_to(second), "center": (first + second) * 0.5}


func _adjust_reader_image_zoom(delta: float, pivot_global: Vector2 = Vector2.ZERO) -> void:
	_zoom_reader_image_by_factor(1.0 + delta, pivot_global)


func _zoom_reader_image_by_factor(factor: float, pivot_global: Vector2 = Vector2.ZERO) -> void:
	if factor <= 0.0 or _reader_image_current_texture == null:
		return

	var previous_zoom := _reader_image_zoom
	var next_zoom: float = clampf(previous_zoom * factor, 0.2, 8.0)
	if is_equal_approx(previous_zoom, next_zoom):
		return

	var focus := _capture_reader_image_focus(pivot_global)
	_reader_image_zoom = next_zoom
	_apply_reader_image_transform()
	call_deferred("_restore_reader_image_focus", focus)


func _apply_reader_image_transform() -> void:
	if _reader_image_current_texture == null or _reader_image_viewport == null or _reader_image_surface == null:
		return

	var viewport_size := _reader_image_viewport.size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return

	_sync_reader_image_render_viewport_size()
	var safe_bounds: Vector2 = Vector2(maxf(160.0, viewport_size.x - 80.0), maxf(120.0, viewport_size.y - 60.0))
	_reader_image_base_size = _fit_size_within(Vector2(_reader_image_current_texture.get_width(), _reader_image_current_texture.get_height()), safe_bounds, true)
	_reader_image_drawn_size = _reader_image_base_size * _reader_image_zoom
	var surface_size := Vector2(maxf(viewport_size.x, _reader_image_drawn_size.x), maxf(viewport_size.y, _reader_image_drawn_size.y))
	_reader_image_surface.custom_minimum_size = surface_size
	_reader_image_surface.size = surface_size
	_reader_image_content_rect = Rect2((surface_size - _reader_image_drawn_size) * 0.5, _reader_image_drawn_size)
	var horizontal_limit := maxf(0.0, surface_size.x - viewport_size.x)
	var vertical_limit := maxf(0.0, surface_size.y - viewport_size.y)
	_reader_image_pan = Vector2(clampf(_reader_image_pan.x, 0.0, horizontal_limit), clampf(_reader_image_pan.y, 0.0, vertical_limit))
	_reader_image_surface.position = -_reader_image_pan
	if _reader_image_canvas and _reader_image_canvas.has_method("set_render_texture"):
		_reader_image_canvas.call("set_render_texture", _reader_image_current_texture)
	if _reader_image_canvas and _reader_image_canvas.has_method("set_render_transform"):
		_reader_image_canvas.call("set_render_transform", _reader_image_content_rect.position, _reader_image_content_rect.size)
	if _reader_image_canvas and _reader_image_canvas.has_method("set_background"):
		_reader_image_canvas.call("set_background", READER_IMAGE_VIEWER_BACKGROUND)
	if _reader_image_zoom_label:
		_reader_image_zoom_label.text = "%d%%" % int(round(_reader_image_zoom * 100.0))


func _get_reader_image_scroll_position() -> Vector2:
	return _reader_image_pan


func _set_reader_image_scroll_position(scroll_position: Vector2) -> void:
	var horizontal_limit := _get_reader_image_scroll_limit(true)
	var vertical_limit := _get_reader_image_scroll_limit(false)
	_reader_image_pan = Vector2(clampf(scroll_position.x, 0.0, horizontal_limit), clampf(scroll_position.y, 0.0, vertical_limit))
	if _reader_image_surface:
		_reader_image_surface.position = -_reader_image_pan


func _get_reader_image_scroll_limit(is_horizontal: bool) -> float:
	if _reader_image_viewport == null or _reader_image_surface == null:
		return 0.0
	var surface_size := _reader_image_surface.size
	var viewport_size := _reader_image_viewport.size
	return maxf(0.0, (surface_size.x - viewport_size.x) if is_horizontal else (surface_size.y - viewport_size.y))


func _clamp_reader_image_scroll_position() -> void:
	_set_reader_image_scroll_position(_get_reader_image_scroll_position())


func _center_reader_image_view() -> void:
	_set_reader_image_scroll_position(Vector2(_get_reader_image_scroll_limit(true) * 0.5, _get_reader_image_scroll_limit(false) * 0.5))


func _capture_reader_image_focus(pivot_global: Vector2 = Vector2.ZERO) -> Dictionary:
	if _reader_image_viewport == null:
		return {}
	var viewport_size := _reader_image_viewport.size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return {}
	var pivot_local := viewport_size * 0.5
	if pivot_global != Vector2.ZERO:
		pivot_local = pivot_global - _reader_image_viewport.get_global_rect().position
		pivot_local.x = clampf(pivot_local.x, 0.0, viewport_size.x)
		pivot_local.y = clampf(pivot_local.y, 0.0, viewport_size.y)
	var texture_size := _reader_image_content_rect.size
	if texture_size.x <= 0.0 or texture_size.y <= 0.0:
		return {"pivot_local": pivot_local, "ratio": Vector2(0.5, 0.5)}
	var focus_local := _get_reader_image_scroll_position() + pivot_local - _reader_image_content_rect.position
	return {
		"pivot_local": pivot_local,
		"ratio": Vector2(
			clampf(focus_local.x / texture_size.x, 0.0, 1.0),
			clampf(focus_local.y / texture_size.y, 0.0, 1.0)
		)
	}


func _restore_reader_image_focus(focus: Dictionary) -> void:
	if focus.is_empty() or _reader_image_viewport == null:
		return
	var pivot_local: Vector2 = focus.get("pivot_local", _reader_image_viewport.size * 0.5)
	var ratio: Vector2 = focus.get("ratio", Vector2(0.5, 0.5))
	var target_point := _reader_image_content_rect.position + Vector2(_reader_image_content_rect.size.x * ratio.x, _reader_image_content_rect.size.y * ratio.y)
	_set_reader_image_scroll_position(target_point - pivot_local)

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
	if _notemd_button:
		_notemd_button.pressed.connect(_on_open_notemd_pressed)
	if _exit_button:
		_exit_button.pressed.connect(_on_exit_pressed)
	if _bg_lock_button:
		_bg_lock_button.toggled.connect(_on_bg_lock_toggled)
		_apply_button_style(_bg_lock_button, Color(0.15, 0.2, 0.28, 1.0), Color(0.2, 0.28, 0.38, 1.0), Color(0.1, 0.15, 0.22, 1.0), Color(0.4, 0.5, 0.7, 1.0), Color(0.95, 0.97, 1.0, 1.0))
	if _history_list:
		_history_list.item_activated.connect(_on_history_item_activated)
		_history_list.item_clicked.connect(func(index: int, _at: Vector2, _mouse_button: int):
			if _mouse_button == MOUSE_BUTTON_LEFT:
				_on_history_item_activated(index)
		)
	if _target_filter_input:
		_target_filter_input.text_changed.connect(_on_target_filter_changed)
	if _target_list:
		_target_list.item_activated.connect(_on_target_item_activated)
		_target_list.item_clicked.connect(func(index: int, _at: Vector2, _mouse_button: int):
			if _mouse_button == MOUSE_BUTTON_LEFT:
				_on_target_item_activated(index)
		)
	
	## Tree View signals
	if _tree_view:
		_tree_view.node_navigate_requested.connect(func(id): tree_node_clicked.emit(id))
		_tree_view.node_reader_requested.connect(func(id): node_reader_requested.emit(id))
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
	if settings.has("reading_mode"):
		_apply_reader_mode_setting(String(settings.get("reading_mode", "window")))
	if settings.has("reader_media_scale") or settings.has("reader_render_mode") or settings.has("reader_toggle_source_shortcut") or settings.has("reader_debug"):
		_sync_reader_controls_from_settings()


func _coerce_remote_target_ids(value) -> Array[String]:
	var ids: Array[String] = []
	if value is Array:
		for raw_id in value:
			var id := String(raw_id).strip_edges()
			if id.is_empty() or id in ids:
				continue
			ids.append(id)
	else:
		var single_id := String(value).strip_edges()
		if not single_id.is_empty():
			ids.append(single_id)
	return ids


func _ensure_future_path_panel_visible() -> void:
	if not _tree_panel:
		return
	if _tree_panel.has_method("restore"):
		_tree_panel.call("restore")
	_tree_panel.visible = true


func _apply_remote_path_selection(settings: Dictionary) -> void:
	var mode_changed := false
	if settings.has("mode"):
		var next_mode := String(settings.get("mode", _current_mode)).strip_edges()
		if next_mode == "domain" or next_mode == "diffusion":
			mode_changed = next_mode != _current_mode
			_current_mode = next_mode

	if settings.has("strategy"):
		var next_strategy := String(settings.get("strategy", _current_strategy)).strip_edges()
		if next_strategy == "foundational" or next_strategy == "core":
			_current_strategy = next_strategy

	var remote_target_ids: Array[String] = []
	if settings.has("targetIds"):
		remote_target_ids = _coerce_remote_target_ids(settings.get("targetIds", []))
	elif settings.has("targetId"):
		remote_target_ids = _coerce_remote_target_ids(settings.get("targetId", ""))
	elif settings.has("target_id"):
		remote_target_ids = _coerce_remote_target_ids(settings.get("target_id", ""))

	if remote_target_ids.size() > 0:
		if _current_mode == "diffusion":
			_current_diffusion_target_ids = remote_target_ids
			_current_target_id = remote_target_ids[0]
			_current_target_label = _current_target_id
		else:
			_current_domain_target_ids = remote_target_ids

	if _mode_option:
		_mode_option.select(0 if _current_mode == "domain" else 1)
	if _strategy_option:
		_strategy_option.select(0 if _current_strategy == "foundational" else 1)

	var mode_name := "Domain Learning" if _current_mode == "domain" else "Diffusion Learning"
	update_mode(mode_name)

	if _target_nodes.size() > 0:
		if _current_mode == "diffusion":
			_ensure_valid_diffusion_target()
		else:
			_reconcile_domain_targets()
	_update_target_button_state()
	_populate_target_list(_target_filter_input.text if _target_filter_input else "")
	if _current_mode == "diffusion" and settings.get("focus_mode", false) == true:
		_ensure_future_path_panel_visible()
	if mode_changed and _tree_view and _tree_view.has_method("update_settings"):
		_tree_view.update_settings(settings)


func apply_remote_runtime_settings(settings: Dictionary) -> void:
	if settings.is_empty():
		return
	_apply_remote_path_selection(settings)
	if _settings_panel and _settings_panel.has_method("_apply_remote_settings"):
		_settings_panel.call("_apply_remote_settings", settings)
		if _settings_panel.has_method("_update_ui"):
			_settings_panel.call("_update_ui")
	if _tree_view and _tree_view.has_method("update_settings"):
		_tree_view.update_settings(settings)
	if settings.has("reading_mode"):
		_apply_reader_mode_setting(String(settings.get("reading_mode", "window")))
	if settings.has("reader_media_scale") or settings.has("reader_render_mode") or settings.has("reader_toggle_source_shortcut") or settings.has("reader_debug"):
		_sync_reader_controls_from_settings()
	_update_reader_media_debug_overlay()


func _setup_initial_state() -> void:
	update_progress(0, 0)
	_update_sidebar_header()
	_update_target_button_state()
	## Diffusion startup config is emitted after targets are available so
	## startup never sends an empty target payload.
	if _current_mode == "domain":
		_emit_runtime_config()


## Called when Mark Complete button is pressed
func _on_mark_complete_pressed() -> void:
	print("[PathModeUI] Mark Complete pressed")
	mark_complete_pressed.emit()


func update_complete_button(is_completed: bool) -> void:
	if not mark_complete_btn:
		return
	if is_completed:
		mark_complete_btn.text = _resolve_ui_text("cancel_completion", "Cancel Completion")
		_apply_button_style(mark_complete_btn, Color(0.7, 0.3, 0.3, 1.0), Color(0.8, 0.4, 0.4, 1.0), Color(0.6, 0.2, 0.2, 1.0), Color(0.8, 0.5, 0.5, 1.0), Color(1.0, 0.9, 0.9, 1.0))
	else:
		mark_complete_btn.text = _resolve_ui_text("complete", "Complete")
		_apply_button_style(mark_complete_btn, Color(0.9, 0.55, 0.15, 1.0), Color(1.0, 0.66, 0.22, 1.0), Color(0.78, 0.42, 0.08, 1.0), Color(0.25, 0.18, 0.1, 1.0), Color(0.09, 0.08, 0.07, 1.0))


func _get_all_target_ids() -> Array[String]:
	var ids: Array[String] = []
	for node in _target_nodes:
		var id: String = node.get("id", "")
		if id.is_empty():
			continue
		ids.append(id)
	return ids


func _array_string_equals(left: Array[String], right: Array[String]) -> bool:
	if left.size() != right.size():
		return false
	for i in range(left.size()):
		if left[i] != right[i]:
			return false
	return true


func _sanitize_target_ids(candidate_ids: Array[String], available_ids: Array[String] = []) -> Array[String]:
	var all_ids := available_ids
	if all_ids.size() == 0:
		all_ids = _get_all_target_ids()
	var available: Dictionary = {}
	for id in all_ids:
		available[id] = true

	var sanitized: Array[String] = []
	for id in candidate_ids:
		if not (id in available):
			continue
		if id in sanitized:
			continue
		sanitized.append(id)
	return sanitized


func _get_default_target_ids(limit: int) -> Array[String]:
	var ids := _get_all_target_ids()
	var defaults: Array[String] = []
	if limit <= 0:
		return defaults
	for id in ids:
		defaults.append(id)
		if defaults.size() >= limit:
			break
	return defaults


func _reconcile_diffusion_targets() -> bool:
	var previous_ids := _current_diffusion_target_ids.duplicate()
	var available_ids := _get_all_target_ids()
	var effective_ids := _sanitize_target_ids(_current_diffusion_target_ids, available_ids)
	if effective_ids.size() == 0:
		effective_ids = _get_default_target_ids(1)
	_current_diffusion_target_ids = effective_ids

	var previous_primary := _current_target_id
	if effective_ids.size() > 0:
		_current_target_id = effective_ids[0]
		_current_target_label = _current_target_id
		for node in _target_nodes:
			if node.get("id", "") == _current_target_id:
				_current_target_label = node.get("label", _current_target_id)
				break
	else:
		_current_target_id = ""
		_current_target_label = ""

	return (not _array_string_equals(previous_ids, effective_ids)) or (previous_primary != _current_target_id)


func _get_effective_diffusion_target_ids() -> Array[String]:
	var available_ids := _get_all_target_ids()
	var effective_ids := _sanitize_target_ids(_current_diffusion_target_ids, available_ids)
	if effective_ids.size() == 0:
		if not _current_target_id.is_empty():
			effective_ids = [_current_target_id]
		else:
			effective_ids = _get_default_target_ids(1)
	return effective_ids


func _reconcile_domain_targets() -> bool:
	var previous_ids := _current_domain_target_ids.duplicate()
	var available_ids := _get_all_target_ids()
	var effective_ids := _sanitize_target_ids(_current_domain_target_ids, available_ids)
	if effective_ids.size() == 0:
		## Domain default is intentionally bounded to avoid all-node OOM on large graphs.
		effective_ids = _get_default_target_ids(2)
	_current_domain_target_ids = effective_ids
	return not _array_string_equals(previous_ids, effective_ids)


func _get_effective_domain_target_ids() -> Array[String]:
	var available_ids := _get_all_target_ids()
	var effective_ids := _sanitize_target_ids(_current_domain_target_ids, available_ids)
	if effective_ids.size() == 0:
		effective_ids = _get_default_target_ids(2)
	return effective_ids



func _on_mode_selected(index: int) -> void:
	var next_mode := "domain" if index == 0 else "diffusion"
	var mode_changed := next_mode != _current_mode
	_current_mode = next_mode
	var mode_name := "Domain Learning" if _current_mode == "domain" else "Diffusion Learning"
	update_mode(mode_name)
	if _current_mode == "domain":
		if mode_changed:
			_current_domain_target_ids = _get_default_target_ids(2)
		_reconcile_domain_targets()
	if _current_mode == "diffusion":
		if mode_changed:
			_current_diffusion_target_ids = _get_default_target_ids(1)
		_ensure_valid_diffusion_target()
	_update_target_button_state()
	_emit_runtime_config()
	if _current_mode == "diffusion":
		_on_target_pressed()


func _on_strategy_selected(index: int) -> void:
	_current_strategy = "foundational" if index == 0 else "core"
	_emit_runtime_config()


func _on_target_pressed() -> void:
	if not _target_popup:
		return
	if _current_mode == "domain":
		_target_list.select_mode = ItemList.SELECT_MULTI
		_target_popup.title = "Select Domain Targets"
	else:
		_target_list.select_mode = ItemList.SELECT_MULTI
		_target_popup.title = "Select Diffusion Targets"
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
	if _current_mode == "domain":
		_current_domain_target_ids.clear()
		for i in _target_list.get_selected_items():
			_current_domain_target_ids.append(_target_list.get_item_metadata(i) as String)
		_reconcile_domain_targets()
		_update_target_button_state()
		_emit_runtime_config()
	else:
		_current_diffusion_target_ids.clear()
		for i in _target_list.get_selected_items():
			_current_diffusion_target_ids.append(_target_list.get_item_metadata(i) as String)
		_ensure_valid_diffusion_target()
		_update_target_button_state()
		_emit_runtime_config()


func _select_target(node_id: String) -> void:
	for node in _target_nodes:
		var id: String = node.get("id", "")
		if id == node_id:
			_current_target_id = id
			_current_target_label = node.get("label", id)
			break
	_current_diffusion_target_ids = [node_id]
	_update_target_button_state()
	_emit_runtime_config()


func _populate_target_list(filter_text: String = "") -> void:
	if not _target_list:
		return
	_target_list.clear()
	var filter_lower := filter_text.to_lower()
	var domain_selected_ids: Array[String] = []
	var diffusion_selected_ids: Array[String] = []
	if _current_mode == "domain":
		domain_selected_ids = _get_effective_domain_target_ids()
	else:
		diffusion_selected_ids = _get_effective_diffusion_target_ids()
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
		if _current_mode == "domain":
			if id in domain_selected_ids:
				_target_list.select(idx, false)
		elif id in diffusion_selected_ids:
			_target_list.select(idx, false)


func _ensure_valid_diffusion_target() -> bool:
	if _current_mode != "diffusion":
		return false

	var previous_ids := _current_diffusion_target_ids.duplicate()

	var changed := _reconcile_diffusion_targets()
	if _current_diffusion_target_ids.size() == 0 and not _current_central_id.is_empty():
		_current_diffusion_target_ids = [_current_central_id]
		_current_target_id = _current_central_id
		_current_target_label = _current_central_id
		changed = true

	return changed or (not _array_string_equals(previous_ids, _current_diffusion_target_ids))


func _update_target_button_state() -> void:
	if not _target_button:
		return
	_target_button.disabled = false
	if _current_mode == "domain":
		var domain_ids := _get_effective_domain_target_ids()
		if domain_ids.size() > 0:
			_target_button.text = _resolve_ui_text("targets_selected", "Targets: %d Selected") % domain_ids.size()
		else:
			_target_button.text = _resolve_ui_text("targets_none", "Targets: None")
		_target_button.tooltip_text = _resolve_ui_text("select_domain_targets", "Select Domain Targets")
		return

	_ensure_valid_diffusion_target()
	var diffusion_ids := _get_effective_diffusion_target_ids()
	if diffusion_ids.size() <= 1:
		var label := _current_target_label if not _current_target_label.is_empty() else _current_target_id
		if label.is_empty():
			label = _resolve_ui_text("target_select_fallback", "Select")
		var display := label
		if display.length() > 26:
			display = display.substr(0, 23) + "..."
		_target_button.text = _resolve_ui_text("target_label", "Target: %s") % display
		_target_button.tooltip_text = _resolve_ui_text("current_diffusion_target", "Current Diffusion target: %s") % label
	else:
		_target_button.text = _resolve_ui_text("targets_selected", "Targets: %d Selected") % diffusion_ids.size()
		var labels: Array[String] = []
		for id in diffusion_ids:
			var matched_label := id
			for node in _target_nodes:
				if node.get("id", "") == id:
					matched_label = node.get("label", id)
					break
			labels.append(matched_label)
		_target_button.tooltip_text = _resolve_ui_text("current_diffusion_targets", "Current Diffusion targets: %s") % ", ".join(PackedStringArray(labels))


func _on_exit_pressed() -> void:
	exit_requested.emit()
	## Auto-hide Godot window after requesting exit from PathMode.
	## The Tauri side will show its own window upon receiving 'exitPathMode'.
	## 退出 PathMode 后自动最小化 Godot 窗口。
	## Tauri 端收到 'exitPathMode' 后将显示自己的窗口。
	if _is_single_window_mode():
		var window := get_window()
		if window:
			DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_NO_FOCUS, true)
			window.mode = Window.MODE_MINIMIZED


func _on_open_notemd_pressed() -> void:
	print("[PathModeUI] NoteMD button pressed from Godot UI.")
	if _notemd_embed_panel and _notemd_embed_panel.has_method("open_panel"):
		_notemd_embed_panel.open_panel()
		return
	_on_notemd_open_full_workspace_requested()


func _on_notemd_open_full_workspace_requested() -> void:
	print("[PathModeUI] Opening full NoteMD workspace in Tauri host.")
	if _ws_client and _ws_client.has_method("send_open_notemd"):
		_ws_client.send_open_notemd()
	elif _ws_client and _ws_client.has_method("send_message"):
		_ws_client.send_message({
			"type": "open_notemd",
			"payload": {}
		})
	else:
		push_warning("[PathModeUI] WsClient unavailable; cannot forward NoteMD open request.")


func _on_bg_lock_toggled(pressed: bool) -> void:
	## Toggle background lock icon and emit signal
	## Keep the background-lock label synchronized with the emitted state.
	if _bg_lock_button:
		_bg_lock_button.text = BG_LOCKED_ICON if pressed else BG_UNLOCKED_ICON
		_bg_lock_button.tooltip_text = "Background locked" if pressed else "Lock Background (camera won't rotate sky)"
	background_lock_toggled.emit(pressed)


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
		var learn_idx := _history_list.add_item("<- Return to learning: %s" % learning_label)
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
		"layout": "orbital",
		"language": _ui_language
	}
	if _settings_panel and _settings_panel.has_method("get_all_settings"):
		var stored_settings: Dictionary = _settings_panel.get_all_settings()
		for key in stored_settings.keys():
			config[key] = stored_settings[key]
	if _current_mode == "diffusion":
		_ensure_valid_diffusion_target()
		var diffusion_ids := _get_effective_diffusion_target_ids()
		if diffusion_ids.size() > 0:
			config["targetIds"] = diffusion_ids
			config["targetId"] = diffusion_ids[0]
	elif _current_mode == "domain":
		var domain_ids := _get_effective_domain_target_ids()
		if domain_ids.size() > 0:
			config["targetIds"] = domain_ids
	for key in extra.keys():
		config[key] = extra[key]
	settings_updated.emit(config)


func get_setting(key: String, default = null):
	if _settings_panel and _settings_panel.has_method("get_setting"):
		return _settings_panel.get_setting(key, default)
	return default


func get_runtime_settings() -> Dictionary:
	if _settings_panel and _settings_panel.has_method("get_all_settings"):
		return _settings_panel.get_all_settings()
	return {}


## Toggle sidebar visibility
func _on_sidebar_header_pressed() -> void:
	# Trigger the full draggable panel collapse instead of just hiding local nodes
	var sidebar := $GoldStarSidebar
	if sidebar and sidebar.has_method("collapse"):
		sidebar.collapse("[<]", HORIZONTAL_ALIGNMENT_RIGHT)

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


## Record the newly focused center while browsing so History reflects switch flow.
func record_navigation_node(node_id: String) -> void:
	if node_id.is_empty():
		return
	if not _is_browsing:
		return
	if _nav_history.is_empty() or _nav_history[_nav_history.size() - 1] != node_id:
		_nav_history.append(node_id)
	_refresh_history_popup()


func _update_return_button() -> void:
	if _return_button:
		_return_button.visible = _is_browsing


func _on_return_about_to_popup() -> void:
	var popup := _return_button.get_popup()
	popup.clear()
	
	## Add "Return to learning" as first option
	popup.add_item("<- Return to learning", 0)
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
		var display := "* %s" % label if not _edit_mode else "x %s" % label
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
	
	# Save current layout for restoration
	_tree_panel_default_offsets = {
		"anchor_left": _tree_panel.anchor_left,
		"anchor_top": _tree_panel.anchor_top,
		"anchor_right": _tree_panel.anchor_right,
		"anchor_bottom": _tree_panel.anchor_bottom,
		"left": _tree_panel.offset_left,
		"top": _tree_panel.offset_top,
		"right": _tree_panel.offset_right,
		"bottom": _tree_panel.offset_bottom
	}
	
	# Expand to near-fullscreen using fixed pixel layout so drag/resize stays predictable.
	var vp_size := get_viewport().get_visible_rect().size
	var target_size := Vector2(vp_size.x * 0.8, vp_size.y * 0.9)
	target_size.x = max(target_size.x, 360.0)
	target_size.y = max(target_size.y, 260.0)
	target_size.x = min(target_size.x, vp_size.x - 20.0)
	target_size.y = min(target_size.y, vp_size.y - 20.0)
	var target_pos := Vector2(
		(vp_size.x - target_size.x) * 0.5,
		(vp_size.y - target_size.y) * 0.5
	)
	
	_tree_panel.anchor_left = 0.0
	_tree_panel.anchor_right = 0.0
	_tree_panel.anchor_top = 0.0
	_tree_panel.anchor_bottom = 0.0
	_tree_panel.offset_left = target_pos.x
	_tree_panel.offset_top = target_pos.y
	_tree_panel.offset_right = target_pos.x + target_size.x
	_tree_panel.offset_bottom = target_pos.y + target_size.y
	
	_is_tree_fullscreen = true
	if _tree_view:
		_tree_view.set_fullscreen_mode(true)

func _shrink_tree_panel() -> void:
	if not _is_tree_fullscreen or not _tree_panel: return
	
	# Restore default anchors (left-side panel)
	_tree_panel.anchor_left = _tree_panel_default_offsets.get("anchor_left", 0.0)
	_tree_panel.anchor_right = _tree_panel_default_offsets.get("anchor_right", 0.0)
	_tree_panel.anchor_top = _tree_panel_default_offsets.get("anchor_top", 0.0)
	_tree_panel.anchor_bottom = _tree_panel_default_offsets.get("anchor_bottom", 0.0)
	
	# Restore offsets
	_tree_panel.offset_left = _tree_panel_default_offsets.get("left", 20)
	_tree_panel.offset_top = _tree_panel_default_offsets.get("top", 220)
	_tree_panel.offset_right = _tree_panel_default_offsets.get("right", 250)
	_tree_panel.offset_bottom = _tree_panel_default_offsets.get("bottom", get_viewport().size.y - 20)
	
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

	var diffusion_targets_changed := _reconcile_diffusion_targets()
	var domain_targets_changed := _reconcile_domain_targets()
	if _current_mode == "diffusion":
		_ensure_valid_diffusion_target()
	_update_target_button_state()
	_populate_target_list(_target_filter_input.text if _target_filter_input else "")
	if (_current_mode == "diffusion" and diffusion_targets_changed) or (_current_mode == "domain" and domain_targets_changed):
		_emit_runtime_config()


func clear_runtime_status() -> void:
	if progress_label:
		progress_label.add_theme_color_override("font_color", Color(0.9, 0.95, 1.0, 1.0))


func set_runtime_status(message: String, tone: String = "info") -> void:
	if not progress_label:
		return
	progress_label.text = message
	match tone:
		"error":
			progress_label.add_theme_color_override("font_color", Color(1.0, 0.68, 0.68, 1.0))
		"warning":
			progress_label.add_theme_color_override("font_color", Color(1.0, 0.88, 0.62, 1.0))
		"success":
			progress_label.add_theme_color_override("font_color", Color(0.72, 0.96, 0.82, 1.0))
		_:
			progress_label.add_theme_color_override("font_color", Color(0.82, 0.92, 1.0, 1.0))


## Update the progress display
func update_progress(completed: int, total: int) -> void:
	if progress_label:
		clear_runtime_status()
		progress_label.text = _resolve_ui_text("progress_template", "Progress: %d of %d") % [completed, total]


## Update the mode label
func update_mode(mode_name: String) -> void:
	if mode_label:
		mode_label.text = _resolve_ui_text("path_mode_template", "Path Mode: %s") % mode_name


## Add a completed node to the sidebar
func add_completed_node(node_id: String, label: String) -> void:
	if _completed_nodes.has(node_id):
		return # Already added
	
	_completed_nodes[node_id] = label
	
	if completed_list:
		var display := "* %s" % label if not _edit_mode else "x %s" % label
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
