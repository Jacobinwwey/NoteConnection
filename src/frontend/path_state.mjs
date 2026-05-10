/**
 * path_state.mjs — Path Mode state object factories
 * Extracted from path_app.js (v2.7, Phase 4 P2)
 *
 * These factory functions create the default state objects used by
 * the Path Mode controller. They are pure data constructors with
 * no DOM, event, or rendering dependencies.
 *
 * Usage (after migration to ES modules):
 *   import { createPathGraphState, createPathLearningState, ... } from './path_state.mjs';
 *
 * Current (pre-migration):
 *   These factories mirror the inline state definitions in path_app.js
 *   lines 7-58. Replace inline definitions with factory calls when
 *   path_app.js migrates to ES module loading.
 */

/** Core graph rendering state: canvas, worker, transform, nodes, links. */
export function createPathGraphState() {
    return {
        canvas: null,
        ctx: null,
        worker: null,
        transform: { k: 1, x: 0, y: 0 },
        nodes: [],
        links: [],
        width: 0,
        height: 0,
    };
}

/** Learning path state: focus node, completion tracking, expansion control. */
export function createPathLearningState() {
    return {
        centralNodeId: null,
        learningHistory: [],
        completedNodes: new Set(),
        collapsedNodes: new Set(),
        forcedExpansionNodes: new Set(),
        expansionOrder: [],
        stickyClaimEnabled: true,
        currentTargetId: null,
        currentTargetIds: [],
        lastTreeLayout: null,
        uiInitialized: false,
    };
}

/** Runtime configuration for Path Mode layout and behavior. */
export function createPathRuntimeConfig(overrides = {}) {
    return {
        mode: 'domain',
        strategy: 'foundational',
        layout: 'orbital',
        targetId: null,
        targetIds: [],
        autoReconstruct: true,
        retainHistory: true,
        ...overrides,
    };
}

/** Learning workbench state: session plan, quality, misconceptions, tutor feedback. */
export function createLearningWorkbenchState(userId = 'path_user_default') {
    return {
        userId,
        loading: false,
        lastError: '',
        lastUpdatedAt: '',
        sessionPlan: null,
        qualitySnapshot: null,
        misconceptions: null,
        runtimeState: null,
        tutorFeedback: null,
        sessionExecution: null,
        sessionHistory: null,
    };
}

/** Animation state for orbital graph rendering. */
export function createAnimationState() {
    return {
        animationId: null,
        orbitalAngle: 0,
    };
}

/** Bridge communication state. */
export function createBridgeState() {
    return {
        bridgeLanguageListenerRegistered: false,
        bridgeMermaidRenderQueue: Promise.resolve(),
        pendingWindowVisibility: null,
        semanticA11yLastSummaryKey: '',
        semanticA11yLastAnnouncementAt: 0,
    };
}

/** Complete Path Mode application state (all substates combined). */
export function createFullPathAppState(overrides = {}) {
    const base = {
        ...createPathGraphState(),
        ...createPathLearningState(),
        ...createPathBridgeState(),
    };
    // Re-assign non-serializable objects that spread would lose
    base.completedNodes = new Set();
    base.collapsedNodes = new Set();
    base.forcedExpansionNodes = new Set();
    base.bridgeMermaidRenderQueue = Promise.resolve();

    base.runtimeConfig = createPathRuntimeConfig();
    base.learningWorkbench = createLearningWorkbenchState();
    base.animationId = null;
    base.orbitalAngle = 0;

    return { ...base, ...overrides };
}
