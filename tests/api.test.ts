import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Api } from '../src/core';
import { ApiConfig, AuthenticationError, ApiError } from '../src/types';

describe('Api', () => {
    let mockAxios: MockAdapter;
    let api: Api;

    const dummySession = { accessToken: 'fake-token' };

    const baseConfig: ApiConfig = {
        baseUrl: 'https://api.example.com',
        enableAuth: true,
        getSession: jest.fn().mockResolvedValue(dummySession),
        signOut: jest.fn(),
        onRequestError: jest.fn(),
        onRequest: (config) => config,
        onResponse: (res) => res,
        debug: false,
    };

    beforeEach(() => {
        mockAxios = new MockAdapter(axios);
        api = new Api(baseConfig);
    });

    afterEach(() => {
        mockAxios.reset();
        jest.clearAllMocks();
    });

    test('should initialize with token if available', async () => {
        const token = await (api as Api).getCurrentToken();
        expect(token).toBe('fake-token');
        expect(baseConfig.getSession).toHaveBeenCalled();
    });

    test('should set token manually and retrieve it', async () => {
        api.setToken('manual-token');
        const token = await (api as Api).getCurrentToken();
        expect(token).toBe('manual-token');
    });

    test('should clear token', async () => {
        api.setToken('manual-token');
        api.clearToken();
        const token = await (api as Api).getCurrentToken();
        expect(token).toBe('fake-token');
    });

    test('should make a GET request with Authorization header', async () => {
        mockAxios.onGet('/users').reply((config) => {
            expect(config.headers?.Authorization).toBe('Bearer fake-token');
            return [200, { success: true }];
        });

        const result = await api.get('/users');
        expect(result).toEqual({ success: true });
    });

    test('should make a POST request with payload', async () => {
        mockAxios.onPost('/users', { name: 'John' }).reply(201, { id: 123 });

        const result = await api.post('/users', { name: 'John' });
        expect(result).toEqual({ id: 123 });
    });

    test('should make a PATCH request with data', async () => {
        mockAxios.onPatch('/users/1').reply(200, { success: true });

        const result = await api.patch('/users/1', { name: 'Updated' });
        expect(result).toEqual({ success: true });
    });

    test('should make a DELETE request', async () => {
        mockAxios.onDelete('/users/1').reply(204);

        const result = await api.delete('/users/1');
        expect(result).toBeUndefined();
    });

    test('should retry on server error (500)', async () => {
        let attempt = 0;
        mockAxios.onGet('/retry').reply(() => {
            attempt++;
            return attempt < 3 ? [500] : [200, { success: true }];
        });

        const result = await api.get('/retry');
        expect(result).toEqual({ success: true });
        expect(attempt).toBe(3);
    });

    test('should sign out and throw AuthenticationError on 401', async () => {
        mockAxios.onGet('/private').reply(401);

        await expect(api.get('/private')).rejects.toThrow(AuthenticationError);
        expect(baseConfig.signOut).toHaveBeenCalled();
    });

    test('should call onRequestError on API error', async () => {
        mockAxios.onGet('/fail').reply(400, {
            message: 'Bad Request',
            code: 'BAD_REQUEST',
        });

        try {
            await api.get('/fail');
        } catch (err) {
            expect(err).toBeInstanceOf(ApiError);
            expect(err.message).toBe('Bad Request');
            expect(err.status).toBe(400);
            expect(err.code).toBe('BAD_REQUEST');
        }

        expect(baseConfig.onRequestError).toHaveBeenCalled();
    });

    test('should update config and still function', async () => {
        api.updateConfig({ timeout: 5000 });
        expect((api as Api).config.timeout).toBe(5000);

        mockAxios.onGet('/ping').reply(200, { pong: true });
        const res = await api.get('/ping');
        expect(res).toEqual({ pong: true });
    });

    test('should apply custom onRequest interceptor', async () => {
        const configWithInterceptor: ApiConfig = {
            ...baseConfig,
            onRequest: (config) => {
                config.headers = { ...config.headers, 'X-Test': 'yes' };
                return config;
            }
        };
        api = new Api(configWithInterceptor);

        mockAxios.onGet('/check-header').reply((config) => {
            expect(config.headers?.['X-Test']).toBe('yes');
            return [200, { ok: true }];
        });

        const res = await api.get('/check-header');
        expect(res).toEqual({ ok: true });
    });

    test('should apply custom onResponse interceptor', async () => {
        const configWithInterceptor: ApiConfig = {
            ...baseConfig,
            onResponse: (res) => {
                res.data.intercepted = true;
                return res;
            }
        };
        api = new Api(configWithInterceptor);

        mockAxios.onGet('/data').reply(200, { key: 'value' });

        const res = await api.get('/data');
        expect(res).toEqual({ key: 'value', intercepted: true });
    });
});
