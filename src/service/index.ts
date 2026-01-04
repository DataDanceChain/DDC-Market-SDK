import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import type { ApiResponse, ApiRequestConfig } from '../types';

/**
 * HTTP Service for API requests
 * Provides type-safe wrapper around axios with generic response handling
 */
class HttpService {
  private axiosInstance: AxiosInstance;
  private baseURL: string;

  /**
   * Create HTTP service instance
   * @param baseURL - Base URL for all requests
   * @param config - Optional axios configuration
   */
  constructor(baseURL: string = '', config?: AxiosRequestConfig) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      baseURL,
      timeout: config?.timeout ?? Number(import.meta.env.API_TIMEOUT || 30000),
      headers: {
        'Content-Type': 'application/json',
        ...(config?.headers || {}),
      },
      ...config,
    });

    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config: any) => {
        // You can add auth tokens or other headers here
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: any) => {
        return response;
      },
      (error: AxiosError) => {
        // Global error handling can be added here
        return Promise.reject(error);
      }
    );
  }

  /**
   * Parse axios response to unified ApiResponse format
   * @param response - Axios response or error object
   * @returns Unified API response with discriminated union type
   */
  private parseResponse<T>(response: AxiosResponse<T> | { err: AxiosError }): ApiResponse<T> {
    // Error case
    if ('err' in response) {
      return {
        success: false,
        data: null,
        error: response.err,
        status: response.err.response?.status ?? null,
      };
    }

    // Success case
    return {
      success: true,
      data: response.data,
      error: null,
      status: response.status,
    };
  }

  /**
   * Generic GET request
   * @param uri - Request URI (relative to baseURL)
   * @param config - Optional request configuration
   * @returns Promise with typed API response
   *
   * @example
   * ```typescript
   * const response = await httpService.get<User>('/users/123');
   * if (response.success) {
   *   console.log(response.data.name); // data is User
   * } else {
   *   console.error(response.error.message); // error is AxiosError
   * }
   * ```
   */
  public async get<T = unknown>(uri: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<T>(uri, {
        params: config?.params,
        headers: config?.headers,
        ...config,
      });
      return this.parseResponse<T>(response);
    } catch (err) {
      return this.parseResponse<T>({ err: err as AxiosError });
    }
  }

  /**
   * Generic POST request
   * @param uri - Request URI (relative to baseURL)
   * @param data - Request body data
   * @param config - Optional request configuration
   * @returns Promise with typed API response
   *
   * @example
   * ```typescript
   * const response = await httpService.post<User>('/users', { name: 'Alice' });
   * if (response.success) {
   *   console.log('User created:', response.data.id); // data is User
   * }
   * ```
   */
  public async post<T = unknown>(
    uri: string,
    data?: unknown,
    config?: ApiRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<T>(uri, data, {
        headers: config?.headers,
        ...config,
      });
      return this.parseResponse<T>(response);
    } catch (err) {
      return this.parseResponse<T>({ err: err as AxiosError });
    }
  }

  /**
   * Update base URL
   * @param baseURL - New base URL
   */
  public setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
    this.axiosInstance.defaults.baseURL = baseURL;
  }

  /**
   * Set default headers
   * @param headers - Headers to set
   */
  public setHeaders(headers: Record<string, string>): void {
    Object.assign(this.axiosInstance.defaults.headers.common, headers);
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

/**
 * Default HTTP service singleton instance
 * Automatically configured with environment-specific base URL from .env files
 *
 * - Development: Uses .env.development (e.g., http://localhost:3000)
 * - Production: Uses .env.production (e.g., https://api.ddc-market.com)
 *
 * Environment variables are injected by Vite at build time.
 *
 * You can override the baseURL at runtime:
 * @example
 * ```typescript
 * httpService.setBaseURL('https://custom-api.com');
 * ```
 */
export const httpService = new HttpService(import.meta.env.API_BASE_URL || '');

/**
 * Convenience function for GET requests
 * @param uri - Request URI
 * @param config - Optional request configuration
 * @returns Promise with typed API response
 *
 * @example
 * ```typescript
 * const response = await requestGet<UserData>('/api/users/123');
 * if (response.success) {
 *   console.log(response.data.name); // data is UserData
 * } else {
 *   console.error(response.error.message); // error is AxiosError
 * }
 * ```
 */
export async function requestGet<T = unknown>(
  uri: string,
  config?: ApiRequestConfig
): Promise<ApiResponse<T>> {
  return httpService.get<T>(uri, config);
}

/**
 * Convenience function for POST requests
 * @param uri - Request URI
 * @param data - Request body data
 * @param config - Optional request configuration
 * @returns Promise with typed API response
 *
 * @example
 * ```typescript
 * const response = await requestPost<User>('/api/users', {
 *   name: 'Alice',
 *   email: 'alice@example.com'
 * });
 * if (response.success) {
 *   console.log('Created user:', response.data.id); // data is User
 * } else {
 *   console.error('Failed:', response.error.message); // error is AxiosError
 * }
 * ```
 */
export async function requestPost<T = unknown>(
  uri: string,
  data?: unknown,
  config?: ApiRequestConfig
): Promise<ApiResponse<T>> {
  return httpService.post<T>(uri, data, config);
}

// Export types for external use
export type { ApiResponse, ApiRequestConfig } from '../types';
