import { AutomationLevel, RequiredContext, SideEffectClass } from '../operations/types';

export interface CliCommandDef {
    name: string;
    aliases: string[];
    description: string;
    operationId: string;
    automationLevel: AutomationLevel;
    requiredContext: RequiredContext;
    sideEffectClass: SideEffectClass;
    params: CliParamDef[];
    flags: CliFlagDef[];
}

export interface CliParamDef {
    name: string;
    aliases: string[];
    description: string;
    required: boolean;
    defaultValue?: string;
}

export interface CliFlagDef {
    name: string;
    aliases: string[];
    description: string;
}

export interface CliExecutionContext {
    workingDir: string;
    getSetting: (key: string) => Promise<string | undefined>;
    callLlm: (prompt: string, content: string, providerName?: string) => Promise<string>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    fileExists: (path: string) => Promise<boolean>;
    mkdir: (path: string) => Promise<void>;
}
