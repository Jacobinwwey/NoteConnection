extends Node3D

## 3D Orbital Path Renderer for Path Mode
## Renders central + peripheral bubbles with orbital rotation animation
class_name PathRenderer

signal node_clicked(node_id: String)
signal node_double_clicked(node_id: String)
signal transition_complete()

const BUBBLE_SHADER_PATH := "res://shaders/bubble_material.gdshader"
const ORBITAL_RADIUS := 2.5
const TRANSITION_DURATION := 0.5 ## 500ms orbital rotation

@export var central_radius: float = 1.0
@export var peripheral_radius: float = 0.4
@export var label_font_size: int = 24

@onready var state_machine: LearningStateMachine = $"../LearningStateMachine"
@onready var ws_client: Node = $"../WsClient"

var _bubble_shader: Shader
var _central_bubble: RigidBody3D
var _peripheral_bubbles: Array[RigidBody3D] = []
var _edge_drawer: ImmediateMesh
var _labels: Array[Label3D] = []

var _current_path: Dictionary = {}
var _central_node: Dictionary = {}
var _peripheral_nodes: Array = []

var _transition_tween: Tween = null
var _click_timer: float = 0.0
var _last_clicked_id: String = ""
var _initial_ui_settings_retries: int = 0
var _background_texture_cache: Dictionary = {}
var _last_applied_background_path: String = "__unset__"
const DOUBLE_CLICK_THRESHOLD := 0.5
const MAX_INITIAL_UI_SETTINGS_RETRIES := 8
const INITIAL_UI_SETTINGS_RETRY_DELAY := 0.15

@onready var ui: PathModeUI = $"../UI"


func _ready() -> void:
	_load_shader()
	_setup_central_bubble()
	_setup_edge_drawer()
	set_physics_process(true)
	
	## Connect to state machine
	if state_machine:
		state_machine.state_changed.connect(_on_state_changed)
		state_machine.central_changed.connect(_on_central_changed)
		state_machine.node_completed.connect(_on_node_completed)
		state_machine.node_unmarked.connect(_on_node_unmarked)
	
	## Connect to WebSocket client
	if ws_client:
		ws_client.data_received.connect(_on_ws_data_received)
		ws_client.completion_sync.connect(_on_completion_sync)
	
	## Connect to UI signals
	if ui:
		ui.mark_complete_pressed.connect(_on_mark_complete_pressed)
		ui.completed_node_clicked.connect(_on_completed_node_clicked)
		ui.return_pressed.connect(_on_return_pressed)
		ui.return_to_node.connect(_on_return_to_node)
		ui.tree_node_clicked.connect(_on_tree_node_clicked)
		ui.unmark_requested.connect(_on_unmark_requested)
		ui.mark_node_requested.connect(_on_mark_node_requested)
		ui.node_toggle_requested.connect(_on_node_toggle_requested) # New
		ui.node_expand_prereqs_requested.connect(_on_node_expand_prereqs_requested) # New
		ui.node_collapse_prereqs_requested.connect(_on_node_collapse_prereqs_requested) # New
		ui.collapse_all_requested.connect(_on_collapse_all_requested) # New
		ui.node_reader_requested.connect(_on_node_reader_requested)
		ui.settings_updated.connect(_on_settings_updated)
		ui.exit_requested.connect(_on_exit_requested)
		ui.background_lock_toggled.connect(_on_background_lock_toggled)

	call_deferred("_apply_initial_ui_settings")

func _physics_process(delta: float) -> void:
	if not state_machine or _peripheral_bubbles.is_empty():
		return
		
	var central_pos := Vector3.ZERO
	if _central_bubble:
		central_pos = _central_bubble.position
	
	## Spring-Force Orbital Model:
	## Pull bubbles towards their rotating target slot, but they bounce off each other.
	var time_offset := Time.get_ticks_msec() / 1000.0 * 0.2 ## Rotate slowly
	for i in range(_peripheral_bubbles.size()):
		var bubble := _peripheral_bubbles[i]
		if not is_instance_valid(bubble):
			continue
			
		var expected_angle: float = (float(i) / max(_peripheral_bubbles.size(), 1)) * TAU + time_offset
		var target_pos := _get_orbital_position(expected_angle)
		bubble.set_meta("target_pos", target_pos)
		
		var to_target := target_pos - bubble.position
		
		## Gently pull toward target (Spring Force)
		var spring_force := to_target * 5.0
		bubble.apply_central_force(spring_force)
		
		## Mild repulsion from center so they don't clip the central bubble
		var to_center := bubble.position - central_pos
		var dist_to_center := to_center.length()
		var safe_dist := central_radius + peripheral_radius + 0.1
		if dist_to_center < safe_dist and dist_to_center > 0.01:
			var push_away := to_center.normalized() * (safe_dist - dist_to_center) * 20.0
			bubble.apply_central_force(push_away)
		
		## BOUNDS CLAMPING: Prevent nodes from flying too far away
		## ä½ç½®é’³åˆ¶ï¼šé˜²æ­¢èŠ‚ç‚¹é£žå¾—å¤ªè¿œ
		var max_allowed_dist: float = ORBITAL_RADIUS * 3.0 # Half-window range
		if dist_to_center > max_allowed_dist:
			# Teleport back to target and kill velocity
			bubble.linear_velocity = Vector3.ZERO
			bubble.angular_velocity = Vector3.ZERO
			bubble.global_position = global_position + target_pos

func _on_node_toggle_requested(node_id: String) -> void:
	if ws_client:
		ws_client.send_toggle_collapse(node_id)


func _on_node_expand_prereqs_requested(node_id: String) -> void:
	if ws_client:
		ws_client.send_expand_prereqs(node_id)


func _on_node_collapse_prereqs_requested(node_id: String) -> void:
	if ws_client:
		ws_client.send_collapse_prereqs(node_id)


func _on_collapse_all_requested() -> void:
	if ws_client:
		ws_client.send_collapse_all()


func _on_node_reader_requested(node_id: String) -> void:
	if node_id.is_empty():
		return

	var reader_node := _find_reader_node(node_id)
	if reader_node.is_empty():
		reader_node = {
			"id": node_id,
			"label": node_id
		}

	if ui and ui.has_method("open_reader"):
		ui.open_reader(reader_node)
		return

	push_warning("PathRenderer: Godot reader UI is unavailable for node %s." % node_id)


func _find_reader_node(node_id: String) -> Dictionary:
	if node_id.is_empty():
		return {}

	var central_id: String = _central_node.get("id", "")
	if central_id == node_id:
		return _central_node

	for raw_peripheral in _peripheral_nodes:
		var peripheral: Dictionary = raw_peripheral if raw_peripheral is Dictionary else {}
		if peripheral.get("id", "") == node_id:
			return peripheral

	var path_nodes_raw: Array = _current_path.get("pathNodes", [])
	for raw_path_node in path_nodes_raw:
		var path_node: Dictionary = raw_path_node if raw_path_node is Dictionary else {}
		if path_node.get("id", "") == node_id:
			return path_node

	return {}


func _load_shader() -> void:
	_bubble_shader = load(BUBBLE_SHADER_PATH)
	if not _bubble_shader:
		push_warning("PathRenderer: Could not load bubble shader")


func _setup_central_bubble() -> void:
	_central_bubble = RigidBody3D.new()
	_central_bubble.gravity_scale = 0.0
	_central_bubble.linear_damp = 5.0
	_central_bubble.angular_damp = 5.0
	var phys_mat := PhysicsMaterial.new()
	phys_mat.friction = 0.0
	phys_mat.bounce = 0.4
	_central_bubble.physics_material_override = phys_mat
	_central_bubble.set_meta("node_id", "")
	_central_bubble.set_meta("target_pos", Vector3.ZERO)
	
	var mesh_inst := MeshInstance3D.new()
	mesh_inst.mesh = SphereMesh.new()
	(mesh_inst.mesh as SphereMesh).radius = central_radius
	(mesh_inst.mesh as SphereMesh).height = central_radius * 2
	(mesh_inst.mesh as SphereMesh).radial_segments = 32
	(mesh_inst.mesh as SphereMesh).rings = 16
	mesh_inst.material_override = _create_bubble_material(true, false)
	_central_bubble.add_child(mesh_inst)
	
	var shape := CollisionShape3D.new()
	var sphere_shape := SphereShape3D.new()
	sphere_shape.radius = central_radius
	shape.shape = sphere_shape
	_central_bubble.add_child(shape)
	
	add_child(_central_bubble)
	
	## Central label
	var label := Label3D.new()
	label.font_size = label_font_size
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.position.y = - central_radius - 0.3
	_central_bubble.add_child(label)


func _setup_edge_drawer() -> void:
	var mesh_instance := MeshInstance3D.new()
	_edge_drawer = ImmediateMesh.new()
	mesh_instance.mesh = _edge_drawer
	
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(0.3, 0.3, 0.3, 0.5)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mesh_instance.material_override = material
	
	add_child(mesh_instance)


## Creates iridescent bubble material using the enhanced shader
func _create_bubble_material(is_central: bool, is_completed: bool) -> Material:
	## Use the iridescent bubble shader
	if _bubble_shader:
		var shader_mat := ShaderMaterial.new()
		shader_mat.shader = _bubble_shader
		
		## Set shader parameters
		shader_mat.set_shader_parameter("is_central", is_central)
		shader_mat.set_shader_parameter("is_completed", is_completed)
		
		## State-dependent tints (subtle tints, iridescence provides main color)
		if is_completed:
			shader_mat.set_shader_parameter("completed_color", Color(1.0, 0.84, 0.0, 0.85))
		elif is_central:
			shader_mat.set_shader_parameter("central_tint", Color(0.3, 0.7, 0.95, 1.0))
		else:
			shader_mat.set_shader_parameter("peripheral_tint", Color(0.65, 0.4, 0.85, 1.0))
		
		## Enhanced iridescence for visible rainbow effect
		shader_mat.set_shader_parameter("iridescence_strength", 1.2)
		shader_mat.set_shader_parameter("rainbow_saturation", 0.85)
		shader_mat.set_shader_parameter("iridescence_scale", 6.0)
		
		## Fresnel: keep the bubble readable against dark HDR backgrounds.
		shader_mat.set_shader_parameter("fresnel_power", 3.5)
		shader_mat.set_shader_parameter("rim_opacity", 0.82 if is_central else 0.74)
		shader_mat.set_shader_parameter("center_opacity", 0.32 if is_central else 0.24)
		
		## Bright specular highlights
		shader_mat.set_shader_parameter("specular_intensity", 2.2)
		shader_mat.set_shader_parameter("highlight_sharpness", 64.0)
		
		return shader_mat
	
	## Fallback to StandardMaterial3D if shader fails to load
	push_warning("PathRenderer: Using fallback material (shader not loaded)")
	var std := StandardMaterial3D.new()
	std.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	std.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
	std.metallic = 0.0
	std.roughness = 0.05
	std.emission_enabled = true
	
	if is_completed:
		std.albedo_color = Color(1.0, 0.84, 0.0, 0.9)
		std.emission = Color.GOLD
		std.emission_energy_multiplier = 0.5
	elif is_central:
		std.albedo_color = Color(0.4, 0.8, 1.0, 0.4)
		std.emission = Color(0.4, 0.8, 1.0)
		std.emission_energy_multiplier = 0.3
	else:
		std.albedo_color = Color(0.7, 0.5, 0.9, 0.35)
		std.emission = Color(0.7, 0.5, 0.9)
		std.emission_energy_multiplier = 0.2
		
	return std


func _create_peripheral_bubble(index: int, node: Dictionary) -> RigidBody3D:
	var bubble := RigidBody3D.new()
	bubble.gravity_scale = 0.0
	bubble.linear_damp = 5.0
	bubble.angular_damp = 4.0
	bubble.continuous_cd = true # Prevent tunneling on collision
	var phys_mat := PhysicsMaterial.new()
	phys_mat.friction = 0.0
	phys_mat.bounce = 0.4
	bubble.physics_material_override = phys_mat
	
	var node_id: String = node.get("id", "")
	bubble.set_meta("node_id", node_id)
	
	var mesh_inst := MeshInstance3D.new()
	mesh_inst.mesh = SphereMesh.new()
	(mesh_inst.mesh as SphereMesh).radius = peripheral_radius
	(mesh_inst.mesh as SphereMesh).height = peripheral_radius * 2
	(mesh_inst.mesh as SphereMesh).radial_segments = 24
	(mesh_inst.mesh as SphereMesh).rings = 12
	var is_completed := state_machine.is_completed(node_id) if state_machine else false
	mesh_inst.material_override = _create_bubble_material(false, is_completed)
	bubble.add_child(mesh_inst)
	
	var shape := CollisionShape3D.new()
	var sphere_shape := SphereShape3D.new()
	sphere_shape.radius = peripheral_radius
	shape.shape = sphere_shape
	bubble.add_child(shape)
	
	var angle: float = (float(index) / max(_peripheral_nodes.size(), 1)) * TAU
	var target_pos := _get_orbital_position(angle)
	bubble.set_meta("target_pos", target_pos)
	bubble.position = target_pos
	
	add_child(bubble)
	
	## Label
	var label := Label3D.new()
	label.text = LearningStateMachine.truncate_label(node.get("label", node_id), 15)
	label.font_size = label_font_size - 6
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.position.y = - peripheral_radius - 0.2
	bubble.add_child(label)
	_labels.append(label)
	
	return bubble


func _get_orbital_position(angle: float) -> Vector3:
	return Vector3(
		cos(angle) * ORBITAL_RADIUS,
		0.0,
		sin(angle) * ORBITAL_RADIUS
	)


## Update display with new path data
func render_path(path_data: Dictionary) -> void:
	## Stop any running transition tween immediately
	if _transition_tween and _transition_tween.is_valid():
		_transition_tween.kill()
	
	if not path_data.has("central") or not path_data.has("peripherals"):
		push_warning("PathRenderer: Invalid path data")
		if ui and ui.has_method("set_runtime_status"):
			ui.set_runtime_status("Path data is invalid or incomplete.", "error")
		return
	
	_current_path = path_data
	_central_node = path_data.get("central", {})
	_peripheral_nodes = path_data.get("peripherals", [])
	var central_id: String = _central_node.get("id", "")
	if ui and ui.has_method("record_navigation_node"):
		ui.record_navigation_node(central_id)
	
	## Extract full path data for state machine
	var total_nodes: int = path_data.get("totalNodes", 0)
	var path_nodes: Array = path_data.get("pathNodes", [])
	var available_target_nodes_raw = path_data.get("availableTargets", path_nodes)
	var available_target_nodes: Array = available_target_nodes_raw if available_target_nodes_raw is Array else path_nodes
	var completed_ids: Array = path_data.get("completedIds", [])
	
	## Update state machine with full learning path
	if state_machine and path_nodes.size() > 0:
		state_machine.set_learning_path({
			"nodes": path_nodes,
			"total": total_nodes
		})
		## Frontend is source of truth for completed IDs - replace, don't merge
		state_machine.completed_ids.clear()
		for node_id in completed_ids:
			state_machine.completed_ids.append(node_id)
	
	## Sync UI sidebar with completed_ids from frontend
	if ui:
		ui.clear_completed_nodes()
		for node_id in completed_ids:
			## Find label for this node
			var node_label: String = node_id
			for pn in path_nodes:
				var pn_dict: Dictionary = pn if pn is Dictionary else {}
				if pn_dict.get("id", "") == node_id:
					node_label = pn_dict.get("label", node_id)
					break
			ui.add_completed_node(node_id, node_label)
		if ui.has_method("set_available_targets"):
			ui.set_available_targets(available_target_nodes, _central_node.get("id", ""))
	
	## Strict Reset of Central Bubble State
	if _central_bubble:
		_central_bubble.position = Vector3.ZERO
		_central_bubble.scale = Vector3.ONE
		_central_bubble.visible = true
	
	_update_central_bubble()
	_rebuild_peripheral_bubbles()
	_draw_edges()
	_update_ui_progress()
	_update_tree_panel()


func _update_central_bubble() -> void:
	if _central_node.is_empty():
		return
	
	var central_id: String = _central_node.get("id", "")
	_central_bubble.set_meta("node_id", central_id)
	
	## Update material for completed state - FORCE NEW MATERIAL
	var is_completed := state_machine.is_completed(central_id) if state_machine else false
	var new_material := _create_bubble_material(true, is_completed)
	
	if ui and ui.has_method("update_complete_button"):
		ui.update_complete_button(is_completed)
	
	## Clear override first to ensure update
	var mesh_inst := _central_bubble.get_child(0) as MeshInstance3D
	if mesh_inst:
		mesh_inst.material_override = null
		mesh_inst.material_override = new_material
	
	## Update label (now child 2)
	if _central_bubble.get_child_count() > 2:
		var label := _central_bubble.get_child(2) as Label3D
		if label:
			var progress := state_machine.get_progress() if state_machine else {"completed": 0, "total": 0}
			var central_label: String = _central_node.get("label", central_id)
			label.text = "%s\n%d of %d" % [
				central_label,
				progress.get("completed", 0),
				progress.get("total", 0)
			]


func _rebuild_peripheral_bubbles() -> void:
	## Clear existing
	for bubble in _peripheral_bubbles:
		bubble.queue_free()
	_peripheral_bubbles.clear()
	_labels.clear()
	
	## Create new
	for i in range(_peripheral_nodes.size()):
		var node: Dictionary = _peripheral_nodes[i]
		var bubble := _create_peripheral_bubble(i, node)
		_peripheral_bubbles.append(bubble)


func _draw_edges() -> void:
	_edge_drawer.clear_surfaces()
	if _peripheral_bubbles.is_empty():
		return
	_edge_drawer.surface_begin(Mesh.PRIMITIVE_LINES)
	
	for bubble in _peripheral_bubbles:
		var start := Vector3.ZERO ## Central position
		var end := bubble.position
		
		_edge_drawer.surface_add_vertex(start)
		_edge_drawer.surface_add_vertex(end)
	
	_edge_drawer.surface_end()


## Clears all peripheral bubbles and labels from the scene
func _clear_all_peripherals() -> void:
	for bubble in _peripheral_bubbles:
		if is_instance_valid(bubble):
			bubble.queue_free()
	_peripheral_bubbles.clear()
	_labels.clear()


## Central node switch: "Clear-then-Rebuild" architecture
## Instead of morphing objects (which causes overlap/color bugs), we:
## 1. Clear all existing visuals
## 2. Request new data from backend
## 3. Let render_path rebuild everything correctly
func animate_orbital_rotation(target_id: String) -> void:
	## Kill any existing tween
	if _transition_tween and _transition_tween.is_valid():
		_transition_tween.kill()
	
	## === PHASE 1: DESTRUCTIVE CLEAR ===
	## Clear all peripheral bubbles immediately
	_clear_all_peripherals()
	
	## Reset central bubble to default state (hidden during transition)
	if _central_bubble:
		_central_bubble.visible = false
		_central_bubble.position = Vector3.ZERO
		_central_bubble.scale = Vector3.ONE
	
	## Clear local state
	_peripheral_nodes.clear()
	
	## === PHASE 2: UPDATE STATE MACHINE ===
	## Notify state machine of the transition (this tracks the new central ID)
	if state_machine:
		state_machine.transition_to(LearningStateMachine.State.TRANSITIONING, {"central_id": target_id})
	
	## === PHASE 3: REQUEST NEW DATA FROM BACKEND ===
	## The backend will respond with `pathUpdate` containing:
	## - new central node
	## - new peripheral nodes (computed for the new central)
	## This triggers render_path(), which rebuilds everything correctly.
	if ws_client and ws_client.has_method("send_message"):
		ws_client.send_message({
			"type": "switchCenter",
			"payload": {"newCenterId": target_id}
		})
	
	transition_complete.emit()


func _on_state_changed(_from_state: StringName, to_state: StringName) -> void:
	if to_state == "TRANSITIONING":
		## Animation will be triggered by animate_orbital_rotation
		pass


func _on_central_changed(_old_id: String, _new_id: String) -> void:
	## Will be handled by render_path with new data
	pass


func _on_ws_data_received(data: Dictionary) -> void:
	var msg_type: String = data.get("type", "")
	var payload: Dictionary = data.get("payload", {})
	match msg_type:
		"pathResult":
			render_path(payload)
		"pathUpdate":
			render_path(payload)
		"pathStatus":
			_handle_path_status(payload)
		"configure":
			_handle_remote_configure(payload)
		"openReader":
			_handle_remote_open_reader(payload)


func _handle_path_status(payload: Dictionary) -> void:
	var level: String = String(payload.get("level", "info"))
	var code: String = String(payload.get("code", "path_status"))
	var message: String = String(payload.get("message", "Path status update received."))
	print("[PathRenderer] Bridge status (%s/%s): %s" % [level, code, message])
	if ui and ui.has_method("set_runtime_status"):
		ui.set_runtime_status(message, level)


func _handle_remote_configure(payload: Dictionary) -> void:
	if payload.is_empty():
		return

	if payload.has("language") and ui and ui.has_method("set_ui_language"):
		ui.set_ui_language(String(payload.get("language", "en")))
	if ui and ui.has_method("apply_remote_runtime_settings"):
		ui.apply_remote_runtime_settings(payload)


func _handle_remote_open_reader(payload) -> void:
	var node_id := ""
	if payload is Dictionary:
		node_id = String((payload as Dictionary).get("nodeId", "")).strip_edges()
	else:
		node_id = String(payload).strip_edges()
	if node_id.is_empty():
		return

	var reader_node := _find_reader_node(node_id)
	if reader_node.is_empty():
		reader_node = {
			"id": node_id,
			"label": node_id
		}
	if ui and ui.has_method("open_reader"):
		ui.open_reader(reader_node)


## Handle bidirectional completion sync from Electron
func _on_completion_sync(completed_ids: Array, _timestamp: int) -> void:
	print("[PathRenderer] Received completion sync from Electron:", completed_ids.size(), "items")
	
	if not state_machine:
		return
	
	## Sync the completed IDs
	## Clear and rebuild to ensure consistency
	state_machine.completed_ids.clear()
	for node_id in completed_ids:
		if node_id is String and not node_id.is_empty():
			state_machine.completed_ids.append(node_id)
	
	## Update UI
	if ui:
		ui.clear_completed_nodes()
		for node_id in state_machine.completed_ids:
			# Try to get label from path data
			var label: String = node_id
			var path_nodes: Array = _current_path.get("pathNodes", [])
			for node in path_nodes:
				var n: Dictionary = node if node is Dictionary else {}
				if n.get("id", "") == node_id:
					label = n.get("label", node_id)
					break
			ui.add_completed_node(node_id, label)
		_update_ui_progress()
		_update_tree_panel()


var _is_pressed: bool = false
var _press_pos: Vector2 = Vector2.ZERO
const CLICK_DRAG_THRESHOLD := 5.0 ## Pixels movement allowed for a click


func _input(event: InputEvent) -> void:
	if ui and ui.has_method("is_reader_open") and ui.is_reader_open():
		return
	
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_is_pressed = true
				_press_pos = event.position
			else:
				if _is_pressed:
					_is_pressed = false
					## Only register click if movement was minimal (not dragging)
					if event.position.distance_to(_press_pos) < CLICK_DRAG_THRESHOLD:
						_handle_click(event.position)


func _handle_click(screen_pos: Vector2) -> void:
	var camera := get_viewport().get_camera_3d()
	if not camera:
		return
	
	var from := camera.project_ray_origin(screen_pos)
	var to := from + camera.project_ray_normal(screen_pos) * 100.0
	
	var space_state := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, to)
	var result := space_state.intersect_ray(query)
	
	if result.is_empty():
		return
	
	var collider = result.get("collider", null)
	if collider and collider.has_meta("node_id"):
		var node_id: String = collider.get_meta("node_id")
		if node_id.is_empty():
			return
		
		## Double-click detection
		var now := Time.get_ticks_msec() / 1000.0
		if node_id == _last_clicked_id and (now - _click_timer) < DOUBLE_CLICK_THRESHOLD:
			_handle_double_click(node_id)
			_last_clicked_id = ""
		else:
			_handle_single_click(node_id)
			_last_clicked_id = node_id
			_click_timer = now


func _handle_single_click(node_id: String) -> void:
	node_clicked.emit(node_id)


func _handle_double_click(node_id: String) -> void:
	node_double_clicked.emit(node_id)
	
	## Check if central or peripheral
	var central_id: String = _central_node.get("id", "")
	if node_id == central_id:
		if ui and ui.has_method("open_reader"):
			ui.open_reader(_central_node)
		return
	
	## Peripheral - orbital rotation
	if ui and not central_id.is_empty():
		ui.start_browsing(central_id)
	animate_orbital_rotation(node_id)


## === UI Signal Handlers ===

func _on_mark_complete_pressed() -> void:
	## Toggle the completion state of the current central node
	var central_id: String = _central_node.get("id", "")
	if not central_id.is_empty():
		var is_completed := state_machine.is_completed(central_id) if state_machine else false
		if is_completed:
			_on_unmark_requested(central_id)
		else:
			_on_mark_node_requested(central_id)


func _on_mark_node_requested(node_id: String) -> void:
	print("[PathRenderer] Marking complete:", node_id)
	
	## Update state machine
	if state_machine:
		state_machine.mark_complete(node_id)
	
	## Notify backend that node was completed
	if ws_client and ws_client.has_method("send_message"):
		ws_client.send_message({
			"type": "markComplete",
			"payload": {"nodeId": node_id}
		})
	
	## Visual Update: Central Bubble
	var central_id: String = _central_node.get("id", "")
	if node_id == central_id and _central_bubble:
		var new_material := _create_bubble_material(true, true)
		var mesh_inst := _central_bubble.get_child(0) as MeshInstance3D
		if mesh_inst:
			mesh_inst.material_override = null
			mesh_inst.material_override = new_material
		if ui and ui.has_method("update_complete_button"):
			ui.update_complete_button(true)
	
	## Visual Update: Peripheral Bubble
	for bubble in _peripheral_bubbles:
		if bubble.get_meta("node_id", "") == node_id:
			var new_material := _create_bubble_material(false, true)
			var mesh_inst := bubble.get_child(0) as MeshInstance3D
			if mesh_inst:
				mesh_inst.material_override = null
				mesh_inst.material_override = new_material
			break
			
	## Update UI Sidebar and Progress
	## Find label
	var label: String = node_id
	if node_id == central_id:
		label = _central_node.get("label", node_id)
	else:
		for p in _peripheral_nodes:
			var p_dict: Dictionary = p if p is Dictionary else {}
			if p_dict.get("id", "") == node_id:
				label = p_dict.get("label", node_id)
				break
				
	if ui:
		ui.add_completed_node(node_id, label)
		_update_ui_progress()
		_update_tree_panel()
	
	## Auto-switch if central
	if node_id == central_id and state_machine:
		var next_id := state_machine.current_central_id
		if not next_id.is_empty() and next_id != central_id:
			print("[PathRenderer] Auto-switching to next node:", next_id)
			_request_switch_center(next_id)


func _on_completed_node_clicked(node_id: String) -> void:
	## When user clicks a completed node in sidebar, switch to view it
	print("[PathRenderer] Completed node clicked:", node_id)
	
	## Start browsing mode and save current position
	var current_id: String = _central_node.get("id", "")
	if ui and current_id != node_id:
		ui.start_browsing(current_id)
	
	## Switch central to the clicked node
	_request_switch_center(node_id)


## Request backend to switch center (for browsing or tree navigation)
func _request_switch_center(target_id: String) -> void:
	if ws_client and ws_client.has_method("send_message"):
		var auto_reconstruct := true
		if ui and ui.has_method("get_auto_reconstruct_setting"):
			auto_reconstruct = ui.get_auto_reconstruct_setting()
			
		ws_client.send_message({
			"type": "switchCenter",
			"payload": {
				"newCenterId": target_id,
				"autoReconstruct": auto_reconstruct
			}
		})


func _on_return_pressed() -> void:
	## Return to learning position
	if ui:
		var learning_pos: String = ui.get_learning_position()
		if not learning_pos.is_empty():
			print("[PathRenderer] Returning to learning position:", learning_pos)
			_request_switch_center(learning_pos)


func _on_return_to_node(node_id: String) -> void:
	## Return to specific node from history dropdown
	print("[PathRenderer] Returning to node:", node_id)
	_request_switch_center(node_id)


func _on_tree_node_clicked(node_id: String) -> void:
	## User clicked a node in the tree panel
	print("[PathRenderer] Tree node clicked:", node_id)
	var current_id: String = _central_node.get("id", "")
	if ui and current_id != node_id and not current_id.is_empty():
		ui.start_browsing(current_id)
	_request_switch_center(node_id)


func _on_settings_updated(settings: Dictionary) -> void:
	print("[PathRenderer] Settings updated: ", settings)
	if ws_client and ws_client.has_method("send_configure"):
		ws_client.send_configure(settings)
		if _settings_require_path_refresh(settings) and ws_client.has_method("send_request_path"):
			ws_client.send_request_path()
		
	if settings.has("background"):
		var bg_file = settings["background"]
		if bg_file == "":
			_apply_background_texture("")
		else:
			var path = "res://assets/backgrounds/" + bg_file
			_apply_background_texture(path)
			
	if settings.has("bg_brightness"):
		var world_env := $"../WorldEnvironment" as WorldEnvironment
		if world_env and world_env.environment:
			world_env.environment.background_energy_multiplier = settings["bg_brightness"]

func _settings_require_path_refresh(settings: Dictionary) -> bool:
	for key in [
		"mode",
		"strategy",
		"layout",
		"targetId",
		"target_id",
		"targetIds",
		"auto_reconstruct",
		"retain_history",
		"focus_mode"
	]:
		if settings.has(key):
			return true
	return false

func _apply_default_background(world_env: WorldEnvironment, sky_mat: PanoramaSkyMaterial) -> void:
	sky_mat.panorama = null
	world_env.environment.background_mode = Environment.BG_COLOR
	world_env.environment.background_color = Color(0.08, 0.1, 0.15, 1.0)


func _apply_background_texture(path: String) -> void:
	var world_env := $"../WorldEnvironment" as WorldEnvironment
	if not world_env or not world_env.environment or not world_env.environment.sky or not world_env.environment.sky.sky_material:
		return
		
	var sky_mat := world_env.environment.sky.sky_material as PanoramaSkyMaterial
	if not sky_mat:
		return

	if _last_applied_background_path == path:
		return
		
	if path == "":
		_last_applied_background_path = path
		_apply_default_background(world_env, sky_mat)
		return

	var texture = _load_background_texture_safely(path)
	if texture:
		world_env.environment.background_mode = Environment.BG_SKY
		sky_mat.panorama = texture
		_last_applied_background_path = path
		print("[PathRenderer] Applied background texture: ", path)
		return

	push_warning("[PathRenderer] Falling back to default background for: %s" % path)
	_last_applied_background_path = ""

	_apply_default_background(world_env, sky_mat)


func _load_background_texture_safely(path: String) -> Texture2D:
	if not ResourceLoader.exists(path):
		push_warning("[PathRenderer] Background file not found: %s" % path)
		return null

	var extension := path.get_extension().to_lower()
	if extension == "exr" or extension == "hdr":
		return _load_hdr_background_safely(path)

	var tex = ResourceLoader.load(path)
	if tex is Texture2D:
		return tex

	push_warning("[PathRenderer] Background resource is not a Texture2D: %s" % path)
	return null


func _load_hdr_background_safely(path: String) -> Texture2D:
	if _background_texture_cache.has(path):
		var cached = _background_texture_cache.get(path)
		if cached is Texture2D:
			return cached

	var imported_tex = ResourceLoader.load(path)
	if not (imported_tex is Texture2D):
		push_warning("[PathRenderer] Failed to load imported HDR background resource: %s" % path)
		return null

	var texture := imported_tex as Texture2D
	_background_texture_cache[path] = texture
	return texture


func _filter_startup_settings(settings: Dictionary) -> Dictionary:
	return settings.duplicate(true)


func _schedule_initial_ui_settings_retry() -> void:
	if _initial_ui_settings_retries >= MAX_INITIAL_UI_SETTINGS_RETRIES:
		return
	_initial_ui_settings_retries += 1
	var timer := get_tree().create_timer(INITIAL_UI_SETTINGS_RETRY_DELAY)
	timer.timeout.connect(_apply_initial_ui_settings, CONNECT_ONE_SHOT)


func _apply_initial_ui_settings() -> void:
	if not ui:
		return

	if ui.has_method("get_runtime_settings"):
		var settings: Dictionary = ui.get_runtime_settings()
		if not settings.is_empty():
			_initial_ui_settings_retries = 0
			_on_settings_updated(_filter_startup_settings(settings))
			return

	if ui.has_method("get_setting"):
		var background = ui.get_setting("background", null)
		var brightness = ui.get_setting("bg_brightness", null)
		if background != null or brightness != null:
			_initial_ui_settings_retries = 0
			_on_settings_updated(_filter_startup_settings({
				"background": background if background != null else "",
				"bg_brightness": brightness if brightness != null else 0.10
			}))
			return

	_schedule_initial_ui_settings_retry()


func _on_exit_requested() -> void:
	print("[PathRenderer] Exit Path Mode requested from Godot UI")
	if ws_client and ws_client.has_method("send_exit_path_mode"):
		ws_client.send_exit_path_mode()
	if OS.get_name() == "Android":
		# Android native Pathmode activity should return to Tauri window on Exit.
		get_tree().quit()


var _is_bg_locked: bool = false
var _is_camera_rotating: bool = false

func _on_background_lock_toggled(is_locked: bool) -> void:
	## Forward background lock to orbital camera
	## å°†èƒŒæ™¯é”å®šçŠ¶æ€è½¬å‘åˆ°è½¨é“ç›¸æœº
	_is_bg_locked = is_locked
	print("[PathRenderer] Background lock toggled: ", is_locked)
	var camera := $"../Camera3D"
	if camera and camera.has_method("set_background_locked"):
		camera.set_background_locked(is_locked)
	
	_update_bubbles_physics_state()


func set_camera_rotating(is_rotating: bool) -> void:
	## Called by OrbitalCamera to notify when the user is actively dragging the view
	## ç”±è½¨é“ç›¸æœºè°ƒç”¨ä»¥é€šçŸ¥ç”¨æˆ·æ­£å¤„äºŽæ‹–æ‹½è§†å›¾çŠ¶æ€
	_is_camera_rotating = is_rotating
	_update_bubbles_physics_state()


func _update_bubbles_physics_state() -> void:
	## Freeze physics on all bubbles if background is locked or user is actively rotating
	## this prevents force superposition and node instability during rotation
	## å¦‚æžœèƒŒæ™¯è¢«é”å®šæˆ–ç”¨æˆ·æ­£åœ¨ä¸»åŠ¨æ—‹è½¬ï¼Œåˆ™å†»ç»“æ‰€æœ‰æ°”æ³¡çš„ç‰©ç†ï¼Œä»¥é˜²åŠ›å åŠ å’ŒèŠ‚ç‚¹ä¸ç¨³å®š
	var should_freeze: bool = _is_bg_locked or _is_camera_rotating
	
	if _central_bubble and is_instance_valid(_central_bubble):
		_central_bubble.freeze = should_freeze
	for bubble in _peripheral_bubbles:
		if is_instance_valid(bubble):
			bubble.freeze = should_freeze


func _on_unmark_requested(node_id: String) -> void:
	## User requested to unmark a node as complete
	print("[PathRenderer] Unmark requested:", node_id)
	
	## Update state machine
	if state_machine:
		state_machine.unmark_complete(node_id)
	
	## Notify Electron to update history
	if ws_client and ws_client.has_method("send_message"):
		ws_client.send_message({
			"type": "unmarkComplete",
			"payload": {"nodeId": node_id}
		})
	
	## UI will be updated via _on_node_unmarked signal


func _on_node_completed(node_id: String, next_id: String) -> void:
	## State machine says a node was completed
	print("[PathRenderer] Node completed:", node_id, "Next:", next_id)
	
	## Sync to Electron
	_sync_completion_to_electron()


func _on_node_unmarked(node_id: String) -> void:
	## State machine says a node was unmarked
	print("[PathRenderer] Node unmarked:", node_id)
	
	## Update UI sidebar
	if ui:
		ui.remove_completed_node(node_id)
		_update_ui_progress()
	
	## If this is the current central node, refresh its material AND label
	var central_id: String = _central_node.get("id", "")
	if node_id == central_id and _central_bubble:
		var is_completed := false
		var new_material := _create_bubble_material(true, is_completed)
		var mesh_inst := _central_bubble.get_child(0) as MeshInstance3D
		if mesh_inst:
			mesh_inst.material_override = null
			mesh_inst.material_override = new_material
		if ui and ui.has_method("update_complete_button"):
			ui.update_complete_button(false)
		
		## Also update the label with new progress
		var label := _central_bubble.get_child(2) as Label3D
		if label:
			var progress := state_machine.get_progress() if state_machine else {"completed": 0, "total": 0}
			var central_label: String = _central_node.get("label", central_id)
			label.text = "%s\n%d of %d" % [
				central_label,
				progress.get("completed", 0),
				progress.get("total", 0)
			]
	
	## Update tree panel to remove star icon
	_update_tree_panel()
	
	## Sync to Electron
	_sync_completion_to_electron()


## Sync completion state to Electron via WebSocket
func _sync_completion_to_electron() -> void:
	if not ws_client or not ws_client.has_method("send_message"):
		return
	
	if not state_machine:
		return
	
	var completed_ids := state_machine.get_completed_ids()
	ws_client.send_message({
		"type": "completionSync",
		"payload": {
			"action": "fullSync",
			"completedIds": completed_ids,
			"timestamp": Time.get_unix_time_from_system() * 1000
		}
	})


func _update_ui_progress() -> void:
	## Update UI with current progress
	if ui and state_machine:
		var progress := state_machine.get_progress()
		ui.update_progress(progress.get("completed", 0), progress.get("total", 0))


## Update tree panel with current path data
func _update_tree_panel() -> void:
	if not ui or not state_machine:
		return
	
	var path_nodes: Array = _current_path.get("pathNodes", [])
	var layout_raw = _current_path.get("treeLayout")
	var tree_layout: Dictionary = layout_raw if layout_raw is Dictionary else {}
	var completed_ids := state_machine.get_completed_ids()
	var current_id: String = _central_node.get("id", "")
	
	# Debug: Check if treeLayout is received
	print("[PathRenderer] treeLayout raw type: ", typeof(layout_raw), " is_dict: ", layout_raw is Dictionary)
	if tree_layout.is_empty():
		print("[PathRenderer] treeLayout is EMPTY - using legacy linear mode")
	else:
		print("[PathRenderer] treeLayout has ", tree_layout.get("nodes", []).size(), " nodes, ", tree_layout.get("edges", []).size(), " edges")
	
	if not tree_layout.is_empty():
		ui.update_tree_layout(tree_layout, completed_ids, current_id)
	else:
		# Fallback to old list method if no layout
		ui.build_tree(path_nodes, completed_ids, current_id)
