class_name TreeViewPanel
extends PanelContainer

signal node_navigate_requested(node_id)
signal node_mark_complete_requested(node_id)
signal node_unmark_requested(node_id)
signal node_toggle_requested(node_id)
signal node_expand_prereqs_requested(node_id) # New
signal node_collapse_prereqs_requested(node_id) # New
signal collapse_all_requested() # New
signal fullscreen_requested(expand: bool)

const MENU_NAVIGATE = 0
const MENU_MARK = 1
const MENU_UNMARK = 2

@onready var _tree_renderer: TreeRenderer = $VBoxContainer/SubViewportContainer/SubViewport/TreeRenderer
@onready var _style_option: OptionButton = $VBoxContainer/Header/StyleOption
@onready var _context_menu: PopupMenu = $ContextMenu
@onready var _expand_button: Button = $VBoxContainer/Header/ExpandButton
@onready var _shrink_button: Button = $VBoxContainer/Header/ShrinkButton

# Data state
var _pending_nodes: Array = []
var _pending_current: String = ""
var _pending_completed: Array = []

func _ready() -> void:
	_setup_ui()
	_connect_signals()

func set_tree_data(nodes: Array, completed_ids: Array, current_id: String) -> void:
	# If not ready, store data for later
	if not is_inside_tree() or not _tree_renderer:
		_pending_nodes = nodes
		_pending_current = current_id
		_pending_completed = completed_ids
		return
		
	_tree_renderer.set_data(nodes, current_id, completed_ids)

func set_tree_layout(layout_data: Dictionary, completed_ids: Array, current_id: String) -> void:
	if not is_inside_tree() or not _tree_renderer:
		# Store as pending (reuse existing pending or add new pending vars?)
		# For simplicity, convert back to nodes array for pending if really needed, 
		# or just wait. Usually Ready happens before data.
		return
		
	_tree_renderer.set_layout_data(layout_data, current_id, completed_ids)

func update_settings(settings: Dictionary) -> void:
	if _tree_renderer:
		_tree_renderer.set_focus_mode(settings.get("focus_mode", true))

func _setup_ui() -> void:
	if _style_option:
		_style_option.clear()
		for style in TreeStyles.STYLES:
			_style_option.add_item(style)
		_style_option.selected = 0 # Set default selection
		# Connect to defined handler which properly extracts text
		_style_option.item_selected.connect(_on_style_selected)
	
	# Capture input from the container to isolate zoom/pan
	var container = $VBoxContainer/SubViewportContainer
	if container:
		container.gui_input.connect(_on_container_gui_input)

	if _context_menu:
		_context_menu.id_pressed.connect(_on_menu_item_pressed)
	
	# Fullscreen buttons
	if _expand_button:
		_expand_button.pressed.connect(func(): fullscreen_requested.emit(true))
	if _shrink_button:
		_shrink_button.pressed.connect(func(): fullscreen_requested.emit(false))

func _on_container_gui_input(event: InputEvent) -> void:
	if _tree_renderer:
		_tree_renderer.handle_input(event)
		
		# Consume event if it's mouse interaction to prevent propagation
		if event is InputEventMouseButton or event is InputEventMouseMotion:
			accept_event()

func _connect_signals() -> void:
	if _tree_renderer:
		_tree_renderer.node_clicked.connect(_on_node_clicked)
		_tree_renderer.node_double_clicked.connect(_on_node_double_clicked)
		_tree_renderer.node_double_clicked.connect(_on_node_double_clicked)
		_tree_renderer.node_toggle_requested.connect(_on_node_toggle_requested)
		_tree_renderer.node_expand_prereqs_requested.connect(_on_node_expand_prereqs_requested)
		_tree_renderer.node_collapse_prereqs_requested.connect(_on_node_collapse_prereqs_requested)
		_tree_renderer.collapse_all_requested.connect(func(): collapse_all_requested.emit())
		_tree_renderer.node_navigate_requested.connect(func(id): node_navigate_requested.emit(id)) # Wire up manual navigate signal
		# Apply any pending data
		if not _pending_nodes.is_empty():
			_tree_renderer.set_data(_pending_nodes, _pending_current, _pending_completed)
			_pending_nodes.clear()

func _on_style_selected(index: int) -> void:
	var style_name = _style_option.get_item_text(index).to_lower()
	_tree_renderer.set_style(style_name)

func _on_node_clicked(node_id: String, global_pos: Vector2) -> void:
	_show_context_menu(node_id, global_pos)

func _on_node_double_clicked(node_id: String) -> void:
	node_navigate_requested.emit(node_id)

func _on_node_toggle_requested(node_id: String) -> void:
	node_toggle_requested.emit(node_id)

func _on_node_expand_prereqs_requested(node_id: String) -> void:
	# Directly send to backend via WsClient singleton?
	# Or emit up to UI? UI has WsClient reference.
	node_expand_prereqs_requested.emit(node_id)

func _on_node_collapse_prereqs_requested(node_id: String) -> void:
	node_collapse_prereqs_requested.emit(node_id)

func _show_context_menu(node_id: String, screen_pos: Vector2) -> void:
	_context_menu.clear()
	_context_menu.add_item("Navigate to Node", MENU_NAVIGATE)
	
	# We need to check if node is completed to show correct option
	# Since we passed completed_ids to renderer, we can check _tree_renderer state 
	# OR we can assume the renderer knows. Let's look at the renderer state.
	# Accessing internal state of child is okay for tight coupling like this
	var is_completed = node_id in _tree_renderer._completed_ids
	
	if is_completed:
		_context_menu.add_item("Unmark Complete", MENU_UNMARK)
	else:
		_context_menu.add_item("Mark Complete", MENU_MARK)
		
	_context_menu.set_meta("target_node_id", node_id)
	_context_menu.position = Vector2i(screen_pos)
	_context_menu.popup()

func _on_menu_item_pressed(id: int) -> void:
	var node_id = _context_menu.get_meta("target_node_id", "")
	if node_id == "": return
	
	match id:
		MENU_NAVIGATE:
			node_navigate_requested.emit(node_id)
		MENU_MARK:
			node_mark_complete_requested.emit(node_id)
		MENU_UNMARK:
			node_unmark_requested.emit(node_id)

## Toggle button visibility based on fullscreen state
func set_fullscreen_mode(is_fullscreen: bool) -> void:
	if _expand_button:
		_expand_button.visible = not is_fullscreen
	if _shrink_button:
		_shrink_button.visible = is_fullscreen
