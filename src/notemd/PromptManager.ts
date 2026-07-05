import { NotemdSettings, TaskKey } from './types';

const DEFAULT_PROMPTS: Record<TaskKey, string> = {
    extractConcepts: [
        'Extract core concepts from the markdown content.',
        'Return only lines in format: CONCEPT: <name>',
        'Do not include explanations or markdown fences.',
        'Ignore references/bibliography sections and code blocks.',
    ].join('\n'),
    addLinks: [
        'Insert Obsidian wiki links for core concepts in the original text.',
        'Preserve original formatting and wording.',
        'Avoid linking common names unless technically relevant.',
        'Do not add duplicate wiki links for the same concept.',
    ].join('\n'),
    generateTitle: [
        'Generate a structured markdown article for "{TITLE}".',
        'Start with a level-2 heading.',
        'Include core concepts, practical usage, and references section.',
        '{RESEARCH_CONTEXT_SECTION}',
    ].join('\n'),
    translate: [
        'Translate the content to {LANGUAGE}.',
        'Only output translated text and preserve markdown formatting.',
    ].join('\n'),
    summarizeToMermaid: [
        'Summarize the content as a single Mermaid diagram.',
        'Output exactly one mermaid code block and no extra text.',
    ].join('\n'),
    extractOriginalText: [
        'For each user query, extract exact matching passages from reference content.',
        'Do not paraphrase.',
        'If none found, output: No match found in reference.',
    ].join('\n'),
    extractOriginalTextMerged: [
        'For each user query, extract exact matching passages from reference content.',
        'Combine matching passages into a single merged response.',
        'Do not paraphrase. If none found, output: No match found in reference.',
    ].join('\n'),
    searchResearch: [
        'Research the given topic using web search results.',
        'Summarize findings in structured markdown with citations.',
        'Include key facts, different perspectives, and references.',
    ].join('\n'),
    ragSufficiencyJudge: [
        'Review whether the supplied RAG context is sufficient to answer the user query.',
        'Use only the supplied context and do not write the final answer.',
        'Return exactly one JSON object with status, score, reasons, and degradationState.',
    ].join('\n'),
};

function safeReplace(template: string, replacements: Record<string, string>): string {
    let next = template;
    Object.entries(replacements).forEach(([key, value]) => {
        next = next.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });
    return next;
}

export class PromptManager {
    public getDefaultPrompt(taskKey: TaskKey): string {
        return DEFAULT_PROMPTS[taskKey] || '';
    }

    public getPrompt(
        settings: NotemdSettings,
        taskKey: TaskKey,
        replacements: Record<string, string> = {}
    ): string {
        const fromCustomPrompts =
            settings.enableGlobalCustomPrompts &&
            settings.customPrompts &&
            typeof settings.customPrompts[taskKey] === 'string'
                ? String(settings.customPrompts[taskKey]).trim()
                : '';

        let prompt = fromCustomPrompts || this.getDefaultPrompt(taskKey);

        if (settings.enableFocusedLearning && settings.focusedLearningDomain.trim()) {
            prompt = `Relevant Domain: ${settings.focusedLearningDomain.trim()}\n\n${prompt}`;
        }

        prompt = safeReplace(prompt, replacements);

        if (taskKey !== 'translate' && !settings.disableAutoTranslation) {
            const languageCode = settings.useDifferentLanguagesForTasks
                ? this.resolveTaskLanguage(settings, taskKey)
                : settings.language;
            if (languageCode && /\{LANGUAGE\}/.test(prompt)) {
                prompt = safeReplace(prompt, {
                    LANGUAGE: this.resolveLanguageName(settings, languageCode),
                });
            }
        }

        return prompt;
    }

    private resolveTaskLanguage(settings: NotemdSettings, taskKey: TaskKey): string {
        switch (taskKey) {
            case 'addLinks':
                return settings.addLinksLanguage;
            case 'generateTitle':
                return settings.generateTitleLanguage;
            case 'summarizeToMermaid':
                return settings.summarizeToMermaidLanguage;
            case 'extractConcepts':
                return settings.extractConceptsLanguage;
            case 'translate':
                return settings.translateLanguage;
            case 'extractOriginalText':
                return settings.language;
            default:
                return settings.language;
        }
    }

    private resolveLanguageName(settings: NotemdSettings, code: string): string {
        const match = settings.availableLanguages.find((item) => item.code === code);
        return match?.name || code;
    }
}

export { DEFAULT_PROMPTS };
