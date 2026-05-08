import { listOperationDefinitions, getOperationDefinition } from '../operations/registry';
import { CliCommandDef } from './types';

const CLI_COMMANDS: CliCommandDef[] = [
    {
        name: 'process-file',
        aliases: ['process'],
        description: 'Process a markdown file to add wiki-links and extract concepts',
        operationId: 'file.process-add-links',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'write-file',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file', required: true },
            { name: 'output', aliases: ['o'], description: 'Custom output path', required: false }
        ],
        flags: [
            { name: 'dry-run', aliases: ['n'], description: 'Preview changes without writing' },
            { name: 'no-concepts', aliases: ['nc'], description: 'Skip concept note creation' }
        ]
    },
    {
        name: 'process-folder',
        aliases: ['pf'],
        description: 'Process all markdown files in a folder',
        operationId: 'file.process-folder-add-links',
        automationLevel: 'interactive-ui',
        requiredContext: 'folder-selection',
        sideEffectClass: 'batch-write',
        params: [
            { name: 'path', aliases: ['p', 'folder'], description: 'Path to the folder', required: true },
            { name: 'output', aliases: ['o'], description: 'Custom output folder', required: false }
        ],
        flags: [
            { name: 'dry-run', aliases: ['n'], description: 'Preview changes without writing' }
        ]
    },
    {
        name: 'generate-content',
        aliases: ['gen', 'generate'],
        description: 'Generate content from a note title',
        operationId: 'content.generate-from-title',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'write-file',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the title file', required: true },
            { name: 'output', aliases: ['o'], description: 'Custom output path', required: false }
        ],
        flags: [
            { name: 'research', aliases: ['r'], description: 'Enable web research for context' }
        ]
    },
    {
        name: 'batch-generate',
        aliases: ['bg'],
        description: 'Batch generate content from all titles in a folder',
        operationId: 'content.batch-generate-from-titles',
        automationLevel: 'interactive-ui',
        requiredContext: 'folder-selection',
        sideEffectClass: 'batch-write',
        params: [
            { name: 'path', aliases: ['p', 'folder'], description: 'Path to the folder', required: true }
        ],
        flags: []
    },
    {
        name: 'translate',
        aliases: ['tr'],
        description: 'Translate a markdown file',
        operationId: 'translate.file',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'write-file',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file', required: true },
            { name: 'language', aliases: ['l', 'lang'], description: 'Target language code', required: true },
            { name: 'output', aliases: ['o'], description: 'Custom output path', required: false }
        ],
        flags: []
    },
    {
        name: 'translate-folder',
        aliases: ['tf'],
        description: 'Translate all markdown files in a folder',
        operationId: 'translate.folder-batch',
        automationLevel: 'interactive-ui',
        requiredContext: 'folder-selection',
        sideEffectClass: 'batch-write',
        params: [
            { name: 'path', aliases: ['p', 'folder'], description: 'Path to the folder', required: true },
            { name: 'language', aliases: ['l', 'lang'], description: 'Target language code', required: true }
        ],
        flags: []
    },
    {
        name: 'search',
        aliases: ['s'],
        description: 'Search the web for a topic',
        operationId: 'research.summarize-topic',
        automationLevel: 'requires-selection',
        requiredContext: 'editor-selection',
        sideEffectClass: 'write-file',
        params: [
            { name: 'query', aliases: ['q'], description: 'Search query', required: true },
            { name: 'provider', aliases: ['prov'], description: 'Search provider (tavily or duckduckgo)', required: false, defaultValue: 'duckduckgo' }
        ],
        flags: []
    },
    {
        name: 'generate-diagram',
        aliases: ['diagram', 'gd'],
        description: 'Generate a diagram from markdown content',
        operationId: 'diagram.generate',
        automationLevel: 'safe',
        requiredContext: 'none',
        sideEffectClass: 'read-only',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file', required: true },
            { name: 'intent', aliases: ['i'], description: 'Diagram intent (mermaid, vega-lite, canvas)', required: false, defaultValue: 'mermaid' },
            { name: 'output', aliases: ['o'], description: 'Custom output path', required: false },
            { name: 'mode', aliases: ['m'], description: 'Compatibility mode (best-fit, legacy-mermaid)', required: false, defaultValue: 'best-fit' }
        ],
        flags: [
            { name: 'preview', aliases: ['pv'], description: 'Preview instead of saving' }
        ]
    },
    {
        name: 'fix-mermaid',
        aliases: ['fm'],
        description: 'Fix Mermaid syntax errors in a markdown file',
        operationId: 'mermaid.batch-fix',
        automationLevel: 'interactive-ui',
        requiredContext: 'folder-selection',
        sideEffectClass: 'batch-write',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file or folder', required: true }
        ],
        flags: [
            { name: 'in-place', aliases: ['i'], description: 'Modify file in place (default: true)' }
        ]
    },
    {
        name: 'fix-formulas',
        aliases: ['ff'],
        description: 'Fix LaTeX formula formatting in markdown',
        operationId: 'formula.fix-file',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'write-file',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file', required: true }
        ],
        flags: [
            { name: 'in-place', aliases: ['i'], description: 'Modify file in place (default: true)' }
        ]
    },
    {
        name: 'check-duplicates',
        aliases: ['cd', 'dup'],
        description: 'Check for duplicate wiki-links and terms',
        operationId: 'duplicate.check-file',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'read-only',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file', required: true }
        ],
        flags: []
    },
    {
        name: 'extract-concepts',
        aliases: ['ec'],
        description: 'Extract concepts from a markdown file',
        operationId: 'concept.extract-file',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'write-file',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file', required: true }
        ],
        flags: []
    },
    {
        name: 'extract-original',
        aliases: ['eo'],
        description: 'Extract original text from a processed file',
        operationId: 'content.extract-original-text',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'write-file',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown file', required: true },
            { name: 'output', aliases: ['o'], description: 'Custom output path', required: false }
        ],
        flags: [
            { name: 'merged', aliases: ['m'], description: 'Use merged extraction mode' }
        ]
    },
    {
        name: 'diagnose',
        aliases: ['diag'],
        description: 'Diagnose LLM provider connectivity',
        operationId: 'provider.diagnostic.run',
        automationLevel: 'safe',
        requiredContext: 'none',
        sideEffectClass: 'read-only',
        params: [
            { name: 'provider', aliases: ['p', 'prov'], description: 'Provider name to diagnose', required: false }
        ],
        flags: []
    },
    {
        name: 'test-connection',
        aliases: ['test'],
        description: 'Test LLM provider connection',
        operationId: 'provider.connection.test',
        automationLevel: 'safe',
        requiredContext: 'none',
        sideEffectClass: 'read-only',
        params: [
            { name: 'provider', aliases: ['p', 'prov'], description: 'Provider name to test', required: false }
        ],
        flags: []
    },
    {
        name: 'capability-manifest',
        aliases: ['manifest'],
        description: 'Export the CLI capability manifest',
        operationId: 'cli.capability-manifest.export',
        automationLevel: 'safe',
        requiredContext: 'none',
        sideEffectClass: 'write-file',
        params: [
            { name: 'output', aliases: ['o'], description: 'Output path for the manifest JSON', required: false }
        ],
        flags: []
    },
    {
        name: 'invocation-contract',
        aliases: ['contract'],
        description: 'Export the CLI invocation contract',
        operationId: 'cli.invocation-contract.export',
        automationLevel: 'safe',
        requiredContext: 'none',
        sideEffectClass: 'write-file',
        params: [
            { name: 'output', aliases: ['o'], description: 'Output path for the contract JSON', required: false }
        ],
        flags: []
    },
    {
        name: 'export-providers',
        aliases: ['export'],
        description: 'Export provider configurations',
        operationId: 'provider.profile.export',
        automationLevel: 'safe',
        requiredContext: 'none',
        sideEffectClass: 'write-file',
        params: [
            { name: 'output', aliases: ['o'], description: 'Output path for the profile JSON', required: false }
        ],
        flags: []
    },
    {
        name: 'import-providers',
        aliases: ['import'],
        description: 'Import provider configurations',
        operationId: 'provider.profile.import',
        automationLevel: 'safe',
        requiredContext: 'none',
        sideEffectClass: 'write-file',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the provider profile JSON', required: true }
        ],
        flags: []
    },
    {
        name: 'concept-dedupe',
        aliases: ['dedupe'],
        description: 'Check and remove duplicate concept notes',
        operationId: 'concept.dedupe',
        automationLevel: 'interactive-ui',
        requiredContext: 'folder-selection',
        sideEffectClass: 'destructive',
        params: [
            { name: 'path', aliases: ['p', 'folder'], description: 'Path to the concept folder', required: true }
        ],
        flags: [
            { name: 'force', aliases: ['f'], description: 'Delete without confirmation' }
        ]
    },
    {
        name: 'workflow',
        aliases: ['wf', 'run'],
        description: 'Run pipeline: extract concepts → (add wikilinks) → generate titles → fix mermaid',
        operationId: 'workflow.extract-and-generate',
        automationLevel: 'requires-active-file',
        requiredContext: 'active-file',
        sideEffectClass: 'batch-write',
        params: [
            { name: 'path', aliases: ['p', 'file'], description: 'Path to the markdown/text file', required: true },
            { name: 'output', aliases: ['o'], description: 'Custom output folder path', required: false },
            { name: 'language', aliases: ['l', 'lang'], description: 'Output language code', required: false }
        ],
        flags: [
            { name: 'with-wikilinks', aliases: ['ww', 'links'], description: 'Add [[wiki-links]] for extracted concepts in source' },
            { name: 'wikilinks-in-place', aliases: ['wi'], description: 'Modify source in place (default: write _wikified copy)' },
            { name: 'no-generate', aliases: ['ng'], description: 'Skip content generation stage' },
            { name: 'no-mermaid', aliases: ['nm'], description: 'Skip Mermaid fix stage' }
        ]
    },
    {
        name: 'batch-workflow',
        aliases: ['bwf', 'batch'],
        description: 'Run pipeline on all matching files in a folder with regex filtering',
        operationId: 'workflow.batch',
        automationLevel: 'interactive-ui',
        requiredContext: 'folder-selection',
        sideEffectClass: 'batch-write',
        params: [
            { name: 'path', aliases: ['p', 'folder'], description: 'Path to the folder', required: true },
            { name: 'output', aliases: ['o'], description: 'Output base folder path', required: false },
            { name: 'pattern', aliases: ['filter', 'regex'], description: 'Regex pattern for filename matching', required: false },
            { name: 'extensions', aliases: ['ext'], description: 'Comma-separated extensions (e.g. ".md,.txt")', required: false },
            { name: 'max', aliases: ['max-files'], description: 'Maximum files to process', required: false }
        ],
        flags: [
            { name: 'with-wikilinks', aliases: ['ww', 'links'], description: 'Add [[wiki-links]] for extracted concepts in each source' },
            { name: 'wikilinks-in-place', aliases: ['wi'], description: 'Modify source in place (default: write _wikified copy)' },
            { name: 'no-generate', aliases: ['ng'], description: 'Skip content generation stage' },
            { name: 'no-mermaid', aliases: ['nm'], description: 'Skip Mermaid fix stage' }
        ]
    }
];

const COMMAND_MAP = new Map<string, CliCommandDef>();
for (const cmd of CLI_COMMANDS) {
    COMMAND_MAP.set(cmd.name, cmd);
    for (const alias of cmd.aliases) {
        COMMAND_MAP.set(alias, cmd);
    }
}

export function listCommands(): CliCommandDef[] {
    return [...CLI_COMMANDS];
}

export function findCommand(name: string): CliCommandDef | undefined {
    return COMMAND_MAP.get(name);
}

export function getOperationForCommand(commandName: string): ReturnType<typeof getOperationDefinition> {
    const cmd = findCommand(commandName);
    if (!cmd) return undefined;
    return getOperationDefinition(cmd.operationId);
}
