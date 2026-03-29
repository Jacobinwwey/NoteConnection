import {
  applyFrontendSettingsToAppConfig,
  applyNotemdSettingsToAppConfig,
  applyPathModeSettingsToAppConfig,
  DEFAULT_FRONTEND_SETTINGS,
  DEFAULT_PATH_MODE_SETTINGS,
  extractFrontendSettingsFromAppConfig,
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
      workspaceFilePath: 'E:/Knowledge_Base/science/topic.md',
      workspaceFolderPath: 'E:/Knowledge_Base/science/topic',
      workspaceOutputFilePath: 'E:/Knowledge_Base/science/topic_processed.md',
      workspaceOutputFolderPath: 'E:/Knowledge_Base/science/topic',
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
    expect(notemdSection.workspace_file_path).toBe('E:/Knowledge_Base/science/topic.md');
    expect(notemdSection.workspace_folder_path).toBe('E:/Knowledge_Base/science/topic');
    expect(notemdSection.workspace_output_file_path).toBe('E:/Knowledge_Base/science/topic_processed.md');
    expect(notemdSection.workspace_output_folder_path).toBe('E:/Knowledge_Base/science/topic');
    expect(providers.length).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.providers.length);
    expect(apiSection.provider).toBe('Qwen');
    expect(apiSection.api_key).toBe('qwen-key');
  });

  test('extractNotemdSettingsFromAppConfig maps workspace fields from TOML', () => {
    const extracted = extractNotemdSettingsFromAppConfig({
      notemd: {
        workspace_file_path: 'E:/Knowledge_Base/math/topic.md',
        workspace_folder_path: 'E:/Knowledge_Base/math/topic',
        workspace_output_file_path: 'E:/Knowledge_Base/math/topic_processed.md',
        workspace_output_folder_path: 'E:/Knowledge_Base/math/topic',
      },
    });

    expect(extracted.workspaceFilePath).toBe('E:/Knowledge_Base/math/topic.md');
    expect(extracted.workspaceFolderPath).toBe('E:/Knowledge_Base/math/topic');
    expect(extracted.workspaceOutputFilePath).toBe('E:/Knowledge_Base/math/topic_processed.md');
    expect(extracted.workspaceOutputFolderPath).toBe('E:/Knowledge_Base/math/topic');
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

  test('frontend_settings are normalized and clamped', () => {
    const extracted = extractFrontendSettingsFromAppConfig({
      frontend_settings: {
        physics: {
          repulsion_force: 100,
          repulsion_dag: -999999,
          link_distance: -50,
          collision_radius: 9999,
        },
        visuals: {
          edge_opacity: 9,
          base_node_size: -1,
          degree_mode: 'invalid',
        },
        performance: {
          max_workers: 999,
          enable_gpu: false,
          gpu_rendering: false,
          memory_saving_mode: true,
          compact_mode: true,
          static_mode: true,
          deep_debug: true,
        },
        reading: {
          mode: 'invalid',
          markdown_engine: 'pulldown',
          chunk_block_size: -1,
          prefetch_blocks: 9999,
          index_cache_ttl_sec: 1,
          max_doc_bytes: 42,
        },
      },
    });

    expect(extracted.physics.repulsionForce).toBe(-1);
    expect(extracted.physics.repulsionDAG).toBe(-10000);
    expect(extracted.physics.linkDistance).toBe(20);
    expect(extracted.physics.collisionRadius).toBe(300);
    expect(extracted.visuals.edgeOpacity).toBe(1);
    expect(extracted.visuals.baseNodeSize).toBe(1);
    expect(extracted.visuals.degreeMode).toBe('visible');
    expect(extracted.performance.maxWorkers).toBe(64);
    expect(extracted.performance.enableGPU).toBe(false);
    expect(extracted.performance.gpuRendering).toBe(false);
    expect(extracted.performance.memorySavingMode).toBe(true);
    expect(extracted.performance.compactMode).toBe(true);
    expect(extracted.performance.staticMode).toBe(true);
    expect(extracted.performance.deepDebug).toBe(true);
    expect(extracted.reading.mode).toBe('window');
    expect(extracted.reading.markdownEngine).toBe('pulldown');
    expect(extracted.reading.chunkBlockSize).toBe(1);
    expect(extracted.reading.prefetchBlocks).toBe(1024);
    expect(extracted.reading.indexCacheTtlSec).toBe(5);
    expect(extracted.reading.maxDocBytes).toBe(256 * 1024);
  });

  test('applyFrontendSettingsToAppConfig writes frontend_settings section', () => {
    const nextConfig = applyFrontendSettingsToAppConfig({}, {
      ...DEFAULT_FRONTEND_SETTINGS,
      visuals: {
        ...DEFAULT_FRONTEND_SETTINGS.visuals,
        degreeMode: 'total',
      },
      performance: {
        ...DEFAULT_FRONTEND_SETTINGS.performance,
        maxWorkers: 8,
        compactMode: true,
      },
      reading: {
        mode: 'fullscreen',
        markdownEngine: 'pulldown',
        chunkBlockSize: 64,
        prefetchBlocks: 16,
        indexCacheTtlSec: 7200,
        maxDocBytes: 134217728,
      },
    });

    const frontendSection = nextConfig.frontend_settings as Record<string, unknown>;
    const visualsSection = frontendSection.visuals as Record<string, unknown>;
    const performanceSection = frontendSection.performance as Record<string, unknown>;
    const readingSection = frontendSection.reading as Record<string, unknown>;

    expect(frontendSection).toBeDefined();
    expect(visualsSection.degree_mode).toBe('total');
    expect(performanceSection.max_workers).toBe(8);
    expect(performanceSection.compact_mode).toBe(true);
    expect(readingSection.mode).toBe('fullscreen');
    expect(readingSection.markdown_engine).toBe('pulldown');
    expect(readingSection.chunk_block_size).toBe(64);
    expect(readingSection.prefetch_blocks).toBe(16);
    expect(readingSection.index_cache_ttl_sec).toBe(7200);
    expect(readingSection.max_doc_bytes).toBe(134217728);
  });
});
