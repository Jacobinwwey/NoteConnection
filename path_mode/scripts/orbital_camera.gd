extends Camera3D

## Orbital Camera Controller for Path Mode
## 轨道相机控制器 - Path Mode
## Supports: Scroll zoom, Middle-drag pan, Right-drag rotate
## When background is locked, camera stays frozen and PathRenderer rotates instead.

@export var zoom_speed: float = 0.5
@export var min_zoom: float = 3.0
@export var max_zoom: float = 15.0
@export var pan_speed: float = 0.02
@export var rotate_speed: float = 0.005

var _target_distance: float = 10.0 ## Increased from 7.0 for better initial view
var _target_rotation: Vector2 = Vector2(0.0, 0.5) ## X = orbit angle, Y = pitch (positive = above)
var _target_offset: Vector3 = Vector3.ZERO
var _is_panning: bool = false
var _is_rotating: bool = false
var _last_mouse_pos: Vector2 = Vector2.ZERO

## Background lock state / 背景锁定状态
## When locked, camera stays frozen (sky stays static), mouse drag rotates the 3D scene instead.
## 锁定后，相机保持不动（天空保持静止），鼠标拖动改为旋转3D场景节点。
var _bg_locked: bool = false


func _ready() -> void:
	_update_camera_transform()


func _unhandled_input(event: InputEvent) -> void:
	## Scroll wheel zoom (always allowed, even when locked)
	if event is InputEventMouseButton:
		var btn_event: InputEventMouseButton = event as InputEventMouseButton
		if btn_event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_target_distance = max(_target_distance - zoom_speed, min_zoom)
			_update_camera_transform()
		elif btn_event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_target_distance = min(_target_distance + zoom_speed, max_zoom)
			_update_camera_transform()
		
		## Middle mouse for pan
		elif btn_event.button_index == MOUSE_BUTTON_MIDDLE:
			_is_panning = btn_event.pressed
			if btn_event.pressed:
				_last_mouse_pos = btn_event.position
		
		## Right mouse OR Left mouse for rotate (Orbit)
		elif btn_event.button_index == MOUSE_BUTTON_RIGHT or btn_event.button_index == MOUSE_BUTTON_LEFT:
			var was_rotating: bool = _is_rotating
			_is_rotating = btn_event.pressed
			
			if _is_rotating != was_rotating:
				var scene_root := get_node_or_null("../PathRenderer")
				if scene_root and scene_root.has_method("set_camera_rotating"):
					scene_root.set_camera_rotating(_is_rotating)
					
			if btn_event.pressed:
				_last_mouse_pos = btn_event.position
	
	## Mouse motion for pan/rotate
	if event is InputEventMouseMotion:
		var motion_event: InputEventMouseMotion = event as InputEventMouseMotion
		var delta: Vector2 = motion_event.position - _last_mouse_pos
		_last_mouse_pos = motion_event.position
		
		if _is_panning:
			## Pan in view space (works the same locked or unlocked)
			var right: Vector3 = global_transform.basis.x
			var up: Vector3 = Vector3.UP
			_target_offset -= right * delta.x * pan_speed
			_target_offset += up * delta.y * pan_speed
			_update_camera_transform()
		
		elif _is_rotating:
			if _bg_locked:
				## LOCKED MODE: Camera stays still, rotate the PathRenderer scene instead
				## 锁定模式：相机不动，旋转 PathRenderer 场景节点
				_rotate_scene(delta)
			else:
				## NORMAL MODE: Rotate the camera (sky rotates with it)
				## 正常模式：旋转相机（天空随之旋转）
				_target_rotation.x -= delta.x * rotate_speed
				## Allow full 360-degree pitch
				_target_rotation.y += delta.y * rotate_speed
				_update_camera_transform()


func _rotate_scene(delta: Vector2) -> void:
	## Rotate the PathRenderer node around the orbit center
	## so nodes and tracks move while the sky stays fixed.
	## 围绕轨道中心旋转 PathRenderer 节点，使节点和轨道移动而天空保持不变。
	var scene_root := get_node_or_null("../PathRenderer") as Node3D
	if not scene_root:
		return
	
	# Use camera-relative axes for intuitive rotation
	# Horizontal drag → rotate around world Y axis (yaw)
	# Vertical drag → rotate around camera's X axis (pitch)
	var yaw_amount: float = - delta.x * rotate_speed
	var pitch_amount: float = delta.y * rotate_speed
	
	# Pure rotation around origin (no position displacement)
	# This prevents RigidBody3D physics from going haywire
	scene_root.rotate_y(yaw_amount)
	
	var pitch_axis: Vector3 = global_transform.basis.x
	scene_root.rotate(pitch_axis, pitch_amount)


func _update_camera_transform() -> void:
	## Calculate camera position on sphere around target
	var orbit_pos: Vector3 = Vector3(
		cos(_target_rotation.x) * cos(_target_rotation.y) * _target_distance,
		sin(_target_rotation.y) * _target_distance,
		sin(_target_rotation.x) * cos(_target_rotation.y) * _target_distance
	)
	
	global_position = _target_offset + orbit_pos
	
	## Ensure the UP vector flips when going upside down to prevent camera flipping/gimbal lock
	var up_vector := Vector3.UP if cos(_target_rotation.y) >= 0 else Vector3.DOWN
	look_at(_target_offset, up_vector)


## Set background lock state (called from path_renderer signal chain)
## 设置背景锁定状态（由 path_renderer 信号链调用）
## Lock: camera freezes, mouse rotates the scene. Unlock: camera resumes, scene keeps its rotation.
## 锁定：相机冻结，鼠标旋转场景。解锁：相机恢复，场景保持其旋转。
func set_background_locked(locked: bool) -> void:
	_bg_locked = locked
	print("[OrbitalCamera] Background locked: ", locked)


## Reset camera to default view
func reset_view() -> void:
	_target_distance = 7.0
	_target_rotation = Vector2(0.0, -0.5)
	_target_offset = Vector3.ZERO
	_update_camera_transform()


## Focus on a specific position
func focus_on(pos: Vector3) -> void:
	_target_offset = pos
	_update_camera_transform()
