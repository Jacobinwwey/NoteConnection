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
var _tree_control: Tree = null


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
	
	## Create Tree Panel (left sidebar) with proper sizing
	_tree_panel = VBoxContainer.new()
	_tree_panel.name = "TreePanel"
	## Use anchors for left side positioning
	_tree_panel.anchor_left = 0.0
	_tree_panel.anchor_top = 0.0
	_tree_panel.anchor_right = 0.0
	_tree_panel.anchor_bottom = 1.0
	_tree_panel.offset_left = 20
	_tree_panel.offset_top = 120 # Below the top UI
	_tree_panel.offset_right = 250 # 230px wide
	_tree_panel.offset_bottom = -20
	_tree_panel.custom_minimum_size = Vector2(200, 200)
	add_child(_tree_panel)
	
	var tree_header := Label.new()
	tree_header.text = "Learning Path"
	tree_header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tree_panel.add_child(tree_header)
	
	## Wrap tree in a ScrollContainer for scrollability
	var scroll_container := ScrollContainer.new()
	scroll_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll_container.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_tree_panel.add_child(scroll_container)
	
	_tree_control = Tree.new()
	_tree_control.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_tree_control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_tree_control.hide_root = true
	_tree_control.custom_minimum_size = Vector2(200, 400)
	scroll_container.add_child(_tree_control)


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
	
	## Tree item selected
	if _tree_control:
		_tree_control.item_selected.connect(_on_tree_item_selected)


func _setup_initial_state() -> void:
	update_progress(0, 0)
	_update_sidebar_header()


## Called when Mark Complete button is pressed
func _on_mark_complete_pressed() -> void:
	print("[PathModeUI] Mark Complete pressed")
	mark_complete_pressed.emit()


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
	if not _is_browsing:
		_learning_position = current_central_id
		_is_browsing = true
		_nav_history.clear()
	_nav_history.append(current_central_id)
	_update_return_button()


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
	if not _tree_control:
		return
	
	_tree_control.clear()
	var root := _tree_control.create_item()
	
	## Build node lookup
	var node_map: Dictionary = {} # id -> TreeItem
	var node_data: Dictionary = {} # id -> {label, parentId}
	
	for node in nodes:
		var n: Dictionary = node if node is Dictionary else {}
		var id: String = n.get("id", "")
		if not id.is_empty():
			node_data[id] = n
	
	## Track visited nodes to prevent cycles
	var visiting: Dictionary = {} # Currently being visited (cycle detection)
	
	## Create tree items (roots first, then children)
	for id in node_data:
		_create_tree_item(id, node_data, node_map, visiting, root, completed_ids, current_id)


func _create_tree_item(id: String, node_data: Dictionary, node_map: Dictionary,
		visiting: Dictionary, root: TreeItem, completed_ids: Array, current_id: String) -> TreeItem:
	## Already created
	if node_map.has(id):
		return node_map[id]
	
	## Cycle detection: if we're already visiting this node, it's circular
	if visiting.has(id):
		push_warning("[PathModeUI] Circular parent reference detected for: ", id)
		return root # Fallback to root to break cycle
	
	visiting[id] = true # Mark as being visited
	
	var data: Dictionary = node_data.get(id, {})
	var parent_id: String = data.get("parentId", "")
	var label: String = data.get("label", id)
	
	## Find or create parent
	var parent_item: TreeItem
	if parent_id.is_empty() or not node_data.has(parent_id) or parent_id == id:
		parent_item = root
	else:
		parent_item = _create_tree_item(parent_id, node_data, node_map, visiting, root, completed_ids, current_id)
	
	## Remove from visiting (done processing this branch)
	visiting.erase(id)
	
	## Create this item
	var item := _tree_control.create_item(parent_item)
	
	## Set icon based on state
	var icon: String
	if id in completed_ids:
		icon = "★" # Completed
	elif id == current_id:
		icon = "●" # Current
	else:
		icon = "○" # Pending
	
	item.set_text(0, "%s %s" % [icon, LearningStateMachine.truncate_label(label)])
	item.set_metadata(0, id)
	
	## Color coding
	if id in completed_ids:
		item.set_custom_color(0, Color.GOLD)
	elif id == current_id:
		item.set_custom_color(0, Color.CYAN)
	else:
		item.set_custom_color(0, Color.GRAY)
	
	node_map[id] = item
	return item


func _on_tree_item_selected() -> void:
	var selected := _tree_control.get_selected()
	if selected:
		var node_id: String = selected.get_metadata(0)
		if not node_id.is_empty():
			print("[PathModeUI] Tree node clicked:", node_id)
			tree_node_clicked.emit(node_id)


## === Public API ===

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
