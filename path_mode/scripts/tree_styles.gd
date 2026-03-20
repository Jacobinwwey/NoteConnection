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
	},
	"tokyo night": {
		"bg": Color(0.102, 0.102, 0.165, 0.95),
		"node_completed": Color(0.612, 0.486, 0.871), # Purple
		"node_current": Color(0.478, 0.843, 0.988), # Cyan
		"node_pending": Color(0.337, 0.353, 0.459), # Comment gray
		"curve_color": Color(0.482, 0.482, 0.635, 0.5),
		"node_radius": 9.0,
		"label_color": Color(0.753, 0.792, 0.910) # Foreground
	},
	"nord": {
		"bg": Color(0.180, 0.204, 0.251, 0.98),
		"node_completed": Color(0.639, 0.745, 0.549), # Frost Green
		"node_current": Color(0.533, 0.753, 0.816), # Frost Blue
		"node_pending": Color(0.298, 0.337, 0.416), # Polar Night diff
		"curve_color": Color(0.333, 0.380, 0.463, 0.7),
		"node_radius": 8.0,
		"label_color": Color(0.847, 0.871, 0.914) # Snow Storm
	},
	"rose pine": {
		"bg": Color(0.098, 0.086, 0.137, 0.95),
		"node_completed": Color(0.961, 0.761, 0.776), # Rose
		"node_current": Color(0.608, 0.573, 0.812), # Iris
		"node_pending": Color(0.337, 0.322, 0.420), # Muted
		"curve_color": Color(0.408, 0.392, 0.502, 0.6),
		"node_radius": 9.0,
		"label_color": Color(0.886, 0.855, 0.886) # Text
	},
	"cyberpunk": {
		"bg": Color(0.02, 0.02, 0.08, 0.98),
		"node_completed": Color(0.96, 0.0, 0.35, 0.9), # Hot Pink
		"node_current": Color(0.0, 1.0, 0.83, 0.9), # Neon Cyan
		"node_pending": Color(0.2, 0.2, 0.4, 0.6), # Dark Blue-gray
		"curve_inherit_parent": true,
		"node_radius": 7.0,
		"label_color": Color(0.98, 0.9, 0.2, 1.0) # Neon Yellow
	}
}

static func get_style(style_name: String) -> Dictionary:
	return STYLES.get(style_name, STYLES["colorful"])
