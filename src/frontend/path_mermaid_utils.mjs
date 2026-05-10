/**
 * path_mermaid_utils.mjs — Pure SVG/Mermaid utility functions
 * extracted from path_app.js (v2.6).
 *
 * These are stateless pure functions with no DOM or event coupling.
 * They can be independently tested and used by any module that
 * needs SVG text measurement, CSS parsing, or glyph width estimation.
 */

export function normalizeBridgeInlineText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

export function parseBridgeNumericAttribute(element, name, fallback = 0) {
    const numeric = Number.parseFloat(String(element?.getAttribute?.(name) || ''));
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function extractBridgeInlineStyleValue(styleValue, propertyName) {
    if (!styleValue) return null;
    const pattern = new RegExp('(?:^|;)\\s*' + propertyName + '\\s*:\\s*([^;]+)', 'i');
    const match = String(styleValue).match(pattern);
    return match && match[1] ? String(match[1]).trim() : null;
}

export function resolveBridgeTextProperty(element, propertyName) {
    let current = element;
    while (current) {
        const attributeValue = current.getAttribute?.(propertyName);
        if (attributeValue && String(attributeValue).trim()) {
            return String(attributeValue).trim();
        }
        const styleValue = extractBridgeInlineStyleValue(
            current.getAttribute?.('style'), propertyName
        );
        if (styleValue) return styleValue;
        current = current.parentElement || null;
    }
    return null;
}

export function parseBridgeCssLength(lengthValue, baseFontSize) {
    if (!lengthValue) return 0;
    const normalized = String(lengthValue).trim().toLowerCase();
    if (!normalized || normalized === 'normal') return 0;
    const numeric = Number.parseFloat(normalized);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    if (normalized.endsWith('em') || normalized.endsWith('rem')) {
        return numeric * Math.max(10, baseFontSize || 16);
    }
    if (normalized.endsWith('%')) {
        return (numeric / 100) * Math.max(10, baseFontSize || 16);
    }
    return numeric;
}

export function resolveBridgeSvgFontSize(element) {
    const resolvedValue = resolveBridgeTextProperty(element, 'font-size');
    const parsed = parseBridgeCssLength(resolvedValue, 16);
    return parsed > 0 ? parsed : 16;
}

export function resolveBridgeSvgLineHeight(element, fontSize) {
    const resolvedValue = resolveBridgeTextProperty(element, 'line-height');
    const parsed = parseBridgeCssLength(resolvedValue, fontSize);
    return parsed > 0 ? parsed : Math.max(fontSize * 1.18, fontSize + 4);
}

export function isBridgeWideGlyph(char) {
    return /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︐-︙︰-﹯！-｠￠-￦\u{1F300}-\u{1FAFF}]/u.test(char);
}

export function estimateBridgeGlyphWidthUnits(char) {
    if (!char) return 0;
    if (/\s/.test(char)) return 0.35;
    if (isBridgeWideGlyph(char)) return 1.02;
    if (/[.,;:!'`|]/.test(char)) return 0.32;
    if (/[(){}\[\]<>]/.test(char)) return 0.46;
    if (/[\\/_-]/.test(char)) return 0.5;
    if (/[0-9]/.test(char)) return 0.62;
    if (/[A-Z]/.test(char)) return 0.72;
    if (/[a-z]/.test(char)) return 0.64;
    return 0.7;
}

export function estimateBridgeTextLineWidth(text, fontSize) {
    let units = 0;
    for (const char of Array.from(String(text || ''))) {
        units += estimateBridgeGlyphWidthUnits(char);
    }
    return Math.max(fontSize * 0.75, (units * fontSize) + Math.max(2, fontSize * 0.12));
}

export function splitBridgeTokenForWrap(token, fontSize, maxLineWidth) {
    const wrapped = [];
    let segment = '';
    for (const char of Array.from(token)) {
        const candidate = segment + char;
        if (!segment || estimateBridgeTextLineWidth(candidate, fontSize) <= maxLineWidth) {
            segment = candidate;
            continue;
        }
        wrapped.push(segment);
        segment = char;
    }
    if (segment) wrapped.push(segment);
    return wrapped;
}
