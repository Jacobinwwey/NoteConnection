class_name TreeRenderer
extends Node2D

# Signals
signal node_clicked(node_id, local_pos)
signal node_double_clicked(node_id)
signal background_clicked
signal node_toggle_requested(node_id) # New
signal node_expand_prereqs_requested(node_id) # New: For hidden prerequisites

# State
var _nodes: Array = []
var _current_id: String = ""
var _completed_ids: Array = []
var _current_style: String = "colorful"
var _style_config: Dictionary = {}

# Layout Data Support
var _use_layout_coords: bool = false
var _layout_nodes: Array = []
var _layout_edges: Array = []

# View State (Pan/Zoom)
var _zoom_level: float = 1.0
var _view_offset: Vector2 = Vector2.ZERO
var _is_dragging: bool = false
var _drag_start: Vector2 = Vector2.ZERO
var _view_start: Vector2 = Vector2.ZERO

# Layout params
const LEVEL_HEIGHT = 60.0 # Vertical distance between levels
const SIBLING_SPACING = 40.0 # Horizontal distance between nodes
const LABEL_OFFSET := Vector2(12, 4)
const TOGGLE_RADIUS := 6.0
const TOGGLE_OFFSET_X := 16.0 # Distance from node edge to toggle button

# Cache
var _node_positions: Dictionary = {} # id -> Vector2
var _click_areas: Array = [] # {rect, id}

func _ready() -> void:
	_update_style_config()

func set_data(nodes: Array, current_id: String, completed_ids: Array) -> void:
	_nodes = nodes
	_layout_nodes.clear()
	_layout_edges.clear()
	_use_layout_coords = false
	_current_id = current_id
	_completed_ids = completed_ids
	
	# Reset view for new linear data? Maybe keep context.
	# _view_offset = Vector2(40, 40)
	queue_redraw()

func set_layout_data(layout: Dictionary, current_id: String, completed_ids: Array) -> void:
	_layout_nodes = layout.get("nodes", [])
	_layout_edges = layout.get("edges", [])
	_use_layout_coords = true
	_current_id = current_id
	_completed_ids = completed_ids
	
	# Only reset view if switching major contexts? For now keep it stable.
	queue_redraw()

func set_style(style_name: String) -> void:
	if _current_style != style_name:
		_current_style = style_name
		_update_style_config()
		queue_redraw()

func _update_style_config() -> void:
	_style_config = TreeStyles.get_style(_current_style)

func _draw() -> void:
	# Apply Transform
	draw_set_transform(_view_offset, 0.0, Vector2(_zoom_level, _zoom_level))
	
	if _use_layout_coords:
		_draw_layout_mode()
	else:
		_draw_legacy_mode()
		
func _draw_layout_mode() -> void:
	if _layout_nodes.is_empty(): return
	
	_click_areas.clear()
	_node_positions.clear()
	
	var base_radius = _style_config.get("node_radius", 8.0)
	
	# Draw Edges (Horizontal Bezier)
	for edge in _layout_edges:
		var from_id = edge.get("from", "")
		var to_id = edge.get("to", "")
		
		var from_node = _find_layout_node(from_id)
		var to_node = _find_layout_node(to_id)
		
		if from_node and to_node:
			var start = Vector2(from_node.x, from_node.y)
			var end = Vector2(to_node.x, to_node.y)
			
			var color = _style_config.get("node_pending")
			color.a = 0.5
			if from_id in _completed_ids and to_id in _completed_ids:
				color = _style_config.get("node_completed")
				color.a = 0.8
				
			# Horizontal S-Curve
			var dist_x = (end.x - start.x) * 0.5
			var cp1 = start + Vector2(dist_x, 0)
			var cp2 = end - Vector2(dist_x, 0)
			
			_draw_bezier_curve(start, cp1, cp2, end, color, 2.0)
			
	# Draw Nodes with size based on in-degree
	for node in _layout_nodes:
		var pos = Vector2(node.x, node.y)
		_node_positions[node.id] = pos
		
		var color = _style_config.get("node_pending")
		if node.id == _current_id:
			color = _style_config.get("node_current")
		elif node.id in _completed_ids:
			color = _style_config.get("node_completed")
		
		# Calculate node radius based on in-degree (higher = larger = more foundational)
		var in_deg = node.get("inDegree", 0)
		var degree_factor = clampf(1.0 + float(in_deg) / 5.0, 1.0, 2.0)
		var node_radius = base_radius * degree_factor
		
		draw_circle(pos, node_radius, color)
		
		# Draw label
		var label_color = _style_config.get("label_color", Color.WHITE)
		draw_string(ThemeDB.fallback_font, pos + LABEL_OFFSET, node.label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, label_color)
		
		# Register Node Click Area (using dynamic radius)
		_click_areas.append({
			"rect": Rect2(pos - Vector2(node_radius, node_radius), Vector2(node_radius * 2, node_radius * 2)),
			"id": node.id,
			"type": "node",
			"radius": node_radius
		})

		# Draw Toggle Button (if has children)
		if node.get("hasChildren", false):
			var toggle_pos = pos + Vector2(node_radius + TOGGLE_OFFSET_X, 0)
			var is_collapsed = node.get("collapsed", false)
			
			# draw button circle
			var btn_color = Color(0.2, 0.2, 0.2, 1.0)
			draw_circle(toggle_pos, TOGGLE_RADIUS, btn_color)
			draw_arc(toggle_pos, TOGGLE_RADIUS, 0, TAU, 16, Color.WHITE, 1.0)
			
			# draw sign (+ or -)
			var sign_color = Color.WHITE
			draw_line(toggle_pos - Vector2(3, 0), toggle_pos + Vector2(3, 0), sign_color, 1.0)
			if is_collapsed:
				draw_line(toggle_pos - Vector2(0, 3), toggle_pos + Vector2(0, 3), sign_color, 1.0)
			
			# Register Toggle Click Area
			_click_areas.append({
				"rect": Rect2(toggle_pos - Vector2(TOGGLE_RADIUS, TOGGLE_RADIUS), Vector2(TOGGLE_RADIUS * 2, TOGGLE_RADIUS * 2)),
				"id": node.id,
				"type": "toggle"
			})

		# Draw Hidden Prereqs Indicator (Left side)
		if node.get("hasHiddenPrereqs", false):
			var indicator_pos = pos - Vector2(node_radius + TOGGLE_OFFSET_X, 0)
			
			# draw button circle (Different color for distinction?)
			var btn_color = Color(0.3, 0.2, 0.2, 1.0) # Reddish tint?
			draw_circle(indicator_pos, TOGGLE_RADIUS, btn_color)
			draw_arc(indicator_pos, TOGGLE_RADIUS, 0, TAU, 16, Color.WHITE, 1.0)
			
			# draw sign (+)
			var sign_color = Color.WHITE
			draw_line(indicator_pos - Vector2(3, 0), indicator_pos + Vector2(3, 0), sign_color, 1.0)
			draw_line(indicator_pos - Vector2(0, 3), indicator_pos + Vector2(0, 3), sign_color, 1.0)
			
			# Register Click Area
			_click_areas.append({
				"rect": Rect2(indicator_pos - Vector2(TOGGLE_RADIUS, TOGGLE_RADIUS), Vector2(TOGGLE_RADIUS * 2, TOGGLE_RADIUS * 2)),
				"id": node.id,
				"type": "expand_prereqs"
			})

# Helper for bezier drawing
func _draw_bezier_curve(p0: Vector2, p1: Vector2, p2: Vector2, p3: Vector2, color: Color, width: float) -> void:
	var points = PackedVector2Array()
	var segments = 20
	for i in range(segments + 1):
		var t = float(i) / segments
		var q0 = p0.lerp(p1, t)
		var q1 = p1.lerp(p2, t)
		var q2 = p2.lerp(p3, t)
		var r0 = q0.lerp(q1, t)
		var r1 = q1.lerp(q2, t)
		var pos = r0.lerp(r1, t)
		points.append(pos)
	draw_polyline(points, color, width, true)

func _find_layout_node(id: String) -> Dictionary:
	for n in _layout_nodes:
		if n.id == id: return n
	return {}

func _draw_legacy_mode() -> void:
	if _nodes.is_empty():
		return
		
	_click_areas.clear()
	_node_positions.clear()
	
	var start_pos = Vector2(0, 0) # Relative to transformed origin
	var current_pos = start_pos
	
	for i in range(_nodes.size()):
		var node = _nodes[i]
		_node_positions[node.id] = current_pos
		
		# Determine color based on state
		var color = _style_config.get("node_pending")
		if node.id == _current_id:
			color = _style_config.get("node_current")
		elif node.id in _completed_ids:
			color = _style_config.get("node_completed")
			
		# Draw connections (simple prev->next for linear, need parent info for tree)
		if i > 0:
			var prev_node = _nodes[i - 1]
			var prev_pos = _node_positions.get(prev_node.id, Vector2.ZERO)
			_draw_connection(prev_pos, current_pos, color)
			
		# Draw node
		draw_circle(current_pos, _style_config.get("node_radius", 8.0), color)
		
		# Draw label
		var label_color = _style_config.get("label_color", Color.WHITE)
		draw_string(ThemeDB.fallback_font, current_pos + LABEL_OFFSET, node.label, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, label_color)
		
		# Register click area
		var r = _style_config.get("node_radius", 8.0)
		_click_areas.append({
			"rect": Rect2(current_pos - Vector2(r, r), Vector2(r * 2, r * 2)),
			"id": node.id
		})
		
		current_pos.y += LEVEL_HEIGHT # Vertical stack for linear path default

func _draw_connection(from: Vector2, to: Vector2, color: Color) -> void:
	var curve = Curve2D.new()
	# Only do S-curve if vertical distance is significant
	var dist_y = abs(to.y - from.y)
	
	if dist_y > 10:
		curve.add_point(from, Vector2.ZERO, Vector2(0, (to.y - from.y) * 0.5))
		curve.add_point(to, Vector2(0, - (to.y - from.y) * 0.5), Vector2.ZERO)
		var line_color = _style_config.get("curve_color", color)
		if _style_config.get("curve_inherit_parent", false):
			line_color = color
		draw_polyline(curve.tessellate(), line_color, 2.0, true)
	else:
		# Straight line
		draw_line(from, to, color, 2.0, true)

## Check if a position hits any clickable node
func _is_click_on_node(screen_pos: Vector2) -> bool:
	var world_pos = (screen_pos - _view_offset) / _zoom_level
	for area in _click_areas:
		if area.rect.has_point(world_pos):
			return true
	return false

## Forwarded input from Container
func handle_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb = event
		
		# Pan (Middle, Right, or Left on empty background)
		var is_pan_button = mb.button_index == MOUSE_BUTTON_MIDDLE or mb.button_index == MOUSE_BUTTON_RIGHT
		var is_left_on_bg = mb.button_index == MOUSE_BUTTON_LEFT and not _is_click_on_node(mb.position)
		
		if is_pan_button or is_left_on_bg:
			if mb.pressed:
				_is_dragging = true
				_drag_start = mb.position
				_view_start = _view_offset
			else:
				_is_dragging = false
				
		# Zoom
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			_apply_zoom(1.1, mb.position)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_apply_zoom(0.9, mb.position)
			
		# Click Handling (Left)
		if mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed:
			_handle_click(mb)
			
	elif event is InputEventMouseMotion:
		if _is_dragging:
			var diff = event.position - _drag_start
			_view_offset = _view_start + diff
			queue_redraw()

func _apply_zoom(factor: float, center: Vector2) -> void:
	var old_zoom = _zoom_level
	_zoom_level = clamp(_zoom_level * factor, 0.1, 5.0)
	
	# Zoom towards center
	# (center - offset) / old_zoom = world_pos
	# world_pos * new_zoom + new_offset = center
	# new_offset = center - world_pos * new_zoom
	
	var world_mouse = (center - _view_offset) / old_zoom
	_view_offset = center - (world_mouse * _zoom_level)
	
	queue_redraw()

func _handle_click(event: InputEventMouseButton) -> void:
	# Event position from Container is already local to the Viewport (0,0 at top-left)
	var local_mouse = event.position
	
	# Reverse draw_set_transform: (local - offset) / zoom
	var world_pos = (local_mouse - _view_offset) / _zoom_level
	
	var hit = false
	for area in _click_areas:
		if area.rect.has_point(world_pos):
			var type = area.get("type", "node")
			if type == "toggle":
				node_toggle_requested.emit(area.id)
				return
			elif type == "expand_prereqs":
				node_expand_prereqs_requested.emit(area.id)
				return
			else: # type == "node"
				if event.double_click:
					node_double_clicked.emit(area.id)
				else:
					node_clicked.emit(area.id, get_global_mouse_position())
			hit = true
			break
	
	if not hit:
		background_clicked.emit()
