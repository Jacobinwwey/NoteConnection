import {
  NOTEMD_PROVIDER_TEMPLATES,
  applyProviderTemplateToSettings,
  getNotemdProviderTemplate,
  mergeProviderTemplatesIntoNotemdSection,
} from './notemd/providerTemplates';
import { DEFAULT_SETTINGS } from './notemd/constants';

describe('notemd provider templates', () => {
  test('exposes curated templates inspired by Cherry Studio and DeepTutor', () => {
    expect(NOTEMD_PROVIDER_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    expect(getNotemdProviderTemplate('openai-official')?.providerName).toBe('OpenAI');
    expect(getNotemdProviderTemplate('lmstudio-local')?.inspiredBy).toContain('DeepTutor');
  });

  test('applies a template to the matching provider and switches activeProvider', () => {
    const next = applyProviderTemplateToSettings(DEFAULT_SETTINGS, 'openrouter-gateway');
    const provider = next.providers.find((item) => item.name === 'OpenRouter');

    expect(next.activeProvider).toBe('OpenRouter');
    expect(provider).toBeTruthy();
    expect(provider?.baseUrl).toContain('openrouter.ai');
    expect(provider?.model).toContain('openai/');
  });

  test('merges provider_templates into the notemd TOML section without dropping existing overrides', () => {
    const next = mergeProviderTemplatesIntoNotemdSection({
      active_provider: 'DeepSeek',
      provider_templates: {
        custom_keep: {
          label: 'Keep Me',
        },
      },
    });
    const templates = next.provider_templates as Record<string, any>;

    expect(templates).toBeTruthy();
    expect(templates.custom_keep.label).toBe('Keep Me');
    expect(templates['openai-official']).toBeTruthy();
    expect(templates['openai-official'].provider_name).toBe('OpenAI');
  });
});
