import { listOperationDefinitions } from './registry';
import { CliInvocationContract } from './types';

export function buildCliInvocationContract(): CliInvocationContract {
    return {
        version: 1,
        operations: listOperationDefinitions()
            .filter(definition => definition.inputSchema && definition.resultSchema)
            .map(definition => ({
                operationId: definition.id,
                operationVersion: definition.version,
                inputSchema: definition.inputSchema!,
                resultSchema: definition.resultSchema!
            }))
    };
}
