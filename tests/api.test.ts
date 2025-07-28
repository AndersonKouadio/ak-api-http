import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Api } from '../src/core';
import { ApiConfig, AuthenticationError, ApiError, ServiceType } from '../src/types';

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

    // ============ TESTS EXISTANTS ============
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

    // ============ NOUVEAUX TESTS CRITIQUES ============

    describe('Service Management', () => {
        test('should use public service without authentication', async () => {
            const configWithServices: ApiConfig = {
                ...baseConfig,
                services: {
                    public: { url: 'https://public.api.com', enableAuth: false },
                    private: { url: 'https://private.api.com', enableAuth: true }
                }
            };
            api = new Api(configWithServices);

            mockAxios.onGet('https://public.api.com/public-data').reply((config) => {
                // Vérifier qu'il n'y a PAS de header Authorization pour le service public
                expect(config.headers?.Authorization).toBeUndefined();
                return [200, { public: true }];
            });

            const result = await api.get('/public-data', {}, 'public');
            expect(result).toEqual({ public: true });
        });

        test('should use custom service with authentication', async () => {
            const configWithCustomService: ApiConfig = {
                ...baseConfig,
                services: {
                    public: { url: 'https://public.api.com', enableAuth: false },
                    private: { url: 'https://private.api.com', enableAuth: true },
                    service_1: { url: 'https://service1.api.com', enableAuth: true }
                }
            };
            api = new Api(configWithCustomService);

            mockAxios.onGet('https://service1.api.com/service1-data').reply((config) => {
                expect(config.headers?.Authorization).toBe('Bearer fake-token');
                return [200, { service1: true }];
            });

            const result = await api.get('/service1-data', {}, 'service_1');
            expect(result).toEqual({ service1: true });
        });

        test('should throw error for non-existent service', async () => {
            try {
                await api.get('/data', {}, 'non_existent_service' as 'public' | 'private' | ServiceType);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect(error.message).toContain("Service 'non_existent_service' not found");
            }
        });
    });

    describe('Search Parameters Handling', () => {
        test('should handle search parameters correctly', async () => {
            mockAxios.onGet('/users?page=1&limit=10&active=true').reply(200, { filtered: true });

            const result = await api.get('/users', {
                page: 1,
                limit: 10,
                active: true
            });

            expect(result).toEqual({ filtered: true });
        });

        test('should filter out undefined, null and empty string parameters', async () => {
            mockAxios.onGet('/users?page=1&active=true').reply(200, { filtered: true });

            const result = await api.get('/users', {
                page: 1,
                limit: undefined,
                name: undefined,
                active: true,
                filter: ''
            });

            expect(result).toEqual({ filtered: true });
        });
    });

    describe('Authentication Edge Cases', () => {
        test('should handle missing token gracefully when auth is required', async () => {
            const configNoToken: ApiConfig = {
                ...baseConfig,
                getSession: jest.fn().mockResolvedValue(null), // Pas de session
            };
            api = new Api(configNoToken);

            mockAxios.onGet('/private-data').reply((config) => {
                // Vérifier qu'il n'y a pas de header Authorization
                expect(config.headers?.Authorization).toBeUndefined();
                return [200, { data: 'accessible' }];
            });

            const result = await api.get('/private-data');
            expect(result).toEqual({ data: 'accessible' });
        });

        test('should handle getSession error gracefully', async () => {
            const configFailingSession: ApiConfig = {
                ...baseConfig,
                getSession: jest.fn().mockRejectedValue(new Error('Session error')),
            };
            api = new Api(configFailingSession);

            mockAxios.onGet('/data').reply((config) => {
                expect(config.headers?.Authorization).toBeUndefined();
                return [200, { data: 'ok' }];
            });

            const result = await api.get('/data');
            expect(result).toEqual({ data: 'ok' });
        });

        test('should handle disabled auth correctly', async () => {
            const configNoAuth: ApiConfig = {
                ...baseConfig,
                enableAuth: false,
            };
            api = new Api(configNoAuth);

            mockAxios.onGet('/public-endpoint').reply((config) => {
                expect(config.headers?.Authorization).toBeUndefined();
                return [200, { public: true }];
            });

            const result = await api.get('/public-endpoint');
            expect(result).toEqual({ public: true });
        });
    });

    describe('Error Handling Edge Cases', () => {
        test('should handle network timeout', async () => {
            mockAxios.onGet('/timeout').timeout();

            await expect(api.get('/timeout')).rejects.toBeDefined();
            expect(baseConfig.onRequestError).toHaveBeenCalled();
        });

        test('should handle network error', async () => {
            mockAxios.onGet('/network-error').networkError();

            await expect(api.get('/network-error')).rejects.toBeDefined();
            expect(baseConfig.onRequestError).toHaveBeenCalled();
        });

        test('should not retry on 4xx errors (except 401)', async () => {
            let attempts = 0;
            mockAxios.onGet('/bad-request').reply(() => {
                attempts++;
                return [400, { error: 'Bad Request' }];
            });

            try {
                await api.get('/bad-request');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
            }

            // Ne devrait pas avoir de retry sur 400
            expect(attempts).toBe(1);
        });

        test('should stop retrying after maxRetries attempts', async () => {
            let attempts = 0;
            mockAxios.onGet('/always-fails').reply(() => {
                attempts++;
                return [500, { error: 'Server Error' }];
            });

            try {
                await api.get('/always-fails');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
            }

            // Devrait essayer : 1 fois + 3 retries = 4 fois total
            expect(attempts).toBe(4);
        });
    });

    describe('Generic Request Method', () => {
        test('should use request method with all parameters', async () => {
            mockAxios.onPost('/custom?filter=test', { data: 'test' }).reply((config) => {
                expect(config.headers?.['X-Custom']).toBe('value');
                return [201, { created: true }];
            });

            const result = await api.request({
                endpoint: '/custom',
                method: 'POST',
                data: { data: 'test' },
                searchParams: { filter: 'test' },
                service: 'private',
                config: {
                    headers: { 'X-Custom': 'value' }
                }
            });

            expect(result).toEqual({ created: true });
        });

        test('should handle PUT method via request', async () => {
            mockAxios.onPut('/resource/1', { updated: true }).reply(200, { success: true });

            const result = await api.request({
                endpoint: '/resource/1',
                method: 'PUT',
                data: { updated: true }
            });

            expect(result).toEqual({ success: true });
        });
    });

    describe('Configuration Management', () => {
        test('should update multiple config properties', async () => {
            api.updateConfig({
                timeout: 15000,
                headers: { 'X-App': 'test-app' },
                maxRetries: 5
            });

            const config = api.getConfig();
            expect(config.timeout).toBe(15000);
            expect(config.headers?.['X-App']).toBe('test-app');
            expect(config.maxRetries).toBe(5);
        });

        test('should update auth functions', async () => {
            const newGetSession = jest.fn().mockResolvedValue({ accessToken: 'new-token' });
            const newSignOut = jest.fn();

            api.updateAuthFunctions(newGetSession, newSignOut);

            // Vérifier que la nouvelle fonction getSession est utilisée
            const token = await (api as Api).getCurrentToken();
            expect(token).toBe('new-token');
            expect(newGetSession).toHaveBeenCalled();
        });

        test('should return correct auth status', () => {
            expect(api.isAuthEnabled()).toBe(true);

            const noAuthApi = new Api({ ...baseConfig, enableAuth: false });
            expect(noAuthApi.isAuthEnabled()).toBe(false);
        });
    });

    describe('Constructor Validation', () => {
        test('should throw error when enableAuth is true but getSession is missing', () => {
            expect(() => {
                new Api({
                    baseUrl: 'https://api.test.com',
                    enableAuth: true,
                    signOut: jest.fn()
                    // getSession manquant
                });
            }).toThrow('getSession and signOut functions are required when enableAuth is true');
        });

        test('should throw error when enableAuth is true but signOut is missing', () => {
            expect(() => {
                new Api({
                    baseUrl: 'https://api.test.com',
                    enableAuth: true,
                    getSession: jest.fn()
                    // signOut manquant
                });
            }).toThrow('getSession and signOut functions are required when enableAuth is true');
        });

        test('should work with minimal configuration', () => {
            expect(() => {
                new Api({
                    baseUrl: 'https://api.test.com',
                    enableAuth: false
                });
            }).not.toThrow();
        });
    });
});