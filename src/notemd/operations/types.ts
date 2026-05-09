export type AutomationLevel = 'safe' | 'requires-active-file' | 'requires-selection' | 'interactive-ui';
export type RequiredContext = 'none' | 'active-file' | 'editor-selection' | 'folder-selection' | 'preview-ui';
export type SideEffectClass = 'read-only' | 'write-file' | 'batch-write' | 'preview-ui' | 'destructive';
export type CapabilityTriggerSurface = 'command-palette' | 'hotkey' | 'official-cli-command';
export type CommandMappingKind = 'exact' | 'future-target' | 'legacy-alias';
export type OperationSchema = Record<string, unknown>;

/**
 * DeepTutor two-layer model:
 * - Tool: stateless, single-function, safe auto-execution (e.g., provider.diagnostic.run)
 * - Capability: stateful, multi-step, may require context (e.g., workflow.extract-and-generate)
 */
export type CapabilityLevel = 'tool' | 'capability';

export interface OperationCommandBinding {
    commandId: string;
    automationLevel: AutomationLevel;
    requiredContext: RequiredContext;
    sideEffectClass: SideEffectClass;
    surfaces: CapabilityTriggerSurface[];
    mappingKind: CommandMappingKind;
    includeInCapabilityManifest?: boolean;
    defaultInput?: OperationSchema;
}

export interface OperationDefinition {
    id: string;
    version: 1;
    /** DeepTutor two-layer model: tool vs capability. */
    capabilityLevel: CapabilityLevel;
    automationLevel: AutomationLevel;
    requiredContext: RequiredContext;
    sideEffectClass: SideEffectClass;
    commandBindings: OperationCommandBinding[];
    inputSchema?: OperationSchema;
    resultSchema?: OperationSchema;
}

export interface CliCapabilityCommand {
    id: string;
    localCommandId: string;
    operationId: string;
    operationVersion: 1;
    automationLevel: AutomationLevel;
    requiredContext: RequiredContext;
    sideEffectClass: SideEffectClass;
    surfaces: CapabilityTriggerSurface[];
    mappingKind: CommandMappingKind;
    defaultInput?: OperationSchema;
}

export interface CliCapabilityManifest {
    version: 1;
    commands: CliCapabilityCommand[];
}

export interface CliInvocationContractOperation {
    operationId: string;
    operationVersion: 1;
    inputSchema: OperationSchema;
    resultSchema: OperationSchema;
}

export interface CliInvocationContract {
    version: 1;
    operations: CliInvocationContractOperation[];
}
