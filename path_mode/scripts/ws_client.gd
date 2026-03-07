extends Node

signal connected
signal disconnected
signal data_received(data)
signal path_result(data)
signal path_update(data)
signal switch_center(new_center_id)
signal completion_sync(completed_ids, timestamp)

const DEFAULT_HOST := "127.0.0.1"
const DEFAULT_BRIDGE_PORT := 9876
const CLIENT_TAG := "godot"
const RECONNECT_DELAY := 3.0

var _socket := WebSocketPeer.new()
var _connected := false
var _reconnect_timer: Timer
var _pending_messages: Array[Dictionary] = []
var _ws_url: String = ""


func _ready() -> void:
	_setup_reconnect_timer()
	_socket.inbound_buffer_size = 1048576 * 8 # Increase buffer to 8MB
	_ws_url = _resolve_ws_url()
	connect_to_server()


func _setup_reconnect_timer() -> void:
	_reconnect_timer = Timer.new()
	_reconnect_timer.one_shot = true
	_reconnect_timer.timeout.connect(_on_reconnect_timeout)
	add_child(_reconnect_timer)


func connect_to_server() -> void:
	if _ws_url.is_empty():
		_ws_url = _resolve_ws_url()
	var err := _socket.connect_to_url(_ws_url)
	if err != OK:
		push_warning("WsClient: Unable to connect to %s" % _ws_url)
		_schedule_reconnect()
	else:
		print("WsClient: Connecting to %s" % _ws_url)


func _process(_delta: float) -> void:
	_socket.poll()
	var state := _socket.get_ready_state()
	
	match state:
		WebSocketPeer.STATE_OPEN:
			_handle_open_state()
		WebSocketPeer.STATE_CLOSED:
			_handle_closed_state()
		WebSocketPeer.STATE_CLOSING:
			pass # Wait for close
		WebSocketPeer.STATE_CONNECTING:
			pass # Wait for connection


func _handle_open_state() -> void:
	if not _connected:
		_connected = true
		connected.emit()
		print("WsClient: Connected!")
		_send_identify()
		_flush_pending_messages()
		
		## Request initial path data
		send_message({"type": "requestPath", "payload": {}})
	
	while _socket.get_available_packet_count() > 0:
		var packet := _socket.get_packet()
		var text := packet.get_string_from_utf8()
		_parse_message(text)


func _handle_closed_state() -> void:
	if _connected:
		_connected = false
		disconnected.emit()
		var code := _socket.get_close_code()
		var reason := _socket.get_close_reason()
		print("WsClient: Disconnected. Code: %d, Reason: %s" % [code, reason])
	
	_schedule_reconnect()


func _schedule_reconnect() -> void:
	if not _reconnect_timer.is_stopped():
		return
	_reconnect_timer.start(RECONNECT_DELAY)


func _on_reconnect_timeout() -> void:
	_ws_url = _resolve_ws_url()
	connect_to_server()


func _send_identify() -> void:
	var payload: Dictionary = {"client": CLIENT_TAG}
	var auth_token := OS.get_environment("NOTE_CONNECTION_AUTH_TOKEN").strip_edges()
	if not auth_token.is_empty():
		payload["token"] = auth_token
	send_message({
		"type": "identify",
		"payload": payload
	})


func _flush_pending_messages() -> void:
	if _pending_messages.is_empty():
		return
	var queued: Array[Dictionary] = _pending_messages.duplicate(true)
	_pending_messages.clear()
	for message in queued:
		send_message(message)


func _parse_message(text: String) -> void:
	var json := JSON.new()
	var error := json.parse(text)
	
	if error != OK:
		push_warning("WsClient: JSON parse error: %s" % json.get_error_message())
		return
	
	var data: Dictionary = json.data
	data_received.emit(data)
	
	## Dispatch to specific signals based on type
	var msg_type: String = data.get("type", "")
	var payload: Dictionary = data.get("payload", {})
	
	match msg_type:
		"pathResult":
			path_result.emit(payload)
		"pathUpdate":
			path_update.emit(payload)
		"switchCenter":
			var new_id: String = payload.get("newCenterId", "")
			if not new_id.is_empty():
				switch_center.emit(new_id)
		"completionSync":
			# Bidirectional sync from Electron
			var ids: Array = payload.get("completedIds", [])
			var timestamp: int = payload.get("timestamp", 0)
			completion_sync.emit(ids, timestamp)


## Send a message to the frontend
func send_message(data: Dictionary) -> void:
	if not _connected:
		_pending_messages.append(data.duplicate(true))
		return
	
	var text := JSON.stringify(data)
	_socket.send_text(text)


## Convenience methods for common message types

func send_node_click(node_id: String) -> void:
	send_message({
		"type": "nodeClick",
		"payload": {"nodeId": node_id}
	})


func send_mark_complete(node_id: String) -> void:
	send_message({
		"type": "markComplete",
		"payload": {"nodeId": node_id}
	})


func send_open_reader(node_id: String) -> void:
	send_message({
		"type": "openReader",
		"payload": {"nodeId": node_id}
	})


func send_switch_center(node_id: String) -> void:
	send_message({
		"type": "switchCenter",
		"payload": {"newCenterId": node_id}
	})

func send_configure(config: Dictionary) -> void:
	send_message({
		"type": "configure",
		"payload": config
	})

func send_toggle_collapse(node_id: String) -> void:
	send_message({
		"type": "toggleCollapse",
		"payload": {"nodeId": node_id}
	})

func send_expand_prereqs(node_id: String) -> void:
	send_message({
		"type": "expandPrereqs",
		"payload": {"nodeId": node_id}
	})

func send_collapse_prereqs(node_id: String) -> void:
	send_message({
		"type": "collapsePrereqs",
		"payload": {"nodeId": node_id}
	})

func send_collapse_all() -> void:
	send_message({
		"type": "collapseAll",
		"payload": {}
	})

func send_exit_path_mode() -> void:
	send_message({
		"type": "exitPathMode",
		"payload": {}
	})

## Check if WebSocket is connected
func is_ws_connected() -> bool:
	return _connected


func _resolve_ws_url() -> String:
	var port := _resolve_bridge_port()
	return "ws://%s:%d" % [DEFAULT_HOST, port]


func _resolve_bridge_port() -> int:
	var port_text := OS.get_environment("NOTE_CONNECTION_BRIDGE_PORT").strip_edges()
	if port_text.is_valid_int():
		var resolved_port := int(port_text)
		if resolved_port > 0:
			return resolved_port
	return DEFAULT_BRIDGE_PORT

