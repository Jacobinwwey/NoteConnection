import { parentPort, workerData } from 'worker_threads';
import { RawFile } from '../FileLoader';
import { checkMatch } from '../utils/stringUtils';

interface WorkerData {
  filesChunk: RawFile[];
  targetIds: string[];
  strategy: 'exact-phrase' | 'fuzzy';
  exclusionList: string[];
}

interface MatchResult {
  source: string;
  target: string;
}

const { filesChunk, targetIds, strategy, exclusionList } = workerData as WorkerData;

const results: MatchResult[] = [];

filesChunk.forEach(sourceFile => {
  const sourceId = sourceFile.filename;
  const content = sourceFile.content;

  targetIds.forEach(targetId => {
    if (sourceId === targetId) return;

    if (exclusionList.includes(targetId)) return;

    if (checkMatch(content, targetId, strategy)) {
      results.push({ source: sourceId, target: targetId });
    }
  });
});

if (parentPort) {
  parentPort.postMessage(results);
}
