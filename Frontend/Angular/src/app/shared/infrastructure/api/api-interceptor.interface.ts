/**
 * API Interceptor interface
 */

export interface IAPIInterceptor {
  intercept(request: any): any;
}
