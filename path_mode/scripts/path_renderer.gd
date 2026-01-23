extends Node2D

var _ws_client

var nodes = []
var edges = []

func _ready():
    _ws_client = get_node("/root/WsClient") # Autosoload or Main scene child?
    # Assuming it's a child of Main for now
    if has_node("../WsClient"):
        _ws_client = get_node("../WsClient")
        _ws_client.connect("data_received", _on_data_received)

func _on_data_received(data):
    if data.type == "pathResult":
        render_path(data.payload)

func render_path(payload):
    nodes = payload.nodes
    edges = payload.edges
    queue_redraw()

func _draw():
    # Efficient 2D drawing
    # For massive counts, we should use RenderingServer directly, 
    # but _draw is easier for < 10k nodes in 2D. 
    # Godot 4.3 can handle many primitives in _draw.
    
    for edge in edges:
        # Resolve positions... Godot needs positions sent from logic or computed here.
        # If logic sends x,y (from PathEngine layout), we use them.
        # Fallback: we need logic to send layout.
        pass
        
    for node in nodes:
        var pos = Vector2(node.get("x", 0), node.get("y", 0))
        draw_circle(pos, 5, Color.CYAN)
