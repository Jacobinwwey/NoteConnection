extends Camera3D

## Orbital Camera Controller for Path Mode
## Supports: Scroll zoom, Middle-drag pan, Right-drag rotate

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


func _ready() -> void:
	_update_camera_transform()


func _unhandled_input(event: InputEvent) -> void:
	## Scroll wheel zoom
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
			_is_rotating = btn_event.pressed
			if btn_event.pressed:
				_last_mouse_pos = btn_event.position
	
	## Mouse motion for pan/rotate
	if event is InputEventMouseMotion:
		var motion_event: InputEventMouseMotion = event as InputEventMouseMotion
		var delta: Vector2 = motion_event.position - _last_mouse_pos
		_last_mouse_pos = motion_event.position
		
		if _is_panning:
			## Pan in view space
			var right: Vector3 = global_transform.basis.x
			var up: Vector3 = Vector3.UP
			_target_offset -= right * delta.x * pan_speed
			_target_offset += up * delta.y * pan_speed
			_update_camera_transform()
		
		elif _is_rotating:
			## Orbit rotation
			_target_rotation.x -= delta.x * rotate_speed
			## Clamp pitch to stay ABOVE horizon (0.1 to 1.5 radians)
			_target_rotation.y = clampf(_target_rotation.y + delta.y * rotate_speed, 0.1, 1.5)
			_update_camera_transform()


func _update_camera_transform() -> void:
	## Calculate camera position on sphere around target
	var orbit_pos: Vector3 = Vector3(
		cos(_target_rotation.x) * cos(_target_rotation.y) * _target_distance,
		sin(_target_rotation.y) * _target_distance,
		sin(_target_rotation.x) * cos(_target_rotation.y) * _target_distance
	)
	
	global_position = _target_offset + orbit_pos
	look_at(_target_offset, Vector3.UP)


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
