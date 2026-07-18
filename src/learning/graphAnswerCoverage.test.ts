import { reviewGraphAnswerCoverage } from './graphAnswerCoverage';
import type { GraphAnswerPlan } from './types';

const plan: GraphAnswerPlan = {
    intent: 'definition',
    depth: 'standard',
    anchorAtomId: 'water_glass',
    leadClaimId: 'definition',
    requiredRoles: ['definition', 'boundary', 'mechanism'],
    omittedCandidates: [],
    claims: [
        {
            claimId: 'definition',
            role: 'definition',
            required: true,
            priority: 100,
            statement: 'A water glass is a transparent drinking vessel containing water.',
            subjectAtomId: 'water_glass',
            supportingAtomIds: [],
            supportingEdgeIds: [],
            evidenceRefs: [],
            confidence: 0.98,
        },
        {
            claimId: 'boundary',
            role: 'boundary',
            required: true,
            priority: 84,
            statement: 'The solid wall forms a material boundary between the liquid and the environment.',
            subjectAtomId: 'water_glass',
            supportingAtomIds: ['material_boundary'],
            supportingEdgeIds: [],
            evidenceRefs: [],
            confidence: 0.91,
        },
        {
            claimId: 'mechanism',
            role: 'mechanism',
            required: true,
            priority: 82,
            statement: 'Heat moves through the glass wall and its thickness affects thermal exchange.',
            subjectAtomId: 'water_glass',
            supportingAtomIds: ['thermal_exchange'],
            supportingEdgeIds: ['edge_heat'],
            evidenceRefs: [],
            confidence: 0.9,
        },
    ],
};

describe('reviewGraphAnswerCoverage', () => {
    test('passes when every required graph claim is represented with natural paraphrasing', () => {
        const review = reviewGraphAnswerCoverage(
            'A water glass is a transparent vessel for water. Its solid wall separates the liquid from the surrounding environment. Heat passes through that glass wall, and wall thickness changes the rate of thermal exchange.',
            plan
        );

        expect(review.passed).toBe(true);
        expect(review.missingRequiredClaimIds).toEqual([]);
        expect(review.coverageScore).toBe(1);
    });

    test('fails when a high-confidence mechanism claim is dropped from the public answer', () => {
        const review = reviewGraphAnswerCoverage(
            'A water glass is a transparent drinking vessel containing water. Its solid wall forms a material boundary between the liquid and the environment.',
            plan
        );

        expect(review.passed).toBe(false);
        expect(review.missingRequiredClaimIds).toEqual(['mechanism']);
        expect(review.coverageScore).toBeCloseTo(2 / 3, 4);
    });

    test('does not count a negated paraphrase as coverage', () => {
        const review = reviewGraphAnswerCoverage(
            'A water glass is a transparent drinking vessel containing water. Its wall does not separate the liquid from the environment. Heat does not move through the glass wall and thickness has no effect on thermal exchange.',
            plan
        );

        expect(review.coveredClaimIds).toEqual(['definition']);
        expect(review.missingRequiredClaimIds).toEqual(['boundary', 'mechanism']);
    });

    test('covers conservative Chinese paraphrases without requiring exact source wording', () => {
        const chinesePlan: GraphAnswerPlan = {
            ...plan,
            claims: [
                {
                    ...plan.claims[0],
                    claimId: 'definition_zh',
                    statement: '水杯是用于盛水的透明饮用容器。',
                },
                {
                    ...plan.claims[1],
                    claimId: 'boundary_zh',
                    statement: '坚固杯壁在液体和外部环境之间形成材料边界。',
                },
                {
                    ...plan.claims[2],
                    claimId: 'mechanism_zh',
                    statement: '热量会穿过杯壁，杯壁厚度会影响热交换。',
                },
            ],
        };

        const review = reviewGraphAnswerCoverage(
            '水杯是一种透明的盛水容器。它的实体杯壁把液体与周围环境隔开；热可以经由玻璃壁传递，而壁厚会改变换热速度。',
            chinesePlan
        );

        expect(review.passed).toBe(true);
        expect(review.coveredClaimIds).toEqual(['definition_zh', 'boundary_zh', 'mechanism_zh']);
    });
});
