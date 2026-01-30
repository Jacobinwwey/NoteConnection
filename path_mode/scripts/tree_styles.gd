class_name TreeStyles
extends Resource

const STYLES := {
	"colorful": {
		"bg": Color(0.1, 0.1, 0.15, 0.9),
		"node_completed": Color(1.0, 0.84, 0.0), # Gold
		"node_current": Color(0.0, 0.8, 0.9), # Cyan
		"node_pending": Color(0.5, 0.5, 0.6), # Gray
		"curve_inherit_parent": true,
		"node_radius": 8.0,
		"label_color": Color.WHITE
	},
	"dark": {
		"bg": Color(0.1, 0.1, 0.18, 0.95),
		"node_completed": Color(0.4, 0.3, 0.6),
		"node_current": Color(0.3, 0.4, 0.7),
		"node_pending": Color(0.25, 0.25, 0.3),
		"curve_color": Color(0.4, 0.4, 0.6, 0.6),
		"node_radius": 10.0,
		"label_color": Color(0.9, 0.9, 0.9)
	},
	"glass": {
		"bg": Color(0.15, 0.15, 0.2, 0.5), # Transparent
		"blur_enabled": true,
		"glow_curves": true,
		"node_completed": Color(1.0, 0.9, 0.5, 0.8),
		"node_current": Color(0.5, 0.9, 1.0, 0.8),
		"node_pending": Color(0.7, 0.7, 0.8, 0.5),
		"curve_color": Color(0.8, 0.9, 1.0, 0.5),
		"node_radius": 6.0,
		"label_color": Color.WHITE
	},
	"minimal": {
		"bg": Color(0.12, 0.12, 0.15, 0.95),
		"node_completed": Color(0.8, 0.8, 0.8),
		"node_current": Color(1.0, 1.0, 1.0),
		"node_pending": Color(0.4, 0.4, 0.4),
		"curve_color": Color(0.5, 0.5, 0.5, 0.4),
		"node_radius": 5.0,
		"label_color": Color(0.8, 0.8, 0.8)
	}
}

static func get_style(style_name: String) -> Dictionary:
	return STYLES.get(style_name, STYLES["colorful"])
