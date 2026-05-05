import * as fs from 'fs';
import * as path from 'path';

function extractUnionLiterals(source: string, typeName: string): string[] {
    const pattern = new RegExp(`export type\\s+${typeName}\\s*=([\\s\\S]*?);`);
    const match = source.match(pattern);
    if (!match) {
        throw new Error(`Unable to locate type definition for ${typeName}`);
    }
    return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}

function extractObjectLiteralKeys(source: string, constName: string): string[] {
    const objectLiteral = extractObjectLiteralSource(source, constName);
    const keys: string[] = [];
    let objectDepth = 0;
    let lineStart = true;

    for (let index = 0; index < objectLiteral.length; index += 1) {
        const character = objectLiteral[index];

        if (character === '{') {
            objectDepth += 1;
            lineStart = false;
            continue;
        }
        if (character === '}') {
            objectDepth -= 1;
            lineStart = false;
            continue;
        }
        if (character === '\n') {
            lineStart = true;
            continue;
        }
        if (objectDepth === 1 && lineStart) {
            if (/\s/.test(character)) {
                continue;
            }
            if (/[a-zA-Z0-9_]/.test(character)) {
                let cursor = index;
                while (cursor < objectLiteral.length && /[a-zA-Z0-9_]/.test(objectLiteral[cursor])) {
                    cursor += 1;
                }
                const key = objectLiteral.slice(index, cursor);
                let separator = cursor;
                while (separator < objectLiteral.length && /\s/.test(objectLiteral[separator])) {
                    separator += 1;
                }
                if (objectLiteral[separator] === ':') {
                    keys.push(key);
                }
            }
            lineStart = false;
            continue;
        }
        if (!/\s/.test(character)) {
            lineStart = false;
        }
    }

    return Array.from(new Set(keys));
}

function extractObjectLiteralSource(source: string, constName: string): string {
    const constStart = source.indexOf(`const ${constName} = {`);
    if (constStart < 0) {
        throw new Error(`Unable to locate constant ${constName}`);
    }

    const openBraceIndex = source.indexOf('{', constStart);
    let depth = 0;
    let endIndex = -1;
    for (let index = openBraceIndex; index < source.length; index += 1) {
        const character = source[index];
        if (character === '{') {
            depth += 1;
        } else if (character === '}') {
            depth -= 1;
            if (depth === 0) {
                endIndex = index;
                break;
            }
        }
    }
    if (endIndex < 0) {
        throw new Error(`Unable to parse object literal for ${constName}`);
    }

    return source.slice(openBraceIndex, endIndex + 1);
}

function extractArrayLiteralAfterMarker(source: string, marker: string): string {
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) {
        throw new Error(`Unable to locate marker: ${marker}`);
    }

    const openBracketIndex = source.indexOf('[', markerIndex + marker.length);
    if (openBracketIndex < 0) {
        throw new Error(`Unable to locate opening array bracket for marker: ${marker}`);
    }

    let depth = 0;
    let endIndex = -1;
    for (let index = openBracketIndex; index < source.length; index += 1) {
        const character = source[index];
        if (character === '[') {
            depth += 1;
            continue;
        }
        if (character === ']') {
            depth -= 1;
            if (depth === 0) {
                endIndex = index;
                break;
            }
        }
    }

    if (endIndex < 0) {
        throw new Error(`Unable to resolve closing array bracket for marker: ${marker}`);
    }

    return source.slice(openBracketIndex, endIndex + 1);
}

function extractObjectFieldStringLiterals(source: string, fieldName: string): string[] {
    const pattern = new RegExp(`${fieldName}\\s*:\\s*'([^']+)'`, 'g');
    return Array.from(source.matchAll(pattern)).map((match) => match[1]);
}

function extractOperationDefaultResultPresentationsFromFrontend(source: string): Record<string, string> {
    const registryLiteral = extractObjectLiteralSource(source, 'KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY');
    const entries = Array.from(
        registryLiteral.matchAll(
            /([a-zA-Z0-9_]+)\s*:\s*{[\s\S]*?defaultResultPresentation\s*:\s*'([^']+)'/g
        )
    );
    const mapping: Record<string, string> = {};
    entries.forEach((entry) => {
        const operationId = String(entry[1] || '').trim();
        const resultPresentation = String(entry[2] || '').trim();
        if (!operationId || !resultPresentation) {
            return;
        }
        mapping[operationId] = resultPresentation;
    });
    return mapping;
}

function extractOperationResultPresentationOverridesFromFrontend(source: string): Record<string, string[]> {
    const overridesLiteral = extractObjectLiteralSource(source, 'KNOWLEDGE_OPERATION_RESULT_PRESENTATION_OVERRIDES');
    const entries = Array.from(
        overridesLiteral.matchAll(
            /([a-zA-Z0-9_]+)\s*:\s*\[([^\]]*)\]/g
        )
    );
    const mapping: Record<string, string[]> = {};
    entries.forEach((entry) => {
        const operationId = String(entry[1] || '').trim();
        if (!operationId) {
            return;
        }
        const rawArrayLiteral = String(entry[2] || '');
        const values = Array.from(rawArrayLiteral.matchAll(/'([^']+)'/g))
            .map((valueMatch) => String(valueMatch[1] || '').trim())
            .filter(Boolean);
        mapping[operationId] = Array.from(new Set(values));
    });
    return mapping;
}

function extractOperationAllowedResultPresentationsFromFrontend(source: string): Record<string, string[]> {
    const defaultMapping = extractOperationDefaultResultPresentationsFromFrontend(source);
    const overrideMapping = extractOperationResultPresentationOverridesFromFrontend(source);
    const allOperationIds = new Set<string>([
        ...Object.keys(defaultMapping),
        ...Object.keys(overrideMapping),
    ]);
    const allowedMapping: Record<string, string[]> = {};
    allOperationIds.forEach((operationId) => {
        const values = [
            String(defaultMapping[operationId] || '').trim(),
            ...(overrideMapping[operationId] || []),
        ].filter(Boolean);
        allowedMapping[operationId] = Array.from(new Set(values));
    });
    return allowedMapping;
}

function extractBackendKnowledgeOperationPairs(conversationCapabilityLiteral: string): Array<{
    operationId: string;
    resultPresentation: string;
}> {
    const entries = Array.from(
        String(conversationCapabilityLiteral || '').matchAll(
            /execution\s*:\s*{[\s\S]*?kind\s*:\s*'knowledge_operation'[\s\S]*?operationId\s*:\s*'([^']+)'[\s\S]*?resultPresentation\s*:\s*'([^']+)'/g
        )
    );
    return entries.map((entry) => ({
        operationId: String(entry[1] || '').trim(),
        resultPresentation: String(entry[2] || '').trim(),
    })).filter((entry) => entry.operationId.length > 0 && entry.resultPresentation.length > 0);
}

function extractTopLevelObjectLiteralsFromArrayLiteral(arrayLiteralSource: string): string[] {
    const source = String(arrayLiteralSource || '');
    const objectLiterals: string[] = [];
    let inString: '\'' | '"' | '`' | null = null;
    let isEscaped = false;
    let objectDepth = 0;
    let objectStartIndex = -1;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }
            if (character === '\\') {
                isEscaped = true;
                continue;
            }
            if (character === inString) {
                inString = null;
            }
            continue;
        }

        if (character === '\'' || character === '"' || character === '`') {
            inString = character;
            continue;
        }

        if (character === '{') {
            if (objectDepth === 0) {
                objectStartIndex = index;
            }
            objectDepth += 1;
            continue;
        }

        if (character === '}') {
            if (objectDepth <= 0) {
                continue;
            }
            objectDepth -= 1;
            if (objectDepth === 0 && objectStartIndex >= 0) {
                objectLiterals.push(source.slice(objectStartIndex, index + 1));
                objectStartIndex = -1;
            }
        }
    }

    return objectLiterals;
}

describe('agent workspace capability registry parity', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const typesSource = fs.readFileSync(path.join(repoRoot, 'src', 'learning', 'types.ts'), 'utf8');
    const frontendSource = fs.readFileSync(path.join(repoRoot, 'src', 'frontend', 'agent_workspace.js'), 'utf8');
    const knowledgePlatformSource = fs.readFileSync(
        path.join(repoRoot, 'src', 'learning', 'KnowledgeLearningPlatform.ts'),
        'utf8'
    );
    const conversationCapabilityLiteral = extractArrayLiteralAfterMarker(
        knowledgePlatformSource,
        "const capabilities: AgentConversationResponse['knowledgePoints'][number]['capabilities'] ="
    );

    test('frontend operation transport registry covers AgentConversationCapabilityOperationId union', () => {
        const operationIds = extractUnionLiterals(typesSource, 'AgentConversationCapabilityOperationId');
        const frontendOperationIds = extractObjectLiteralKeys(frontendSource, 'KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY');
        expect(new Set(frontendOperationIds)).toEqual(new Set(operationIds));
    });

    test('frontend operation request builder registry covers AgentConversationCapabilityOperationId union', () => {
        const operationIds = extractUnionLiterals(typesSource, 'AgentConversationCapabilityOperationId');
        const frontendOperationIds = extractObjectLiteralKeys(frontendSource, 'KNOWLEDGE_OPERATION_REQUEST_BUILDERS');
        expect(new Set(frontendOperationIds)).toEqual(new Set(operationIds));
    });

    test('frontend operation transport and request builder registries stay aligned', () => {
        const transportOperationIds = extractObjectLiteralKeys(frontendSource, 'KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY');
        const requestBuilderOperationIds = extractObjectLiteralKeys(frontendSource, 'KNOWLEDGE_OPERATION_REQUEST_BUILDERS');
        expect(new Set(transportOperationIds)).toEqual(new Set(requestBuilderOperationIds));
    });

    test('frontend operation result-presentation override keys stay within operation union', () => {
        const operationIds = new Set(
            extractUnionLiterals(typesSource, 'AgentConversationCapabilityOperationId')
        );
        const overrideMapping = extractOperationResultPresentationOverridesFromFrontend(frontendSource);
        Object.keys(overrideMapping).forEach((operationId) => {
            expect(operationIds.has(operationId)).toBe(true);
            expect(overrideMapping[operationId].length).toBeGreaterThan(0);
        });
    });

    test('frontend operation result-presentation overrides stay within result-presentation union', () => {
        const resultPresentationIds = new Set(
            extractUnionLiterals(typesSource, 'AgentConversationCapabilityResultPresentation')
        );
        const overrideMapping = extractOperationResultPresentationOverridesFromFrontend(frontendSource);
        Object.entries(overrideMapping).forEach(([operationId, presentations]) => {
            expect(operationId).toBeTruthy();
            expect(presentations.length).toBeGreaterThan(0);
            presentations.forEach((presentation) => {
                expect(resultPresentationIds.has(presentation)).toBe(true);
            });
        });
    });

    test('frontend operation allowlists include transport defaults and stay non-empty', () => {
        const defaultMapping = extractOperationDefaultResultPresentationsFromFrontend(frontendSource);
        const allowlistMapping = extractOperationAllowedResultPresentationsFromFrontend(frontendSource);
        const overrideMapping = extractOperationResultPresentationOverridesFromFrontend(frontendSource);

        Object.entries(defaultMapping).forEach(([operationId, defaultPresentation]) => {
            expect(defaultPresentation).toBeTruthy();
            const allowlist = allowlistMapping[operationId] || [];
            expect(allowlist.length).toBeGreaterThan(0);
            expect(allowlist).toContain(defaultPresentation);
            expect(new Set(allowlist).size).toBe(allowlist.length);
        });

        Object.keys(overrideMapping).forEach((operationId) => {
            expect(defaultMapping[operationId]).toBeDefined();
        });
    });

    test('frontend operation result-presentation overrides only declare non-default presentations', () => {
        const defaultMapping = extractOperationDefaultResultPresentationsFromFrontend(frontendSource);
        const overrideMapping = extractOperationResultPresentationOverridesFromFrontend(frontendSource);
        Object.entries(overrideMapping).forEach(([operationId, overridePresentations]) => {
            const defaultPresentation = String(defaultMapping[operationId] || '').trim();
            expect(defaultPresentation).toBeTruthy();
            overridePresentations.forEach((presentation) => {
                expect(presentation).not.toBe(defaultPresentation);
            });
        });
    });

    test('frontend registry diagnostics expose operation presentation maps', () => {
        expect(frontendSource).toMatch(
            /operationResultPresentationOverrideMap\s*:\s*resolveOperationResultPresentationOverrideMap\(\)/
        );
        expect(frontendSource).toMatch(
            /operationInvalidResultPresentationOverrideMap\s*:\s*(resolveOperationInvalidResultPresentationOverrideMap\(\)|invalidOverrideMap)/
        );
        expect(frontendSource).toMatch(
            /operationUnknownResultPresentationOverrideMap\s*:\s*(resolveOperationUnknownResultPresentationOverrideMap\(\)|unknownOverrideMap)/
        );
        expect(frontendSource).toMatch(
            /operationDefaultResultPresentations\s*:\s*resolveOperationDefaultResultPresentationMap\(\)/
        );
        expect(frontendSource).toMatch(
            /operationAllowedResultPresentations\s*:\s*resolveOperationAllowedResultPresentationMap\(\)/
        );
        expect(frontendSource).toMatch(
            /operationResultPresentationOverrideDriftDetected\s*:\s*\(/
        );
        expect(frontendSource).toMatch(
            /operationResultPresentationInvalidOverrideTokenCount\s*:\s*invalidOverrideTokenCount/
        );
        expect(frontendSource).toMatch(
            /operationResultPresentationUnknownOverrideTokenCount\s*:\s*unknownOverrideTokenCount/
        );
    });

    test('frontend result presentation registries cover AgentConversationCapabilityResultPresentation union', () => {
        const presentationIds = extractUnionLiterals(typesSource, 'AgentConversationCapabilityResultPresentation');
        const customPresentationIds = extractObjectLiteralKeys(frontendSource, 'CUSTOM_RESULT_PRESENTERS');
        const cardPresentationIds = extractObjectLiteralKeys(frontendSource, 'CARD_RESULT_PRESENTATION_REGISTRY');
        expect(new Set([...customPresentationIds, ...cardPresentationIds])).toEqual(new Set(presentationIds));
    });

    test('frontend card result presentation registry and payload builders stay aligned', () => {
        const cardPresentationIds = extractObjectLiteralKeys(frontendSource, 'CARD_RESULT_PRESENTATION_REGISTRY');
        const payloadBuilderPresentationIds = extractObjectLiteralKeys(frontendSource, 'RESULT_PRESENTATION_PAYLOAD_BUILDERS');
        expect(new Set(cardPresentationIds)).toEqual(new Set(payloadBuilderPresentationIds));
    });

    test('frontend execution kind handlers cover AgentConversationCapabilityExecutionKind union', () => {
        const executionKinds = extractUnionLiterals(typesSource, 'AgentConversationCapabilityExecutionKind');
        const frontendExecutionKinds = extractObjectLiteralKeys(frontendSource, 'CAPABILITY_EXECUTION_KIND_HANDLERS');
        expect(new Set(frontendExecutionKinds)).toEqual(new Set(executionKinds));
    });

    test('backend conversation emitter action set stays governed and union-compatible', () => {
        const backendActionIds = Array.from(new Set(
            extractObjectFieldStringLiterals(conversationCapabilityLiteral, 'actionId')
        ));
        const explicitActionIds = extractUnionLiterals(typesSource, 'AgentConversationActionId');
        const tutorActionIds = extractUnionLiterals(typesSource, 'TutorActionKind');
        const governedActionIds = [
            'open_focus_mode',
            'open_learning_path',
            'generate_quiz',
            'recap',
            'generate_transfer',
            'generate_counterexample',
            'follow_up',
            'compare_query_backends',
            'inspect_conversation_turn_cache_diagnostics',
            'inspect_conversation_turn_cache_alert_trend',
            'inspect_conversation_turn_cache_alert_trend_index',
            'inspect_conversation_turn_cache_alert_trend_export',
            'inspect_query_backend_diagnostics',
            'inspect_query_backend_comparison_history',
            'inspect_query_backend_comparison_trend',
            'inspect_tutor_adapter_telemetry',
            'inspect_tutor_trace_diagnostics',
            'inspect_learning_quality_trend',
            'inspect_learning_quality_history',
            'inspect_session_plan_quality_trend',
            'inspect_session_plan_quality_history',
            'inspect_runtime_capability_runbook_verify',
            'inspect_runtime_capability_runbook_history',
            'inspect_runtime_capability_runbook_checks',
            'inspect_runtime_capability_runbook_action_queue',
            'inspect_session_history',
            'build_study_session',
            'inspect_conversation_memory',
        ];
        const fullActionUnionSet = new Set([...explicitActionIds, ...tutorActionIds]);
        backendActionIds.forEach((actionId) => {
            expect(fullActionUnionSet.has(actionId)).toBe(true);
        });
        expect(new Set(backendActionIds)).toEqual(new Set(governedActionIds));
        expect(backendActionIds).not.toContain('analyze_answer');
    });

    test('backend conversation emitter operation ids stay in parity with frontend transport and request registries', () => {
        const backendOperationIds = Array.from(new Set(
            extractObjectFieldStringLiterals(conversationCapabilityLiteral, 'operationId')
        ));
        const frontendTransportOperationIds = extractObjectLiteralKeys(frontendSource, 'KNOWLEDGE_OPERATION_TRANSPORT_REGISTRY');
        const frontendRequestBuilderOperationIds = extractObjectLiteralKeys(frontendSource, 'KNOWLEDGE_OPERATION_REQUEST_BUILDERS');

        expect(new Set(backendOperationIds)).toEqual(new Set(frontendTransportOperationIds));
        expect(new Set(backendOperationIds)).toEqual(new Set(frontendRequestBuilderOperationIds));
    });

    test('backend conversation emitter result presentations stay in parity with frontend presenters', () => {
        const backendResultPresentations = Array.from(new Set(
            extractObjectFieldStringLiterals(conversationCapabilityLiteral, 'resultPresentation')
        ));
        const customPresentationIds = extractObjectLiteralKeys(frontendSource, 'CUSTOM_RESULT_PRESENTERS');
        const cardPresentationIds = extractObjectLiteralKeys(frontendSource, 'CARD_RESULT_PRESENTATION_REGISTRY');
        const frontendResultPresentations = new Set([...customPresentationIds, ...cardPresentationIds]);

        expect(new Set(backendResultPresentations)).toEqual(frontendResultPresentations);
    });

    test('backend knowledge-operation execution presentations stay within frontend operation allowlist', () => {
        const frontendOperationAllowedPresentations = extractOperationAllowedResultPresentationsFromFrontend(frontendSource);
        const backendOperationPairs = extractBackendKnowledgeOperationPairs(conversationCapabilityLiteral);
        expect(backendOperationPairs.length).toBeGreaterThan(0);

        const backendOperationPresentationSetByOperationId = new Map<string, Set<string>>();
        backendOperationPairs.forEach((entry) => {
            expect(frontendOperationAllowedPresentations[entry.operationId]).toBeDefined();
            expect(frontendOperationAllowedPresentations[entry.operationId]).toContain(entry.resultPresentation);
            const knownPresentations = backendOperationPresentationSetByOperationId.get(entry.operationId) || new Set<string>();
            knownPresentations.add(entry.resultPresentation);
            backendOperationPresentationSetByOperationId.set(entry.operationId, knownPresentations);
        });

        backendOperationPresentationSetByOperationId.forEach((presentations) => {
            expect(presentations.size).toBe(1);
        });
    });

    test('backend non-default operation presentations require explicit frontend overrides', () => {
        const defaultMapping = extractOperationDefaultResultPresentationsFromFrontend(frontendSource);
        const overrideMapping = extractOperationResultPresentationOverridesFromFrontend(frontendSource);
        const backendOperationPairs = extractBackendKnowledgeOperationPairs(conversationCapabilityLiteral);
        expect(backendOperationPairs.length).toBeGreaterThan(0);

        backendOperationPairs.forEach(({ operationId, resultPresentation }) => {
            const defaultPresentation = String(defaultMapping[operationId] || '').trim();
            expect(defaultPresentation).toBeTruthy();
            if (resultPresentation !== defaultPresentation) {
                const operationOverrides = overrideMapping[operationId] || [];
                expect(operationOverrides).toContain(resultPresentation);
            }
        });
    });

    test('frontend override presentations must be exercised by backend capability emission', () => {
        const overrideMapping = extractOperationResultPresentationOverridesFromFrontend(frontendSource);
        const backendOperationPairs = extractBackendKnowledgeOperationPairs(conversationCapabilityLiteral);
        const backendOperationPresentations = new Map<string, Set<string>>();

        backendOperationPairs.forEach(({ operationId, resultPresentation }) => {
            const knownPresentations = backendOperationPresentations.get(operationId) || new Set<string>();
            knownPresentations.add(resultPresentation);
            backendOperationPresentations.set(operationId, knownPresentations);
        });

        Object.entries(overrideMapping).forEach(([operationId, overridePresentations]) => {
            const backendPresentations = backendOperationPresentations.get(operationId) || new Set<string>();
            overridePresentations.forEach((presentation) => {
                expect(backendPresentations.has(presentation)).toBe(true);
            });
        });
    });

    test('backend conversation emitter capabilities keep executable contract completeness', () => {
        const capabilityObjectLiterals = extractTopLevelObjectLiteralsFromArrayLiteral(conversationCapabilityLiteral);
        expect(capabilityObjectLiterals.length).toBeGreaterThan(0);

        capabilityObjectLiterals.forEach((capabilityLiteral) => {
            expect(capabilityLiteral).toMatch(/capabilityId\s*:\s*`[^`]+`|capabilityId\s*:\s*'[^']+'/);
            expect(capabilityLiteral).toMatch(/actionId\s*:\s*'[^']+'/);
            expect(capabilityLiteral).toMatch(/labelKey\s*:\s*'agentWorkspace\.actions\.[^']+'/);
            expect(capabilityLiteral).toMatch(/failure\s*:\s*{[\s\S]*?messageKey\s*:\s*'agentWorkspace\.messages\.[^']+'/);
            expect(capabilityLiteral).toMatch(/failure\s*:\s*{[\s\S]*?fallbackMessage\s*:\s*'[^']+'/);
            expect(capabilityLiteral).toMatch(/execution\s*:\s*{[\s\S]*?kind\s*:\s*'[^']+'/);

            const isKnowledgeOperation = /execution\s*:\s*{[\s\S]*?kind\s*:\s*'knowledge_operation'/.test(capabilityLiteral);
            if (isKnowledgeOperation) {
                expect(capabilityLiteral).toMatch(/execution\s*:\s*{[\s\S]*?operationId\s*:\s*'[^']+'/);
                expect(capabilityLiteral).toMatch(/execution\s*:\s*{[\s\S]*?resultPresentation\s*:\s*'[^']+'/);
            }
        });
    });
});
