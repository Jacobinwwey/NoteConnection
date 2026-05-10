/**
 * path_modules_bridge.js — Non-module bridge for extracted path modules.
 *
 * This script exposes utility functions from path_mermaid_utils.mjs and
 * path_state.mjs on window.pathModules, so path_app.js can access them
 * without ES module imports (which require <script type="module">).
 *
 * Load order:
 *   1. <script src="path_modules_bridge.js"></script>  (this file)
 *   2. <script src="path_app.js"></script>
 *
 * path_app.js can then use:
 *   window.pathModules.utils.estimateBridgeTextLineWidth(text, fontSize)
 *   window.pathModules.state.createPathLearningState()
 *
 * When path_app.js migrates to ES modules, it can import directly from
 * path_mermaid_utils.mjs and path_state.mjs instead.
 *
 * Phase 4 P1 — eliminates duplication; canonical source remains the .mjs files.
 */

(function () {
    'use strict';

    // ── SVG/Mermaid Utilities (from path_mermaid_utils.mjs) ──

    function normalizeBridgeInlineText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function isBridgeWideGlyph(char) {
        return /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︐-︙︰-﹯！-｠￠-￦\u{1F300}-\u{1FAFF}]/u.test(char);
    }

    function estimateBridgeGlyphWidthUnits(char) {
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

    function estimateBridgeTextLineWidth(text, fontSize) {
        var units = 0;
        var chars = Array.from(String(text || ''));
        for (var i = 0; i < chars.length; i++) {
            units += estimateBridgeGlyphWidthUnits(chars[i]);
        }
        return Math.max(fontSize * 0.75, (units * fontSize) + Math.max(2, fontSize * 0.12));
    }

    function splitBridgeTokenForWrap(token, fontSize, maxLineWidth) {
        var wrapped = [];
        var segment = '';
        var chars = Array.from(token);
        for (var i = 0; i < chars.length; i++) {
            var candidate = segment + chars[i];
            if (!segment || estimateBridgeTextLineWidth(candidate, fontSize) <= maxLineWidth) {
                segment = candidate;
            } else {
                wrapped.push(segment);
                segment = chars[i];
            }
        }
        if (segment) wrapped.push(segment);
        return wrapped;
    }

    function parseBridgeCssLength(lengthValue, baseFontSize) {
        if (!lengthValue) return 0;
        var normalized = String(lengthValue).trim().toLowerCase();
        if (!normalized || normalized === 'normal') return 0;
        var numeric = parseFloat(normalized);
        if (!isFinite(numeric) || numeric <= 0) return 0;
        if (normalized.indexOf('em') !== -1 || normalized.indexOf('rem') !== -1) {
            return numeric * Math.max(10, baseFontSize || 16);
        }
        if (normalized.indexOf('%') !== -1) {
            return (numeric / 100) * Math.max(10, baseFontSize || 16);
        }
        return numeric;
    }

    function parseBridgeNumericAttribute(element, name, fallback) {
        var numeric = parseFloat(String((element && element.getAttribute) ? element.getAttribute(name) : ''));
        return isFinite(numeric) ? numeric : (fallback || 0);
    }

    function extractBridgeInlineStyleValue(styleValue, propertyName) {
        if (!styleValue) return null;
        var pattern = new RegExp('(?:^|;)\\s*' + propertyName + '\\s*:\\s*([^;]+)', 'i');
        var match = String(styleValue).match(pattern);
        return match && match[1] ? String(match[1]).trim() : null;
    }

    function wrapBridgeMeasurementLine(line, fontSize, maxLineWidth) {
        var normalized = normalizeBridgeInlineText(line);
        if (!normalized) return [];
        if (estimateBridgeTextLineWidth(normalized, fontSize) <= maxLineWidth) {
            return [normalized];
        }
        var tokens = normalized.split(/\s+/);
        var wrapped = [];
        for (var i = 0; i < tokens.length; i++) {
            var tokenWrapped = splitBridgeTokenForWrap(tokens[i], fontSize, maxLineWidth);
            wrapped = wrapped.concat(tokenWrapped);
        }
        return wrapped;
    }

    function resolveBridgeTextProperty(element, propertyName) {
        var current = element;
        while (current) {
            var attr = current.getAttribute && current.getAttribute(propertyName);
            if (attr && String(attr).trim()) return String(attr).trim();
            var styleVal = extractBridgeInlineStyleValue(
                current.getAttribute && current.getAttribute('style'), propertyName
            );
            if (styleVal) return styleVal;
            current = current.parentElement || null;
        }
        return null;
    }

    function resolveBridgeSvgFontSize(element) {
        var current = element;
        while (current) {
            var attr = current.getAttribute && current.getAttribute('font-size');
            if (attr && String(attr).trim()) return String(attr).trim();
            current = current.parentElement || null;
        }
        var parsed = parseBridgeCssLength('16', 16);
        return parsed > 0 ? parsed : 16;
    }

    function resolveBridgeSvgLineHeight(element, fontSize) {
        var current = element;
        while (current) {
            var attr = current.getAttribute && current.getAttribute('line-height');
            if (attr && String(attr).trim()) return String(attr).trim();
            current = current.parentElement || null;
        }
        var parsed = parseBridgeCssLength('normal', fontSize);
        return parsed > 0 ? parsed : Math.max(fontSize * 1.18, fontSize + 4);
    }

    // ── State Factories (from path_state.mjs) ──

    function createPathGraphState() {
        return {
            canvas: null, ctx: null, worker: null,
            transform: { k: 1, x: 0, y: 0 },
            nodes: [], links: [], width: 0, height: 0,
        };
    }

    function createPathLearningState() {
        return {
            centralNodeId: null, learningHistory: [],
            completedNodes: new Set(), collapsedNodes: new Set(),
            forcedExpansionNodes: new Set(), expansionOrder: [],
            stickyClaimEnabled: true, currentTargetId: null,
            currentTargetIds: [], lastTreeLayout: null, uiInitialized: false,
        };
    }

    function createPathRuntimeConfig(overrides) {
        var base = { mode: 'domain', strategy: 'foundational', layout: 'orbital',
            targetId: null, targetIds: [], autoReconstruct: true, retainHistory: true };
        if (overrides) { for (var k in overrides) { base[k] = overrides[k]; } }
        return base;
    }

    function createLearningWorkbenchState(userId) {
        return {
            userId: userId || 'path_user_default', loading: false,
            lastError: '', lastUpdatedAt: '', sessionPlan: null,
            qualitySnapshot: null, misconceptions: null, runtimeState: null,
            tutorFeedback: null, sessionExecution: null, sessionHistory: null,
        };
    }

    // ── Expose on window ──

    window.pathModules = {
        utils: {
            normalizeBridgeInlineText: normalizeBridgeInlineText,
            parseBridgeNumericAttribute: parseBridgeNumericAttribute,
            extractBridgeInlineStyleValue: extractBridgeInlineStyleValue,
            parseBridgeCssLength: parseBridgeCssLength,
            resolveBridgeTextProperty: resolveBridgeTextProperty,
            resolveBridgeSvgFontSize: resolveBridgeSvgFontSize,
            resolveBridgeSvgLineHeight: resolveBridgeSvgLineHeight,
            estimateBridgeTextLineWidth: estimateBridgeTextLineWidth,
            estimateBridgeGlyphWidthUnits: estimateBridgeGlyphWidthUnits,
            splitBridgeTokenForWrap: splitBridgeTokenForWrap,
            wrapBridgeMeasurementLine: wrapBridgeMeasurementLine,
            isBridgeWideGlyph: isBridgeWideGlyph,
        },
        state: {
            createPathGraphState: createPathGraphState,
            createPathLearningState: createPathLearningState,
            createPathRuntimeConfig: createPathRuntimeConfig,
            createLearningWorkbenchState: createLearningWorkbenchState,
        }
    };
})();
