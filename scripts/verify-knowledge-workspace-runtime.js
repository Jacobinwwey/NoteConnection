#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

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

function buildConversationRequest(activeTarget, query) {
  return {
    userId: 'runtime_verify_user',
    sessionId: buildConversationSessionId('runtime_verify_session', `${activeTarget}:${query}`),
    activeTarget,
    message: query,
    persistMemory: false,
  };
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

async function buildTarget(port, target) {
  const buildResponse = await requestJson(port, 'POST', '/api/build', { target }, 900000);
  if (buildResponse.status !== 200 || !buildResponse.body || buildResponse.body.success !== true) {
    throw new Error(`build failed for target=${target}: status=${buildResponse.status} body=${JSON.stringify(buildResponse.body)}`);
  }
  return buildResponse.body;
}

async function restoreTarget(port, target) {
  const restoreResponse = await requestJson(
    port,
    'GET',
    `/api/restore-cache?target=${encodeURIComponent(target)}`,
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
    answerMustNotContain,
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
  if (!summary.usedScope || !Array.isArray(summary.usedScope.documentIds) || summary.usedScope.documentIds.length <= 0) {
    throw new Error(`used scope is missing scoped documentIds for query=${query}: ${JSON.stringify(summary.usedScope)}`);
  }
  if (expectedScopeSource && String(summary.usedScope.scopeSource || '') !== String(expectedScopeSource)) {
    throw new Error(`used scope source mismatch for query=${query}: expected=${expectedScopeSource} actual=${JSON.stringify(summary.usedScope)}`);
  }
  const answer = String(summary.answer || '');
  forbiddenFragments.forEach((fragment) => {
    if (answer.includes(fragment)) {
      throw new Error(`conversation leaked "${fragment}" into the public answer for query=${query}: ${answer}`);
    }
  });
  if (!summary.answerReleaseReview || typeof summary.answerReleaseReview !== 'object') {
    throw new Error(`conversation did not return answerReleaseReview for query=${query}: ${JSON.stringify(summary)}`);
  }
  if (String(summary.answerReleaseReview.publicAnswer || '') !== answer) {
    throw new Error(`answerReleaseReview/public answer mismatch for query=${query}: review=${JSON.stringify(summary.answerReleaseReview)} answer=${answer}`);
  }
  if (
    expectedAnswerReleaseDecision
    && String(summary.answerReleaseReview.decision || '') !== String(expectedAnswerReleaseDecision)
  ) {
    throw new Error(
      `answerReleaseReview decision mismatch for query=${query}: expected=${expectedAnswerReleaseDecision} actual=${JSON.stringify(summary.answerReleaseReview)}`
    );
  }
  if (summary.missDiagnostics && summary.missDiagnostics.reason === 'retrieval_candidates_below_threshold') {
    throw new Error(`conversation still fell below retrieval threshold for query=${query}: ${JSON.stringify(summary.missDiagnostics)}`);
  }
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
  const projectRoot = process.cwd();
  const frontendDir = path.join(projectRoot, 'dist', 'src', 'frontend');
  const kbRoot = path.join(projectRoot, 'Knowledge_Base');
  const runtimeDataDir = makeTempDir('noteconnection-knowledge-workspace-runtime');
  const port = await getFreePort();
  const bridgePort = await getFreePort();

  process.env.NOTE_CONNECTION_PROJECT_ROOT = projectRoot;
  process.env.NOTE_CONNECTION_FRONTEND_DIR = frontendDir;
  process.env.NOTE_CONNECTION_KB_ROOT = kbRoot;
  process.env.NOTE_CONNECTION_RUNTIME_DATA_DIR = runtimeDataDir;
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
        console.log('[verify-knowledge-workspace-runtime] step=build');
        buildResponse = await buildTarget(port, target);
        console.log('[verify-knowledge-workspace-runtime] step=restore-cache');
        restoreResponse = await restoreTarget(port, target);
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
          answer: result.answer,
        };
        validatePositiveConversationResult(summary, {
          query,
          target,
          expectedMinCitations: 1,
          answerMustNotContain: [
            'No scoped knowledge points matched',
            'retrieval_candidates_below_threshold',
          ],
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
    if (mode === 'full') {
      for (const preloadTarget of preloadTargets) {
        console.log(`[verify-knowledge-workspace-runtime] step=build target=${preloadTarget}`);
        buildResults[preloadTarget] = await buildTarget(port, preloadTarget);
      }
    }

    const caseResults = [];
    const restoreResults = {};
    for (const regressionCase of regressionCases) {
      if (mode === 'full') {
        console.log(`[verify-knowledge-workspace-runtime] step=restore-cache target=${regressionCase.activeTarget}`);
        restoreResults[regressionCase.id] = await restoreTarget(port, regressionCase.activeTarget);
      }
      console.log(`[verify-knowledge-workspace-runtime] step=conversation case=${regressionCase.id} query=${regressionCase.query}`);
      const conversationResponse = await requestJson(
        port,
        'POST',
        '/api/knowledge/conversation',
        buildConversationRequest(regressionCase.activeTarget, regressionCase.query),
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
        expectedAnswerReleaseDecision: regressionCase.expected.answerReleaseDecision,
        answerMustNotContain: regressionCase.expected.answerMustNotContain,
      });
      caseResults.push(summary);
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
