shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_back, specular_schlick_ggx;

// Smooth bubble shader
// Optimized for: clean translucent bubbles without visible surface texture artifacts

group_uniforms BubbleCore;
uniform vec4 base_tint : source_color = vec4(0.9, 0.92, 1.0, 0.03);
uniform float bubble_thickness : hint_range(0.5, 3.0) = 1.5;
uniform float ior : hint_range(1.0, 1.5) = 1.33;

group_uniforms Iridescence;
uniform float iridescence_strength : hint_range(0.0, 2.0) = 0.45;
uniform float iridescence_scale : hint_range(2.0, 12.0) = 6.0;
uniform float color_shift_speed : hint_range(0.0, 0.5) = 0.1;
uniform float rainbow_saturation : hint_range(0.0, 1.0) = 0.22;

group_uniforms Fresnel;
uniform float fresnel_power : hint_range(1.0, 8.0) = 2.5;
uniform float rim_opacity : hint_range(0.1, 1.0) = 0.84;
uniform float center_opacity : hint_range(0.0, 1.0) = 0.34;

group_uniforms Highlights;
uniform float specular_intensity : hint_range(0.5, 3.0) = 1.5;
uniform float highlight_sharpness : hint_range(16.0, 96.0) = 64.0;

group_uniforms Animation;
uniform float time_scale : hint_range(0.0, 0.5) = 0.15;
uniform float surface_wobble : hint_range(0.0, 0.05) = 0.002;

group_uniforms State;
uniform bool is_central = true;
uniform bool is_completed = false;
uniform vec4 completed_color : source_color = vec4(1.0, 0.84, 0.0, 0.85);
uniform vec4 central_tint : source_color = vec4(0.3, 0.7, 0.95, 1.0);
uniform vec4 peripheral_tint : source_color = vec4(0.65, 0.4, 0.85, 1.0);

const float nu = 1.4;

const mat3 sparsespfiltconst = mat3(vec3(997.744490776777870, 0.0, 0.0), vec3(0.0, 1000.429230968840700, 0.0), vec3(0.0, 0.0, 1000.314923254210300));
const mat3 sparsespfilta[13] = mat3[13](
	mat3(vec3(-9.173541963568921, 0.0, 0.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.0)),
	mat3(vec3(-12.118820092848431, 0.0, 0.0), vec3(0.0, 0.362717643641774, 0.0), vec3(0.0, 0.0, 0.0)),
	mat3(vec3(-18.453733912103289, 0.0, 0.0), vec3(0.0, 1.063838675818334, 0.0), vec3(0.0, 0.0, 0.0)),
	mat3(vec3(-448.414255038845680, -26.846846493079958, 0.0), vec3(94.833575999184120, 9.525075729872752, 0.0), vec3(-48.773853498042200, 0.0, -0.416692876008104)),
	mat3(vec3(6.312176276235818, -29.044711065580177, 0.0), vec3(-187.629408328884550, -359.908263134928520, 0.0), vec3(0.0, 25.579031651446712, -0.722360089703890)),
	mat3(vec3(-33.547962219868452, 61.587972582979901, 0.0), vec3(97.565538879460178, -150.665614921761320, -30.220477643983013), vec3(1.552347379820659, -0.319166631512109, -0.935186347338915)),
	mat3(vec3(3.894757056395064, 0.0, 10.573132007634964), vec3(0.0, -3.434367603334157, -9.216617325755173), vec3(39.438244799684632, 0.0, -274.009089525723140)),
	mat3(vec3(3.824490469437192, 0.0, 0.0), vec3(0.0, -1.540065958710146, 35.179624268750139), vec3(0.0, 0.0, -239.475015979167920)),
	mat3(vec3(2.977660826364815, 0.0, 0.0), vec3(0.0, -1.042036915995045, 0.0), vec3(0.0, 0.0, -2.472524681362817)),
	mat3(vec3(2.307327051977537, 0.0, 0.0), vec3(0.0, -0.875061637866728, 0.0), vec3(0.0, 0.0, -1.409849313639845)),
	mat3(vec3(1.823790655724537, 0.0, 0.0), vec3(0.0, -0.781918646414733, 0.0), vec3(0.0, 0.0, -1.048825978147449)),
	mat3(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, -0.868933490490107)),
	mat3(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, -0.766926116519291))
);
const mat3 sparsespfiltb[13] = mat3[13](
	mat3(vec3(36.508697968439087, 0.0, 0.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.0)),
	mat3(vec3(57.242341893668829, 0.0, 0.0), vec3(0.0, 38.326477066948989, 0.0), vec3(0.0, 0.0, 0.0)),
	mat3(vec3(112.305664332688050, 0.0, 0.0), vec3(0.0, 59.761768151790150, 0.0), vec3(0.0, 0.0, 0.0)),
	mat3(vec3(295.791838308625070, 58.489998502973329, 0.0), vec3(70.091833386311293, 120.512061156381040, 0.0), vec3(17.204619265336060, 0.0, 37.784871450121273)),
	mat3(vec3(-253.802681237032970, -160.471170139118780, 0.0), vec3(-194.893137314865900, 220.339388056683760, 0.0), vec3(0.0, -22.651202495658183, 57.335351084503102)),
	mat3(vec3(-114.597984116320400, 38.688618505605739, 0.0), vec3(30.320616033665370, -278.354607015268130, 9.944900164751438), vec3(-30.962164636838232, 37.612068254920686, 113.260728861048410)),
	mat3(vec3(-78.527368894236332, 0.0, 30.382451414099631), vec3(0.0, -116.269817575252430, -55.801473552703627), vec3(0.353768568406928, 0.0, 243.785483416097240)),
	mat3(vec3(-53.536668214025610, 0.0, 0.0), vec3(0.0, -68.933243211639621, 17.821880498324404), vec3(0.0, 0.0, -278.470203722289060)),
	mat3(vec3(-42.646930307293360, 0.0, 0.0), vec3(0.0, -51.026918452773138, 0.0), vec3(0.0, 0.0, -113.420624636770270)),
	mat3(vec3(-35.705990828985080, 0.0, 0.0), vec3(0.0, -40.934269625438475, 0.0), vec3(0.0, 0.0, -67.307342271105213)),
	mat3(vec3(-30.901151041566411, 0.0, 0.0), vec3(0.0, -34.440424768095276, 0.0), vec3(0.0, 0.0, -49.156471643386766)),
	mat3(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, -39.178407337105710)),
	mat3(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, -32.812895526130347))
);

vec3 sp_spectral_filter(vec3 col, float filmwidth, float cosi) {
    const float NN = 2001.0;
    float a = 1.0/(nu*nu);
    float cost = sqrt(a*cosi*cosi + (1.0-a));
    float n = 2.0*PI*filmwidth*cost/NN;
    float kn = 0.0;
    mat3 filt = sparsespfiltconst;
    
    for(int i = 0; i < 13; i++) {
        kn = (float(i)+6.0)*n;
        filt += sparsespfilta[i]*cos(kn) + sparsespfiltb[i]*sin(kn);
    }
    return 4.0*(filt*col)/NN;
}

varying vec3 v_world_normal;

void vertex() {
    // Subtle breathing animation
    float breath = 1.0;
    if (is_central) {
        breath = 1.0 + sin(TIME * time_scale * 3.0) * 0.012;
    }
    
    // Keep a barely perceptible motion so the bubble still feels alive
    float wobble = sin(VERTEX.x * 3.0 + TIME * 0.35) * sin(VERTEX.y * 3.0 + TIME * 0.2) * surface_wobble;
    VERTEX *= breath + wobble;
    
    v_world_normal = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
}

void fragment() {
    vec3 view_dir = normalize(VIEW);
    vec3 normal = normalize(NORMAL);
    
    // Fresnel: 0 = facing camera, 1 = edge (grazing angle)
    float fresnel = pow(1.0 - abs(dot(normal, view_dir)), fresnel_power);
    
    // Use a smooth view-angle-driven thickness instead of noisy marbling.
    float filmwidth = mix(420.0, 560.0, clamp(fresnel, 0.0, 1.0));
    if (!is_central) {
        filmwidth = mix(380.0, 500.0, clamp(fresnel, 0.0, 1.0));
    }
    
    // Incident angle cosine for thin-film interference
    float cosi = abs(dot(normal, view_dir));
    
    // Generate interference spectrum
    vec3 iridescent = sp_spectral_filter(vec3(1.0), filmwidth, cosi) * iridescence_strength;
    
    // Clamp to avoid blown out colors and keep the rim subtle.
    iridescent = clamp(iridescent * 0.95, vec3(0.0), vec3(1.0));
    float lum = dot(iridescent, vec3(0.299, 0.587, 0.114));
    iridescent = mix(vec3(lum), iridescent, rainbow_saturation);
    
    if (is_completed) {
        // Gold completed state
        ALBEDO = completed_color.rgb;
        ALPHA = completed_color.a;
        EMISSION = completed_color.rgb * 0.4 + iridescent * 0.5;
        METALLIC = 0.85;
        ROUGHNESS = 0.2;
        SPECULAR = 0.9;
    } else {
        // Select tint based on central/peripheral
        vec3 tint = is_central ? central_tint.rgb : peripheral_tint.rgb;
        
        // Smooth bubble color without visible noise texture.
        vec3 base_color = mix(vec3(0.9, 0.94, 0.98), tint, is_central ? 0.24 : 0.18);
        vec3 rim_color = mix(base_color, base_color + iridescent * 0.32, clamp(fresnel * 0.85, 0.0, 1.0));
        vec3 bubble_color = rim_color;
        
        // Transparency: very transparent in center, slightly opaque at rim
        float alpha = mix(max(center_opacity, base_tint.a), rim_opacity, fresnel);
        
        // Peripheral bubbles slightly more transparent
        if (!is_central) {
            alpha *= 0.92;
        }
        
        ALBEDO = bubble_color;
        ALPHA = clamp(alpha, is_central ? 0.28 : 0.22, 0.98);
        
        // Soft emissive glow at rim with iridescent color
        EMISSION = iridescent * (0.06 + fresnel * 0.18) + tint * 0.03;
        
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
    DIFFUSE_LIGHT += ALBEDO * LIGHT_COLOR * ndotl * 0.12 * ATTENUATION;
}
