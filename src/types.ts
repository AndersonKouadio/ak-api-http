import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public context?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string) {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type SearchParams = Record<
  string,
  string | number | boolean | undefined
>;

export type ServiceType =
  | 'service_1'
  | 'service_2'
  | 'service_3'
  | 'service_4'
  | 'service_5';

export interface RequestConfig {
  endpoint: string;
  method: HttpMethod;
  data?: any;
  searchParams?: SearchParams;
  service?: 'public' | 'private' | ServiceType;
  config?: AxiosRequestConfig;
}

export interface ServiceConfig {
  url: string;
  enableAuth?: boolean;
}

export interface SessionData {
  accessToken: string;
  [key: string]: any;
}

export type GetSessionFunction = () => Promise<SessionData | null>;
export type SignOutFunction = () => Promise<void>;

export type RequestInterceptor = (
  config: AxiosRequestConfig
) => AxiosRequestConfig | Promise<AxiosRequestConfig>;
export type ResponseInterceptor = (
  response: AxiosResponse
) => AxiosResponse | Promise<AxiosResponse>;
export type ResponseErrorInterceptor = (error: AxiosError) => Promise<any>;

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  enableAuth?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  services?: {
    public: ServiceConfig;
    private: ServiceConfig;
  } & Partial<Record<ServiceType, ServiceConfig>>;

  getSession?: GetSessionFunction;
  signOut?: SignOutFunction;
  onRequestError?: (error: ApiError) => void;
  debug?: boolean;
  // Nouvelles propriétés pour les intercepteurs personnalisés
  onRequest?: RequestInterceptor;
  onResponse?: ResponseInterceptor;
}

export interface RetryableAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}
