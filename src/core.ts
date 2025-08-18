import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  ApiConfig,
  HttpMethod,
  RetryableAxiosRequestConfig,
  SearchParams,
  ServiceType,
  RequestConfig,
  GetSessionFunction,
  SignOutFunction,
  AuthenticationError,
  ApiError,
  ServiceConfig,
} from './types';

export class Api {
  private axiosInstance: AxiosInstance;
  private currentToken: string | null = null;
  config: Required<ApiConfig>;

  constructor(options: ApiConfig) {
    if (options.enableAuth) {
      if (!options.getSession || !options.signOut) {
        throw new Error('getSession and signOut functions are required when enableAuth is true');
      }
    }

    this.config = {
      baseUrl: options.baseUrl,
      timeout: options.timeout ?? 10000,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      enableAuth: options.enableAuth ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      services: {
        public: {
          url: options.baseUrl,
          enableAuth: false,
        },
        private: {
          url: options.baseUrl,
          enableAuth: true,
        },
        ...options.services,
      },
      getSession: options.getSession ?? (async () => null),
      signOut: options.signOut ?? (async () => {console.log('Sign out');}),
      onRequestError: options.onRequestError ?? (() => {console.log('');}),
      debug: options.debug ?? false,
      onRequest: options.onRequest ?? ((config) => config),
      onResponse: options.onResponse ?? ((response) => response),
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.enableAuth
        ? this.config.services.private.url
        : this.config.services.public.url,
      timeout: this.config.timeout,
      headers: this.config.headers,
    });

    if (this.config.enableAuth) {
      this.setupInterceptors();
    }
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[Api] ${message}`, data);
    }
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      async (
        config: InternalAxiosRequestConfig
      ): Promise<InternalAxiosRequestConfig> => {
        try {
          // Convertir InternalAxiosRequestConfig en AxiosRequestConfig pour l'intercepteur utilisateur
          const userConfig: AxiosRequestConfig = {
            ...config,
            headers: config.headers as any, // Cast nécessaire pour la compatibilité
          };

          // Appliquer l'intercepteur utilisateur
          const modifiedConfig = await Promise.resolve(this.config.onRequest(userConfig));

          // Reconvertir en InternalAxiosRequestConfig et MERGER les headers
          const internalConfig: InternalAxiosRequestConfig = {
            ...config,
            ...modifiedConfig,
            headers: {
              ...config.headers,
              ...modifiedConfig.headers, // Merger les headers personnalisés
            } as any,
          };

          // Assurer que headers ne soit jamais undefined
          if (!internalConfig.headers) {
            internalConfig.headers = {} as any;
          }

          // Déterminer le service ciblé
          const serviceConfig = this.getServiceByUrl(internalConfig.baseURL as string);

          if (serviceConfig && serviceConfig.enableAuth) {
            const token = await this.getCurrentToken();
            if (token) {
              // Mettre à jour les headers avec le token
              Object.assign(internalConfig.headers, {
                Authorization: `Bearer ${token}`,
              });
            }
          }

          return internalConfig;
        } catch (error) {
          this.log('Erreur dans l\'intercepteur de requête personnalisé', error);
          return Promise.reject(error);
        }
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      async (response) => {
        try {
          return await Promise.resolve(this.config.onResponse(response));
        } catch (error) {
          this.log('Erreur dans l\'intercepteur de réponse personnalisé (succès)', error);
          return Promise.reject(error);
        }
      },
      async (error: AxiosError): Promise<any> => {
        const originalRequest = error.config as RetryableAxiosRequestConfig;

        // Si pas de config dans l'erreur, appliquer l'intercepteur et rejeter
        if (!originalRequest) {
          try {
            // Passer seulement la réponse si elle existe, sinon créer un objet réponse factice
            const responseForInterceptor = error.response ?? {
              data: null,
              status: 0,
              statusText: 'No Response',
              headers: {},
              config: {} as InternalAxiosRequestConfig,
            } as AxiosResponse;

            await Promise.resolve(this.config.onResponse(responseForInterceptor));
          } catch (interceptorError) {
            this.log('Erreur dans l\'intercepteur de réponse personnalisé (erreur sans config)', interceptorError);
          }
          return Promise.reject(error);
        }

        if (error.response?.status === 401) {
          this.log('Erreur 401 détectée, déconnexion de l\'utilisateur.');
          if (this.config.signOut) {
            await this.config.signOut();
          }
          try {
            const responseForInterceptor = error.response ?? {
              data: null,
              status: 401,
              statusText: 'Unauthorized',
              headers: {},
              config: {} as InternalAxiosRequestConfig,
            } as AxiosResponse;

            await Promise.resolve(this.config.onResponse(responseForInterceptor));
          } catch (interceptorError) {
            this.log('Erreur dans l\'intercepteur de réponse personnalisé (401)', interceptorError);
          }
          return Promise.reject(new AuthenticationError('Unauthorized, user logged out.'));
        }

        if (
          error.response?.status &&
          error.response.status >= 500 &&
          (originalRequest._retryCount ?? 0) < this.config.maxRetries
        ) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          this.log(
            `Tentative de réessai #${originalRequest._retryCount} pour ${originalRequest.url}`
          );

          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
          return this.axiosInstance(originalRequest);
        }

        // CRÉER l'ApiError ici avant de le rejeter
        const apiError = this.createApiError(error, {
          endpoint: originalRequest.url || '',
          method: (originalRequest.method?.toUpperCase() as HttpMethod) || 'GET',
          service: 'private',
        });

        this.handleRequestError(apiError, {
          endpoint: originalRequest.url || '',
          method: (originalRequest.method?.toUpperCase() as HttpMethod) || 'GET',
          service: 'private',
        });

        try {
          const responseForInterceptor = error.response ?? {
            data: null,
            status: error.status || 0,
            statusText: error.message || 'Error',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          } as AxiosResponse;

          await Promise.resolve(this.config.onResponse(responseForInterceptor));
        } catch (interceptorError) {
          this.log('Erreur dans l\'intercepteur de réponse personnalisé (erreur finale)', interceptorError);
        }

        // Rejeter avec l'ApiError au lieu de l'erreur Axios originale
        return Promise.reject(apiError);
      }
    );
  }

  async getCurrentToken(): Promise<string | null> {
    if (!this.config.enableAuth) return null;

    if (this.currentToken) return this.currentToken;

    try {
      const session = await this.config.getSession();
      const token = session?.accessToken || null;

      if (token) {
        this.currentToken = token;
      }
      return token;
    } catch (error) {
      this.log('Erreur lors de la récupération de la session', error);
      return null;
    }
  }

  private buildUrl(endpoint: string, searchParams?: SearchParams): string {
    const cleanEndpoint = endpoint.trim();

    if (!searchParams) return cleanEndpoint;

    const filteredParams: Record<string, string> = {};
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        filteredParams[key] = String(value);
      }
    });

    const queryString = new URLSearchParams(filteredParams).toString();
    return queryString ? `${cleanEndpoint}?${queryString}` : cleanEndpoint;
  }

  private async executeRequest<T>(
    method: HttpMethod,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const lowercaseMethod = method.toLowerCase() as Lowercase<HttpMethod>;

    const requestConfig: RetryableAxiosRequestConfig = {
      ...config,
      _retryCount: 0,
    };

    switch (lowercaseMethod) {
      case 'post':
        return (await this.axiosInstance.post<T>(url, data, requestConfig)).data;
      case 'put':
        return (await this.axiosInstance.put<T>(url, data, requestConfig)).data;
      case 'patch':
        return (await this.axiosInstance.patch<T>(url, data, requestConfig)).data;
      case 'delete':
        return (await this.axiosInstance.delete<T>(url, requestConfig)).data;
      case 'get':
      default:
        return (await this.axiosInstance.get<T>(url, requestConfig)).data;
    }
  }

  async request<T = any>({
    endpoint,
    method,
    data,
    searchParams,
    service = 'private',
    config = {},
  }: RequestConfig): Promise<T> {
    this.log(`${method} ${endpoint}`, { data, searchParams, service });

    const serviceConfig = await this.getServiceConfig(service, config);
    const url = this.buildUrl(endpoint, searchParams);

    return await this.executeRequest<T>(method, url, data, serviceConfig);
  }

  public get<T = any>(
    endpoint: string,
    searchParams?: SearchParams,
    service: 'public' | 'private' | ServiceType = 'private',
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      endpoint,
      method: 'GET',
      searchParams,
      service,
      config,
    });
  }

  public post<T = any>(
    endpoint: string,
    data?: any,
    service: 'public' | 'private' | ServiceType = 'private',
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      endpoint,
      method: 'POST',
      data,
      service,
      config,
    });
  }

  public put<T = any>(
    endpoint: string,
    data?: any,
    service: 'public' | 'private' | ServiceType = 'private',
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      endpoint,
      method: 'PUT',
      data,
      service,
      config,
    });
  }

  public patch<T = any>(
    endpoint: string,
    data?: any,
    service: 'public' | 'private' | ServiceType = 'private',
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      endpoint,
      method: 'PATCH',
      data,
      service,
      config,
    });
  }

  public delete<T = any>(
    endpoint: string,
    service: 'public' | 'private' | ServiceType = 'private',
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      endpoint,
      method: 'DELETE',
      service,
      config,
    });
  }

  private getServiceByUrl(
    url: string
  ): ServiceConfig | null {
    for (const serviceKey in this.config.services) {
      const service = this.config.services[serviceKey as keyof typeof this.config.services];
      if (service?.url === url) {
        return service;
      }
    }
    return null;
  }

  private async getServiceConfig(
    service: 'public' | 'private' | ServiceType,
    config: AxiosRequestConfig
  ): Promise<AxiosRequestConfig> {
    const serviceConfig = this.config.services[service];

    if (!serviceConfig) {
      throw new ApiError(`Service '${service}' not found in configuration`);
    }

    const headers = { ...config.headers } as InternalAxiosRequestConfig['headers'];

    if (serviceConfig.enableAuth && this.config.enableAuth) {
      const token = await this.getCurrentToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return {
      ...config,
      baseURL: serviceConfig.url,
      headers,
    };
  }

  // NOUVELLE méthode pour créer une ApiError à partir d'une AxiosError
  private createApiError(
    error: any,
    context: {
      endpoint: string;
      method: HttpMethod;
      service?: 'public' | 'private' | ServiceType;
    }
  ): ApiError {
    return new ApiError(
      error.response?.data?.message || error.message,
      error.response?.status,
      error.response?.data?.code || error.code,
      JSON.stringify({
        endpoint: context?.endpoint,
        method: context?.method,
        service: context?.service,
        url: error?.config?.url,
        baseURL: error?.config?.baseURL,
        headers: error?.config?.headers,
        responseData: error?.response?.data,
      })
    );
  }

  // MODIFIÉE pour accepter une ApiError au lieu de créer l'erreur
  private handleRequestError(
    apiError: ApiError,
    context: {
      endpoint: string;
      method: HttpMethod;
      service?: 'public' | 'private' | ServiceType;
    }
  ): void {
    this.log('Erreur HTTP', apiError);
    this.config.onRequestError(apiError);

    if (apiError.status && apiError.status >= 500) {
      this.log('Erreur serveur détectée');
    }
  }

  public updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.baseUrl) {
      this.axiosInstance.defaults.baseURL = newConfig.baseUrl;
      this.config.services.private.url = newConfig.baseUrl;
      this.config.services.public.url = newConfig.baseUrl;
    }
    if (newConfig.timeout) {
      this.axiosInstance.defaults.timeout = newConfig.timeout;
    }
    if (newConfig.headers) {
      this.axiosInstance.defaults.headers = {
        ...this.axiosInstance.defaults.headers,
        ...newConfig.headers,
      };
    }

    if (newConfig.onRequest || newConfig.onResponse) {
      this.log('Les intercepteurs personnalisés ont été mis à jour. Notez que les intercepteurs Axios existants ne sont pas automatiquement remplacés sans recréer l\'instance ou éjecter les anciens.');
      // Ici, si besoin, il faudrait re-créer this.axiosInstance et re-configurer les intercepteurs
    }
  }

  public getConfig(): ApiConfig {
    return { ...this.config };
  }

  public clearToken(): void {
    this.currentToken = null;
  }

  public setToken(token: string): void {
    this.currentToken = token;
  }

  public isAuthEnabled(): boolean {
    return this.config.enableAuth;
  }

  public updateAuthFunctions(
    getSession?: GetSessionFunction,
    signOut?: SignOutFunction
  ): void {
    if (getSession) {
      this.config.getSession = getSession;
    }
    if (signOut) {
      this.config.signOut = signOut;
    }
  }
}