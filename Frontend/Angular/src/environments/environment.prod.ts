export const environment = {
  production: true,
  apiBaseUrl: '/api',
  apiGatewayUrl: '/api',
  /** Public CDN base URL served by Nginx edge proxy in production. */
  cdnBaseUrl: 'https://cdn.yourdomain.com',
  /** Default API version applied to all versioned API requests. */
  apiVersion: '1.0',
  oidc: {
    issuer: 'https://identity.yourdomain.com',
    clientId: 'usm-inventory-spa',
    scope: 'openid profile email offline_access api',
    redirectUri: `${window.location.origin}/callback`,
    postLogoutRedirectUri: `${window.location.origin}/logout`,
    responseType: 'code',
    useSilentRefresh: true,
    silentRefreshTimeout: 5000,
    timeoutFactor: 0.75,
    sessionChecksEnabled: true,
    showDebugInformation: false,
    clearHashAfterLogin: true,
    requireHttps: true,
  },
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru'],
  cacheTtlMs: 5 * 60 * 1000,
};
