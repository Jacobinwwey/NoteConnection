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
});
