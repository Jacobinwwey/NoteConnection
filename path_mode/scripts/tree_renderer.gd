class_name TreeRenderer
extends Node2D

# Signals
signal node_clicked(node_id, local_pos)
signal node_double_clicked(node_id)
signal background_clicked
signal node_toggle_requested(node_id) # New
signal node_expand_prereqs_requested(node_id) # New: For hidden prerequisites
signal node_collapse_prereqs_requested(node_id) # New: For hiding prerequisites
signal collapse_all_requested() # New: Middle click to collapse all
signal node_navigate_requested(node_id) # New: Explicit navigation signal

# State
var _nodes: Array = []
var _current_id: String = ""
var _completed_ids: Array = []
var _current_style: String = "colorful"
var _style_config: Dictionary = {}
var _focus_mode_enabled: bool = true # New: Focus Highlighting

# Layout Data Support
var _use_layout_coords: bool = false
var _layout_nodes: Array = []
var _layout_edges: Array = []
var _layout_hulls: Array = []

# View State (Pan/Zoom)
var _zoom_level: float = 1.0
var _view_offset: Vector2 = Vector2.ZERO
var _is_dragging: bool = false
var _drag_start: Vector2 = Vector2.ZERO
var _view_start: Vector2 = Vector2.ZERO

# Interaction State (Long Press)
var _pressed_node_id: String = ""
var _press_start_time: float = 0.0
var _is_long_pressing: bool = false
var _is_pressed: bool = false
var _press_pos: Vector2 = Vector2.ZERO
const CLICK_DRAG_THRESHOLD := 5.0
const LONG_PRESS_DURATION := 0.6 # Seconds

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
	set_process(true)

func _process(_delta: float) -> void:
	if _is_long_pressing and not _pressed_node_id.is_empty():
		var elapsed = (Time.get_ticks_msec() / 1000.0) - _press_start_time
		
		# Feedback: Queue redraw to animate progress ring
		queue_redraw()
		
		if elapsed >= LONG_PRESS_DURATION:
			# Long Press Triggered: SWITCH CENTRAL (Navigate)
			# Send explicit Navigate signal instead of Click (which opens context menu)
			print("[TreeRenderer] Long Press Triggered on:", _pressed_node_id)
			node_navigate_requested.emit(_pressed_node_id)
			
			# Reset state to prevent multiple triggers
			_is_long_pressing = false
			_pressed_node_id = ""
			queue_redraw()


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
	_layout_hulls = layout.get("hulls", [])
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

func set_focus_mode(enabled: bool) -> void:
	if _focus_mode_enabled != enabled:
		_focus_mode_enabled = enabled
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
	
	# Draw Long Press Progress Ring (Overlay)
	if _is_long_pressing and not _pressed_node_id.is_empty():
		var pos = _node_positions.get(_pressed_node_id)
		if pos != null:
			var elapsed = (Time.get_ticks_msec() / 1000.0) - _press_start_time
			var progress = clampf(elapsed / LONG_PRESS_DURATION, 0.0, 1.0)
			
			if progress > 0.0:
				var radius = 25.0 # Fixed or responsive?
				# Draw background ring (faint)
				draw_arc(pos, radius, 0, TAU, 32, Color(1, 1, 1, 0.3), 3.0)
				# Draw progress arc (active)
				var end_angle = - PI / 2 + (progress * TAU)
				draw_arc(pos, radius, -PI / 2, end_angle, 32, Color(0.2, 0.8, 1.0, 0.9), 3.0)
		
func _draw_layout_mode() -> void:
	if _layout_nodes.is_empty(): return
	
	_click_areas.clear()
	_node_positions.clear()
	
	var _base_radius = _style_config.get("node_radius", 8.0)
	
	# Draw Hulls (Background)
	_draw_hulls()
	
	# Determine Highlight Set (Central Node + Incoming Prerequisites)
	var highlight_ids = {}
	if _focus_mode_enabled and not _current_id.is_empty():
		highlight_ids[_current_id] = true
		for edge in _layout_edges:
			if edge.get("to") == _current_id:
				highlight_ids[edge.get("from")] = true
	
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
				
			# Focus Mode Dimming (Edges)
			if _focus_mode_enabled and not _current_id.is_empty():
				# Highlight only edges connected to Central Node (Incoming OR Outgoing? User said "in-degree nodes")
				# Let's highlight Incoming edges to Central to match "Illuminate in-degree nodes"
				if to_id == _current_id:
					color.a = 1.0 # Bright
					color = color.lightened(0.2) # Make it pop
				else:
					color.a = 0.1 # Dim
					
			# Horizontal S-Curve
			var dist_x = (end.x - start.x) * 0.5
			
			# Edge Filtering (Skip-Level Check)
			# Standard spacing is 250 in path_core.js. If distance > 300, it's a skip-level.
			if abs(end.x - start.x) > 300.0:
				continue # Skip drawing direct connection across levels
				
			var cp1 = start + Vector2(dist_x, 0)
			var cp2 = end - Vector2(dist_x, 0)
			
			_draw_bezier_curve(start, cp1, cp2, end, color, 2.0)
			
	# Draw Nodes
	var node_size = Vector2(140.0, 50.0) # Synced with Mockup
	var corner_radius = 25.0 # Fully rounded ends
	
	var sb = StyleBoxFlat.new()
	sb.set_corner_radius_all(corner_radius)
	
	for node in _layout_nodes:
		var pos = Vector2(node.x, node.y)
		_node_positions[node.id] = pos
		
		var color = _style_config.get("node_pending")
		var text_color = _style_config.get("label_color", Color.WHITE)
		
		if node.id == _current_id:
			color = _style_config.get("node_current")
		elif node.id in _completed_ids:
			color = _style_config.get("node_completed")
			text_color = Color.BLACK # Contrast for yellow/gold
		
		# Focus Mode Dimming
		if _focus_mode_enabled and not _current_id.is_empty():
			if not highlight_ids.has(node.id):
				color.a = 0.2
				text_color.a = 0.3
			else:
				color.a = 1.0
				text_color.a = 1.0

		# Draw Rounded Rectangle
		var rect_pos = pos - (node_size * 0.5)
		var rect = Rect2(rect_pos, node_size)
		
		# Reuse stylebox to avoid allocation spam (though cheap)
		sb.bg_color = color
		draw_style_box(sb, rect)
		
		# Draw Text (Centered & Wrapped)
		var font = ThemeDB.fallback_font
		var font_size = 14
		
		# Simple wrapping hack:
		var text = node.label
		var lines = []
		var current_line = ""
		
		# Approximation: Avg char width ~8px at size 14?
		# Or better: split by space and measure
		# Max width = node_size.x - 20 (padding)
		var max_line_width = node_size.x - 20.0
		
		var words = text.split(" ")
		for word in words:
			var test_line = current_line
			if not test_line.is_empty(): test_line += " "
			test_line += word
			
			var width = font.get_string_size(test_line, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size).x
			
			if width > max_line_width and not current_line.is_empty():
				lines.append(current_line)
				current_line = word
			else:
				current_line = test_line
		lines.append(current_line)
		
		var line_height = font_size + 4.0
		var total_text_height = lines.size() * line_height
		var start_y = pos.y - (total_text_height / 2.0) + (font_size * 0.7) # Ascent approx
		
		for i in range(lines.size()):
			var line = lines[i]
			var line_width = font.get_string_size(line, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size).x
			draw_string(font, Vector2(pos.x - line_width / 2.0, start_y + i * line_height), line, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, text_color)
		
		# Draw Spine glow/outline
		if node.get("isSpine", false):
			var spine_color = Color(1.0, 0.84, 0.0, 0.6)
			if node.id == _current_id: spine_color = Color(0.0, 0.8, 1.0, 0.8)
			draw_rect(rect, Color.TRANSPARENT, false, 2.0)
			
			var sb_spine = StyleBoxFlat.new()
			sb_spine.set_corner_radius_all(corner_radius)
			sb_spine.bg_color = Color.TRANSPARENT
			sb_spine.border_color = spine_color
			sb_spine.set_border_width_all(2)
			draw_style_box(sb_spine, rect)

		# Draw Expansion Indicator (Badge)
		if node.get("hasPrereqs", false):
			var badge_radius = 10.0
			var badge_pos = pos + Vector2(0, node_size.y * 0.5) # Bottom edge center
			var is_expanded = node.get("isExpanded", true)
			
			# Draw background circle
			draw_circle(badge_pos, badge_radius, Color(0.15, 0.15, 0.15, 1.0))
			# Draw outline
			draw_arc(badge_pos, badge_radius, 0, TAU, 16, Color(0.8, 0.8, 0.8, 0.8), 1.5)
			
			# Draw symbol (+ or -)
			var symbol = "-" if is_expanded else "+"
			var symbol_size = font.get_string_size(symbol, HORIZONTAL_ALIGNMENT_CENTER, -1, 14)
			draw_string(font, badge_pos + Vector2(-symbol_size.x / 2.0, symbol_size.y * 0.3), symbol, HORIZONTAL_ALIGNMENT_CENTER, -1, 14, Color.WHITE)

		# Register Node Click Area
		_click_areas.append({
			"rect": rect,
			"id": node.id,
			"type": "node",
			"radius": max(node_size.x, node_size.y)
		})

func _draw_hulls() -> void:
	if _layout_hulls.is_empty(): return
	
	for hull in _layout_hulls:
		var member_ids = hull.get("memberIds", [])
		if member_ids.is_empty(): continue
		
		var points = PackedVector2Array()
		var node_size_half = Vector2(140.0, 50.0) * 0.5
		var padding = 15.0
		
		for id in member_ids:
			var node = _find_layout_node(id)
			if node.is_empty(): continue
			var pos = Vector2(node.x, node.y)
			
			var w = node_size_half.x + padding
			var h = node_size_half.y + padding
			
			points.append(pos + Vector2(-w, -h))
			points.append(pos + Vector2(w, -h))
			points.append(pos + Vector2(w, h))
			points.append(pos + Vector2(-w, h))

		if points.size() >= 3:
			var hull_points = Geometry2D.convex_hull(points)
			var color = Color(0.298, 0.686, 0.314, 0.08) # rgba(76, 175, 80, 0.08)
			var stroke_color = Color(0.298, 0.686, 0.314, 0.4)
			
			draw_colored_polygon(hull_points, color)
			
			# Draw Outline 
			hull_points.append(hull_points[0])
			draw_polyline(hull_points, stroke_color, 2.0, true)

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
		
		# --- Long Press & Click Logic (Left Button) ---
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_is_pressed = true
				_press_pos = mb.position
				
				# Check for node hit to start Long Press
				var world_pos = (mb.position - _view_offset) / _zoom_level
				for area in _click_areas:
					if area.rect.has_point(world_pos) and area.get("type") == "node":
						_pressed_node_id = area.id
						_press_start_time = Time.get_ticks_msec() / 1000.0
						_is_long_pressing = true
						queue_redraw() # Start progress animation
						break
			else:
				# Released
				var was_long_press = _is_long_pressing and ((Time.get_ticks_msec() / 1000.0) - _press_start_time) >= LONG_PRESS_DURATION
				
				_is_pressed = false
				_is_long_pressing = false
				_pressed_node_id = ""
				queue_redraw() # Clear progress animation
				
				if not was_long_press:
					# Only register click if movement was minimal (not dragging)
					if mb.position.distance_to(_press_pos) < CLICK_DRAG_THRESHOLD:
						_handle_click(mb)

		# --- Pan (Middle or Right - logic says Middle implies Collapse All now) ---
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			if mb.pressed:
				# Right Click -> Toggle Expansion
				_handle_right_click(mb)
			# (Optional) Allow panning with right click drag if needed? 
			# User didn't specify, but often right-drag is pan. 
			# Let's keep existing pan (which was Middle/Right?)
			# Existing code used MOUSE_BUTTON_RIGHT/MIDDLE for pan.
			# If Middle is now "Collapse All", we should probably restrict Pan to Right-Drag or just Space+Left?
			# User request: "middle-clicking to collapse all nodes".
			# So Middle Click is Action. Middle Drag could still be Pan?
			# Let's check Middle Click on release or press? Usually Click actions are on Release or quick Press.
			pass

		elif mb.button_index == MOUSE_BUTTON_MIDDLE:
			if mb.pressed:
				collapse_all_requested.emit()
			else:
				# Stop any potential drag (if Middle was used for pan)
				_is_dragging = false

		# Zoom
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			_apply_zoom(1.1, mb.position)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_apply_zoom(0.9, mb.position)

	elif event is InputEventMouseMotion:
		if _is_pressed and (event.button_mask & MOUSE_BUTTON_MASK_RIGHT):
			# Allow Right-Mouse Pan if dragged?
			_handle_pan_drag(event)
		elif _is_pressed and (event.button_mask & MOUSE_BUTTON_MASK_LEFT) and _pressed_node_id == "":
			# Left-Mouse Pan if NOT on a node
			_handle_pan_drag(event)

func _handle_pan_drag(event: InputEventMouseMotion) -> void:
	var diff = event.relative
	_view_offset += diff
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
	var world_pos = (event.position - _view_offset) / _zoom_level
	var hit = false
	
	for area in _click_areas:
		if area.rect.has_point(world_pos):
			hit = true
			var type = area.get("type", "node")
			if type == "node":
				var node_id = area.id
				# Logic Update:
				# Double Click -> Toggle Expansion
				# Single Click -> Select (Node Clicked)
				if event.double_click:
					# Check current state to decide expand/collapse
					var node = _find_layout_node(node_id)
					if node.get("isExpanded", false):
						node_collapse_prereqs_requested.emit(node_id)
					else:
						node_expand_prereqs_requested.emit(node_id)
				else:
					node_clicked.emit(node_id, get_global_mouse_position())
			break
			
	if not hit:
		background_clicked.emit()

func _handle_right_click(event: InputEventMouseButton) -> void:
	var world_pos = (event.position - _view_offset) / _zoom_level
	for area in _click_areas:
		if area.rect.has_point(world_pos) and area.get("type") == "node":
			var node_id = area.id
			var node = _find_layout_node(node_id)
			if node.get("isExpanded", false):
				node_collapse_prereqs_requested.emit(node_id)
			else:
				node_expand_prereqs_requested.emit(node_id)
			return
