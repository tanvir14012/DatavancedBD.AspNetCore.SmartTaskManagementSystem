import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';

export const authConfig: AuthConfig = {
  issuer: environment.oidc.issuer,
  clientId: environment.oidc.clientId,
  redirectUri: environment.oidc.redirectUri,
  postLogoutRedirectUri: environment.oidc.postLogoutRedirectUri,
  responseType: environment.oidc.responseType,
  scope: environment.oidc.scope,
  useSilentRefresh: environment.oidc.useSilentRefresh,
  silentRefreshTimeout: environment.oidc.silentRefreshTimeout,
  timeoutFactor: environment.oidc.timeoutFactor,
  sessionChecksEnabled: environment.oidc.sessionChecksEnabled,
  showDebugInformation: environment.oidc.showDebugInformation,
  clearHashAfterLogin: environment.oidc.clearHashAfterLogin,
  requireHttps: environment.oidc.requireHttps,
  // PKCE is default in angular-oauth2-oidc v12+
};
