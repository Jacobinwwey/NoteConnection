shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_back, specular_schlick_ggx;

// Iridescent Soap Bubble Shader v2
// Optimized for: visible rainbow iridescence, proper transparency

group_uniforms BubbleCore;
uniform vec4 base_tint : source_color = vec4(0.9, 0.92, 1.0, 0.03);
uniform float bubble_thickness : hint_range(0.5, 3.0) = 1.5;
uniform float ior : hint_range(1.0, 1.5) = 1.33;

group_uniforms Iridescence;
uniform float iridescence_strength : hint_range(0.0, 2.0) = 1.2;
uniform float iridescence_scale : hint_range(2.0, 12.0) = 6.0;
uniform float color_shift_speed : hint_range(0.0, 0.5) = 0.1;
uniform float rainbow_saturation : hint_range(0.5, 1.0) = 0.85;

group_uniforms Fresnel;
uniform float fresnel_power : hint_range(2.0, 8.0) = 3.5;
uniform float rim_opacity : hint_range(0.1, 0.5) = 0.35;
uniform float center_opacity : hint_range(0.0, 0.1) = 0.02;

group_uniforms Highlights;
uniform float specular_intensity : hint_range(0.5, 3.0) = 2.0;
uniform float highlight_sharpness : hint_range(16.0, 96.0) = 64.0;

group_uniforms Animation;
uniform float time_scale : hint_range(0.0, 0.5) = 0.15;
uniform float surface_wobble : hint_range(0.0, 0.05) = 0.01;

group_uniforms State;
uniform bool is_central = true;
uniform bool is_completed = false;
uniform vec4 completed_color : source_color = vec4(1.0, 0.84, 0.0, 0.85);
uniform vec4 central_tint : source_color = vec4(0.3, 0.7, 0.95, 1.0);
uniform vec4 peripheral_tint : source_color = vec4(0.65, 0.4, 0.85, 1.0);

// Thin-film interference - creates rainbow bands
vec3 thin_film_color(float angle, float thickness) {
    // Optical path creates phase differences for RGB
    float path = thickness * (1.0 + angle);
    
    // Phase-shifted cosines for each wavelength
    vec3 rgb;
    rgb.r = 0.5 + 0.5 * cos(path * 2.5 + 0.0);        // Red: longest wavelength
    rgb.g = 0.5 + 0.5 * cos(path * 3.2 + 2.094);      // Green: +120°
    rgb.b = 0.5 + 0.5 * cos(path * 4.0 + 4.189);      // Blue: +240°
    
    return rgb;
}

// HSV to RGB for saturated rainbow
vec3 hsv2rgb(float h, float s, float v) {
    vec3 c = vec3(h, s, v);
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

varying vec3 v_world_normal;

void vertex() {
    // Subtle breathing animation
    float breath = 1.0;
    if (is_central) {
        breath = 1.0 + sin(TIME * time_scale * 3.0) * 0.012;
    }
    
    // Organic surface wobble
    float wobble = sin(VERTEX.x * 5.0 + TIME) * sin(VERTEX.y * 5.0 + TIME * 0.7) * surface_wobble;
    VERTEX *= breath + wobble;
    
    v_world_normal = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
}

void fragment() {
    vec3 view_dir = normalize(VIEW);
    vec3 normal = normalize(NORMAL);
    
    // Fresnel: 0 = facing camera, 1 = edge (grazing angle)
    float fresnel = pow(1.0 - abs(dot(normal, view_dir)), fresnel_power);
    
    // Thickness varies across surface for color bands
    float thickness_var = bubble_thickness 
        + sin(UV.x * iridescence_scale + TIME * color_shift_speed) * 0.6
        + sin(UV.y * iridescence_scale * 1.2 - TIME * color_shift_speed * 0.5) * 0.4
        + cos((UV.x + UV.y) * iridescence_scale * 0.7) * 0.3;
    
    // Viewing angle for interference
    float view_angle = acos(abs(dot(normal, view_dir)));
    
    // Thin-film interference colors
    vec3 interference = thin_film_color(view_angle, thickness_var);
    
    // Rainbow hue based on position and time
    float hue = fract(UV.x * 0.5 + UV.y * 0.3 + fresnel * 0.4 + TIME * color_shift_speed * 0.2);
    vec3 rainbow = hsv2rgb(hue, rainbow_saturation, 1.0);
    
    // Blend interference + rainbow for rich iridescence
    vec3 iridescent = mix(interference, rainbow, 0.5) * iridescence_strength;
    
    if (is_completed) {
        // Gold completed state
        ALBEDO = completed_color.rgb;
        ALPHA = completed_color.a;
        EMISSION = completed_color.rgb * 0.4 + iridescent * 0.15;
        METALLIC = 0.85;
        ROUGHNESS = 0.2;
        SPECULAR = 0.9;
    } else {
        // Select tint based on central/peripheral
        vec3 tint = is_central ? central_tint.rgb : peripheral_tint.rgb;
        
        // Bubble color: mostly iridescent with subtle tint
        vec3 bubble_color = iridescent * (0.6 + fresnel * 0.4) + tint * 0.15;
        
        // Transparency: very transparent in center, slightly opaque at rim
        float alpha = mix(center_opacity, rim_opacity, fresnel);
        
        // Peripheral bubbles slightly more transparent
        if (!is_central) {
            alpha *= 0.85;
        }
        
        ALBEDO = bubble_color;
        ALPHA = clamp(alpha, 0.01, 0.5);
        
        // Soft emissive glow at rim with iridescent color
        EMISSION = iridescent * fresnel * 0.3;
        
        // Glass-like properties
        METALLIC = 0.0;
        ROUGHNESS = 0.02;
        SPECULAR = 0.8;
    }
}

void light() {
    // Primary bright specular highlight
    vec3 reflect_dir = reflect(-LIGHT, NORMAL);
    float spec_main = pow(max(dot(reflect_dir, VIEW), 0.0), highlight_sharpness);
    
    // Secondary offset highlight (creates dual-light effect)
    vec3 offset_view = normalize(VIEW + vec3(0.3, 0.25, 0.0));
    float spec_secondary = pow(max(dot(reflect_dir, offset_view), 0.0), highlight_sharpness * 0.5);
    
    // Third soft fill highlight
    vec3 offset_view2 = normalize(VIEW + vec3(-0.25, 0.15, 0.1));
    float spec_fill = pow(max(dot(reflect_dir, offset_view2), 0.0), highlight_sharpness * 0.25);
    
    // Combine with white-ish color
    float combined = (spec_main + spec_secondary * 0.6 + spec_fill * 0.3) * specular_intensity;
    SPECULAR_LIGHT += LIGHT_COLOR * combined * vec3(1.0, 0.98, 0.96);
    
    // Minimal diffuse for soap bubble
    float ndotl = max(dot(NORMAL, LIGHT), 0.0);
    DIFFUSE_LIGHT += ALBEDO * LIGHT_COLOR * ndotl * 0.08 * ATTENUATION;
}
