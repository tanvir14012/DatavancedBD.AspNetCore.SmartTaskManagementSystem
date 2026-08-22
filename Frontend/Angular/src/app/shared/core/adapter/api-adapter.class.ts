/**
 * API Adapter for converting between API responses and internal models
 */

import { IAdapter } from './adapter.interface';

export interface IAPIResponse<T = any> {
  data?: T;
  status?: number;
  message?: string;
  errors?: any;
  metadata?: Record<string, any>;
}

export interface IAPIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Adapter for API responses
 */
export class APIAdapter<TAPIResponse, TInternal> implements IAdapter<IAPIResponse<TAPIResponse>, TInternal> {
  constructor(
    private dataExtractor: (response: IAPIResponse<TAPIResponse>) => TAPIResponse,
    private transformer: (data: TAPIResponse) => TInternal,
    private errorHandler?: (error: IAPIError) => never
  ) {}

  /**
   * Adapt API response to internal model
   */
  adapt(response: IAPIResponse<TAPIResponse>): TInternal {
    if (!response.data && response.errors) {
      if (this.errorHandler) {
        this.errorHandler(response.errors);
      }
      throw new Error(response.message || 'API Error');
    }

    const data = this.dataExtractor(response);
    return this.transformer(data);
  }

  /**
   * Adapt array of API responses
   */
  adaptArray(responses: IAPIResponse<TAPIResponse>[]): TInternal[] {
    return responses.map(response => this.adapt(response));
  }

  /**
   * Create an adapter with default data extractor
   */
  static create<TAPIResponse, TInternal>(
    transformer: (data: TAPIResponse) => TInternal,
    errorHandler?: (error: IAPIError) => never
  ): APIAdapter<TAPIResponse, TInternal> {
    return new APIAdapter(
      (response) => response.data as TAPIResponse,
      transformer,
      errorHandler
    );
  }
}

/**
 * Generic API response adapter
 */
export class GenericAPIAdapter<T = any> implements IAdapter<IAPIResponse<T>, T> {
  constructor(private errorHandler?: (error: IAPIError) => never) {}

  /**
   * Adapt API response to internal model
   */
  adapt(response: IAPIResponse<T>): T {
    if (!response.data && response.errors) {
      if (this.errorHandler) {
        this.errorHandler(response.errors);
      }
      throw new Error(response.message || 'API Error');
    }

    return response.data as T;
  }

  /**
   * Adapt array of API responses
   */
  adaptArray(responses: IAPIResponse<T>[]): T[] {
    return responses.map(response => this.adapt(response));
  }
}

/**
 * API error handler utilities
 */
export class APIErrorHandlers {
  /**
   * Throw with standard error
   */
  static throwError(error: IAPIError): never {
    throw new Error(`${error.code}: ${error.message}`);
  }

  /**
   * Log and throw
   */
  static logAndThrow(error: IAPIError): never {
    console.error('API Error:', error);
    APIErrorHandlers.throwError(error);
  }

  /**
   * Custom handler
   */
  static custom(handler: (error: IAPIError) => never): (error: IAPIError) => never {
    return handler;
  }
}

/**
 * Example usage:
 * 
 * interface UserAPI {
 *   id: number;
 *   first_name: string;
 *   last_name: string;
 * }
 * 
 * interface User {
 *   id: number;
 *   fullName: string;
 * }
 * 
 * const userAdapter = APIAdapter.create<UserAPI, User>(
 *   (apiUser) => ({
 *     id: apiUser.id,
 *     fullName: `${apiUser.first_name} ${apiUser.last_name}`
 *   }),
 *   APIErrorHandlers.logAndThrow
 * );
 * 
 * const response: IAPIResponse<UserAPI> = {
 *   data: { id: 1, first_name: 'John', last_name: 'Doe' },
 *   status: 200
 * };
 * 
 * const user = userAdapter.adapt(response);
 */
