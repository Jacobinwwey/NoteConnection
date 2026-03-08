extends Node2D
class_name ReaderImageCanvas

var image_texture: Texture2D = null
var image_position: Vector2 = Vector2.ZERO
var image_size: Vector2 = Vector2.ZERO
var background_color: Color = Color(0.012, 0.014, 0.018, 1.0)

func _ready() -> void:
	modulate = Color(1.0, 1.0, 1.0, 1.0)
	self_modulate = Color(1.0, 1.0, 1.0, 1.0)
	material = null
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	z_as_relative = true
	z_index = 0


func set_render_texture(texture: Texture2D) -> void:
	image_texture = texture
	queue_redraw()


func set_render_transform(position: Vector2, size: Vector2) -> void:
	image_position = position
	image_size = size
	queue_redraw()


func set_background(color_value: Color) -> void:
	background_color = color_value
	queue_redraw()


func _draw() -> void:
	if image_size.x <= 0.0 or image_size.y <= 0.0:
		return
	var target_rect := Rect2(image_position, image_size)
	draw_rect(target_rect, background_color, true)
	if image_texture != null:
		draw_texture_rect(image_texture, target_rect, false)