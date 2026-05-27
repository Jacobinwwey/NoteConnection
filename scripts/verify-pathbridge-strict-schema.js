#!/usr/bin/env node

const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function parseBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseArgs(argv) {
  const options = {
    strict: parseBoolean(
      process.env.NOTE_CONNECTION_REQUIRE_STRICT_PATHBRIDGE_SCHEMA === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_REQUIRE_STRICT_PATHBRIDGE_SCHEMA
    ),
    contractOnly: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) {
      continue;
    }
    if (arg === '--contract-only') {
      options.contractOnly = true;
      continue;
    }
    if (arg === '--strict' && index + 1 < argv.length) {
      options.strict = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
  }

  return options;
}

function fail(message) {
  console.error(`[PathBridge Strict Verify] FAIL ${message}`);
  process.exit(1);
}

function assertCondition(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertRejected(envelopeResult, expectedReasonFragment, label) {
  assertCondition(envelopeResult && envelopeResult.ok === false, `${label} should be rejected.`);
  const reason = String(envelopeResult.reason || '');
  assertCondition(
    reason.includes(expectedReasonFragment),
    `${label} rejection reason mismatch. expected fragment="${expectedReasonFragment}" actual="${reason}"`
  );
}

function main() {
  const options = parseArgs(process.argv);

  if (options.contractOnly) {
    console.log('[PathBridge Strict Verify] Contract-only mode passed.');
    console.log(`[PathBridge Strict Verify] strict=${options.strict}`);
    return;
  }

  if (!options.strict) {
    console.log('[PathBridge Strict Verify] Strict mode disabled by option/environment; skipping checks.');
    return;
  }

  process.env.NOTE_CONNECTION_BRIDGE_REJECT_UNKNOWN_TYPES = '1';
  process.env.NOTE_CONNECTION_BRIDGE_STRICT_CONFIG_SCHEMA = '1';

  // Import TypeScript module in-place to validate real runtime behavior under strict env flags.
  require('ts-node/register/transpile-only');
  const pathBridgeModulePath = path.join(repoRoot, 'src', 'core', 'PathBridge.ts');
  const {
    BRIDGE_INBOUND_SCHEMA_LIMITS,
    parseBridgeInboundEnvelope,
  } = require(pathBridgeModulePath);

  assertCondition(
    BRIDGE_INBOUND_SCHEMA_LIMITS.rejectUnknownTypes === true,
    'BRIDGE_INBOUND_SCHEMA_LIMITS.rejectUnknownTypes should be true in strict verification mode.'
  );
  assertCondition(
    BRIDGE_INBOUND_SCHEMA_LIMITS.strictConfigureSchema === true,
    'BRIDGE_INBOUND_SCHEMA_LIMITS.strictConfigureSchema should be true in strict verification mode.'
  );

  const unknownTypeEnvelope = parseBridgeInboundEnvelope({
    type: 'customRuntimeEvent',
    payload: {},
  });
  assertRejected(unknownTypeEnvelope, 'not allowed in strict unknown-type mode', 'unknown message type');

  const unknownConfigureKeyEnvelope = parseBridgeInboundEnvelope({
    type: 'configure',
    payload: {
      mode: 'domain',
      customRuntimeHint: true,
    },
  });
  assertRejected(unknownConfigureKeyEnvelope, 'unsupported keys in strict mode', 'unknown configure key');

  const conflictingTargetEnvelope = parseBridgeInboundEnvelope({
    type: 'configure',
    payload: {
      targetId: 'node-a',
      target_id: 'node-b',
    },
  });
  assertRejected(
    conflictingTargetEnvelope,
    'targetId and payload.target_id must match',
    'conflicting configure target keys'
  );

  const validStrictConfigureEnvelope = parseBridgeInboundEnvelope({
    type: 'configure',
    payload: {
      mode: 'diffusion',
      strategy: 'core',
      layout: 'orbital',
      targetId: 'node-a',
      auto_reconstruct: true,
      retain_history: true,
      focus_mode: false,
      background: 'belfast_sunset_puresky_4k.exr',
      bg_brightness: 0.1,
      reading_mode: 'window',
      reader_render_mode: 'render',
      reader_toggle_source_shortcut: 'Ctrl+M',
      reader_media_scale: 1.5,
      reader_debug: false,
    },
  });
  assertCondition(
    validStrictConfigureEnvelope && validStrictConfigureEnvelope.ok === true,
    `valid configure envelope should be accepted in strict mode. reason=${String(validStrictConfigureEnvelope.reason || '')}`
  );

  console.log('[PathBridge Strict Verify] PASS strict schema checks are enforced and compatible payloads are accepted.');
}

main();
