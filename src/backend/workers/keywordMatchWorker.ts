import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { checkMatch } from '../utils/stringUtils';
import { CrashLogger } from '../utils/CrashLogger';

CrashLogger.initGlobalHandlers();

interface WorkerData {
  filePaths: string[];
  targetIds: string[];
  strategy: 'exact-phrase' | 'fuzzy';
  exclusionList: string[];
}

interface MatchResult {
  source: string;
  target: string;
}

try {
    const { filePaths, targetIds, strategy, exclusionList } = workerData as WorkerData;

    const results: MatchResult[] = [];

    filePaths.forEach(filePath => {
      try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const sourceId = path.basename(filePath, path.extname(filePath));

          targetIds.forEach(targetId => {
            if (sourceId === targetId) return;

            if (exclusionList.includes(targetId)) return;

            if (checkMatch(content, targetId, strategy)) {
              results.push({ source: sourceId, target: targetId });
            }
          });
      } catch (err) {
          console.warn(`[KeywordMatchWorker] Failed to read file: ${filePath}`, err);
      }
    });

    if (parentPort) {
      parentPort.postMessage(results);
    }
} catch (error) {
    CrashLogger.log(error, 'KeywordMatchWorker');
    process.exit(1);
}
