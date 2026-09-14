import { HttpInterceptorFn } from '@angular/common/http';

// TODO(SAAS-04): Allowlist API origins and preserve organization context through refresh/retry.
// TODO(SAAS-04): Test using HttpTestingController; reject conflicting context and third-party leakage.
// Intentionally NOT registered; fail explicitly if accidentally wired before implementation.
export const tenantInterceptor: HttpInterceptorFn = () => {
  throw new Error('TODO(SAAS-04): Tenant interceptor is not implemented.');
};
