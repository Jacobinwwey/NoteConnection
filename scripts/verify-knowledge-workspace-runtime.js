#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const LARGE_TARGET_DOCUMENT_THRESHOLD = 100;

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to allocate free port.'));
        return;
      }
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function requestJson(port, method, requestPath, body, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'undefined' ? undefined : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }
        : undefined,
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        text += chunk;
      });
      res.on('end', () => {
        let parsed = text;
        if (text.length > 0) {
          try {
            parsed = JSON.parse(text);
          } catch (_error) {
          }
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: parsed,
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`request_timeout:${requestPath}:${timeoutMs}`));
    });
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function startRuntimeProviderFixture(fixtureKind) {
  if (!['malformed_json', 'timeout'].includes(fixtureKind)) {
    throw new Error(`Unsupported runtime provider fixture: ${fixtureKind}`);
  }
  const timeoutDelayMs = 6000;
  const state = {
    kind: fixtureKind,
    requestCount: 0,
    completionCount: 0,
    modelProbeCount: 0,
    timeoutDelayMs: fixtureKind === 'timeout' ? timeoutDelayMs : undefined,
  };
  const server = http.createServer((req, res) => {
    state.requestCount += 1;
    const requestPath = String(req.url || '');
    req.setEncoding('utf8');
    req.on('data', () => {});
    req.on('end', () => {
      if (req.method === 'GET' && requestPath.endsWith('/models')) {
        state.modelProbeCount += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'rag-fixture-model' }] }));
        return;
      }
      if (req.method === 'POST' && requestPath.endsWith('/chat/completions')) {
        state.completionCount += 1;
        if (fixtureKind === 'timeout') {
          const timer = setTimeout(() => {
            if (res.destroyed || res.writableEnded) {
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: '{"status":"sufficient","score":0.99,"reasons":["late_fixture_response"],"degradationState":"none"}',
                  },
                },
              ],
            }));
          }, timeoutDelayMs);
          res.on('close', () => {
            clearTimeout(timer);
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'not json',
              },
            },
          ],
        }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `fixture route not found: ${req.method} ${requestPath}` }));
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to start runtime provider fixture.'));
        return;
      }
      resolve({
        kind: fixtureKind,
        port: address.port,
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        summary: () => ({ ...state }),
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => {
            if (error) {
              closeReject(error);
              return;
            }
            closeResolve();
          });
        }),
      });
    });
  });
}

async function readNotemdSettings(port) {
  const response = await requestJson(port, 'GET', '/api/notemd/settings', undefined, 90000);
  if (response.status !== 200 || !response.body || response.body.success !== true || !response.body.settings) {
    throw new Error(`failed to read NoteMD settings: status=${response.status} body=${JSON.stringify(response.body)}`);
  }
  return response.body.settings;
}

async function writeNotemdSettings(port, settings) {
  const response = await requestJson(port, 'POST', '/api/notemd/settings', { settings }, 90000);
  if (response.status !== 200 || !response.body || response.body.success !== true || !response.body.settings) {
    throw new Error(`failed to write NoteMD settings: status=${response.status} body=${JSON.stringify(response.body)}`);
  }
  return response.body.settings;
}

async function applyRuntimeProviderFixture(port, fixture) {
  const previousSettings = await readNotemdSettings(port);
  const providerName = 'OpenAI Compatible';
  const providers = Array.isArray(previousSettings.providers)
    ? previousSettings.providers.map((provider) => ({ ...provider }))
    : [];
  const fixtureProvider = {
    name: providerName,
    apiKey: 'runtime-fixture-key',
    baseUrl: fixture.baseUrl,
    model: 'rag-fixture-model',
    temperature: 0,
    enabled: true,
  };
  const providerIndex = providers.findIndex((provider) => provider && provider.name === providerName);
  if (providerIndex >= 0) {
    providers[providerIndex] = {
      ...providers[providerIndex],
      ...fixtureProvider,
    };
  } else {
    providers.push(fixtureProvider);
  }
  await writeNotemdSettings(port, {
    ...previousSettings,
    activeProvider: providerName,
    useMultiModelSettings: false,
    enableGlobalCustomPrompts: false,
    providers,
  });
  return previousSettings;
}

function collectFlagValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag || !args[index + 1]) {
      continue;
    }
    values.push(String(args[index + 1]).trim());
  }
  return values.filter(Boolean);
}

function buildConversationSessionId(prefix, value) {
  return `${prefix}_${Buffer.from(String(value || '')).toString('hex').slice(0, 24)}`;
}

function buildConversationRequest(activeTarget, query, options = {}) {
  const request = {
    userId: 'runtime_verify_user',
    sessionId: buildConversationSessionId('runtime_verify_session', `${activeTarget}:${query}`),
    activeTarget,
    message: query,
    persistMemory: false,
  };
  const topK = Number(options.topK);
  if (Number.isInteger(topK) && topK > 0) {
    request.topK = topK;
  }
  return request;
}

function countRagSourceDecisionStatuses(ragContextPack) {
  const decisions = Array.isArray(ragContextPack && ragContextPack.sourceDecisions)
    ? ragContextPack.sourceDecisions
    : [];
  return decisions.reduce((counts, decision) => {
    const status = String(decision && decision.status || '').trim();
    if (!status) {
      return counts;
    }
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function countFullDocumentRagFragmentsByRole(ragContextPack) {
  const fragments = Array.isArray(ragContextPack && ragContextPack.fragments)
    ? ragContextPack.fragments
    : [];
  return fragments.reduce((counts, fragment) => {
    if (String(fragment && fragment.sourceBoundary || '') !== 'full_document') {
      return counts;
    }
    const role = String(fragment && fragment.role || '').trim();
    if (!role) {
      return counts;
    }
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});
}

function assertReasonFragments(query, label, observedReasons, requiredFragments) {
  if (!Array.isArray(requiredFragments) || requiredFragments.length <= 0) {
    return;
  }
  const reasons = Array.isArray(observedReasons)
    ? observedReasons.map((reason) => String(reason || ''))
    : [];
  requiredFragments.forEach((fragment) => {
    const expectedFragment = String(fragment || '').trim();
    if (!expectedFragment) {
      return;
    }
    if (!reasons.some((reason) => reason.includes(expectedFragment))) {
      throw new Error(
        `${label} missing reason fragment "${expectedFragment}" for query=${query}: reasons=${JSON.stringify(reasons)}`
      );
    }
  });
}

function collectGraphSuccessorWindowTitles(graphContext) {
  const successorWindow = Array.isArray(graphContext && graphContext.successorWindow)
    ? graphContext.successorWindow
    : [];
  return successorWindow
    .map((node) => String(node && node.title || '').trim())
    .filter(Boolean);
}

function collectGraphSuccessorWindowRelationKinds(graphContext) {
  const successorWindow = Array.isArray(graphContext && graphContext.successorWindow)
    ? graphContext.successorWindow
    : [];
  return successorWindow
    .map((node) => String(node && node.relationKind || '').trim())
    .filter(Boolean);
}

function collectGraphNeighborFragmentTitles(ragContextPack) {
  const fragments = Array.isArray(ragContextPack && ragContextPack.fragments)
    ? ragContextPack.fragments
    : [];
  return fragments
    .filter((fragment) => String(fragment && fragment.role || '') === 'graph_neighbor_support')
    .map((fragment) => String(fragment && fragment.title || '').trim())
    .filter(Boolean);
}

function graphDiagnostics(graphContext) {
  return graphContext && graphContext.diagnostics && typeof graphContext.diagnostics === 'object'
    ? graphContext.diagnostics
    : {};
}

function assertMinimumGraphDiagnosticCount(query, graphContext, fieldName, minimumCount) {
  if (typeof minimumCount !== 'number') {
    return;
  }
  const diagnostics = graphDiagnostics(graphContext);
  const observed = Number(diagnostics[fieldName] || 0);
  if (!Number.isFinite(observed) || observed < minimumCount) {
    throw new Error(
      `graph diagnostic ${fieldName} below minimum for query=${query}: expected>=${minimumCount} observed=${observed} graphContext=${JSON.stringify(graphContext)}`
    );
  }
}

function assertGraphDiagnosticBoolean(query, graphContext, fieldName, expectedValue) {
  if (typeof expectedValue !== 'boolean') {
    return;
  }
  const diagnostics = graphDiagnostics(graphContext);
  const observed = diagnostics[fieldName] === true;
  if (observed !== expectedValue) {
    throw new Error(
      `graph diagnostic ${fieldName} mismatch for query=${query}: expected=${expectedValue} observed=${observed} graphContext=${JSON.stringify(graphContext)}`
    );
  }
}

function collectRagSourceDecisionReasons(ragContextPack) {
  const decisions = Array.isArray(ragContextPack && ragContextPack.sourceDecisions)
    ? ragContextPack.sourceDecisions
    : [];
  return decisions
    .map((decision) => String(decision && decision.reason || '').trim())
    .filter(Boolean);
}

function loadConversationRegressionCases(caseIds) {
  const modulePath = path.join(
    process.cwd(),
    'dist',
    'src',
    'learning',
    'KnowledgeWorkspaceConversationRegression.js'
  );
  const regressionModule = require(modulePath);
  const selector = typeof regressionModule.selectKnowledgeWorkspaceConversationRegressionCases === 'function'
    ? regressionModule.selectKnowledgeWorkspaceConversationRegressionCases
    : null;
  if (!selector) {
    throw new Error(`regression corpus selector missing at ${modulePath}`);
  }
  return selector(caseIds);
}

function runIsolatedFullRegressionGroups(regressionCases) {
  const groupsByPreloadTargets = new Map();
  regressionCases.forEach((regressionCase) => {
    const preloadTargets = Array.from(new Set(regressionCase.preloadTargets || [])).sort();
    const groupKey = JSON.stringify(preloadTargets);
    const group = groupsByPreloadTargets.get(groupKey) || {
      preloadTargets,
      caseIds: [],
    };
    group.caseIds.push(regressionCase.id);
    groupsByPreloadTargets.set(groupKey, group);
  });

  const groups = Array.from(groupsByPreloadTargets.values());
  groups.forEach((group, index) => {
    console.log(
      `[verify-knowledge-workspace-runtime] isolated-group=${index + 1}/${groups.length} targets=${group.preloadTargets.join(',')} cases=${group.caseIds.length}`
    );
    const childArguments = [
      __filename,
      '--full',
      '--runtime-case-group',
      ...group.caseIds.flatMap((caseId) => ['--case', caseId]),
    ];
    const child = spawnSync(process.execPath, childArguments, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
    if (child.error) {
      throw child.error;
    }
    if (child.status !== 0) {
      throw new Error(
        `isolated regression group failed: targets=${group.preloadTargets.join(',')} status=${child.status} signal=${child.signal || 'none'}`
      );
    }
  });

  console.log(JSON.stringify({
    ok: true,
    mode: 'full',
    execution: 'isolated_preload_target_groups',
    groupCount: groups.length,
    caseCount: regressionCases.length,
  }, null, 2));
}

async function countMarkdownFiles(directoryPath) {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      count += await countMarkdownFiles(entryPath);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
      count += 1;
    }
  }
  return count;
}

async function selectRuntimeRelationRecomputeMode(kbRoot, target) {
  const normalizedTarget = String(target || '').trim();
  const targetPath = normalizedTarget && normalizedTarget !== 'ALL_FOLDERS'
    ? path.join(kbRoot, normalizedTarget)
    : kbRoot;
  const documentCount = await countMarkdownFiles(targetPath);
  return {
    documentCount,
    relationRecomputeMode: documentCount >= LARGE_TARGET_DOCUMENT_THRESHOLD ? 'none' : 'incremental',
  };
}

async function buildTarget(port, target, relationRecomputeMode) {
  const buildResponse = await requestJson(
    port,
    'POST',
    '/api/build',
    { target, relationRecomputeMode },
    900000
  );
  if (buildResponse.status !== 200 || !buildResponse.body || buildResponse.body.success !== true) {
    throw new Error(`build failed for target=${target}: status=${buildResponse.status} body=${JSON.stringify(buildResponse.body)}`);
  }
  return buildResponse.body;
}

async function restoreTarget(port, target, relationRecomputeMode) {
  const restoreResponse = await requestJson(
    port,
    'GET',
    `/api/restore-cache?target=${encodeURIComponent(target)}&relationRecomputeMode=${encodeURIComponent(relationRecomputeMode)}`,
    undefined,
    900000
  );
  if (restoreResponse.status !== 200 || !restoreResponse.body || restoreResponse.body.success !== true) {
    throw new Error(`restore-cache failed for target=${target}: status=${restoreResponse.status} body=${JSON.stringify(restoreResponse.body)}`);
  }
  return restoreResponse.body;
}

function validatePositiveConversationResult(summary, options) {
  const {
    query,
    target,
    expectedScopeSource,
    expectedMinCitations,
    expectedPlannerTitleLikeQueries,
    expectedRetrievalModes,
    expectedPrimarySourcePath,
    expectedRecoveredSourcePaths,
    expectedAnswerReleaseDecision,
    acceptedAnswerReleaseDecisions,
    requiredFailedGateIds,
    answerMustContain,
    answerMustCoverConcepts,
    answerMustNotContain,
    expectedRagSourceBoundary,
    expectedRagBudget,
    requiredRagRoles,
    minimumRagFullDocumentFragmentCounts,
    acceptedRagSufficiencyStatuses,
    minimumRagSourceDecisionStatusCounts,
    expectedRagDeterministic,
    expectedRagLlmJudgeUsed,
    expectedRagRecoveryAttempted,
    acceptedRagDegradationStates,
    requiredRagFailureStages,
    minimumRagRecoveryBeforeSourceDecisionStatusCounts,
    requiredRagRecoveryBeforeReasonFragments,
    requiredRagSufficiencyReasonFragments,
    requiredRagSourceDecisionReasonFragments,
    requiredFirstGraphSuccessorTitle,
    requiredGraphSuccessorTitles,
    forbiddenGraphSuccessorTitles,
    requiredGraphSuccessorRelationKinds,
    forbiddenGraphNeighborFragmentTitles,
    minimumGraphIntentAlignedPredecessorCandidates,
    minimumGraphIntentAlignedSuccessorCandidates,
    minimumGraphIntentMisalignedPredecessorCandidates,
    minimumGraphIntentMisalignedSuccessorCandidates,
    expectedGraphUsedMisalignedPredecessorFallback,
    expectedGraphUsedMisalignedSuccessorFallback,
    requireScopedDocumentIds,
    requireCompleteGraphAnswerCoverage,
    requireGraphAnswerPlanOrder,
    requiredGraphAnswerRoles,
    requirePublicAnswerScaffoldingHygiene,
    requireNoDuplicatePublicClauses,
  } = options;
  const forbiddenFragments = Array.isArray(answerMustNotContain) && answerMustNotContain.length > 0
    ? answerMustNotContain
    : ['No scoped knowledge points matched', 'retrieval_candidates_below_threshold'];

  if (Number(summary.citationCount || 0) < Math.max(1, Number(expectedMinCitations || 1))) {
    throw new Error(`expected citations for query=${query}, got summary=${JSON.stringify(summary)}`);
  }
  if (!summary.workspaceReadiness || summary.workspaceReadiness.status !== 'ready') {
    throw new Error(`workspace readiness not ready for query=${query}: ${JSON.stringify(summary.workspaceReadiness)}`);
  }
  const usedScopeDocumentIds = summary.usedScope && Array.isArray(summary.usedScope.documentIds)
    ? summary.usedScope.documentIds
    : [];
  const usedScopePathPrefixes = summary.usedScope && Array.isArray(summary.usedScope.sourcePathPrefixes)
    ? summary.usedScope.sourcePathPrefixes
    : [];
  if (requireScopedDocumentIds !== false && usedScopeDocumentIds.length <= 0) {
    throw new Error(`used scope is missing scoped documentIds for query=${query}: ${JSON.stringify(summary.usedScope)}`);
  }
  if (
    requireScopedDocumentIds === false
    && usedScopeDocumentIds.length <= 0
    && usedScopePathPrefixes.length <= 0
    && !summary.usedScope.workspaceId
    && !summary.usedScope.corpusId
  ) {
    throw new Error(`used scope is missing a scoped boundary for query=${query}: ${JSON.stringify(summary.usedScope)}`);
  }
  if (expectedScopeSource && String(summary.usedScope.scopeSource || '') !== String(expectedScopeSource)) {
    throw new Error(`used scope source mismatch for query=${query}: expected=${expectedScopeSource} actual=${JSON.stringify(summary.usedScope)}`);
  }
  const answer = String(summary.answer || '');
  const answerDiagnostics = () => ({
    knowledgePointTitles: Array.isArray(summary.knowledgePoints)
      ? summary.knowledgePoints.map((point) => String(point && point.title || ''))
      : [],
    ragFragments: Array.isArray(summary.ragContextPack && summary.ragContextPack.fragments)
      ? summary.ragContextPack.fragments.map((entry) => ({
        role: entry && entry.role,
        title: entry && entry.title,
        score: entry && entry.score,
        text: String(entry && entry.text || '').slice(0, 220),
      }))
      : [],
    graphClaims: Array.isArray(summary.graphAnswerPlan && summary.graphAnswerPlan.claims)
      ? summary.graphAnswerPlan.claims.map((claim) => ({
        role: claim && claim.role,
        required: claim && claim.required,
        statement: claim && claim.statement,
      }))
      : [],
  });
  if (Array.isArray(answerMustContain) && answerMustContain.length > 0) {
    const normalizedAnswer = answer.toLowerCase();
    answerMustContain.forEach((fragment) => {
      const expectedFragment = String(fragment || '');
      if (!answer.includes(expectedFragment) && !normalizedAnswer.includes(expectedFragment.toLowerCase())) {
        throw new Error(`conversation answer missing "${fragment}" for query=${query}: ${answer}; diagnostics=${JSON.stringify(answerDiagnostics())}`);
      }
    });
  }
  if (Array.isArray(answerMustCoverConcepts) && answerMustCoverConcepts.length > 0) {
    const { semanticFeatures } = require('../dist/src/learning/graphClaimMatcher.js');
    const answerFeatures = new Set(semanticFeatures(answer));
    answerMustCoverConcepts.forEach((concept) => {
      const expectedFeature = String(concept || '').startsWith('concept:')
        ? String(concept || '')
        : `concept:${String(concept || '')}`;
      if (!answerFeatures.has(expectedFeature)) {
        throw new Error(`conversation answer missing semantic feature "${expectedFeature}" for query=${query}: ${answer}; diagnostics=${JSON.stringify(answerDiagnostics())}`);
      }
    });
  }
  if (Array.isArray(requiredGraphAnswerRoles) && requiredGraphAnswerRoles.length > 0) {
    const plannedRequiredRoles = new Set(
      Array.isArray(summary.graphAnswerPlan && summary.graphAnswerPlan.claims)
        ? summary.graphAnswerPlan.claims
          .filter((claim) => claim && claim.required)
          .map((claim) => String(claim.role || ''))
        : []
    );
    requiredGraphAnswerRoles.forEach((role) => {
      if (!plannedRequiredRoles.has(String(role || ''))) {
        throw new Error(`graph answer plan missing required role "${role}" for query=${query}: ${JSON.stringify(answerDiagnostics())}`);
      }
    });
  }
  forbiddenFragments.forEach((fragment) => {
    if (answer.includes(fragment)) {
      throw new Error(`conversation leaked "${fragment}" into the public answer for query=${query}: ${answer}`);
    }
  });
  if (requirePublicAnswerScaffoldingHygiene === true && /(?:\*\*|(?:^|\s)\*\s+(?=\$|\*\*|[\u3400-\u9fff]))/u.test(answer)) {
    throw new Error(`conversation leaked Markdown list/bold scaffolding for query=${query}: ${answer}`);
  }
  if (requireNoDuplicatePublicClauses === true) {
    const clauses = answer
      .split(/(?<=[.!?。！？])\s+/u)
      .map((clause) => clause.replace(/\s+/g, '').toLowerCase())
      .filter((clause) => clause.length >= 24);
    const duplicateClause = clauses.find((clause, index) => clauses.indexOf(clause) !== index);
    if (duplicateClause) {
      throw new Error(`conversation repeated a public clause for query=${query}: ${answer}`);
    }
  }
  if (!summary.answerReleaseReview || typeof summary.answerReleaseReview !== 'object') {
    throw new Error(`conversation did not return answerReleaseReview for query=${query}: ${JSON.stringify(summary)}`);
  }
  if (String(summary.answerReleaseReview.publicAnswer || '') !== answer) {
    throw new Error(`answerReleaseReview/public answer mismatch for query=${query}: review=${JSON.stringify(summary.answerReleaseReview)} answer=${answer}`);
  }
  if (requireCompleteGraphAnswerCoverage === true) {
    const plan = summary.graphAnswerPlan;
    const coverage = summary.graphAnswerCoverage;
    const requiredClaimIds = Array.isArray(plan && plan.claims)
      ? plan.claims.filter((claim) => claim && claim.required === true).map((claim) => String(claim.claimId || ''))
      : [];
    const coveredClaimIds = new Set(Array.isArray(coverage && coverage.coveredClaimIds)
      ? coverage.coveredClaimIds.map((claimId) => String(claimId || ''))
      : []);
    const missingClaimIds = requiredClaimIds.filter((claimId) => !coveredClaimIds.has(claimId));
    if (!plan || !coverage || coverage.passed !== true || missingClaimIds.length > 0) {
      throw new Error(
        `graph answer coverage incomplete for query=${query}: required=${JSON.stringify(requiredClaimIds)} missing=${JSON.stringify(missingClaimIds)} coverage=${JSON.stringify(coverage)} plan=${JSON.stringify(plan)} releaseReview=${JSON.stringify(summary.answerReleaseReview)}`
      );
    }
  }
  if (requireGraphAnswerPlanOrder === true) {
    const requiredClaims = Array.isArray(summary.graphAnswerPlan && summary.graphAnswerPlan.claims)
      ? summary.graphAnswerPlan.claims.filter((claim) => claim && claim.required === true)
      : [];
    const normalizedAnswer = answer.replace(/\s+/g, ' ').trim();
    const positions = requiredClaims.map((claim) => ({
      claimId: String(claim.claimId || ''),
      position: normalizedAnswer.indexOf(String(claim.statement || '').replace(/\s+/g, ' ').trim()),
    }));
    const missingOrderedClaims = positions.filter((entry) => entry.position < 0);
    const outOfOrder = positions.some((entry, index) => index > 0 && entry.position < positions[index - 1].position);
    if (missingOrderedClaims.length > 0 || outOfOrder) {
      throw new Error(
        `graph answer plan order not realized for query=${query}: positions=${JSON.stringify(positions)} answer=${answer}`
      );
    }
  }
  if (
    expectedAnswerReleaseDecision
    && String(summary.answerReleaseReview.decision || '') !== String(expectedAnswerReleaseDecision)
  ) {
    throw new Error(
      `answerReleaseReview decision mismatch for query=${query}: expected=${expectedAnswerReleaseDecision} actual=${JSON.stringify(summary.answerReleaseReview)}`
    );
  }
  if (
    !expectedAnswerReleaseDecision
    && Array.isArray(acceptedAnswerReleaseDecisions)
    && acceptedAnswerReleaseDecisions.length > 0
  ) {
    const observedDecision = String(summary.answerReleaseReview.decision || '');
    const normalizedAcceptedDecisions = acceptedAnswerReleaseDecisions.map((entry) => String(entry || ''));
    if (!normalizedAcceptedDecisions.includes(observedDecision)) {
      throw new Error(
        `answerReleaseReview decision outside accepted set for query=${query}: accepted=${JSON.stringify(normalizedAcceptedDecisions)} actual=${JSON.stringify(summary.answerReleaseReview)}`
      );
    }
  }
  if (Array.isArray(requiredFailedGateIds) && requiredFailedGateIds.length > 0) {
    const failedGateIds = Array.isArray(summary.answerReleaseReview.failedGateIds)
      ? summary.answerReleaseReview.failedGateIds
      : [];
    requiredFailedGateIds.forEach((gateId) => {
      if (!failedGateIds.includes(gateId)) {
        throw new Error(
          `answerReleaseReview failedGateIds missing "${gateId}" for query=${query}: actual=${JSON.stringify(summary.answerReleaseReview)}`
        );
      }
    });
  }
  if (summary.missDiagnostics && summary.missDiagnostics.reason === 'retrieval_candidates_below_threshold') {
    throw new Error(`conversation still fell below retrieval threshold for query=${query}: ${JSON.stringify(summary.missDiagnostics)}`);
  }
  if (expectedRagSourceBoundary) {
    if (!summary.ragContextPack || String(summary.ragContextPack.sourceBoundary || '') !== String(expectedRagSourceBoundary)) {
      throw new Error(`RAG source boundary mismatch for query=${query}: expected=${expectedRagSourceBoundary} actual=${JSON.stringify(summary.ragContextPack)}`);
    }
    if (!/^ragctx_[a-f0-9]{16}$/.test(String(summary.ragContextPack.replayId || ''))) {
      throw new Error(`RAG replay id missing or invalid for query=${query}: actual=${JSON.stringify(summary.ragContextPack)}`);
    }
  }
  if (expectedRagBudget && typeof expectedRagBudget === 'object') {
    const observedBudget = summary.ragContextPack && summary.ragContextPack.budget
      ? summary.ragContextPack.budget
      : null;
    ['maxFragments', 'maxCharsPerFragment', 'maxTotalChars'].forEach((field) => {
      if (typeof expectedRagBudget[field] !== 'number') {
        return;
      }
      if (!observedBudget || Number(observedBudget[field]) !== Number(expectedRagBudget[field])) {
        throw new Error(
          `RAG budget mismatch for query=${query}: field=${field} expected=${expectedRagBudget[field]} actual=${JSON.stringify(observedBudget)}`
        );
      }
    });
  }
  if (Array.isArray(requiredRagRoles) && requiredRagRoles.length > 0) {
    const observedRoles = Array.isArray(summary.ragContextPack && summary.ragContextPack.fragments)
      ? summary.ragContextPack.fragments.map((fragment) => String(fragment && fragment.role || '')).filter(Boolean)
      : [];
    requiredRagRoles.forEach((role) => {
      if (!observedRoles.includes(role)) {
        throw new Error(`RAG fragment role missing "${role}" for query=${query}: observed=${JSON.stringify(observedRoles)}`);
      }
    });
  }
  if (
    minimumRagFullDocumentFragmentCounts
    && typeof minimumRagFullDocumentFragmentCounts === 'object'
  ) {
    const observedFullDocumentFragmentCounts = countFullDocumentRagFragmentsByRole(summary.ragContextPack);
    Object.entries(minimumRagFullDocumentFragmentCounts).forEach(([role, minimumCount]) => {
      const expectedMinimum = Number(minimumCount || 0);
      const observedCount = Number(observedFullDocumentFragmentCounts[role] || 0);
      if (observedCount < expectedMinimum) {
        throw new Error(
          `RAG full-document fragment count below minimum for query=${query}: role=${role} expected>=${expectedMinimum} observed=${observedCount} pack=${JSON.stringify(summary.ragContextPack)}`
        );
      }
    });
  }
  if (Array.isArray(acceptedRagSufficiencyStatuses) && acceptedRagSufficiencyStatuses.length > 0) {
    const observedStatus = String(summary.ragSufficiencyReview && summary.ragSufficiencyReview.status || '');
    if (!acceptedRagSufficiencyStatuses.includes(observedStatus)) {
      throw new Error(
        `RAG sufficiency status outside accepted set for query=${query}: accepted=${JSON.stringify(acceptedRagSufficiencyStatuses)} actual=${JSON.stringify(summary.ragSufficiencyReview)}`
      );
    }
  }
  if (typeof expectedRagDeterministic === 'boolean') {
    const observed = Boolean(summary.ragSufficiencyReview && summary.ragSufficiencyReview.deterministic);
    if (observed !== expectedRagDeterministic) {
      throw new Error(
        `RAG deterministic flag mismatch for query=${query}: expected=${expectedRagDeterministic} actual=${JSON.stringify(summary.ragSufficiencyReview)}`
      );
    }
  }
  if (typeof expectedRagLlmJudgeUsed === 'boolean') {
    const observed = Boolean(summary.ragSufficiencyReview && summary.ragSufficiencyReview.llmJudgeUsed);
    if (observed !== expectedRagLlmJudgeUsed) {
      throw new Error(
        `RAG llmJudgeUsed flag mismatch for query=${query}: expected=${expectedRagLlmJudgeUsed} actual=${JSON.stringify(summary.ragSufficiencyReview)}`
      );
    }
  }
  if (typeof expectedRagRecoveryAttempted === 'boolean') {
    const observed = Boolean(summary.ragSufficiencyReview && summary.ragSufficiencyReview.recoveryAttempted);
    if (observed !== expectedRagRecoveryAttempted) {
      throw new Error(
        `RAG recoveryAttempted flag mismatch for query=${query}: expected=${expectedRagRecoveryAttempted} actual=${JSON.stringify(summary.ragSufficiencyReview)}`
      );
    }
  }
  if (Array.isArray(acceptedRagDegradationStates) && acceptedRagDegradationStates.length > 0) {
    const observed = String(summary.ragSufficiencyReview && summary.ragSufficiencyReview.degradationState || '');
    if (!acceptedRagDegradationStates.includes(observed)) {
      throw new Error(
        `RAG degradation state outside accepted set for query=${query}: accepted=${JSON.stringify(acceptedRagDegradationStates)} actual=${JSON.stringify(summary.ragSufficiencyReview)}`
      );
    }
  }
  if (Array.isArray(requiredRagFailureStages) && requiredRagFailureStages.length > 0) {
    const observedStages = Array.isArray(summary.ragFailureClassifications)
      ? summary.ragFailureClassifications
        .map((classification) => String(classification && classification.stage || '').trim())
        .filter(Boolean)
      : [];
    requiredRagFailureStages.forEach((stage) => {
      if (!observedStages.includes(stage)) {
        throw new Error(
          `RAG failure stage missing "${stage}" for query=${query}: observed=${JSON.stringify(observedStages)} classifications=${JSON.stringify(summary.ragFailureClassifications)}`
        );
      }
    });
  }
  if (
    minimumRagSourceDecisionStatusCounts
    && typeof minimumRagSourceDecisionStatusCounts === 'object'
  ) {
    const observedDecisionCounts = countRagSourceDecisionStatuses(summary.ragContextPack);
    Object.entries(minimumRagSourceDecisionStatusCounts).forEach(([status, minimumCount]) => {
      const expectedMinimum = Number(minimumCount || 0);
      const observedCount = Number(observedDecisionCounts[status] || 0);
      if (observedCount < expectedMinimum) {
        throw new Error(
          `RAG source decision status count below minimum for query=${query}: status=${status} expected>=${expectedMinimum} observed=${observedCount} pack=${JSON.stringify(summary.ragContextPack)}`
        );
      }
    });
  }
  if (
    minimumRagRecoveryBeforeSourceDecisionStatusCounts
    && typeof minimumRagRecoveryBeforeSourceDecisionStatusCounts === 'object'
  ) {
    const observedDecisionCounts = summary.ragRecovery && typeof summary.ragRecovery === 'object'
      ? (summary.ragRecovery.beforeSourceDecisionStatusCounts || {})
      : {};
    Object.entries(minimumRagRecoveryBeforeSourceDecisionStatusCounts).forEach(([status, minimumCount]) => {
      const expectedMinimum = Number(minimumCount || 0);
      const observedCount = Number(observedDecisionCounts[status] || 0);
      if (observedCount < expectedMinimum) {
        throw new Error(
          `RAG recovery-before source decision status count below minimum for query=${query}: status=${status} expected>=${expectedMinimum} observed=${observedCount} recovery=${JSON.stringify(summary.ragRecovery)}`
        );
      }
    });
  }
  assertReasonFragments(
    query,
    'RAG recovery-before review',
    summary.ragRecovery && summary.ragRecovery.beforeReasons,
    requiredRagRecoveryBeforeReasonFragments
  );
  assertReasonFragments(
    query,
    'RAG sufficiency review',
    summary.ragSufficiencyReview && summary.ragSufficiencyReview.reasons,
    requiredRagSufficiencyReasonFragments
  );
  assertReasonFragments(
    query,
    'RAG source decisions',
    collectRagSourceDecisionReasons(summary.ragContextPack),
    requiredRagSourceDecisionReasonFragments
  );
  const graphSuccessorTitles = collectGraphSuccessorWindowTitles(summary.graphContext);
  const graphSuccessorRelationKinds = collectGraphSuccessorWindowRelationKinds(summary.graphContext);
  if (requiredFirstGraphSuccessorTitle) {
    const firstTitle = graphSuccessorTitles[0] || '';
    if (firstTitle !== requiredFirstGraphSuccessorTitle) {
      throw new Error(
        `graph successor first title mismatch for query=${query}: expected=${requiredFirstGraphSuccessorTitle} actual=${JSON.stringify(graphSuccessorTitles)} graphContext=${JSON.stringify(summary.graphContext)}`
      );
    }
  }
  if (Array.isArray(requiredGraphSuccessorTitles) && requiredGraphSuccessorTitles.length > 0) {
    requiredGraphSuccessorTitles.forEach((title) => {
      if (!graphSuccessorTitles.includes(title)) {
        throw new Error(
          `graph successor title missing "${title}" for query=${query}: actual=${JSON.stringify(graphSuccessorTitles)} graphContext=${JSON.stringify(summary.graphContext)}`
        );
      }
    });
  }
  if (Array.isArray(forbiddenGraphSuccessorTitles) && forbiddenGraphSuccessorTitles.length > 0) {
    forbiddenGraphSuccessorTitles.forEach((title) => {
      if (graphSuccessorTitles.includes(title)) {
        throw new Error(
          `graph successor title should not be selected "${title}" for query=${query}: actual=${JSON.stringify(graphSuccessorTitles)} graphContext=${JSON.stringify(summary.graphContext)}`
        );
      }
    });
  }
  if (Array.isArray(requiredGraphSuccessorRelationKinds) && requiredGraphSuccessorRelationKinds.length > 0) {
    requiredGraphSuccessorRelationKinds.forEach((relationKind) => {
      if (!graphSuccessorRelationKinds.includes(relationKind)) {
        throw new Error(
          `graph successor relation kind missing "${relationKind}" for query=${query}: actual=${JSON.stringify(graphSuccessorRelationKinds)} graphContext=${JSON.stringify(summary.graphContext)}`
        );
      }
    });
  }
  if (Array.isArray(forbiddenGraphNeighborFragmentTitles) && forbiddenGraphNeighborFragmentTitles.length > 0) {
    const graphNeighborFragmentTitles = collectGraphNeighborFragmentTitles(summary.ragContextPack);
    forbiddenGraphNeighborFragmentTitles.forEach((title) => {
      if (graphNeighborFragmentTitles.includes(title)) {
        throw new Error(
          `RAG graph-neighbor fragment title should not be selected "${title}" for query=${query}: actual=${JSON.stringify(graphNeighborFragmentTitles)} pack=${JSON.stringify(summary.ragContextPack)}`
        );
      }
    });
  }
  assertMinimumGraphDiagnosticCount(
    query,
    summary.graphContext,
    'intentAlignedPredecessorCandidateCount',
    minimumGraphIntentAlignedPredecessorCandidates
  );
  assertMinimumGraphDiagnosticCount(
    query,
    summary.graphContext,
    'intentAlignedSuccessorCandidateCount',
    minimumGraphIntentAlignedSuccessorCandidates
  );
  assertMinimumGraphDiagnosticCount(
    query,
    summary.graphContext,
    'intentMisalignedPredecessorCandidateCount',
    minimumGraphIntentMisalignedPredecessorCandidates
  );
  assertMinimumGraphDiagnosticCount(
    query,
    summary.graphContext,
    'intentMisalignedSuccessorCandidateCount',
    minimumGraphIntentMisalignedSuccessorCandidates
  );
  assertGraphDiagnosticBoolean(
    query,
    summary.graphContext,
    'usedIntentMisalignedPredecessorFallback',
    expectedGraphUsedMisalignedPredecessorFallback
  );
  assertGraphDiagnosticBoolean(
    query,
    summary.graphContext,
    'usedIntentMisalignedSuccessorFallback',
    expectedGraphUsedMisalignedSuccessorFallback
  );
  if (
    Array.isArray(expectedPlannerTitleLikeQueries)
    && expectedPlannerTitleLikeQueries.length > 0
  ) {
    const plannerTitleLikeQueries = Array.isArray(summary.planner && summary.planner.titleLikeQueries)
      ? summary.planner.titleLikeQueries
      : [];
    expectedPlannerTitleLikeQueries.forEach((entry) => {
      if (!plannerTitleLikeQueries.includes(entry)) {
        throw new Error(`planner titleLikeQueries missing "${entry}" for query=${query}: ${JSON.stringify(summary.planner)}`);
      }
    });
  }
  if (Array.isArray(expectedRetrievalModes) && expectedRetrievalModes.length > 0) {
    const retrievalModes = Array.isArray(summary.retrievalModes) ? summary.retrievalModes : [];
    expectedRetrievalModes.forEach((entry) => {
      if (!retrievalModes.includes(entry)) {
        throw new Error(`retrievalModes missing "${entry}" for query=${query}: ${JSON.stringify(retrievalModes)}`);
      }
    });
  }
  const citationSourcePaths = Array.isArray(summary.citations)
    ? summary.citations.map((entry) => String(entry && entry.sourcePath || '').trim()).filter(Boolean)
    : [];
  const knowledgePointSourcePaths = Array.isArray(summary.knowledgePoints)
    ? summary.knowledgePoints.map((entry) => String(entry && entry.sourcePath || '').trim()).filter(Boolean)
    : [];
  const observedSourcePaths = Array.from(new Set([
    ...citationSourcePaths,
    ...knowledgePointSourcePaths,
  ]));
  if (expectedPrimarySourcePath && !observedSourcePaths.includes(expectedPrimarySourcePath)) {
    throw new Error(`primary source path mismatch for query=${query}: expected=${expectedPrimarySourcePath} observed=${JSON.stringify(observedSourcePaths)}`);
  }
  if (Array.isArray(expectedRecoveredSourcePaths) && expectedRecoveredSourcePaths.length > 0) {
    const recoveredSourcePaths = Array.isArray(summary.scopeRecovery && summary.scopeRecovery.recoveredSourcePaths)
      ? summary.scopeRecovery.recoveredSourcePaths
      : [];
    expectedRecoveredSourcePaths.forEach((entry) => {
      if (!recoveredSourcePaths.includes(entry)) {
        throw new Error(`scope recovery source path mismatch for query=${query}: expected=${entry} actual=${JSON.stringify(summary.scopeRecovery)}`);
      }
    });
  }
  if (!summary.usedScope || String(summary.usedScope.source || '').trim().toLowerCase() !== 'scoped') {
    throw new Error(`used scope source kind mismatch for query=${query}: ${JSON.stringify(summary.usedScope)}`);
  }
  if (
    expectedScopeSource === 'explicit_request'
    && String(summary.usedScope.workspaceId || '').trim().toLowerCase() !== String(target || '').trim().toLowerCase()
  ) {
    throw new Error(`workspace scope mismatch for query=${query}: expected=${target} actual=${JSON.stringify(summary.usedScope)}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--full') ? 'full' : 'conversation';
  const requestedCaseIds = collectFlagValues(args, '--case');
  const targetArgIndex = args.findIndex((arg) => arg === '--target');
  const hasExplicitTarget = targetArgIndex >= 0 && Boolean(args[targetArgIndex + 1]);
  const target = hasExplicitTarget
    ? String(args[targetArgIndex + 1]).trim()
    : 'waterglass';
  const explicitQueries = collectFlagValues(args, '--query');
  const isRuntimeCaseGroup = args.includes('--runtime-case-group');
  if (
    mode === 'full'
    && requestedCaseIds.length === 0
    && !hasExplicitTarget
    && explicitQueries.length === 0
    && !isRuntimeCaseGroup
  ) {
    runIsolatedFullRegressionGroups(loadConversationRegressionCases([]));
    return;
  }
  const projectRoot = process.cwd();
  const frontendDir = path.join(projectRoot, 'dist', 'src', 'frontend');
  const kbRoot = path.join(projectRoot, 'Knowledge_Base');
  const runtimeDataDir = makeTempDir('noteconnection-knowledge-workspace-runtime');
  const runtimeConfigDir = path.join(runtimeDataDir, 'config');
  const port = await getFreePort();
  const bridgePort = await getFreePort();

  process.env.NOTE_CONNECTION_PROJECT_ROOT = projectRoot;
  process.env.NOTE_CONNECTION_FRONTEND_DIR = frontendDir;
  process.env.NOTE_CONNECTION_KB_ROOT = kbRoot;
  process.env.NOTE_CONNECTION_RUNTIME_DATA_DIR = runtimeDataDir;
  process.env.NOTE_CONNECTION_CONFIG_DIR = runtimeConfigDir;
  process.env.NOTE_CONNECTION_PORT = String(port);
  process.env.NOTE_CONNECTION_BRIDGE_PORT = String(bridgePort);

  const serverModule = require('../dist/src/server.js');
  console.log(`[verify-knowledge-workspace-runtime] start server mode=${mode} target=${target}`);
  const server = await serverModule.startServer({ port });

  try {
    const adHocQueries = explicitQueries.length > 0
      ? explicitQueries
      : (
        requestedCaseIds.length <= 0 && hasExplicitTarget
          ? (
            String(target || '').trim().toLowerCase() === 'waterglass'
              ? ['什么是waterglass?', '什么是water glass']
              : ['什么是water glass']
          )
          : []
      );

    if (adHocQueries.length > 0) {
      let buildResponse = null;
      let restoreResponse = null;
      if (mode === 'full') {
        const relationPolicy = await selectRuntimeRelationRecomputeMode(kbRoot, target);
        console.log(`[verify-knowledge-workspace-runtime] step=build relationRecomputeMode=${relationPolicy.relationRecomputeMode} markdownFiles=${relationPolicy.documentCount}`);
        buildResponse = await buildTarget(port, target, relationPolicy.relationRecomputeMode);
        console.log(`[verify-knowledge-workspace-runtime] step=restore-cache relationRecomputeMode=${relationPolicy.relationRecomputeMode}`);
        restoreResponse = await restoreTarget(port, target, relationPolicy.relationRecomputeMode);
      }

      const conversations = [];
      for (const query of adHocQueries) {
        console.log(`[verify-knowledge-workspace-runtime] step=conversation query=${query}`);
        const conversationResponse = await requestJson(
          port,
          'POST',
          '/api/knowledge/conversation',
          buildConversationRequest(target, query),
          90000
        );
        if (conversationResponse.status !== 200 || !conversationResponse.body || !conversationResponse.body.success) {
          throw new Error(`conversation failed for query=${query}: status=${conversationResponse.status} body=${JSON.stringify(conversationResponse.body)}`);
        }

        const result = conversationResponse.body.result || {};
        const citations = Array.isArray(result.citations) ? result.citations : [];
        const knowledgePoints = Array.isArray(result.knowledgePoints) ? result.knowledgePoints : [];
        const workspaceReadiness = result.trace && result.trace.workspaceReadiness ? result.trace.workspaceReadiness : null;
        const usedScope = result.trace && result.trace.usedScope ? result.trace.usedScope : null;
        const planner = result.trace && result.trace.planner ? result.trace.planner : null;
        const retrievalTrace = result.trace && result.trace.retrieval ? result.trace.retrieval : null;
        const missDiagnostics = result.trace && result.trace.missDiagnostics ? result.trace.missDiagnostics : null;
        const answerReleaseReview = result.answerReleaseReview || (result.trace && result.trace.answerReleaseReview) || null;
        const ragContextPack = result.trace && result.trace.ragContextPack ? result.trace.ragContextPack : null;
        const ragSufficiencyReview = result.trace && result.trace.ragSufficiencyReview ? result.trace.ragSufficiencyReview : null;
        const ragRecovery = result.trace && result.trace.ragRecovery ? result.trace.ragRecovery : null;
        const ragFailureClassifications = result.trace && Array.isArray(result.trace.ragFailureClassifications)
          ? result.trace.ragFailureClassifications
          : [];
        const graphContext = result.trace && result.trace.graphContext ? result.trace.graphContext : null;
        const graphAnswerPlan = result.trace && result.trace.graphAnswerPlan ? result.trace.graphAnswerPlan : null;
        const graphAnswerCoverage = result.trace && result.trace.graphAnswerCoverage ? result.trace.graphAnswerCoverage : null;

        const summary = {
          query,
          citationCount: citations.length,
          citations,
          knowledgePoints,
          topCitation: citations[0],
          workspaceReadiness,
          usedScope,
          planner,
          retrievalModes: Array.isArray(retrievalTrace && retrievalTrace.retrievalModes)
            ? retrievalTrace.retrievalModes
            : [],
          scopeRecovery: retrievalTrace && retrievalTrace.scopeRecovery ? retrievalTrace.scopeRecovery : null,
          missDiagnostics,
          answerReleaseReview,
          graphContext,
          graphAnswerPlan,
          graphAnswerCoverage,
          ragContextPack,
          ragSufficiencyReview,
          ragRecovery,
          answer: result.answer,
        };
        validatePositiveConversationResult(summary, {
          query,
          target,
          expectedMinCitations: 1,
          answerMustNotContain: [
            'No scoped knowledge points matched',
            'retrieval_candidates_below_threshold',
            ...(String(target || '').trim().toLowerCase() === 'waterglass'
              ? ['库朗数', '特征速度', '网格尺寸']
              : []),
          ],
          answerMustContain: String(target || '').trim().toLowerCase() === 'waterglass'
            ? ['\\frac{\\partial T}{\\partial t}', 'n_1 \\sin(\\theta_1)']
            : undefined,
          requirePublicAnswerScaffoldingHygiene: String(target || '').trim().toLowerCase() === 'waterglass',
          requireNoDuplicatePublicClauses: String(target || '').trim().toLowerCase() === 'waterglass',
        });
        conversations.push(summary);
      }

      console.log(JSON.stringify({
        ok: true,
        mode,
        target,
        query: conversations[0] ? conversations[0].query : null,
        queries: adHocQueries,
        bridgePort,
        runtimeDataDir,
        build: buildResponse,
        restore: restoreResponse,
        conversation: conversations[0] || null,
        conversations,
      }, null, 2));
      return;
    }

    const regressionCases = loadConversationRegressionCases(requestedCaseIds);
    const preloadTargets = Array.from(new Set(
      regressionCases.flatMap((entry) => Array.isArray(entry.preloadTargets) ? entry.preloadTargets : [])
    ));
    const buildResults = {};
    const relationPolicies = {};
    if (mode === 'full') {
      for (const preloadTarget of preloadTargets) {
        const relationPolicy = await selectRuntimeRelationRecomputeMode(kbRoot, preloadTarget);
        relationPolicies[preloadTarget] = relationPolicy;
        console.log(`[verify-knowledge-workspace-runtime] step=build target=${preloadTarget} relationRecomputeMode=${relationPolicy.relationRecomputeMode} markdownFiles=${relationPolicy.documentCount}`);
        buildResults[preloadTarget] = await buildTarget(
          port,
          preloadTarget,
          relationPolicy.relationRecomputeMode
        );
      }
    }

    const caseResults = [];
    const restoreResults = {};
    for (const regressionCase of regressionCases) {
      if (mode === 'full') {
        const relationPolicy = relationPolicies[regressionCase.activeTarget]
          || await selectRuntimeRelationRecomputeMode(kbRoot, regressionCase.activeTarget);
        console.log(`[verify-knowledge-workspace-runtime] step=restore-cache target=${regressionCase.activeTarget} relationRecomputeMode=${relationPolicy.relationRecomputeMode}`);
        restoreResults[regressionCase.id] = await restoreTarget(
          port,
          regressionCase.activeTarget,
          relationPolicy.relationRecomputeMode
        );
      }
      let runtimeProviderFixture = null;
      let previousNotemdSettings = null;
      const previousUnavailableSourcePaths = process.env.NOTE_CONNECTION_RAG_UNAVAILABLE_SOURCE_PATHS;
      try {
        if (regressionCase.runtimeProviderFixture) {
          runtimeProviderFixture = await startRuntimeProviderFixture(regressionCase.runtimeProviderFixture);
          previousNotemdSettings = await applyRuntimeProviderFixture(port, runtimeProviderFixture);
          console.log(`[verify-knowledge-workspace-runtime] step=provider-fixture case=${regressionCase.id} kind=${runtimeProviderFixture.kind} port=${runtimeProviderFixture.port}`);
        }
        if (
          Array.isArray(regressionCase.runtimeUnavailableSourcePaths)
          && regressionCase.runtimeUnavailableSourcePaths.length > 0
        ) {
          process.env.NOTE_CONNECTION_RAG_UNAVAILABLE_SOURCE_PATHS = regressionCase.runtimeUnavailableSourcePaths.join(';');
          console.log(`[verify-knowledge-workspace-runtime] step=source-unavailable-fixture case=${regressionCase.id} paths=${regressionCase.runtimeUnavailableSourcePaths.length}`);
        }
        console.log(`[verify-knowledge-workspace-runtime] step=conversation case=${regressionCase.id} query=${regressionCase.query}`);
        const conversationResponse = await requestJson(
          port,
          'POST',
          '/api/knowledge/conversation',
          buildConversationRequest(regressionCase.activeTarget, regressionCase.query, {
            topK: regressionCase.topK,
          }),
          90000
        );
        if (conversationResponse.status !== 200 || !conversationResponse.body || !conversationResponse.body.success) {
          throw new Error(`conversation failed for case=${regressionCase.id}: status=${conversationResponse.status} body=${JSON.stringify(conversationResponse.body)}`);
        }

        const result = conversationResponse.body.result || {};
        const citations = Array.isArray(result.citations) ? result.citations : [];
        const knowledgePoints = Array.isArray(result.knowledgePoints) ? result.knowledgePoints : [];
        const workspaceReadiness = result.trace && result.trace.workspaceReadiness ? result.trace.workspaceReadiness : null;
        const usedScope = result.trace && result.trace.usedScope ? result.trace.usedScope : null;
        const planner = result.trace && result.trace.planner ? result.trace.planner : null;
        const retrievalTrace = result.trace && result.trace.retrieval ? result.trace.retrieval : null;
        const missDiagnostics = result.trace && result.trace.missDiagnostics ? result.trace.missDiagnostics : null;
        const answerReleaseReview = result.answerReleaseReview || (result.trace && result.trace.answerReleaseReview) || null;
        const ragContextPack = result.trace && result.trace.ragContextPack ? result.trace.ragContextPack : null;
        const ragSufficiencyReview = result.trace && result.trace.ragSufficiencyReview ? result.trace.ragSufficiencyReview : null;
        const ragRecovery = result.trace && result.trace.ragRecovery ? result.trace.ragRecovery : null;
        const ragFailureClassifications = result.trace && Array.isArray(result.trace.ragFailureClassifications)
          ? result.trace.ragFailureClassifications
          : [];
        const graphContext = result.trace && result.trace.graphContext ? result.trace.graphContext : null;
        const graphAnswerPlan = result.trace && result.trace.graphAnswerPlan ? result.trace.graphAnswerPlan : null;
        const graphAnswerCoverage = result.trace && result.trace.graphAnswerCoverage ? result.trace.graphAnswerCoverage : null;

        const summary = {
          id: regressionCase.id,
          description: regressionCase.description,
          activeTarget: regressionCase.activeTarget,
          preloadTargets: regressionCase.preloadTargets,
          query: regressionCase.query,
          citationCount: citations.length,
          citations,
          knowledgePoints,
          topCitation: citations[0],
          workspaceReadiness,
          usedScope,
          planner,
          retrievalModes: Array.isArray(retrievalTrace && retrievalTrace.retrievalModes)
            ? retrievalTrace.retrievalModes
            : [],
          scopeRecovery: retrievalTrace && retrievalTrace.scopeRecovery ? retrievalTrace.scopeRecovery : null,
          missDiagnostics,
          answerReleaseReview,
          graphContext,
          graphAnswerPlan,
          graphAnswerCoverage,
          ragContextPack,
          ragSufficiencyReview,
          ragRecovery,
          ragFailureClassifications,
          runtimeProviderFixture: runtimeProviderFixture ? runtimeProviderFixture.summary() : null,
          answer: result.answer,
        };
        validatePositiveConversationResult(summary, {
          query: regressionCase.query,
          target: regressionCase.activeTarget,
          expectedScopeSource: regressionCase.expected.scopeSource,
          expectedMinCitations: regressionCase.expected.minCitations,
          expectedPlannerTitleLikeQueries: regressionCase.expected.plannerTitleLikeQueries,
          expectedRetrievalModes: regressionCase.expected.retrievalModes,
          expectedPrimarySourcePath: regressionCase.expected.primarySourcePath,
          expectedRecoveredSourcePaths: regressionCase.expected.recoveredSourcePaths,
          expectedAnswerReleaseDecision: regressionCase.expected.runtimeAnswerReleaseDecision
            || regressionCase.expected.answerReleaseDecision,
          acceptedAnswerReleaseDecisions: regressionCase.expected.acceptedAnswerReleaseDecisions,
          requiredFailedGateIds: regressionCase.expected.runtimeRequiredFailedGateIds,
          answerMustContain: regressionCase.expected.answerMustContain,
          answerMustCoverConcepts: regressionCase.expected.answerMustCoverConcepts,
          answerMustNotContain: regressionCase.expected.answerMustNotContain,
          expectedRagSourceBoundary: regressionCase.expected.ragSourceBoundary,
          expectedRagBudget: regressionCase.expected.expectedRagBudget,
          requiredRagRoles: regressionCase.expected.requiredRagRoles,
          acceptedRagSufficiencyStatuses: regressionCase.expected.runtimeAcceptedRagSufficiencyStatuses
            || regressionCase.expected.acceptedRagSufficiencyStatuses,
          minimumRagSourceDecisionStatusCounts: regressionCase.expected.minimumRagSourceDecisionStatusCounts,
          expectedRagDeterministic: regressionCase.expected.expectedRagDeterministic,
          expectedRagLlmJudgeUsed: regressionCase.expected.expectedRagLlmJudgeUsed,
          expectedRagRecoveryAttempted: regressionCase.expected.expectedRagRecoveryAttempted,
          acceptedRagDegradationStates: regressionCase.expected.runtimeAcceptedRagDegradationStates
            || regressionCase.expected.acceptedRagDegradationStates,
          requiredRagFailureStages: regressionCase.expected.runtimeRequiredRagFailureStages
            || regressionCase.expected.requiredRagFailureStages,
          requiredRagSufficiencyReasonFragments: regressionCase.expected.runtimeRequiredRagSufficiencyReasonFragments,
          requiredRagSourceDecisionReasonFragments: regressionCase.expected.runtimeRequiredRagSourceDecisionReasonFragments,
          minimumRagRecoveryBeforeSourceDecisionStatusCounts: regressionCase.expected.minimumRagRecoveryBeforeSourceDecisionStatusCounts,
          requiredRagRecoveryBeforeReasonFragments: regressionCase.expected.runtimeRequiredRagRecoveryBeforeReasonFragments
            || regressionCase.expected.requiredRagRecoveryBeforeReasonFragments,
          requiredFirstGraphSuccessorTitle: regressionCase.expected.requiredFirstGraphSuccessorTitle,
          requiredGraphSuccessorTitles: regressionCase.expected.requiredGraphSuccessorTitles,
          forbiddenGraphSuccessorTitles: regressionCase.expected.forbiddenGraphSuccessorTitles,
          requiredGraphSuccessorRelationKinds: regressionCase.expected.requiredGraphSuccessorRelationKinds,
          forbiddenGraphNeighborFragmentTitles: regressionCase.expected.forbiddenGraphNeighborFragmentTitles,
          minimumGraphIntentAlignedPredecessorCandidates: regressionCase.expected.minimumGraphIntentAlignedPredecessorCandidates,
          minimumGraphIntentAlignedSuccessorCandidates: regressionCase.expected.minimumGraphIntentAlignedSuccessorCandidates,
          minimumGraphIntentMisalignedPredecessorCandidates: regressionCase.expected.minimumGraphIntentMisalignedPredecessorCandidates,
          minimumGraphIntentMisalignedSuccessorCandidates: regressionCase.expected.minimumGraphIntentMisalignedSuccessorCandidates,
          expectedGraphUsedMisalignedPredecessorFallback: regressionCase.expected.expectedGraphUsedMisalignedPredecessorFallback,
          expectedGraphUsedMisalignedSuccessorFallback: regressionCase.expected.expectedGraphUsedMisalignedSuccessorFallback,
          requireCompleteGraphAnswerCoverage: regressionCase.expected.requireCompleteGraphAnswerCoverage,
          requireGraphAnswerPlanOrder: regressionCase.expected.requireGraphAnswerPlanOrder,
          requiredGraphAnswerRoles: regressionCase.expected.requiredGraphAnswerRoles,
          minimumRagFullDocumentFragmentCounts: regressionCase.expected.minimumRagFullDocumentFragmentCounts,
          requireScopedDocumentIds: regressionCase.expected.requireScopedDocumentIds,
        });
        caseResults.push(summary);
      } finally {
        try {
          if (typeof previousUnavailableSourcePaths === 'string') {
            process.env.NOTE_CONNECTION_RAG_UNAVAILABLE_SOURCE_PATHS = previousUnavailableSourcePaths;
          } else {
            delete process.env.NOTE_CONNECTION_RAG_UNAVAILABLE_SOURCE_PATHS;
          }
          if (previousNotemdSettings) {
            await writeNotemdSettings(port, previousNotemdSettings);
          }
        } finally {
          if (runtimeProviderFixture) {
            await runtimeProviderFixture.close();
          }
        }
      }
    }

    console.log(JSON.stringify({
      ok: true,
      mode,
      target: null,
      query: caseResults[0] ? caseResults[0].query : null,
      queries: caseResults.map((entry) => entry.query),
      caseIds: caseResults.map((entry) => entry.id),
      bridgePort,
      runtimeDataDir,
      preloadTargets,
      relationPolicies,
      build: buildResults,
      restore: restoreResults,
      conversation: caseResults[0] || null,
      conversations: caseResults,
      cases: caseResults,
    }, null, 2));
  } finally {
    await new Promise((resolve, reject) => {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    fs.rmSync(runtimeDataDir, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[verify-knowledge-workspace-runtime] FAIL: ${error && error.message ? error.message : String(error)}`);
    process.exit(1);
  });
