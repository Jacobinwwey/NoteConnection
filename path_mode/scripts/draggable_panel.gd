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

## The button that appears when panel is collapsed / 面板折叠时出现的按钮
var collapse_button: Button

## Internal state / 内部状态
var _drag_handle: Control = null
var _is_dragging := false
var _is_resizing := false
var _drag_offset := Vector2.ZERO
var _resize_start_size := Vector2.ZERO
var _resize_start_pos := Vector2.ZERO
var _is_collapsed := false
var _collapse_alignment: int = HORIZONTAL_ALIGNMENT_LEFT

## Save state for restoring from collapse / 保存折叠前的状态用于恢复
var _restored_size := Vector2.ZERO
var _restored_pos := Vector2.ZERO

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_PASS


## Call this AFTER adding the panel to the tree and setting the drag handle.
## 在将面板添加到树并设置拖拽句柄之后调用此方法。
func setup_drag_handle(handle: Control) -> void:
	_drag_handle = handle
	if _drag_handle:
		_drag_handle.gui_input.connect(_on_handle_gui_input)
		_drag_handle.mouse_default_cursor_shape = Control.CURSOR_DRAG


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var local_pos = get_local_mouse_position()
		var at_edge = _is_at_resize_edge(local_pos)
		
		if _is_resizing:
			var delta = event.global_position - _resize_start_pos
			size = _resize_start_size + delta
			size.x = max(size.x, min_size.x)
			size.y = max(size.y, min_size.y)
		elif at_edge:
			mouse_default_cursor_shape = CURSOR_FDIAGSIZE
		else:
			mouse_default_cursor_shape = CURSOR_ARROW
			
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		var local_pos = get_local_mouse_position()
		var at_edge = _is_at_resize_edge(local_pos)
		
		if event.pressed and at_edge:
			_is_resizing = true
			_resize_start_size = size
			_resize_start_pos = event.global_position
			accept_event()
		elif not event.pressed:
			_is_resizing = false


func _is_at_resize_edge(local_pos: Vector2) -> bool:
	## Check bottom edge, right edge, or corner
	var at_right = local_pos.x > size.x - resize_margin
	var at_bottom = local_pos.y > size.y - resize_margin
	return at_right and at_bottom


func _on_handle_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_is_dragging = true
			_drag_offset = event.global_position - global_position
			_drag_handle.accept_event()
		else:
			_is_dragging = false
			
	elif event is InputEventMouseMotion and _is_dragging:
		global_position = event.global_position - _drag_offset
		# Clamp to viewport so the panel doesn't disappear off-screen
		var vp = get_viewport_rect().size
		global_position.x = clampf(global_position.x, -size.x + 60, vp.x - 60)
		global_position.y = clampf(global_position.y, 0, vp.y - 40)
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
		collapse_button.custom_minimum_size = Vector2(44, 44)
		collapse_button.focus_mode = Control.FOCUS_NONE
		collapse_button.tooltip_text = "Show Panel"
		
		# Glassmorphic style for high visibility on any background
		# 玻璃态设计，确保在任何背景下都有高可见性
		var style = StyleBoxFlat.new()
		style.bg_color = Color(0.08, 0.1, 0.14, 0.88)
		style.corner_radius_top_left = 22
		style.corner_radius_top_right = 22
		style.corner_radius_bottom_left = 22
		style.corner_radius_bottom_right = 22
		style.border_width_left = 2
		style.border_width_top = 2
		style.border_width_right = 2
		style.border_width_bottom = 2
		style.border_color = Color(0.45, 0.55, 0.75, 0.9)
		style.shadow_color = Color(0, 0, 0, 0.55)
		style.shadow_size = 10
		style.content_margin_left = 6
		style.content_margin_right = 6
		
		collapse_button.add_theme_stylebox_override("normal", style)
		
		var hover_style = style.duplicate() as StyleBoxFlat
		hover_style.bg_color = Color(0.14, 0.18, 0.26, 0.95)
		hover_style.border_color = Color(0.6, 0.72, 0.95, 1.0)
		hover_style.shadow_size = 14
		collapse_button.add_theme_stylebox_override("hover", hover_style)
		
		var pressed_style = style.duplicate() as StyleBoxFlat
		pressed_style.bg_color = Color(0.06, 0.08, 0.1, 0.95)
		collapse_button.add_theme_stylebox_override("pressed", pressed_style)
		
		collapse_button.add_theme_color_override("font_color", Color(0.95, 0.97, 1.0, 1.0))
		collapse_button.add_theme_font_size_override("font_size", 20)
		
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
