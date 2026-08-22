import { ActivatedRouteSnapshot, Params, Router, UrlTree } from '@angular/router';

export function normalizeRouteSegment(segment: string): string {
  return segment.trim().replace(/^\/+|\/+$/g, '');
}

export function joinRoutePaths(...segments: Array<string | null | undefined>): string {
  return segments
    .filter(
      (segment): segment is string => typeof segment === 'string' && segment.trim().length > 0,
    )
    .map(normalizeRouteSegment)
    .filter(Boolean)
    .join('/');
}

export function compactQueryParams(params: Params): Params {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    ),
  );
}

export function routeDataString(route: ActivatedRouteSnapshot, key: string): string | undefined {
  const value = route.data[key];
  return typeof value === 'string' ? value : undefined;
}

export function createReturnUrlTree(
  router: Router,
  returnUrl: string | null | undefined,
  fallback = '/',
): UrlTree {
  const target = returnUrl?.trim() || fallback;
  return router.parseUrl(target.startsWith('/') ? target : `/${target}`);
}
