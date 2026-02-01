extends Node

## WebSocket Client for Path Mode communication
## Handles bidirectional messaging with frontend

signal data_received(data: Dictionary)
signal connected
signal disconnected
signal path_result(data: Dictionary)
signal path_update(data: Dictionary)
signal switch_center(new_center_id: String)
signal completion_sync(completed_ids: Array, timestamp: int)

const WS_URL := "ws://127.0.0.1:9876"
const RECONNECT_DELAY := 3.0

var _socket := WebSocketPeer.new()
var _connected := false
var _reconnect_timer: Timer


func _ready() -> void:
	_setup_reconnect_timer()
	_socket.inbound_buffer_size = 1048576 * 8 # Increase buffer to 8MB
	connect_to_server()


func _setup_reconnect_timer() -> void:
	_reconnect_timer = Timer.new()
	_reconnect_timer.one_shot = true
	_reconnect_timer.timeout.connect(_on_reconnect_timeout)
	add_child(_reconnect_timer)


func connect_to_server() -> void:
	var err := _socket.connect_to_url(WS_URL)
	if err != OK:
		push_warning("WsClient: Unable to connect to %s" % WS_URL)
		_schedule_reconnect()
	else:
		print("WsClient: Connecting to %s" % WS_URL)


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
	connect_to_server()


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
		push_warning("WsClient: Cannot send, not connected")
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
## Check if WebSocket is connected
func is_ws_connected() -> bool:
	return _connected
