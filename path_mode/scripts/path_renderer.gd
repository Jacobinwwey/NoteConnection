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
var _central_bubble: MeshInstance3D
var _peripheral_bubbles: Array[MeshInstance3D] = []
var _edge_drawer: ImmediateMesh
var _labels: Array[Label3D] = []

var _current_path: Dictionary = {}
var _central_node: Dictionary = {}
var _peripheral_nodes: Array = []

var _transition_tween: Tween = null
var _click_timer: float = 0.0
var _last_clicked_id: String = ""
const DOUBLE_CLICK_THRESHOLD := 0.5


func _ready() -> void:
	_load_shader()
	_setup_central_bubble()
	_setup_edge_drawer()
	
	## Connect to state machine
	if state_machine:
		state_machine.state_changed.connect(_on_state_changed)
		state_machine.central_changed.connect(_on_central_changed)
	
	## Connect to WebSocket client
	if ws_client:
		ws_client.data_received.connect(_on_ws_data_received)


func _load_shader() -> void:
	_bubble_shader = load(BUBBLE_SHADER_PATH)
	if not _bubble_shader:
		push_warning("PathRenderer: Could not load bubble shader")


func _setup_central_bubble() -> void:
	_central_bubble = MeshInstance3D.new()
	_central_bubble.mesh = SphereMesh.new()
	(_central_bubble.mesh as SphereMesh).radius = central_radius
	(_central_bubble.mesh as SphereMesh).height = central_radius * 2
	(_central_bubble.mesh as SphereMesh).radial_segments = 32
	(_central_bubble.mesh as SphereMesh).rings = 16
	
	var material := _create_bubble_material(true, false)
	_central_bubble.material_override = material
	_central_bubble.set_meta("node_id", "")
	
	## Add collision for click detection
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var sphere_shape := SphereShape3D.new()
	sphere_shape.radius = central_radius
	shape.shape = sphere_shape
	body.add_child(shape)
	body.set_meta("node_id", "") ## Will be updated with actual ID
	_central_bubble.add_child(body)
	
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


## Creates bubble material - returns ShaderMaterial or fallback StandardMaterial3D
func _create_bubble_material(is_central: bool, is_completed: bool) -> Material:
	## Force fallback to solid opaque material for reliability
	var std := StandardMaterial3D.new()
	std.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	std.metallic = 0.1
	std.roughness = 0.1
	std.emission_enabled = true
	std.use_point_size = true
	std.point_size = 5.0
	
	if is_completed:
		std.albedo_color = Color.GOLD
		std.emission = Color.GOLD
		std.emission_energy_multiplier = 0.5
	elif is_central:
		std.albedo_color = Color(0.2, 0.6, 1.0)
		std.emission = Color(0.2, 0.6, 1.0)
		std.emission_energy_multiplier = 0.5
	else:
		std.albedo_color = Color(0.5, 0.3, 0.8)
		std.emission = Color(0.5, 0.3, 0.8)
		std.emission_energy_multiplier = 0.3 # Added emission for peripherals
		
	return std


func _create_peripheral_bubble(index: int, node: Dictionary) -> MeshInstance3D:
	var bubble := MeshInstance3D.new()
	bubble.mesh = SphereMesh.new()
	(bubble.mesh as SphereMesh).radius = peripheral_radius
	(bubble.mesh as SphereMesh).height = peripheral_radius * 2
	(bubble.mesh as SphereMesh).radial_segments = 24
	(bubble.mesh as SphereMesh).rings = 12
	
	var node_id: String = node.get("id", "")
	var is_completed := state_machine.is_completed(node_id) if state_machine else false
	var material := _create_bubble_material(false, is_completed)
	bubble.material_override = material
	bubble.set_meta("node_id", node_id)
	
	## Add collision for click detection
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var sphere_shape := SphereShape3D.new()
	sphere_shape.radius = peripheral_radius
	shape.shape = sphere_shape
	body.add_child(shape)
	body.set_meta("node_id", node_id)
	bubble.add_child(body)
	
	## Position on orbital ring
	var angle: float = (float(index) / max(_peripheral_nodes.size(), 1)) * TAU
	bubble.position = _get_orbital_position(angle)
	
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
	_current_path = path_data
	
	## Stop any running transition tween immediately
	if _transition_tween and _transition_tween.is_valid():
		_transition_tween.kill()
	
	if not path_data.has("central") or not path_data.has("peripherals"):
		push_warning("PathRenderer: Invalid path data")
		return
	
	_central_node = path_data.get("central", {})
	_peripheral_nodes = path_data.get("peripherals", [])
	
	## Strict Reset of Central Bubble State
	if _central_bubble:
		_central_bubble.position = Vector3.ZERO
		_central_bubble.scale = Vector3.ONE
		_central_bubble.visible = true
	
	_update_central_bubble()
	_rebuild_peripheral_bubbles()
	_draw_edges()


func _update_central_bubble() -> void:
	if _central_node.is_empty():
		return
	
	var central_id: String = _central_node.get("id", "")
	_central_bubble.set_meta("node_id", central_id)
	
	## Update collision body meta
	var body := _central_bubble.get_child(0) as StaticBody3D
	if body:
		body.set_meta("node_id", central_id)
	
	## Update material for completed state - FORCE NEW MATERIAL
	var is_completed := state_machine.is_completed(central_id) if state_machine else false
	var new_material := _create_bubble_material(true, is_completed)
	
	## Clear override first to ensure update
	_central_bubble.material_override = null
	_central_bubble.material_override = new_material
	
	## Update label (now second child after collision body)
	var label := _central_bubble.get_child(1) as Label3D
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


var _is_pressed: bool = false
var _press_pos: Vector2 = Vector2.ZERO
const CLICK_DRAG_THRESHOLD := 5.0 ## Pixels movement allowed for a click


func _input(event: InputEvent) -> void:
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
		## Open reader
		if ws_client and ws_client.has_method("send_message"):
			ws_client.send_message({
				"type": "openReader",
				"payload": {"nodeId": node_id}
			})
	else:
		## Peripheral - orbital rotation
		animate_orbital_rotation(node_id)
