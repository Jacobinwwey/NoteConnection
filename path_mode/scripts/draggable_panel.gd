class_name DraggablePanel
extends Control

## A reusable Godot UI script to make panels draggable, resizable, and fully collapsible.
## 一个可复用的 Godot UI 脚本，使面板可拖动、可调整大小、可折叠为一个按钮。
##
## Usage: call setup_drag_handle(control) after adding your header to connect drag events.
## 用法: 在添加标题后调用 setup_drag_handle(control) 来连接拖拽事件。

signal collapsed_state_changed(is_collapsed: bool)

@export var resize_margin: int = 8
@export var min_size := Vector2(180, 150)
@export var dynamic_resize_margin_max: int = 40

enum ResizeEdge {
	NONE,
	LEFT,
	RIGHT,
	TOP,
	BOTTOM,
	TOP_LEFT,
	TOP_RIGHT,
	BOTTOM_LEFT,
	BOTTOM_RIGHT
}

## The button that appears when panel is collapsed / 面板折叠时出现的按钮
var collapse_button: Button

## Internal state / 内部状态
var _drag_handle: Control = null
var _interaction_exclusions: Array[Control] = []
var _is_dragging := false
var _is_resizing := false
var _drag_offset := Vector2.ZERO
var _resize_start_size := Vector2.ZERO
var _resize_start_pos := Vector2.ZERO
var _resize_start_mouse := Vector2.ZERO
var _resize_edge: int = ResizeEdge.NONE
var _hover_resize_edge: int = ResizeEdge.NONE
var _is_collapsed := false
var _collapse_alignment: int = HORIZONTAL_ALIGNMENT_LEFT
var _resize_guides_layer: Control = null
var _resize_guides: Dictionary = {}
var _active_cursor_shape: int = CURSOR_ARROW

## Save state for restoring from collapse / 保存折叠前的状态用于恢复
var _restored_size := Vector2.ZERO
var _restored_pos := Vector2.ZERO

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_PASS
	set_process(true)
	set_process_input(true)
	call_deferred("_ensure_resize_guides")


func _process(_delta: float) -> void:
	_update_resize_guides()


func _input(event: InputEvent) -> void:
	if not visible or _is_collapsed:
		return

	if event is InputEventMouseMotion:
		var motion_event := event as InputEventMouseMotion
		if _is_resizing:
			_resize_panel(motion_event.global_position)
			_apply_cursor_shape(_cursor_for_resize_edge(_resize_edge))
			get_viewport().set_input_as_handled()
		else:
			_update_hover_state(motion_event.global_position)

	elif event is InputEventMouseButton:
		var button_event := event as InputEventMouseButton
		if button_event.button_index != MOUSE_BUTTON_LEFT:
			return

		if button_event.pressed:
			var edge = _get_resize_edge_from_global(button_event.global_position)
			if edge != ResizeEdge.NONE:
				_begin_resize(edge, button_event.global_position)
				get_viewport().set_input_as_handled()
		else:
			if _is_resizing:
				_finish_resize()
				get_viewport().set_input_as_handled()
			else:
				_update_hover_state(button_event.global_position)


## Call this AFTER adding the panel to the tree and setting the drag handle.
## 在将面板添加到树并设置拖拽句柄之后调用此方法。
func setup_drag_handle(handle: Control) -> void:
	if _drag_handle and _drag_handle.gui_input.is_connected(_on_handle_gui_input):
		_drag_handle.gui_input.disconnect(_on_handle_gui_input)
	
	_drag_handle = handle
	if _drag_handle:
		_drag_handle.gui_input.connect(_on_handle_gui_input)
		_drag_handle.mouse_default_cursor_shape = Control.CURSOR_DRAG


func _gui_input(_event: InputEvent) -> void:
	pass


func _get_resize_edge(local_pos: Vector2) -> int:
	var margin = _effective_resize_margin()
	var at_left = local_pos.x <= margin
	var at_right = local_pos.x >= size.x - margin
	var at_top = local_pos.y <= margin
	var at_bottom = local_pos.y >= size.y - margin

	if at_left and at_top:
		return ResizeEdge.TOP_LEFT
	if at_right and at_top:
		return ResizeEdge.TOP_RIGHT
	if at_left and at_bottom:
		return ResizeEdge.BOTTOM_LEFT
	if at_right and at_bottom:
		return ResizeEdge.BOTTOM_RIGHT
	if at_left:
		return ResizeEdge.LEFT
	if at_right:
		return ResizeEdge.RIGHT
	if at_top:
		return ResizeEdge.TOP
	if at_bottom:
		return ResizeEdge.BOTTOM
	return ResizeEdge.NONE


func _is_over_drag_handle(mouse_global: Vector2) -> bool:
	return _drag_handle != null and _drag_handle.visible and _drag_handle.get_global_rect().has_point(mouse_global) and not _is_over_interaction_exclusion(mouse_global)


func register_interaction_exclusion(control: Control) -> void:
	if control == null:
		return
	if _interaction_exclusions.has(control):
		return
	_interaction_exclusions.append(control)


func unregister_interaction_exclusion(control: Control) -> void:
	if control == null:
		return
	_interaction_exclusions.erase(control)


func _is_over_interaction_exclusion(mouse_global: Vector2) -> bool:
	for control in _interaction_exclusions:
		if control == null or not is_instance_valid(control) or not control.visible:
			continue
		var control_rect: Rect2 = control.get_global_rect()
		if control_rect.has_point(mouse_global):
			return true
	return false


func _get_resize_edge_from_global(mouse_global: Vector2) -> int:
	var global_rect: Rect2 = get_global_rect()
	if not global_rect.has_point(mouse_global):
		return ResizeEdge.NONE
	if _is_over_interaction_exclusion(mouse_global):
		return ResizeEdge.NONE
	return _get_resize_edge(mouse_global - global_position)


func _effective_resize_margin() -> float:
	# Increase hit area on larger panels so cursor feedback stays reliable
	# when the panel is expanded.
	var dynamic_margin = min(size.x, size.y) * 0.035
	return clampf(
		max(float(resize_margin), dynamic_margin),
		float(resize_margin),
		float(dynamic_resize_margin_max)
	)


func _cursor_for_resize_edge(edge: int) -> int:
	match edge:
		ResizeEdge.LEFT, ResizeEdge.RIGHT:
			return CURSOR_HSIZE
		ResizeEdge.TOP, ResizeEdge.BOTTOM:
			return CURSOR_VSIZE
		ResizeEdge.TOP_LEFT, ResizeEdge.BOTTOM_RIGHT:
			return CURSOR_FDIAGSIZE
		ResizeEdge.TOP_RIGHT, ResizeEdge.BOTTOM_LEFT:
			return CURSOR_BDIAGSIZE
		_:
			return CURSOR_ARROW


func _apply_cursor_shape(shape: int) -> void:
	if _active_cursor_shape == shape:
		return
	_active_cursor_shape = shape
	mouse_default_cursor_shape = shape
	DisplayServer.cursor_set_shape(shape)


func _begin_resize(edge: int, mouse_global_pos: Vector2) -> void:
	_is_resizing = true
	_is_dragging = false
	_resize_edge = edge
	_hover_resize_edge = edge
	_resize_start_size = size
	_resize_start_pos = global_position
	_resize_start_mouse = mouse_global_pos
	_apply_cursor_shape(_cursor_for_resize_edge(edge))


func _finish_resize() -> void:
	_is_resizing = false
	_resize_edge = ResizeEdge.NONE
	_update_hover_state(get_viewport().get_mouse_position())


func _update_hover_state(mouse_global_pos: Vector2) -> void:
	var over_panel: bool = get_global_rect().has_point(mouse_global_pos)
	var over_exclusion: bool = _is_over_interaction_exclusion(mouse_global_pos)
	var over_handle: bool = _is_over_drag_handle(mouse_global_pos)
	if not over_panel and not over_handle:
		_hover_resize_edge = ResizeEdge.NONE
		if _active_cursor_shape != Control.CURSOR_ARROW:
			_apply_cursor_shape(Control.CURSOR_ARROW)
		return

	if over_exclusion:
		_hover_resize_edge = ResizeEdge.NONE
		if _active_cursor_shape != Control.CURSOR_ARROW:
			_apply_cursor_shape(Control.CURSOR_ARROW)
		return

	var edge: int = ResizeEdge.NONE
	if over_panel:
		edge = _get_resize_edge_from_global(mouse_global_pos)
	_hover_resize_edge = edge
	if edge != ResizeEdge.NONE:
		_apply_cursor_shape(_cursor_for_resize_edge(edge))
		return

	if over_handle:
		_apply_cursor_shape(Control.CURSOR_DRAG)
	else:
		_apply_cursor_shape(Control.CURSOR_ARROW)


func _ensure_resize_guides() -> void:
	if _resize_guides_layer:
		return

	_resize_guides_layer = Control.new()
	_resize_guides_layer.name = "ResizeGuides"
	_resize_guides_layer.anchor_right = 1.0
	_resize_guides_layer.anchor_bottom = 1.0
	_resize_guides_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_resize_guides_layer.z_index = 100
	add_child(_resize_guides_layer)

	for guide_name in ["left", "right", "top", "bottom", "top_left", "top_right", "bottom_left", "bottom_right"]:
		var guide := ColorRect.new()
		guide.name = guide_name
		guide.mouse_filter = Control.MOUSE_FILTER_IGNORE
		guide.color = Color(0.7, 0.78, 0.95, 0.08)
		guide.z_index = 100
		_resize_guides_layer.add_child(guide)
		_resize_guides[guide_name] = guide


func _update_resize_guides() -> void:
	if not _resize_guides_layer:
		return

	_resize_guides_layer.visible = visible and not _is_collapsed
	if not _resize_guides_layer.visible:
		return

	var margin = _effective_resize_margin()
	var corner_size = margin * 1.2
	var pulse = 0.5 + 0.5 * sin(Time.get_ticks_msec() / 1000.0 * 4.0)
	var idle_color = Color(0.18, 0.22, 0.32, lerpf(0.08, 0.18, pulse))
	var active_color = Color(0.85, 0.92, 1.0, lerpf(0.16, 0.42, pulse))
	var focus_edge = _resize_edge if _is_resizing else _hover_resize_edge

	var left_guide: ColorRect = _resize_guides.get("left")
	left_guide.anchor_left = 0.0
	left_guide.anchor_top = 0.0
	left_guide.anchor_right = 0.0
	left_guide.anchor_bottom = 1.0
	left_guide.offset_left = 0.0
	left_guide.offset_top = margin
	left_guide.offset_right = margin
	left_guide.offset_bottom = -margin

	var right_guide: ColorRect = _resize_guides.get("right")
	right_guide.anchor_left = 1.0
	right_guide.anchor_top = 0.0
	right_guide.anchor_right = 1.0
	right_guide.anchor_bottom = 1.0
	right_guide.offset_left = -margin
	right_guide.offset_top = margin
	right_guide.offset_right = 0.0
	right_guide.offset_bottom = -margin

	var top_guide: ColorRect = _resize_guides.get("top")
	top_guide.anchor_left = 0.0
	top_guide.anchor_top = 0.0
	top_guide.anchor_right = 1.0
	top_guide.anchor_bottom = 0.0
	top_guide.offset_left = margin
	top_guide.offset_top = 0.0
	top_guide.offset_right = -margin
	top_guide.offset_bottom = margin

	var bottom_guide: ColorRect = _resize_guides.get("bottom")
	bottom_guide.anchor_left = 0.0
	bottom_guide.anchor_top = 1.0
	bottom_guide.anchor_right = 1.0
	bottom_guide.anchor_bottom = 1.0
	bottom_guide.offset_left = margin
	bottom_guide.offset_top = -margin
	bottom_guide.offset_right = -margin
	bottom_guide.offset_bottom = 0.0

	var top_left_guide: ColorRect = _resize_guides.get("top_left")
	top_left_guide.anchor_left = 0.0
	top_left_guide.anchor_top = 0.0
	top_left_guide.anchor_right = 0.0
	top_left_guide.anchor_bottom = 0.0
	top_left_guide.offset_left = 0.0
	top_left_guide.offset_top = 0.0
	top_left_guide.offset_right = corner_size
	top_left_guide.offset_bottom = corner_size

	var top_right_guide: ColorRect = _resize_guides.get("top_right")
	top_right_guide.anchor_left = 1.0
	top_right_guide.anchor_top = 0.0
	top_right_guide.anchor_right = 1.0
	top_right_guide.anchor_bottom = 0.0
	top_right_guide.offset_left = -corner_size
	top_right_guide.offset_top = 0.0
	top_right_guide.offset_right = 0.0
	top_right_guide.offset_bottom = corner_size

	var bottom_left_guide: ColorRect = _resize_guides.get("bottom_left")
	bottom_left_guide.anchor_left = 0.0
	bottom_left_guide.anchor_top = 1.0
	bottom_left_guide.anchor_right = 0.0
	bottom_left_guide.anchor_bottom = 1.0
	bottom_left_guide.offset_left = 0.0
	bottom_left_guide.offset_top = -corner_size
	bottom_left_guide.offset_right = corner_size
	bottom_left_guide.offset_bottom = 0.0

	var bottom_right_guide: ColorRect = _resize_guides.get("bottom_right")
	bottom_right_guide.anchor_left = 1.0
	bottom_right_guide.anchor_top = 1.0
	bottom_right_guide.anchor_right = 1.0
	bottom_right_guide.anchor_bottom = 1.0
	bottom_right_guide.offset_left = -corner_size
	bottom_right_guide.offset_top = -corner_size
	bottom_right_guide.offset_right = 0.0
	bottom_right_guide.offset_bottom = 0.0

	for guide_name in _resize_guides.keys():
		var guide: ColorRect = _resize_guides[guide_name]
		guide.color = active_color if _guide_matches_edge(guide_name, focus_edge) else idle_color


func _guide_matches_edge(guide_name: String, edge: int) -> bool:
	match edge:
		ResizeEdge.LEFT:
			return guide_name in ["left", "top_left", "bottom_left"]
		ResizeEdge.RIGHT:
			return guide_name in ["right", "top_right", "bottom_right"]
		ResizeEdge.TOP:
			return guide_name in ["top", "top_left", "top_right"]
		ResizeEdge.BOTTOM:
			return guide_name in ["bottom", "bottom_left", "bottom_right"]
		ResizeEdge.TOP_LEFT:
			return guide_name in ["left", "top", "top_left"]
		ResizeEdge.TOP_RIGHT:
			return guide_name in ["right", "top", "top_right"]
		ResizeEdge.BOTTOM_LEFT:
			return guide_name in ["left", "bottom", "bottom_left"]
		ResizeEdge.BOTTOM_RIGHT:
			return guide_name in ["right", "bottom", "bottom_right"]
		_:
			return false


func _resize_panel(mouse_global_pos: Vector2) -> void:
	var delta = mouse_global_pos - _resize_start_mouse
	var new_pos = _resize_start_pos
	var new_size = _resize_start_size

	match _resize_edge:
		ResizeEdge.LEFT:
			new_pos.x += delta.x
			new_size.x -= delta.x
		ResizeEdge.RIGHT:
			new_size.x += delta.x
		ResizeEdge.TOP:
			new_pos.y += delta.y
			new_size.y -= delta.y
		ResizeEdge.BOTTOM:
			new_size.y += delta.y
		ResizeEdge.TOP_LEFT:
			new_pos.x += delta.x
			new_size.x -= delta.x
			new_pos.y += delta.y
			new_size.y -= delta.y
		ResizeEdge.TOP_RIGHT:
			new_size.x += delta.x
			new_pos.y += delta.y
			new_size.y -= delta.y
		ResizeEdge.BOTTOM_LEFT:
			new_pos.x += delta.x
			new_size.x -= delta.x
			new_size.y += delta.y
		ResizeEdge.BOTTOM_RIGHT:
			new_size += delta
		_:
			return

	var resize_from_left = _resize_edge in [ResizeEdge.LEFT, ResizeEdge.TOP_LEFT, ResizeEdge.BOTTOM_LEFT]
	var resize_from_top = _resize_edge in [ResizeEdge.TOP, ResizeEdge.TOP_LEFT, ResizeEdge.TOP_RIGHT]

	var start_right = _resize_start_pos.x + _resize_start_size.x
	var start_bottom = _resize_start_pos.y + _resize_start_size.y

	if new_size.x < min_size.x:
		new_size.x = min_size.x
		if resize_from_left:
			new_pos.x = start_right - new_size.x

	if new_size.y < min_size.y:
		new_size.y = min_size.y
		if resize_from_top:
			new_pos.y = start_bottom - new_size.y

	var vp = get_viewport_rect().size
	var min_width = min(min_size.x, vp.x)
	var min_height = min(min_size.y, vp.y)
	new_pos.x = clampf(new_pos.x, 0.0, max(vp.x - new_size.x, 0.0))
	new_pos.y = clampf(new_pos.y, 0.0, max(vp.y - new_size.y, 0.0))
	new_size.x = clampf(new_size.x, min_width, max(vp.x - new_pos.x, min_width))
	new_size.y = clampf(new_size.y, min_height, max(vp.y - new_pos.y, min_height))

	global_position = new_pos
	size = new_size


func _on_handle_gui_input(event: InputEvent) -> void:
	if _drag_handle == null:
		return

	if event is InputEventMouseButton:
		var button_event := event as InputEventMouseButton
		if button_event.button_index != MOUSE_BUTTON_LEFT:
			return
		if button_event.pressed:
			if _is_over_interaction_exclusion(button_event.global_position):
				_is_dragging = false
				return
			if _get_resize_edge_from_global(button_event.global_position) != ResizeEdge.NONE:
				_is_dragging = false
				return
			_is_dragging = true
			_drag_offset = button_event.global_position - global_position
			_drag_handle.accept_event()
		else:
			_is_dragging = false
			
	elif event is InputEventMouseMotion and _is_dragging and not _is_resizing:
		var motion_event := event as InputEventMouseMotion
		if _is_over_interaction_exclusion(motion_event.global_position):
			_is_dragging = false
			return
		global_position = motion_event.global_position - _drag_offset
		var vp: Vector2 = get_viewport_rect().size
		global_position.x = clampf(global_position.x, -size.x + 60, vp.x - 60)
		global_position.y = clampf(global_position.y, 0.0, vp.y - 40)
		_drag_handle.accept_event()


## Trigger full collapse into a floating button
## 将面板完全折叠为一个浮动按钮
func collapse(button_text: String = "[>]", alignment: int = HORIZONTAL_ALIGNMENT_LEFT) -> void:
	if _is_collapsed:
		return
	_is_collapsed = true
	_collapse_alignment = alignment
	
	_restored_size = size
	_restored_pos = global_position
	
	visible = false
	
	if not collapse_button:
		collapse_button = Button.new()
		collapse_button.text = button_text
		collapse_button.custom_minimum_size = Vector2(56, 56)
		collapse_button.focus_mode = Control.FOCUS_NONE
		collapse_button.tooltip_text = "Show Panel"
		
		# Glassmorphic style for high visibility on any background
		# 玻璃态设计，确保在任何背景下都有高可见性
		var style = StyleBoxFlat.new()
		style.bg_color = Color(0.08, 0.1, 0.14, 0.92)
		style.corner_radius_top_left = 28
		style.corner_radius_top_right = 28
		style.corner_radius_bottom_left = 28
		style.corner_radius_bottom_right = 28
		style.border_width_left = 1
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
		style.border_color = Color(0.45, 0.55, 0.75, 0.6)
		style.shadow_color = Color(0, 0, 0, 0.65)
		style.shadow_size = 12
		
		collapse_button.add_theme_stylebox_override("normal", style)
		
		var hover_style = style.duplicate() as StyleBoxFlat
		hover_style.bg_color = Color(0.14, 0.18, 0.26, 0.98)
		hover_style.border_color = Color(0.6, 0.72, 0.95, 0.9)
		hover_style.shadow_size = 16
		hover_style.shadow_color = Color(0.2, 0.4, 0.8, 0.5)
		collapse_button.add_theme_stylebox_override("hover", hover_style)
		
		var pressed_style = style.duplicate() as StyleBoxFlat
		pressed_style.bg_color = Color(0.06, 0.08, 0.1, 0.95)
		collapse_button.add_theme_stylebox_override("pressed", pressed_style)
		
		collapse_button.add_theme_color_override("font_color", Color(0.85, 0.9, 0.95, 1.0))
		collapse_button.add_theme_color_override("font_hover_color", Color(1.0, 1.0, 1.0, 1.0))
		collapse_button.add_theme_font_size_override("font_size", 28)
		
		collapse_button.pressed.connect(restore)
		
		# Add to same parent so it stays at the same hierarchy level
		get_parent().add_child(collapse_button)
		
	collapse_button.visible = true
	
	# Position the button at the screen edge where the panel used to be
	var vp_size = get_viewport_rect().size
	if alignment == HORIZONTAL_ALIGNMENT_LEFT:
		collapse_button.global_position = Vector2(4, _restored_pos.y)
	else:
		collapse_button.global_position = Vector2(vp_size.x - 48, _restored_pos.y)
	
	collapsed_state_changed.emit(true)


func restore() -> void:
	if not _is_collapsed:
		return
	_is_collapsed = false
	
	if collapse_button:
		collapse_button.visible = false
		
	visible = true
	size = _restored_size
	global_position = _restored_pos
	
	collapsed_state_changed.emit(false)

