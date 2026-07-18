import * as fs from 'fs';
import * as path from 'path';

function extractFunctionBody(source: string, functionName: string): string {
    const functionStart = source.indexOf(`function ${functionName}(`);
    if (functionStart < 0) throw new Error(`Function not found: ${functionName}`);
    const openBrace = source.indexOf('{', functionStart);
    let depth = 0;
    for (let index = openBrace; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(openBrace, index + 1);
    }
    throw new Error(`Function body is incomplete: ${functionName}`);
}

describe('graph answer operator inspector contract', () => {
    const frontendRoot = path.join(__dirname, 'frontend');
    const workspaceSource = fs.readFileSync(path.join(frontendRoot, 'agent_workspace.js'), 'utf8');
    const panesSource = fs.readFileSync(path.join(frontendRoot, 'workspace_panes.js'), 'utf8');

    test('projects plan, coverage, and bounded expansion only through grounding diagnostics', () => {
        expect(workspaceSource).toContain('graphAnswerPlan');
        expect(workspaceSource).toContain('graphAnswerCoverage');
        expect(workspaceSource).toContain('graphExpansion');
        expect(panesSource).toContain('buildEvidenceGraphAnswerPlanHtml');
        expect(panesSource).toContain("agentWorkspace.evidence.graphAnswerPlanLabel");
        expect(panesSource).toContain('missingRequiredClaimIds');
        expect(panesSource).toContain('executedSteps');
    });

    test('does not render plan scaffolding in the public assistant answer block', () => {
        const answerRenderer = extractFunctionBody(workspaceSource, 'appendAssistantConversationResult');
        expect(answerRenderer).not.toContain('graphAnswerPlan');
        expect(answerRenderer).not.toContain('graphAnswerCoverage');
    });
});
