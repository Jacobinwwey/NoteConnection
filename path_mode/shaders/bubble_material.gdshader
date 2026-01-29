shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

// Iridescent Soap Bubble Shader for Path Mode Orbital Learning
// Replicates thin-film interference and fresnel glow effect

group_uniforms BubbleProperties;
uniform vec4 base_color : source_color = vec4(0.8, 0.85, 1.0, 0.15);
uniform float fresnel_power : hint_range(1.0, 8.0) = 4.0;
uniform float iridescence_amount : hint_range(0.0, 1.0) = 0.6;
uniform float rim_intensity : hint_range(0.0, 2.0) = 1.2;
uniform float bubble_size : hint_range(0.5, 2.0) = 1.0;

group_uniforms Animation;
uniform float time_scale : hint_range(0.0, 2.0) = 0.3;
uniform float noise_strength : hint_range(0.0, 0.5) = 0.1;

group_uniforms State;
uniform bool is_central = true;
uniform bool is_completed = false;
uniform vec4 completed_color : source_color = vec4(1.0, 0.84, 0.0, 0.9);  // Gold

// Thin-film interference color approximation
// Simulates rainbow effect on soap bubble surface
vec3 iridescent_color(float angle) {
    // Phase-shifted sine waves for RGB channels
    // Creates rainbow spectrum based on viewing angle
    return vec3(
        sin(angle * 2.0) * 0.5 + 0.5,
        sin(angle * 2.0 + 2.094) * 0.5 + 0.5,  // +120 degrees
        sin(angle * 2.0 + 4.189) * 0.5 + 0.5   // +240 degrees
    );
}

// Simple noise for surface variation
float simple_noise(vec2 uv, float t) {
    return fract(sin(dot(uv + t * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
}

void vertex() {
    // Subtle breathing animation for central bubble
    if (is_central) {
        float breath = sin(TIME * time_scale) * 0.02 + 1.0;
        VERTEX *= breath * bubble_size;
    } else {
        VERTEX *= bubble_size;
    }
}

void fragment() {
    // Fresnel effect - brighter at edges (like real soap bubble)
    float fresnel = pow(1.0 - dot(NORMAL, VIEW), fresnel_power);
    
    // Animated surface noise for organic feel
    float noise = simple_noise(UV, TIME) * noise_strength;
    
    // Rainbow iridescence based on fresnel angle
    vec3 rainbow = iridescent_color(fresnel * 6.28318) * iridescence_amount;
    
    if (is_completed) {
        // Gold star appearance for completed nodes
        ALBEDO = completed_color.rgb;
        ALPHA = completed_color.a;
        EMISSION = completed_color.rgb * 0.5;
        METALLIC = 0.8;
        ROUGHNESS = 0.2;
    } else {
        // Normal iridescent bubble
        vec3 final_color = base_color.rgb + rainbow * fresnel;
        
        // Central bubbles are slightly more opaque
        float alpha_mult = is_central ? 1.0 : 0.7;
        
        ALBEDO = final_color;
        ALPHA = (base_color.a + fresnel * rim_intensity - noise) * alpha_mult;
        EMISSION = rainbow * fresnel * 0.3;
        ROUGHNESS = 0.1;
        METALLIC = 0.0;
    }
}

void light() {
    // Dual highlight spots simulation
    float spec1 = pow(max(dot(reflect(-LIGHT, NORMAL), VIEW), 0.0), 32.0);
    float spec2 = pow(max(dot(reflect(-LIGHT, NORMAL), VIEW + vec3(0.3, 0.2, 0.0)), 0.0), 16.0);
    
    SPECULAR_LIGHT += LIGHT_COLOR * (spec1 * 0.8 + spec2 * 0.4);
    DIFFUSE_LIGHT += ALBEDO * LIGHT_COLOR * max(dot(NORMAL, LIGHT), 0.0) * 0.3;
}
