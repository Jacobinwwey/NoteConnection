/**
 * Domain classes extracted from KnowledgeLearningPlatform.
 *
 * Each domain class wraps the platform behind a clean interface.
 * Implementations are gradually migrated from the monolithic
 * KnowledgeLearningPlatform into these domain classes.
 *
 * Usage:
 *   const ingestor = new KnowledgeIngestor(platform);
 *   const querier  = new KnowledgeQuerier(platform);
 *   const conv     = new ConversationManager(platform);
 *   const mastery  = new MasteryEngine(platform);
 *   const quality  = new QualityEvaluator(platform, thresholds);
 *   const tutor    = new TutorRouter(platform);
 *   const memory   = new MemoryPolicyManager(platform);
 */

export type { DomainContext } from './types';

export { KnowledgeIngestor } from './KnowledgeIngestor';
export type { IngestPlatform } from './KnowledgeIngestor';

export { KnowledgeQuerier } from './KnowledgeQuerier';
export type { QueryPlatform } from './KnowledgeQuerier';

export { ConversationManager } from './ConversationManager';
export type { ConversationPlatform } from './ConversationManager';

export { MasteryEngine } from './MasteryEngine';
export type { MasteryPlatform } from './MasteryEngine';

export { QualityEvaluator } from './QualityEvaluator';
export type { QualityPlatform } from './QualityEvaluator';

export { TutorRouter } from './TutorRouter';
export type { TutorPlatform } from './TutorRouter';

export { MemoryPolicyManager } from './MemoryPolicyManager';
export type { MemoryPlatform } from './MemoryPolicyManager';
