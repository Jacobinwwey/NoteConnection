# Path Mode: Orbital Learning Design (Finalized)

> All design questions answered. Document locked for implementation.

---

## Visual Reference

![Reference Bubble Style](C:/Users/jacob/.gemini/antigravity/brain/d1cf6b8d-481a-4278-9a30-de1cfdc75527/uploaded_media_1769652710516.png)

**Key Visual Properties to Replicate:**

- Soap bubble translucency with internal light scattering
- Rainbow iridescent edge (thin-film interference)
- Dual highlight spots (simulating light sources)
- Soft shadow/ambient environment
- Depth perception through refraction

---

## Confirmed Requirements

| Aspect                      | Final Decision                           |
| --------------------------- | ---------------------------------------- |
| **Display Limit**           | 1 Central + 1-4 Peripheral (max 5 total) |
| **Zero In-Degree Fallback** | Select by highest relevance score        |
| **Completed Nodes UI**      | Collapsible sidebar: `★ × {count}`       |
| **Bubble Style**            | Iridescent soap bubble (reference image) |
| **Layer Separation**        | Peripheral cannot overlap central text   |

---

## Confirmed Design Decisions

### 1. Peripheral Node Selection ✅

**Domain Learning:**

- In-degree nodes (prerequisites) first
- Fill remaining slots with highest-association nodes

**Diffusion Learning:**

- High-association nodes to current central
- Must NOT be out-degree of ultimate target

---

### 2. Central Bubble Content ✅

**Display:** Node title + Progress indicator

```
┌─────────────────────────────────────────────┐
│                                             │
│           [Iridescent Bubble]               │
│                                             │
│              "Chain Rule"                   │
│         3 of 12 prerequisites               │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 3. Peripheral Bubble Labels ✅

**Display:** Title only, max 15 chars + ellipsis

| Original                          | Displayed            |
| --------------------------------- | -------------------- |
| "Derivatives"                     | "Derivatives"        |
| "Fundamental Theorem of Calculus" | "Fundamental The..." |
| "Introduction to Limits"          | "Introduction to..." |

---

### 4. Transition Animation ✅

**Style:** Orbital Rotation (~500ms)

```
Animation Sequence:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Clicked peripheral begins arc toward center
2. Current central shrinks, moves to vacated slot
3. Other peripherals redistribute on orbital ring
4. New central inflates to full size
5. Progress indicator updates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Component Specifications

### Central Bubble

| Property  | Value                                     |
| --------- | ----------------------------------------- |
| Radius    | 80-100px (screen space)                   |
| Opacity   | 90%                                       |
| Effect    | Fresnel rim + rainbow iridescent          |
| Highlight | Dual light spots                          |
| Content   | Title (max 24 chars) + Progress indicator |
| Z-Index   | Foreground layer                          |

### Peripheral Bubble

| Property   | Value                                      |
| ---------- | ------------------------------------------ |
| Radius     | 30-40px (screen space)                     |
| Opacity    | 60%                                        |
| Effect     | Iridescent (less intense than central)     |
| Position   | Orbital ring around central                |
| Label      | Title only (max 15 chars + ellipsis)       |
| Z-Index    | Background layer                           |
| Constraint | Cannot intersect central text bounding box |

### Gold Star Sidebar

```
Expanded:
┌─────────────────────────────────────────────┐
│  [▼] Completed Nodes  ★ × 7                 │
│  ├── Introduction to Calculus               │
│  ├── Limits and Continuity                  │
│  ├── Derivatives Basics                     │
│  └── ... (scrollable list)                  │
└─────────────────────────────────────────────┘

Collapsed:
┌─────────────────────────────────────────────┐
│  [▶] Completed Nodes  ★ × 7                 │
└─────────────────────────────────────────────┘
```

---

## Godot Shader Implementation

```gdscript
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform vec4 base_color : source_color = vec4(0.8, 0.8, 1.0, 0.15);
uniform float fresnel_power : hint_range(1.0, 8.0) = 4.0;
uniform float iridescence_amount : hint_range(0.0, 1.0) = 0.6;
uniform float rim_intensity : hint_range(0.0, 2.0) = 1.2;

vec3 iridescent_color(float angle) {
    return vec3(
        sin(angle * 2.0) * 0.5 + 0.5,
        sin(angle * 2.0 + 2.094) * 0.5 + 0.5,
        sin(angle * 2.0 + 4.189) * 0.5 + 0.5
    );
}

void fragment() {
    float fresnel = pow(1.0 - dot(NORMAL, VIEW), fresnel_power);
    vec3 rainbow = iridescent_color(fresnel * 6.28) * iridescence_amount;

    ALBEDO = base_color.rgb + rainbow * fresnel;
    ALPHA = base_color.a + fresnel * rim_intensity;
    EMISSION = rainbow * fresnel * 0.3;
    ROUGHNESS = 0.1;
    METALLIC = 0.0;
}
```

---

## Decision Log

| Decision             | Choice                        | Alternatives Rejected                 | Rationale                              |
| -------------------- | ----------------------------- | ------------------------------------- | -------------------------------------- |
| Peripheral selection | In-degree first + association | Strict in-degree only, Mixed priority | Balances learning order with discovery |
| Central content      | Title + Progress              | Title only, Title + excerpt           | Progress tracking is core UX           |
| Peripheral labels    | 15 char truncation            | No labels, External labels            | Clean yet informative                  |
| Transition           | Orbital rotation              | Instant, Fade, Pop/Inflate            | Best fits "Orbital Learning" metaphor  |
| Node count           | 1 + 1-4                       | Fixed count                           | Adapts to node connectivity            |

---

## Ready for Implementation

All design decisions confirmed. Next step: Update `implementation_plan.md` with final specifications and begin EXECUTION phase.
