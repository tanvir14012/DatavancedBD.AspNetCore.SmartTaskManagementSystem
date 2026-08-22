export const environment = {
  production: false,
  apiGatewayUrl: 'http://localhost:5000/api',
  /** Public CDN base URL served by Nginx. For local dev, proxied through the API gateway. */
  cdnBaseUrl: 'http://localhost:5000/cdn',
  /** Default API version applied to all versioned API requests. */
  apiVersion: '1.0',
  oidc: {
    issuer: 'http://localhost:5001',
    clientId: 'usm-inventory-spa',
    scope: 'openid profile email offline_access api',
    redirectUri: `${window.location.origin}/callback`,
    postLogoutRedirectUri: `${window.location.origin}/logout`,
    responseType: 'code',
    useSilentRefresh: true,
    silentRefreshTimeout: 5000,
    timeoutFactor: 0.75,
    sessionChecksEnabled: false,
    showDebugInformation: true,
    clearHashAfterLogin: true,
    requireHttps: false,
  },
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru'],
  cacheTtlMs: 5 * 60 * 1000,
};
