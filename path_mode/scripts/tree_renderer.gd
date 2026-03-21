class_name TreeRenderer
extends Node2D

const TREE_STYLES = preload("res://scripts/tree_styles.gd")

# Signals
signal node_clicked(node_id, local_pos)
signal node_double_clicked(node_id)
signal background_clicked
signal node_toggle_requested(node_id) # New
signal node_expand_prereqs_requested(node_id) # New: For hidden prerequisites
signal node_collapse_prereqs_requested(node_id) # New: For hiding prerequisites
signal collapse_all_requested() # New: Middle click to collapse all
signal node_navigate_requested(node_id) # New: Explicit navigation signal
signal node_reader_requested(node_id) # New: Explicit reader request

# State
var _nodes: Array = []
var _current_id: String = ""
var _completed_ids: Array = []
var _current_style: String = "colorful"
var _style_config: Dictionary = {}
var _focus_mode_enabled: bool = true # New: Focus Highlighting
var _orientation: int = 0 # 0 = Horizontal, 1 = Vertical

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

# Hover State (Light Exploration Info Box) / 悬停状态（轻度探索信息框）
var _hovered_node_id: String = ""
var _hover_start_time: float = 0.0
var _hover_info_visible: bool = false
var _hover_screen_pos: Vector2 = Vector2.ZERO
var _hover_in_expanded: bool = false # Whether the in-degree list is expanded
var _hover_out_expanded: bool = false # Whether the out-degree list is expanded
const HOVER_DELAY := 0.8 # 800ms hover delay for info box

# Hover Box Interaction State / 悬停框交互状态
var _hover_info_rect: Rect2 = Rect2()
var _hover_in_rect: Rect2 = Rect2()
var _hover_out_rect: Rect2 = Rect2()
var _hover_item_rects: Array[Dictionary] = [] # list of {rect, id}
var _hover_detail_button_rects: Array[Dictionary] = [] # list of {rect, id}
var _hover_expanded_sub_nodes: Array[String] = [] # Expanded rows for in/out details
var _hover_pin_time: float = 0.0 # 5-second auto-close timer

# Layout params
const LEVEL_HEIGHT = 60.0 # Vertical distance between levels
const SIBLING_SPACING = 40.0 # Horizontal distance between nodes
const LABEL_OFFSET := Vector2(12, 4)
const TOGGLE_RADIUS := 6.0
const TOGGLE_OFFSET_X := 16.0 # Distance from node edge to toggle button

# Cache
var _node_positions: Dictionary = {} # id -> Vector2
var _click_areas: Array = [] # {rect, id}

# Hull Node Management
var _hull_canvas_group: Node2D = null
var _hull_polygons: Array[Polygon2D] = []

func _ready() -> void:
	_hull_canvas_group = Node2D.new()
	_hull_canvas_group.z_index = -1
	add_child(_hull_canvas_group)
	_update_style_config()
	set_process(true)

func _process(_delta: float) -> void:
	if is_instance_valid(_hull_canvas_group):
		_hull_canvas_group.position = _view_offset
		_hull_canvas_group.scale = Vector2(_zoom_level, _zoom_level)

	# Long Press logic
	if _is_long_pressing and not _pressed_node_id.is_empty():
		var elapsed = (Time.get_ticks_msec() / 1000.0) - _press_start_time
		queue_redraw()
		if elapsed >= LONG_PRESS_DURATION:
			print("[TreeRenderer] Long Press Triggered on:", _pressed_node_id)
			node_navigate_requested.emit(_pressed_node_id)
			_is_long_pressing = false
			_pressed_node_id = ""
			queue_redraw()

	# Hover timer logic (Light Exploration) / 悬停计时器（轻度探索）
	if not _hovered_node_id.is_empty():
		var current_time = Time.get_ticks_msec() / 1000.0
		if not _hover_info_visible:
			var hover_elapsed = current_time - _hover_start_time
			if hover_elapsed >= HOVER_DELAY:
				_hover_info_visible = true
				_hover_pin_time = 0.0
				queue_redraw()
		else:
			# Check if we need to start or enforce the 5-second leave timer
			var mouse_pos = get_local_mouse_position()
			var world_pos = (mouse_pos - _view_offset) / _zoom_level
			var is_in_box = _hover_info_rect.has_point(mouse_pos)
			var is_on_node = false
			for area in _click_areas:
				if area.rect.has_point(world_pos) and area.get("type") == "node" and area.id == _hovered_node_id:
					is_on_node = true
					break
			
			if is_in_box or is_on_node:
				_hover_pin_time = 0.0 # Mouse active, keep open
			else:
				if _hover_pin_time == 0.0:
					_hover_pin_time = current_time # Start 5-second countdown
				elif current_time - _hover_pin_time >= 5.0:
					# 5 seconds elapsed while away, close it
					_hover_info_visible = false
					_hovered_node_id = ""
					_hover_expanded_sub_nodes.clear()
					_hover_pin_time = 0.0
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

func set_orientation(ori: int) -> void:
	if _orientation != ori:
		_orientation = ori
		var tmp = _view_offset.x
		_view_offset.x = _view_offset.y
		_view_offset.y = tmp
		queue_redraw()

func _get_layout_pos(node: Dictionary) -> Vector2:
	if _orientation == 1:
		return Vector2(node.get("y", 0.0), node.get("x", 0.0))
	return Vector2(node.get("x", 0.0), node.get("y", 0.0))

func _update_style_config() -> void:
	_style_config = TREE_STYLES.get_style(_current_style)

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
				var radius = 25.0
				draw_arc(pos, radius, 0, TAU, 32, Color(1, 1, 1, 0.3), 3.0)
				var end_angle = - PI / 2 + (progress * TAU)
				draw_arc(pos, radius, -PI / 2, end_angle, 32, Color(0.2, 0.8, 1.0, 0.9), 3.0)

	# Draw Light Exploration hover info box in SCREEN SPACE / 在屏幕空间绘制悬停信息框
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	_draw_hover_info_box()
		
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
			var start = _get_layout_pos(from_node)
			var end = _get_layout_pos(to_node)
			
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
					
			# Horizontal/Vertical S-Curve
			var primary_dist = (end.y - start.y) * 0.5 if _orientation == 1 else (end.x - start.x) * 0.5
			
			# Edge Filtering (Skip-Level Check)
			if abs(primary_dist * 2.0) > 300.0:
				continue # Skip drawing direct connection across levels
				
			var cp_offset = Vector2(0, primary_dist) if _orientation == 1 else Vector2(primary_dist, 0)
			var cp1 = start + cp_offset
			var cp2 = end - cp_offset
			
			_draw_bezier_curve(start, cp1, cp2, end, color, 2.0)
			
	# Draw Nodes
	var node_size = Vector2(140.0, 50.0) # Synced with Mockup
	var corner_radius = 25.0 # Fully rounded ends
	
	var sb = StyleBoxFlat.new()
	sb.set_corner_radius_all(corner_radius)
	
	for node in _layout_nodes:
		var pos = _get_layout_pos(node)
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
		
		# Draw Expanded Node Glow Effect
		if node.get("isExpanded", false) and node.get("isSpine", false):
			var glow_radius = max(node_size.x, node_size.y) * 0.7
			var glow_color = color
			glow_color.a = 0.3 # Base glow opacity
			
			# Draw multiple expanding rings for a soft glow
			draw_circle(pos, glow_radius * 0.7, glow_color)
			glow_color.a = 0.15
			draw_circle(pos, glow_radius * 0.85, glow_color)
			glow_color.a = 0.05
			draw_circle(pos, glow_radius, glow_color)
		
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

		# Draw Expansion Indicator (Badge) — SPINE NODES ONLY (Deep Exploration)
		# 展开指示标记 — 仅主干节点（深度探索）
		if node.get("hasPrereqs", false) and node.get("isSpine", false):
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
	if _layout_hulls.is_empty():
		for p in _hull_polygons:
			p.hide()
		return

	var hull_map = {}
	for hull in _layout_hulls:
		var group_id = hull.get("groupNodeId", "")
		hull_map[group_id] = hull.get("memberIds", [])

	var get_valid_members = func(root: String) -> Array:
		var res = []
		var stack = [root]
		var visited = {}
		while stack.size() > 0:
			var curr = stack.pop_back()
			if visited.has(curr): continue
			visited[curr] = true
			
			if hull_map.has(curr):
				var members = hull_map[curr]
				for m in members:
					if m != curr and not visited.has(m):
						res.append(m)
						stack.append(m)
						
		var unique_res = []
		for item in res:
			if not item in unique_res:
				unique_res.append(item)
		return unique_res

	# Determine Default Active Hull (Largest by descendants)
	var max_desc_count = -1
	var max_root_id = ""
	for hull in _layout_hulls:
		var group_id = hull.get("groupNodeId", "")
		var descs = get_valid_members.call(group_id)
		if descs.size() > max_desc_count:
			max_desc_count = descs.size()
			max_root_id = group_id
			
	var active_root_id = max_root_id
	
	# Override if hovering a node
	if not _hovered_node_id.is_empty():
		var min_size = 999999
		var hovered_root_id = ""
		for hull in _layout_hulls:
			var group_id = hull.get("groupNodeId", "")
			var descs = get_valid_members.call(group_id)
			if group_id == _hovered_node_id or _hovered_node_id in descs:
				var size = descs.size()
				if size < min_size:
					min_size = size
					hovered_root_id = group_id
		if not hovered_root_id.is_empty():
			active_root_id = hovered_root_id

	for p in _hull_polygons:
		p.hide()

	if active_root_id.is_empty():
		return
		
	var valid_member_ids = get_valid_members.call(active_root_id)
	if valid_member_ids.is_empty(): return
	
	var all_polygons = []
	var rx = 140.0 * 0.5 + 24.0
	var ry = 50.0 * 0.5 + 24.0
	
	# Add Node Rectangles
	for id in valid_member_ids:
		var node = _find_layout_node(id)
		if node.is_empty(): continue
		var pos = _get_layout_pos(node)
		all_polygons.append(PackedVector2Array([
			pos + Vector2(-rx, -ry),
			pos + Vector2(rx, -ry),
			pos + Vector2(rx, ry),
			pos + Vector2(-rx, ry)
		]))
		
	# Add edge capsules
	for edge in _layout_edges:
		var from_id = edge.get("from", "")
		var to_id = edge.get("to", "")
		if from_id in valid_member_ids and to_id in valid_member_ids:
			var from_node = _find_layout_node(from_id)
			var to_node = _find_layout_node(to_id)
			if not from_node.is_empty() and not to_node.is_empty():
				var p1 = _get_layout_pos(from_node)
				var p2 = _get_layout_pos(to_node)
				var dir = (p2 - p1).normalized()
				var perp = Vector2(-dir.y, dir.x) * (ry * 0.8)
				all_polygons.append(PackedVector2Array([
					p1 + perp, p1 - perp, p2 - perp, p2 + perp
				]))

	if all_polygons.is_empty():
		return
		
	# Merge Polygons Additively, discarding holes
	var finals: Array[PackedVector2Array] = []
	finals.append(all_polygons[0])
	for i in range(1, all_polygons.size()):
		var pToAdd = all_polygons[i]
		var did_merge = true
		while did_merge:
			did_merge = false
			var next_finals: Array[PackedVector2Array] = []
			for j in range(finals.size()):
				var f = finals[j]
				if not Geometry2D.intersect_polygons(f, pToAdd).is_empty():
					var res = Geometry2D.merge_polygons(f, pToAdd)
					pToAdd = res[0] # Take only the outer boundary
					did_merge = true
					for k in range(j + 1, finals.size()):
						next_finals.append(finals[k])
					break
				else:
					next_finals.append(f)
			finals = next_finals
		finals.append(pToAdd)

	var stroke_color = Color(0.298, 0.686, 0.314, 0.6)
	var shader = load("res://shaders/frosted_glass.gdshader")
	var poly_index = 0
	
	for fp in finals:
		var expanded_arr = Geometry2D.offset_polygon(fp, 18.0, Geometry2D.JOIN_ROUND)
		for expanded in expanded_arr:
			if poly_index >= _hull_polygons.size():
				var poly = Polygon2D.new()
				poly.antialiased = true
				var mat = ShaderMaterial.new()
				mat.shader = shader
				poly.material = mat
				poly.color = Color(1.0, 1.0, 1.0, 1.0)
				_hull_canvas_group.add_child(poly)
				_hull_polygons.append(poly)
				
			var poly = _hull_polygons[poly_index]
			poly.polygon = expanded
			poly.show()
			poly_index += 1
			
			if expanded.size() > 2:
				var outline = expanded.duplicate()
				outline.append(outline[0])
				draw_polyline(outline, stroke_color, 2.0, true)

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
			_handle_pan_drag(event)
		elif _is_pressed and (event.button_mask & MOUSE_BUTTON_MASK_LEFT) and _pressed_node_id == "":
			_handle_pan_drag(event)
		else:
			# Hover detection for Light Exploration / 轻度探索悬停检测
			_handle_hover(event)

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

	# Intercept click if on hover info box / 如果点击在悬停信息框上，拦截点击
	if _hover_info_visible and _hover_info_rect.has_point(event.position):
		for button_item in _hover_detail_button_rects:
			if button_item.rect.has_point(event.position):
				node_reader_requested.emit(button_item.id)
				return # Consume click

		var item_hit = false
		for item in _hover_item_rects:
			if item.rect.has_point(event.position):
				item_hit = true
				if event.double_click:
					node_reader_requested.emit(item.id)
				else:
					if _hover_expanded_sub_nodes.has(item.id):
						_hover_expanded_sub_nodes.erase(item.id)
					else:
						_hover_expanded_sub_nodes.append(item.id)
					queue_redraw()
				break

		if not item_hit:
			if _hover_in_rect.has_point(event.position):
				_hover_in_expanded = true
				queue_redraw()
			elif _hover_out_rect.has_point(event.position):
				_hover_out_expanded = true
				queue_redraw()
		return # Consume click

	# Dismiss hover info box on any OTHER click / 点击其他地方时关闭信息框
	if _hover_info_visible:
		_hover_info_visible = false
		_hovered_node_id = ""
		_hover_expanded_sub_nodes.clear()
		_hover_pin_time = 0.0
		_hover_detail_button_rects.clear()
		queue_redraw()

	for area in _click_areas:
		if area.rect.has_point(world_pos):
			hit = true
			var type = area.get("type", "node")
			if type == "node":
				var node_id = area.id
				var node = _find_layout_node(node_id)
				if event.double_click:
					# Deep Exploration: SPINE NODES ONLY / 深度探索：仅主干节点
					if node.get("isSpine", false):
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
	if _hover_info_visible and _hover_info_rect.has_point(event.position):
		for item in _hover_item_rects:
			if item.rect.has_point(event.position):
				node_navigate_requested.emit(item.id)
				_hover_info_visible = false
				_hover_expanded_sub_nodes.clear()
				queue_redraw()
				return
		return # Consume right click
		
	var world_pos = (event.position - _view_offset) / _zoom_level
	for area in _click_areas:
		if area.rect.has_point(world_pos) and area.get("type") == "node":
			var node_id = area.id
			var node = _find_layout_node(node_id)
			# Deep Exploration: SPINE NODES ONLY / 深度探索：仅主干节点
			if not node.get("isSpine", false):
				return # Non-spine node: ignore expand action
			if node.get("isExpanded", false):
				node_collapse_prereqs_requested.emit(node_id)
			else:
				node_expand_prereqs_requested.emit(node_id)
			return

## Handle hover for Light Exploration info box / 处理悬停以显示轻度探索信息框
func _handle_hover(event: InputEventMouseMotion) -> void:
	var world_pos = (event.position - _view_offset) / _zoom_level
	var found_node_id := ""

	for area in _click_areas:
		if area.rect.has_point(world_pos) and area.get("type") == "node":
			found_node_id = area.id
			break

	if _hover_info_visible:
		# If visible, check if mouse is over suspended window OR original node
		var is_in_box = _hover_info_rect.has_point(event.position)
		if is_in_box or found_node_id == _hovered_node_id:
			_hover_pin_time = 0.0 # Reset 5-second timer
			return
		# If mouse entered a DIFFERENT node completely, switch hover immediately
		if not found_node_id.is_empty() and found_node_id != _hovered_node_id:
			_hovered_node_id = found_node_id
			_hover_start_time = Time.get_ticks_msec() / 1000.0
			_hover_info_visible = false
			_hover_pin_time = 0.0
			_hover_in_expanded = false
			_hover_out_expanded = false
			_hover_expanded_sub_nodes.clear()
			_hover_detail_button_rects.clear()
			_hover_screen_pos = event.position
			queue_redraw()
		return

	# Logic when NOT visible yet
	if found_node_id.is_empty():
		# Mouse left all nodes — reset hover
		if not _hovered_node_id.is_empty():
			_hovered_node_id = ""
			_hover_start_time = 0.0
			_hover_expanded_sub_nodes.clear()
			queue_redraw()
	elif found_node_id != _hovered_node_id:
		# Mouse entered a new node — restart timer
		_hovered_node_id = found_node_id
		_hover_start_time = Time.get_ticks_msec() / 1000.0
		_hover_in_expanded = false
		_hover_out_expanded = false
		_hover_expanded_sub_nodes.clear()
		_hover_detail_button_rects.clear()
		_hover_screen_pos = event.position
		queue_redraw()
	else:
		# Same node, not visible yet — update position for info box anchor
		_hover_screen_pos = event.position

## Draw the Light Exploration hover info box / 绘制轻度探索悬停信息框
func _draw_hover_info_box() -> void:
	if not _hover_info_visible or _hovered_node_id.is_empty():
		return

	var node = _find_layout_node(_hovered_node_id)
	if not node:
		return

	var in_names: Array = node.get("inDegreeNames", [])
	var out_names: Array = node.get("outDegreeNames", [])
	var in_ids: Array = node.get("inDegreeIds", [])
	var out_ids: Array = node.get("outDegreeIds", [])

	var in_deg = in_names.size()
	var out_deg = out_names.size()

	var label = node.get("label", node.get("id", "?"))

	var font = ThemeDB.fallback_font
	var font_size = 12
	var line_h = 18.0
	var pad = Vector2(12, 10)

	var lines: Array[Dictionary] = []
	lines.append({"text": label, "id": ""})
	lines.append({"text": "", "id": ""})

	if in_deg < 10 or _hover_in_expanded:
		lines.append({"text": "In (%d):" % in_deg, "id": ""})
		for i in range(in_deg):
			var nid = in_ids[i] if i < in_ids.size() else ""
			var icon = "[v]" if _hover_expanded_sub_nodes.has(nid) else "[>]"
			lines.append({"text": "  <- " + icon + " " + str(in_names[i]), "id": nid})
			if _hover_expanded_sub_nodes.has(nid):
				_append_accordion_details(lines, nid, "      ")
	else:
		lines.append({"text": "In: %d  [click >]" % in_deg, "id": ""})

	lines.append({"text": "", "id": ""})

	if out_deg < 10 or _hover_out_expanded:
		lines.append({"text": "Out (%d):" % out_deg, "id": ""})
		for i in range(out_deg):
			var nid = out_ids[i] if i < out_ids.size() else ""
			var icon = "[v]" if _hover_expanded_sub_nodes.has(nid) else "[>]"
			lines.append({"text": "  -> " + icon + " " + str(out_names[i]), "id": nid})
			if _hover_expanded_sub_nodes.has(nid):
				_append_accordion_details(lines, nid, "      ")
	else:
		lines.append({"text": "Out: %d  [click >]" % out_deg, "id": ""})

	var detail_button_text = "Details"
	var detail_button_font_size = 11
	var detail_button_pad = Vector2(8, 4)
	var detail_button_gap = 10.0
	var detail_button_w = font.get_string_size(detail_button_text, HORIZONTAL_ALIGNMENT_LEFT, -1, detail_button_font_size).x + detail_button_pad.x * 2.0
	var detail_button_h = max(line_h - 4.0, 14.0)

	var max_w = 0.0
	for line_data in lines:
		var lw = font.get_string_size(line_data.text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		if not str(line_data.get("id", "")).is_empty():
			lw += detail_button_gap + detail_button_w
		max_w = max(max_w, lw)

	var box_w = max_w + pad.x * 2
	var box_h = lines.size() * line_h + pad.y * 2
	var box_pos = _hover_screen_pos + Vector2(16, -box_h / 2)

	var bg_rect = Rect2(box_pos, Vector2(box_w, box_h))
	var sb = StyleBoxFlat.new()
	sb.set_corner_radius_all(8)
	sb.bg_color = Color(0.1, 0.1, 0.15, 0.92)
	sb.border_color = Color(0.4, 0.6, 0.9, 0.6)
	sb.set_border_width_all(1)
	draw_style_box(sb, bg_rect)

	var text_x = box_pos.x + pad.x
	var text_y = box_pos.y + pad.y + font_size

	_hover_info_rect = bg_rect
	_hover_in_rect = Rect2()
	_hover_out_rect = Rect2()
	_hover_item_rects.clear()
	_hover_detail_button_rects.clear()

	for i in range(lines.size()):
		var line_data = lines[i]
		var line = line_data.text
		var line_id = str(line_data.get("id", ""))
		var col = Color.WHITE

		var line_rect = Rect2(text_x, text_y + i * line_h - font_size, box_w - pad.x * 2, line_h + 2)

		if i == 0:
			col = Color(0.4, 0.8, 1.0)
		elif line.begins_with("In"):
			col = Color(0.9, 0.9, 0.5)
			_hover_in_rect = line_rect
		elif line.begins_with("Out"):
			col = Color(0.9, 0.9, 0.5)
			_hover_out_rect = line_rect
		elif line.begins_with("      "):
			col = Color(0.55, 0.55, 0.55)
		elif line.begins_with("  "):
			col = Color(0.75, 0.75, 0.75)
			if not line_id.is_empty():
				_hover_item_rects.append({"rect": line_rect, "id": line_id})

		var render_line = line
		if not line_id.is_empty():
			var max_text_w = box_w - pad.x * 2.0 - detail_button_gap - detail_button_w
			render_line = _truncate_text_for_width(line, max_text_w, font, font_size)

		draw_string(font, Vector2(text_x, text_y + i * line_h), render_line, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, col)

		if not line_id.is_empty():
			var button_rect = Rect2(
				box_pos.x + box_w - pad.x - detail_button_w,
				line_rect.position.y + (line_rect.size.y - detail_button_h) * 0.5,
				detail_button_w,
				detail_button_h
			)

			var button_style = StyleBoxFlat.new()
			button_style.set_corner_radius_all(4)
			button_style.bg_color = Color(0.2, 0.35, 0.55, 0.95)
			button_style.border_color = Color(0.6, 0.8, 1.0, 0.8)
			button_style.set_border_width_all(1)
			draw_style_box(button_style, button_rect)

			var detail_text_size = font.get_string_size(detail_button_text, HORIZONTAL_ALIGNMENT_LEFT, -1, detail_button_font_size)
			var detail_text_pos = Vector2(
				button_rect.position.x + (button_rect.size.x - detail_text_size.x) * 0.5,
				button_rect.position.y + (button_rect.size.y + detail_button_font_size) * 0.5 - 2.0
			)
			draw_string(font, detail_text_pos, detail_button_text, HORIZONTAL_ALIGNMENT_LEFT, -1, detail_button_font_size, Color(0.95, 0.98, 1.0))

			_hover_detail_button_rects.append({"rect": button_rect, "id": line_id})

func _append_accordion_details(lines: Array[Dictionary], node_id: String, indent: String) -> void:
	var node = _find_layout_node(node_id)
	if node.is_empty():
		return

	var in_n: Array = node.get("inDegreeNames", [])
	var out_n: Array = node.get("outDegreeNames", [])

	if in_n.size() > 0:
		lines.append({"text": indent + "[In: %d]" % in_n.size(), "id": ""})
	for i in range(min(in_n.size(), 3)):
		lines.append({"text": indent + "<- " + str(in_n[i]), "id": ""})
	if in_n.size() > 3:
		lines.append({"text": indent + "... (+%d)" % (in_n.size() - 3), "id": ""})

	if out_n.size() > 0:
		lines.append({"text": indent + "[Out: %d]" % out_n.size(), "id": ""})
	for i in range(min(out_n.size(), 3)):
		lines.append({"text": indent + "-> " + str(out_n[i]), "id": ""})
	if out_n.size() > 3:
		lines.append({"text": indent + "... (+%d)" % (out_n.size() - 3), "id": ""})

func _truncate_text_for_width(text: String, max_width: float, font: Font, font_size: int) -> String:
	if max_width <= 0.0:
		return ""

	if font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x <= max_width:
		return text

	var ellipsis = "..."
	var result = text
	while result.length() > 0:
		result = result.left(result.length() - 1)
		var candidate = result + ellipsis
		if font.get_string_size(candidate, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x <= max_width:
			return candidate

	return ellipsis
