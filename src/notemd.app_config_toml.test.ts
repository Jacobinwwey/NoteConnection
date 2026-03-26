import {
  applyNotemdSettingsToAppConfig,
  applyPathModeSettingsToAppConfig,
  DEFAULT_PATH_MODE_SETTINGS,
  extractNotemdSettingsFromAppConfig,
  extractPathModeSettingsFromAppConfig,
} from './notemd/AppConfigToml';
import { DEFAULT_SETTINGS } from './notemd/constants';

describe('app_config.toml adapters', () => {
  test('extractNotemdSettingsFromAppConfig supports legacy notemd.api overrides', () => {
    const appConfig = {
      notemd: {
        active_provider: 'OpenAI',
        chunk_word_count: 1234,
        max_tokens: 2345,
        auto_mermaid_fix_after_generate: true,
        api: {
          provider: 'OpenAI',
          base_url: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          api_key: 'legacy-key',
          api_version: '',
          temperature: 0.25,
        },
      },
    };

    const extracted = extractNotemdSettingsFromAppConfig(appConfig);
    const openAiProvider = extracted.providers?.find((provider) => provider.name === 'OpenAI');

    expect(extracted.activeProvider).toBe('OpenAI');
    expect(extracted.chunkWordCount).toBe(1234);
    expect(extracted.maxTokens).toBe(2345);
    expect(extracted.autoMermaidFixAfterGenerate).toBe(true);
    expect(openAiProvider?.apiKey).toBe('legacy-key');
    expect(openAiProvider?.model).toBe('gpt-4o-mini');
  });

  test('applyNotemdSettingsToAppConfig persists full provider list and legacy mirror', () => {
    const nextSettings = {
      ...DEFAULT_SETTINGS,
      activeProvider: 'Qwen' as const,
      chunkWordCount: 3456,
      maxTokens: 4567,
      providers: DEFAULT_SETTINGS.providers.map((provider) =>
        provider.name === 'Qwen'
          ? {
              ...provider,
              apiKey: 'qwen-key',
              model: 'qwen-plus',
            }
          : provider
      ),
    };

    const nextConfig = applyNotemdSettingsToAppConfig({}, nextSettings);
    const notemdSection = nextConfig.notemd as Record<string, unknown>;
    const providers = Array.isArray(notemdSection.providers) ? notemdSection.providers : [];
    const apiSection = notemdSection.api as Record<string, unknown>;

    expect(notemdSection.active_provider).toBe('Qwen');
    expect(notemdSection.chunk_word_count).toBe(3456);
    expect(notemdSection.max_tokens).toBe(4567);
    expect(providers.length).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.providers.length);
    expect(apiSection.provider).toBe('Qwen');
    expect(apiSection.api_key).toBe('qwen-key');
  });

  test('path_mode settings are normalized and clamped', () => {
    const nextConfig = applyPathModeSettingsToAppConfig(
      {},
      {
        ...DEFAULT_PATH_MODE_SETTINGS,
        bg_brightness: 99,
        reader_media_scale: -3,
        node_spacing: 999,
        reading_mode: 'invalid',
        reader_render_mode: 'invalid',
      }
    );

    const extracted = extractPathModeSettingsFromAppConfig(nextConfig);
    expect(extracted.bg_brightness).toBe(10);
    expect(extracted.reader_media_scale).toBe(0.1);
    expect(extracted.node_spacing).toBe(600);
    expect(extracted.reading_mode).toBe('window');
    expect(extracted.reader_render_mode).toBe('render');
  });
});
