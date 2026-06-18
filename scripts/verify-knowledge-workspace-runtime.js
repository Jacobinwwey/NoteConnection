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

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--full') ? 'full' : 'conversation';
  const targetArgIndex = args.findIndex((arg) => arg === '--target');
  const target = targetArgIndex >= 0 && args[targetArgIndex + 1]
    ? String(args[targetArgIndex + 1]).trim()
    : 'waterglass';
  const explicitQueries = collectFlagValues(args, '--query');
  const queries = explicitQueries.length > 0
    ? explicitQueries
    : (
      String(target || '').trim().toLowerCase() === 'waterglass'
        ? ['什么是waterglass?', '什么是water glass']
        : ['什么是water glass']
    );
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
    let buildResponse = null;
    let restoreResponse = null;
    if (mode === 'full') {
      console.log('[verify-knowledge-workspace-runtime] step=build');
      buildResponse = await requestJson(port, 'POST', '/api/build', {
        target,
      });
      if (buildResponse.status !== 200 || !buildResponse.body || buildResponse.body.success !== true) {
        throw new Error(`build failed: status=${buildResponse.status} body=${JSON.stringify(buildResponse.body)}`);
      }

      console.log('[verify-knowledge-workspace-runtime] step=restore-cache');
      restoreResponse = await requestJson(port, 'GET', `/api/restore-cache?target=${encodeURIComponent(target)}`);
      if (restoreResponse.status !== 200 || !restoreResponse.body || restoreResponse.body.success !== true) {
        throw new Error(`restore-cache failed: status=${restoreResponse.status} body=${JSON.stringify(restoreResponse.body)}`);
      }
    }

    const conversations = [];
    for (const query of queries) {
      console.log(`[verify-knowledge-workspace-runtime] step=conversation query=${query}`);
      const conversationResponse = await requestJson(port, 'POST', '/api/knowledge/conversation', {
        userId: 'runtime_verify_user',
        sessionId: `runtime_verify_session_${Buffer.from(query).toString('hex').slice(0, 16)}`,
        activeTarget: target,
        message: query,
        persistMemory: false,
      }, 90000);
      if (conversationResponse.status !== 200 || !conversationResponse.body || !conversationResponse.body.success) {
        throw new Error(`conversation failed for query=${query}: status=${conversationResponse.status} body=${JSON.stringify(conversationResponse.body)}`);
      }

      const result = conversationResponse.body.result || {};
      const citations = Array.isArray(result.citations) ? result.citations : [];
      const workspaceReadiness = result.trace && result.trace.workspaceReadiness ? result.trace.workspaceReadiness : null;
      const usedScope = result.trace && result.trace.usedScope ? result.trace.usedScope : null;
      const planner = result.trace && result.trace.planner ? result.trace.planner : null;
      const missDiagnostics = result.trace && result.trace.missDiagnostics ? result.trace.missDiagnostics : null;
      const answerReleaseReview = result.answerReleaseReview || (result.trace && result.trace.answerReleaseReview) || null;

      if (citations.length <= 0) {
        throw new Error(`expected citations for query=${query}, got body=${JSON.stringify(conversationResponse.body)}`);
      }
      if (!workspaceReadiness || workspaceReadiness.status !== 'ready') {
        throw new Error(`workspace readiness not ready for query=${query}: ${JSON.stringify(workspaceReadiness)}`);
      }
      if (!usedScope || usedScope.workspaceId !== String(target || '').toLowerCase()) {
        throw new Error(`used scope mismatch for query=${query}: ${JSON.stringify(usedScope)}`);
      }
      if (!usedScope || !Array.isArray(usedScope.documentIds) || usedScope.documentIds.length <= 0) {
        throw new Error(`used scope is missing scoped documentIds for query=${query}: ${JSON.stringify(usedScope)}`);
      }
      if (String(result.answer || '').includes('No scoped knowledge points matched')) {
        throw new Error(`conversation still returned empty-scope answer for query=${query}: ${String(result.answer || '')}`);
      }
      if (String(result.answer || '').includes('retrieval_candidates_below_threshold')) {
        throw new Error(`conversation leaked retrieval diagnostics into the public answer for query=${query}: ${String(result.answer || '')}`);
      }
      if (!answerReleaseReview || typeof answerReleaseReview !== 'object') {
        throw new Error(`conversation did not return answerReleaseReview for query=${query}: ${JSON.stringify(conversationResponse.body)}`);
      }
      if (String(answerReleaseReview.publicAnswer || '') !== String(result.answer || '')) {
        throw new Error(`answerReleaseReview/public answer mismatch for query=${query}: review=${JSON.stringify(answerReleaseReview)} answer=${String(result.answer || '')}`);
      }
      if (missDiagnostics && missDiagnostics.reason === 'retrieval_candidates_below_threshold') {
        throw new Error(`conversation still fell below retrieval threshold for query=${query}: ${JSON.stringify(missDiagnostics)}`);
      }

      conversations.push({
        query,
        citationCount: citations.length,
        topCitation: citations[0],
        workspaceReadiness,
        usedScope,
        planner,
        missDiagnostics,
        answerReleaseReview,
        answer: result.answer,
      });
    }

    console.log(JSON.stringify({
      ok: true,
      mode,
      target,
      query: conversations[0] ? conversations[0].query : null,
      queries,
      bridgePort,
      runtimeDataDir,
      build: buildResponse ? buildResponse.body : null,
      restore: restoreResponse ? restoreResponse.body : null,
      conversation: conversations[0] || null,
      conversations,
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
