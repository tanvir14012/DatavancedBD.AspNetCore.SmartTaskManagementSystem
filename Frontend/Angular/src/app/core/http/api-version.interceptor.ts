import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const API_VERSION_HEADER = 'api-version';
const API_VERSION_PARAM = 'api-version';
/** Custom request header that allows per-request version override. Stripped before forwarding. */
const OVERRIDE_HEADER = 'X-Api-Version';

/**
 * Appends the configured API version as a query parameter to every request
 * that targets the API gateway. Respects per-request overrides via
 * `X-Api-Version` header and leaves already-versioned requests unchanged.
 *
 * Versioning strategy: query-string (`?api-version=1.0`) per ASP.NET Core
 * Asp.Versioning defaults. The header variant is also forwarded so server-side
 * header-based versioning middlewares can read it.
 */
export const apiVersionInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept requests that target our API gateway
  if (!req.url.startsWith(environment.apiGatewayUrl)) {
    return next(req);
  }

  // Resolve the version: explicit override > environment default
  const override = req.headers.get(OVERRIDE_HEADER);
  const version = override ?? environment.apiVersion;

  // Build a cloned request without the internal override header and with the
  // version applied as both a query param and a header (supports both
  // query-string and header versioning strategies on the server side).
  let headers = req.headers.delete(OVERRIDE_HEADER);

  // Only set the header if not already present
  if (!headers.has(API_VERSION_HEADER)) {
    headers = headers.set(API_VERSION_HEADER, version);
  }

  // Only append the query param if not already present
  let params = req.params;
  if (!params.has(API_VERSION_PARAM)) {
    params = params.set(API_VERSION_PARAM, version);
  }

  return next(req.clone({ headers, params }));
};
