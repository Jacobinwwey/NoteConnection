shader_type canvas_item;

uniform sampler2D SCREEN_TEXTURE : hint_screen_texture, filter_linear_mipmap;
uniform float lod: hint_range(0.0, 5.0) = 2.0;
uniform vec4 mix_color : source_color = vec4(0.85, 0.9, 0.95, 0.2); // Soft glass tint

void fragment() {
    // Read the screen pixels behind this polygon
    vec4 bg = textureLod(SCREEN_TEXTURE, SCREEN_UV, lod);
    // Mix it with the tint
    COLOR = mix(bg, mix_color, mix_color.a);
}
