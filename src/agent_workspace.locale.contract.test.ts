import * as fs from 'fs';
import * as path from 'path';

type LocaleJson = Record<string, unknown>;
type CapabilityActionLabelPair = {
  actionId: string;
  labelKey: string;
};
type CapabilityFailureDescriptor = {
  messageKey: string;
  fallbackMessage: string;
};

function readLocale(filePath: string): LocaleJson {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as LocaleJson;
}

function getObjectAtPath(source: LocaleJson, objectPath: string[]): Record<string, unknown> {
  let cursor: unknown = source;
  for (const segment of objectPath) {
    if (!cursor || typeof cursor !== 'object' || !(segment in (cursor as Record<string, unknown>))) {
      throw new Error(`Missing locale path: ${objectPath.join('.')}`);
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
    throw new Error(`Locale path is not an object: ${objectPath.join('.')}`);
  }
  return cursor as Record<string, unknown>;
}

function extractPlaceholderSet(value: string): string[] {
  return Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map((match) => match[1]).sort();
}

function extractDiagnosticsLocaleKeysFromWorkspacePanes(source: string): string[] {
  const keys = new Set<string>();
  for (const match of source.matchAll(/agentWorkspace\.queryBackendDiagnostics\.([a-zA-Z0-9_]+)/g)) {
    const key = String(match[1] || '').trim();
    if (key.length > 0) {
      keys.add(key);
    }
  }
  return Array.from(keys).sort();
}

function extractMessageLocaleKeysFromAgentWorkspace(source: string): string[] {
  const keys = new Set<string>();
  for (const match of source.matchAll(/agentWorkspace\.messages\.([a-zA-Z0-9_]+)/g)) {
    const key = String(match[1] || '').trim();
    if (key.length > 0) {
      keys.add(key);
    }
  }
  return Array.from(keys).sort();
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

function extractCapabilityActionLabelPairs(source: string): CapabilityActionLabelPair[] {
  const pairs: CapabilityActionLabelPair[] = [];
  const pattern = /actionId\s*:\s*'([^']+)'[\s\S]*?labelKey\s*:\s*'([^']+)'/g;
  for (const match of source.matchAll(pattern)) {
    const actionId = String(match[1] || '').trim();
    const labelKey = String(match[2] || '').trim();
    if (!actionId || !labelKey) {
      continue;
    }
    pairs.push({ actionId, labelKey });
  }
  return pairs;
}

function extractCapabilityFailureDescriptors(source: string): CapabilityFailureDescriptor[] {
  const failures: CapabilityFailureDescriptor[] = [];
  const pattern = /failure\s*:\s*{[\s\S]*?messageKey\s*:\s*'([^']+)'[\s\S]*?fallbackMessage\s*:\s*'([^']+)'/g;
  for (const match of source.matchAll(pattern)) {
    const messageKey = String(match[1] || '').trim();
    const fallbackMessage = String(match[2] || '').trim();
    if (!messageKey || !fallbackMessage) {
      continue;
    }
    failures.push({
      messageKey,
      fallbackMessage,
    });
  }
  return failures;
}

describe('agent workspace locale contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const enLocalePath = path.join(repoRoot, 'src', 'frontend', 'locales', 'en.json');
  const zhLocalePath = path.join(repoRoot, 'src', 'frontend', 'locales', 'zh.json');
  const workspacePanesPath = path.join(repoRoot, 'src', 'frontend', 'workspace_panes.js');
  const agentWorkspacePath = path.join(repoRoot, 'src', 'frontend', 'agent_workspace.js');
  const knowledgePlatformPath = path.join(repoRoot, 'src', 'learning', 'KnowledgeLearningPlatform.ts');
  const requiredDiagnosticsKeys = [
    'cardTitle',
    'summary',
    'metricsHeading',
    'comparisonsLabel',
    'preferredCountsLabel',
    'latencyDeltaLabel',
    'runtimeReadyLabel',
    'graphvizRuntimeLabel',
    'graphvizDotBinaryLabel',
    'graphvizReasonLabel',
    'graphvizCheckedAtLabel',
    'graphvizFreshnessLabel',
    'vectorIndexLabel',
    'accelerationLabel',
    'healthLabel',
    'rolloutModeLabel',
    'accelerationProviderLabel',
    'accelerationFailureModeLabel',
    'accelerationRepresentationStrictLabel',
    'annPrefilterLabel',
    'annPrefilterEnabled',
    'annPrefilterDisabled',
    'annPrefilterUnknown',
    'boolEnabled',
    'boolDisabled',
    'fallbackBackendLabel',
    'lastErrorLabel',
    'runtimeLastErrorLabel',
    'statusAvailable',
    'statusUnavailable',
    'statusUnknown',
    'freshnessFresh',
    'freshnessWarn',
    'freshnessStale',
    'freshnessUnknown',
    'none',
  ] as const;

  test('query backend diagnostics locale keys exist in both en and zh dictionaries', () => {
    const en = readLocale(enLocalePath);
    const zh = readLocale(zhLocalePath);
    const enDiagnostics = getObjectAtPath(en, ['agentWorkspace', 'queryBackendDiagnostics']);
    const zhDiagnostics = getObjectAtPath(zh, ['agentWorkspace', 'queryBackendDiagnostics']);

    for (const key of requiredDiagnosticsKeys) {
      expect(typeof enDiagnostics[key]).toBe('string');
      expect(typeof zhDiagnostics[key]).toBe('string');
      expect(String(enDiagnostics[key] || '').trim().length).toBeGreaterThan(0);
      expect(String(zhDiagnostics[key] || '').trim().length).toBeGreaterThan(0);
    }
  });

  test('query backend diagnostics interpolation placeholders stay aligned between en and zh', () => {
    const en = readLocale(enLocalePath);
    const zh = readLocale(zhLocalePath);
    const enDiagnostics = getObjectAtPath(en, ['agentWorkspace', 'queryBackendDiagnostics']);
    const zhDiagnostics = getObjectAtPath(zh, ['agentWorkspace', 'queryBackendDiagnostics']);

    for (const key of requiredDiagnosticsKeys) {
      const enValue = String(enDiagnostics[key] || '');
      const zhValue = String(zhDiagnostics[key] || '');
      expect(extractPlaceholderSet(zhValue)).toEqual(extractPlaceholderSet(enValue));
    }
  });

  test('workspace diagnostics renderer only references locale keys declared in contract + en/zh dictionaries', () => {
    const workspacePanesSource = fs.readFileSync(workspacePanesPath, 'utf8');
    const referencedKeys = extractDiagnosticsLocaleKeysFromWorkspacePanes(workspacePanesSource);
    const en = readLocale(enLocalePath);
    const zh = readLocale(zhLocalePath);
    const enDiagnostics = getObjectAtPath(en, ['agentWorkspace', 'queryBackendDiagnostics']);
    const zhDiagnostics = getObjectAtPath(zh, ['agentWorkspace', 'queryBackendDiagnostics']);
    const contractKeys = new Set(requiredDiagnosticsKeys);

    expect(referencedKeys.length).toBeGreaterThan(0);

    for (const key of referencedKeys) {
      expect(contractKeys.has(key as (typeof requiredDiagnosticsKeys)[number])).toBe(true);
      expect(typeof enDiagnostics[key]).toBe('string');
      expect(typeof zhDiagnostics[key]).toBe('string');
      expect(String(enDiagnostics[key] || '').trim().length).toBeGreaterThan(0);
      expect(String(zhDiagnostics[key] || '').trim().length).toBeGreaterThan(0);
    }
  });

  test('backend conversation capability labels resolve to bilingual action locale keys', () => {
    const knowledgePlatformSource = fs.readFileSync(knowledgePlatformPath, 'utf8');
    const conversationCapabilityLiteral = extractArrayLiteralAfterMarker(
      knowledgePlatformSource,
      "const capabilities: AgentConversationResponse['knowledgePoints'][number]['capabilities'] ="
    );
    const pairs = extractCapabilityActionLabelPairs(conversationCapabilityLiteral);

    const en = readLocale(enLocalePath);
    const zh = readLocale(zhLocalePath);
    const enActions = getObjectAtPath(en, ['agentWorkspace', 'actions']);
    const zhActions = getObjectAtPath(zh, ['agentWorkspace', 'actions']);

    expect(pairs.length).toBeGreaterThan(0);

    const seenActionIds = new Set<string>();
    const seenLabelKeys = new Set<string>();
    const actionLabelPrefix = 'agentWorkspace.actions.';
    for (const pair of pairs) {
      expect(pair.actionId.length).toBeGreaterThan(0);
      expect(pair.labelKey.startsWith(actionLabelPrefix)).toBe(true);
      expect(seenActionIds.has(pair.actionId)).toBe(false);
      expect(seenLabelKeys.has(pair.labelKey)).toBe(false);

      const localeActionKey = pair.labelKey.slice(actionLabelPrefix.length);
      expect(localeActionKey.length).toBeGreaterThan(0);
      expect(typeof enActions[localeActionKey]).toBe('string');
      expect(typeof zhActions[localeActionKey]).toBe('string');
      expect(String(enActions[localeActionKey] || '').trim().length).toBeGreaterThan(0);
      expect(String(zhActions[localeActionKey] || '').trim().length).toBeGreaterThan(0);

      seenActionIds.add(pair.actionId);
      seenLabelKeys.add(pair.labelKey);
    }
  });

  test('backend conversation capability failure message keys resolve to bilingual locale entries with aligned placeholders', () => {
    const knowledgePlatformSource = fs.readFileSync(knowledgePlatformPath, 'utf8');
    const conversationCapabilityLiteral = extractArrayLiteralAfterMarker(
      knowledgePlatformSource,
      "const capabilities: AgentConversationResponse['knowledgePoints'][number]['capabilities'] ="
    );
    const failures = extractCapabilityFailureDescriptors(conversationCapabilityLiteral);

    const en = readLocale(enLocalePath);
    const zh = readLocale(zhLocalePath);
    const enMessages = getObjectAtPath(en, ['agentWorkspace', 'messages']);
    const zhMessages = getObjectAtPath(zh, ['agentWorkspace', 'messages']);

    expect(failures.length).toBeGreaterThan(0);

    const seenMessageKeys = new Set<string>();
    const fallbackPlaceholdersByMessageKey = new Map<string, string[]>();
    const messagePrefix = 'agentWorkspace.messages.';
    for (const failure of failures) {
      expect(failure.messageKey.startsWith(messagePrefix)).toBe(true);

      const localeMessageKey = failure.messageKey.slice(messagePrefix.length);
      expect(localeMessageKey.length).toBeGreaterThan(0);
      expect(typeof enMessages[localeMessageKey]).toBe('string');
      expect(typeof zhMessages[localeMessageKey]).toBe('string');
      const enValue = String(enMessages[localeMessageKey] || '');
      const zhValue = String(zhMessages[localeMessageKey] || '');
      expect(enValue.trim().length).toBeGreaterThan(0);
      expect(zhValue.trim().length).toBeGreaterThan(0);
      expect(extractPlaceholderSet(zhValue)).toEqual(extractPlaceholderSet(enValue));
      const fallbackPlaceholders = extractPlaceholderSet(failure.fallbackMessage);
      const knownFallbackPlaceholders = fallbackPlaceholdersByMessageKey.get(failure.messageKey);
      if (knownFallbackPlaceholders) {
        expect(fallbackPlaceholders).toEqual(knownFallbackPlaceholders);
      } else {
        fallbackPlaceholdersByMessageKey.set(failure.messageKey, fallbackPlaceholders);
      }
      expect(fallbackPlaceholders).toEqual(extractPlaceholderSet(enValue));

      seenMessageKeys.add(failure.messageKey);
    }

    expect(seenMessageKeys.size).toBeGreaterThan(0);
  });

  test('agent workspace message locale references stay resolvable in bilingual dictionaries', () => {
    const agentWorkspaceSource = fs.readFileSync(agentWorkspacePath, 'utf8');
    const referencedMessageKeys = extractMessageLocaleKeysFromAgentWorkspace(agentWorkspaceSource);
    const en = readLocale(enLocalePath);
    const zh = readLocale(zhLocalePath);
    const enMessages = getObjectAtPath(en, ['agentWorkspace', 'messages']);
    const zhMessages = getObjectAtPath(zh, ['agentWorkspace', 'messages']);

    expect(referencedMessageKeys.length).toBeGreaterThan(0);
    for (const key of referencedMessageKeys) {
      expect(typeof enMessages[key]).toBe('string');
      expect(typeof zhMessages[key]).toBe('string');
      const enValue = String(enMessages[key] || '');
      const zhValue = String(zhMessages[key] || '');
      expect(enValue.trim().length).toBeGreaterThan(0);
      expect(zhValue.trim().length).toBeGreaterThan(0);
      expect(extractPlaceholderSet(zhValue)).toEqual(extractPlaceholderSet(enValue));
    }
  });
});
