extends Node

## Learning State Machine for Orbital Learning Flow
## Controls state transitions and progress persistence
class_name LearningStateMachine

signal state_changed(from_state: StringName, to_state: StringName)
signal central_changed(old_id: String, new_id: String)
signal node_completed(node_id: String, next_id: String)
signal node_unmarked(node_id: String)
signal path_complete()

enum State {
	IDLE, ## No path loaded
	VIEWING, ## Viewing orbital layout
	TRANSITIONING, ## Animating transition between nodes
	READING ## Reader overlay open
}

const SAVE_PATH := "user://orbital_progress.json"

var current_state: State = State.IDLE
var previous_state: State = State.IDLE
var current_central_id: String = ""
var completed_ids: Array[String] = []
var learning_path: Dictionary = {} ## {nodes: [], edges: [], strategy}
var mode: String = "diffusion" ## "domain" or "diffusion"
var ultimate_target_id: String = "" ## For diffusion mode


func _ready() -> void:
	_load_progress()


## Transition to a new state with optional data
func transition_to(new_state: State, data: Dictionary = {}) -> void:
	if new_state == current_state:
		return
	
	previous_state = current_state
	current_state = new_state
	
	var from_name := State.keys()[previous_state] as StringName
	var to_name := State.keys()[new_state] as StringName
	state_changed.emit(from_name, to_name)
	
	match new_state:
		State.IDLE:
			_on_enter_idle()
		State.VIEWING:
			_on_enter_viewing(data)
		State.TRANSITIONING:
			_on_enter_transitioning(data)
		State.READING:
			_on_enter_reading(data)


func _on_enter_idle() -> void:
	current_central_id = ""
	learning_path = {}


func _on_enter_viewing(data: Dictionary) -> void:
	if data.has("central_id"):
		var old_id := current_central_id
		current_central_id = data.get("central_id", "")
		if old_id != current_central_id:
			central_changed.emit(old_id, current_central_id)
	_save_progress()


func _on_enter_transitioning(_data: Dictionary) -> void:
	## Animation handled by PathRenderer
	## Will transition back to VIEWING when complete
	pass


func _on_enter_reading(_data: Dictionary) -> void:
	## Reader overlay is shown
	## Will return to VIEWING when closed
	pass


## Mark a node as complete (defaults to current central node)
func mark_complete(target_id: String = "") -> void:
	var node_id := target_id
	if node_id.is_empty():
		node_id = current_central_id
		
	if node_id.is_empty():
		return
	
	if node_id not in completed_ids:
		completed_ids.append(node_id)
	
	## Logic for next node depends on whether we completed the current central node
	var next_id := ""
	if node_id == current_central_id:
		next_id = _find_next_uncompleted()
	
	node_completed.emit(node_id, next_id)
	
	if next_id.is_empty():
		## Check if truly all done
		if _find_next_uncompleted() == "":
			path_complete.emit()
			_save_progress()
	else:
		if node_id == current_central_id:
			switch_central(next_id, true)


## Find next uncompleted node in learning path
func _find_next_uncompleted() -> String:
	if not learning_path.has("nodes"):
		return ""
	
	var nodes: Array = learning_path.get("nodes", [])
	var current_idx := -1
	
	for i in range(nodes.size()):
		var node_data: Dictionary = nodes[i] if nodes[i] is Dictionary else {}
		if node_data.get("id", "") == current_central_id:
			current_idx = i
			break
	
	for i in range(current_idx + 1, nodes.size()):
		var node_data: Dictionary = nodes[i] if nodes[i] is Dictionary else {}
		var node_id: String = node_data.get("id", "")
		if not node_id.is_empty() and node_id not in completed_ids:
			return node_id
	
	return ""


## Switch to a new central node
func switch_central(node_id: String, animate: bool = true) -> void:
	if node_id == current_central_id:
		return
	
	if animate:
		transition_to(State.TRANSITIONING, {"target_id": node_id})
	else:
		transition_to(State.VIEWING, {"central_id": node_id})


## Set learning path from PathEngine
func set_learning_path(path: Dictionary) -> void:
	learning_path = path
	
	var nodes: Array = path.get("nodes", [])
	if nodes.size() > 0:
		## Find first uncompleted
		for node in nodes:
			var node_data: Dictionary = node if node is Dictionary else {}
			var node_id: String = node_data.get("id", "")
			if not node_id.is_empty() and node_id not in completed_ids:
				current_central_id = node_id
				break
		
		if current_central_id.is_empty() and nodes.size() > 0:
			var first_node: Dictionary = nodes[0] if nodes[0] is Dictionary else {}
			current_central_id = first_node.get("id", "")
	
	transition_to(State.VIEWING, {"central_id": current_central_id})


## Get progress for display (X of Y)
func get_progress() -> Dictionary:
	var nodes: Array = learning_path.get("nodes", [])
	# Use explicit total if provided, otherwise count nodes
	var total: int = learning_path.get("total", nodes.size())
	return {
		"completed": completed_ids.size(),
		"total": total
	}


## Get list of completed node IDs
func get_completed_ids() -> Array[String]:
	return completed_ids


## Check if a node is completed
func is_completed(node_id: String) -> bool:
	return node_id in completed_ids


## Reset all progress
func reset_progress() -> void:
	completed_ids.clear()
	current_central_id = ""
	learning_path = {}
	_delete_save()
	transition_to(State.IDLE)


## Unmark a node as complete
func unmark_complete(node_id: String) -> void:
	var idx := completed_ids.find(node_id)
	if idx >= 0:
		completed_ids.remove_at(idx)
		node_unmarked.emit(node_id)
		_save_progress()


## Save progress to user filesystem
func _save_progress() -> void:
	var data := {
		"completed_ids": completed_ids,
		"current_central_id": current_central_id,
		"mode": mode,
		"ultimate_target_id": ultimate_target_id,
		"version": 1
	}
	
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()


## Load progress from user filesystem
func _load_progress() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	
	var content := file.get_as_text()
	file.close()
	
	var json := JSON.new()
	var error := json.parse(content)
	if error != OK:
		push_warning("LearningStateMachine: Failed to parse save file")
		return
	
	var data: Dictionary = json.data
	if data.has("completed_ids"):
		completed_ids.assign(data.completed_ids)
	if data.has("current_central_id"):
		current_central_id = data.current_central_id
	if data.has("mode"):
		mode = data.mode
	if data.has("ultimate_target_id"):
		ultimate_target_id = data.ultimate_target_id


## Delete save file
func _delete_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)


## Truncate label for display (max chars)
static func truncate_label(label: String, max_len: int = 15) -> String:
	if label.length() <= max_len:
		return label
	return label.substr(0, max_len) + "..."
