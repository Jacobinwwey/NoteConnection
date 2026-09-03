import { normalizeAgentConversationRequestPayload } from './requestNormalization';

describe('agent conversation request normalization', () => {
    test.each([
        ['zh-CN', 'zh'],
        ['zh_CN', 'zh'],
        ['Chinese', 'zh'],
        ['en-US', 'en'],
        ['en_US', 'en'],
        ['English', 'en'],
        ['auto', 'auto'],
        ['unsupported-language', undefined],
    ])('normalizes answer language %s to %s', (answerLanguage, expectedLanguage) => {
        expect(normalizeAgentConversationRequestPayload({
            message: 'what is water glass?',
            answerLanguage,
        }).answerLanguage).toBe(expectedLanguage);
    });

    test('keeps an explicit English answer contract even when the query contains CJK text', () => {
        expect(normalizeAgentConversationRequestPayload({
            message: '\u4ec0\u4e48\u662f water glass?',
            response_language: 'en-US',
        }).answerLanguage).toBe('en');
    });

    test('normalizes the additive mobile response profile without changing the default', () => {
        expect(normalizeAgentConversationRequestPayload({
            message: 'what is water glass?',
            response_profile: 'mobile',
        }).responseProfile).toBe('mobile_compact');
        expect(normalizeAgentConversationRequestPayload({
            message: 'what is water glass?',
        }).responseProfile).toBeUndefined();
    });

    test.each([
        [undefined, undefined],
        ['slim', 'slim'],
        ['definition', 'slim'],
        ['compact', 'slim'],
        ['full', 'full'],
        ['comprehensive', 'full'],
        ['unsupported-mode', undefined],
    ])('normalizes answer response mode %s to %s', (responseMode, expectedMode) => {
        expect(normalizeAgentConversationRequestPayload({
            message: 'what is water glass?',
            responseMode,
        }).responseMode).toBe(expectedMode);
    });

    test('keeps response mode independent from the mobile response profile', () => {
        const request = normalizeAgentConversationRequestPayload({
            message: 'what is water glass?',
            response_mode: 'full',
            response_profile: 'mobile',
        });
        expect(request.responseMode).toBe('full');
        expect(request.responseProfile).toBe('mobile_compact');
    });
});
