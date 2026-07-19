import type { AgentConversationGraphContext } from './types';
import { collectGraphAnswerFacts } from './graphAnswerFacts';

function makeGraphContext(): AgentConversationGraphContext {
    return {
        anchorAtomId: 'anchor',
        anchorTitle: 'Anchor',
        anchorGraphProfile: { atomId: 'anchor', title: 'Anchor', inDegree: 2, outDegree: 3 },
        predecessorWindow: [
            { atomId: 'anchor', title: 'Anchor' },
            { atomId: 'predecessor', title: 'Upstream Node' },
            { atomId: 'duplicate', title: 'upstream node' },
        ],
        successorWindow: [{ atomId: 'successor', title: 'Downstream Node' }],
    } as AgentConversationGraphContext;
}

describe('collectGraphAnswerFacts', () => {
    test('deduplicates windows and excludes the anchor by atom or title', () => {
        const facts = collectGraphAnswerFacts(makeGraphContext(), {
            anchorAtomId: 'anchor',
            anchorTitle: 'Anchor',
            normalizeTitle: (value) => String(value || '').trim(),
        });

        expect(facts).toEqual({
            anchorTitle: 'Anchor',
            inDegree: 2,
            outDegree: 3,
            predecessorTitles: ['Upstream Node'],
            successorTitles: ['Downstream Node'],
        });
    });

    test('returns no facts when graph context is unavailable', () => {
        expect(collectGraphAnswerFacts(null, {
            anchorAtomId: '',
            anchorTitle: '',
            normalizeTitle: (value) => String(value || '').trim(),
        })).toBeNull();
    });
});
