extends Node

signal data_received(data)
signal connected
signal disconnected

var _socket = WebSocketPeer.new()
var _url = "ws://127.0.0.1:9876"
var _connected = false

func _ready():
    connect_to_server()

func connect_to_server():
    var err = _socket.connect_to_url(_url)
    if err != OK:
        print("Unable to connect")
        set_process(false)
    else:
        print("Connecting to " + _url)

func _process(_delta):
    _socket.poll()
    var state = _socket.get_ready_state()
    
    if state == WebSocketPeer.STATE_OPEN:
        if not _connected:
            _connected = true
            emit_signal("connected")
            print("Connected!")
            
        while _socket.get_available_packet_count():
            var packet = _socket.get_packet()
            var text = packet.get_string_from_utf8()
            var json = JSON.new()
            var error = json.parse(text)
            if error == OK:
                emit_signal("data_received", json.data)
            else:
                print("JSON Parse Error: ", json.get_error_message())
                
    elif state == WebSocketPeer.STATE_CLOSED:
        if _connected:
            _connected = false
            emit_signal("disconnected")
            print("Disconnected. code: ", _socket.get_close_code(), " reason: ", _socket.get_close_reason())
            # Auto reconnect?
            await get_tree().create_timer(3.0).timeout
            connect_to_server()

func send_message(data):
    if _connected:
        _socket.send_text(JSON.stringify(data))
