extends Node2D

var _ws_client

var nodes = []
var edges = []
var central_id = null

func _ready():
    if has_node("/root/WsClient"):
        _ws_client = get_node("/root/WsClient")
    elif has_node("../WsClient"):
        _ws_client = get_node("../WsClient")
    
    if _ws_client:
        _ws_client.connect("data_received", _on_data_received)
    
    set_process_unhandled_input(true)

func _on_data_received(data):
    if data.type == "pathResult":
        render_path(data.payload)

func render_path(payload):
    nodes = payload.nodes
    edges = payload.edges
    
    # Simple heuristic for central node (first in list)
    if nodes.size() > 0:
        central_id = nodes[0].id
        
    queue_redraw()

func _draw():
    # Draw Edges
    for edge in edges:
        var src = find_node_by_id(edge.source)
        var tgt = find_node_by_id(edge.target)
        if src and tgt:
            var p1 = Vector2(src.get("x", 0), src.get("y", 0))
            var p2 = Vector2(tgt.get("x", 0), tgt.get("y", 0))
            draw_line(p1, p2, Color(0.3, 0.3, 0.3), 1.0, true)

    # Draw Nodes
    for node in nodes:
        var pos = Vector2(node.get("x", 0), node.get("y", 0))
        var is_central = (node.id == central_id)
        var radius = 50 if is_central else 20
        var color = Color.GOLD if node.get("isCompleted", false) else (Color.CYAN if is_central else Color(0.2, 0.4, 0.8, 0.7))
        
        draw_circle(pos, radius, color)
        
        # Determine strict label rendering (using default font)
        # Godot 4.3 `draw_string` needs a Font resource ideally, or Theme.
        # Fallback to simple circle only if font missing, but we'll try default.
        # draw_string(ThemeDB.get_fallback_theme().default_font, pos, node.label)

func find_node_by_id(id):
    for n in nodes:
        if n.id == id: return n
    return null

func _unhandled_input(event):
    if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
        if event.double_click:
            # Assuming Node2D is centered or camera handles transform. 
            # If using Camera2D, use get_global_mouse_position()
            var mouse_pos = get_global_mouse_position()
            var clicked_node = get_node_at(mouse_pos)
            
            if clicked_node and _ws_client:
                _ws_client.send_message({
                    "type": "nodeClick",
                    "payload": clicked_node.id
                })

func get_node_at(pos):
    for node in nodes:
        var n_pos = Vector2(node.get("x", 0), node.get("y", 0))
        var radius = 50 if node.id == central_id else 20
        if pos.distance_to(n_pos) < radius:
            return node
    return null
