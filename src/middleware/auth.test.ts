import {
    isAuthorizedRequest,
    isRequestTokenAuthorized,
    setSidecarAuthToken,
} from './auth';

function request(headers: Record<string, string>): any {
    return { headers };
}

describe('request authorization boundary', () => {
    afterEach(() => {
        setSidecarAuthToken('');
    });

    test('allows requests when no token is configured', () => {
        expect(isRequestTokenAuthorized(request({}), '')).toBe(true);
        expect(isAuthorizedRequest(request({}))).toBe(true);
    });

    test('accepts a valid Bearer credential', () => {
        expect(isRequestTokenAuthorized(request({ authorization: 'Bearer secret' }), 'secret')).toBe(true);
        expect(isRequestTokenAuthorized(request({ authorization: 'bearer secret' }), 'secret')).toBe(true);
    });

    test('rejects missing, malformed, and invalid credentials when configured', () => {
        expect(isRequestTokenAuthorized(request({}), 'secret')).toBe(false);
        expect(isRequestTokenAuthorized(request({ authorization: 'Basic secret' }), 'secret')).toBe(false);
        expect(isRequestTokenAuthorized(request({ authorization: 'Bearer ' }), 'secret')).toBe(false);
        expect(isRequestTokenAuthorized(request({ authorization: 'Bearer wrong' }), 'secret')).toBe(false);
    });

    test('preserves the legacy token header', () => {
        expect(isRequestTokenAuthorized(request({ 'x-noteconnection-token': 'secret' }), 'secret')).toBe(true);
    });

    test('sidecar middleware uses the same strict decision', () => {
        setSidecarAuthToken('secret');
        expect(isAuthorizedRequest(request({}))).toBe(false);
        expect(isAuthorizedRequest(request({ authorization: 'Bearer secret' }))).toBe(true);
    });
});
