import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';
import { AuthState, UserProfile } from './models/user-profile.model';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface StoredAuthSession {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authority = environment.oidc.issuer;
  private readonly storageKey = 'usm.auth.session';
  private refreshInFlight: Promise<boolean> | null = null;

  private readonly _state = signal<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    expiresAt: null,
  });

  readonly isAuthenticated = computed(() => this._state().isAuthenticated);
  readonly currentUser = computed(() => this._state().user);
  readonly accessToken = computed(() => this._state().accessToken);

  async initialize(): Promise<boolean> {
    const session = this.readSession();
    if (!session) {
      this.clearState();
      return false;
    }

    if (this.isExpired(session.expiresAt)) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        this.clearSession();
      }
      return refreshed;
    }

    this.applySession(session);
    return true;
  }

  login(): void {
    this.router.navigateByUrl('/login');
  }

  async loginWithPassword(username: string, password: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${this.authority}/login/password`, { username, password }),
    );

    this.persistTokenResponse(response);
    return true;
  }

  async loginWithCac(): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${this.authority}/login/cac`, {}),
    );

    this.persistTokenResponse(response);
    return true;
  }

  async beginFido2Login(): Promise<string> {
    return firstValueFrom(
      this.http.post(
        `${this.authority}/login/fido2/options`,
        {},
        {
          responseType: 'text',
        },
      ),
    );
  }

  async loginWithFido2(assertionResponse: unknown, assertionOptionsJson: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${this.authority}/login/fido2`, {
        assertionResponse,
        assertionOptionsJson,
      }),
    );

    this.persistTokenResponse(response);
    return true;
  }

  async getValidAccessToken(): Promise<string | null> {
    const current = this.readSession();
    if (!current?.accessToken) {
      return null;
    }

    if (this.isExpired(current.expiresAt, 30_000)) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        this.clearSession();
        return null;
      }
    }

    return this._state().accessToken;
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const session = this.readSession();
    if (!session?.refreshToken) {
      this.clearSession();
      return false;
    }

    this.refreshInFlight = this.performRefresh(session.refreshToken);

    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/login');
  }

  clearSession(): void {
    localStorage.removeItem(this.storageKey);
    this.clearState();
  }

  getAccessToken(): string | null {
    return this._state().accessToken;
  }

  hasPermission(permission: string): boolean {
    const perms = this.getPermissions();
    return perms.includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    const perms = this.getPermissions();
    return permissions.some((permission) => perms.includes(permission));
  }

  hasAllPermissions(permissions: string[]): boolean {
    const perms = this.getPermissions();
    return permissions.every((permission) => perms.includes(permission));
  }

  hasRole(role: string): boolean {
    const roles = this.getRoles();
    return roles.includes(role);
  }

  private async performRefresh(refreshToken: string): Promise<boolean> {
    const body = new HttpParams()
      .set('grant_type', 'refresh_token')
      .set('client_id', environment.oidc.clientId)
      .set('refresh_token', refreshToken);

    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${this.authority}/connect/token`, body.toString(), {
        headers: new HttpHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );

    this.persistTokenResponse(response);
    return true;
  }

  private persistTokenResponse(response: TokenResponse): void {
    const expiresAt = Date.now() + response.expires_in * 1000;
    const session: StoredAuthSession = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? this.readSession()?.refreshToken ?? null,
      expiresAt,
    };

    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.applySession(session);
  }

  private applySession(session: StoredAuthSession): void {
    const claims = this.decodeClaims(session.accessToken);
    this._state.set({
      isAuthenticated: !this.isExpired(session.expiresAt),
      user: claims,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
    });
  }

  private clearState(): void {
    this._state.set({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      expiresAt: null,
    });
  }

  private readSession(): StoredAuthSession | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as StoredAuthSession;
      if (!parsed.accessToken || !parsed.expiresAt) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private decodeClaims(token: string): UserProfile | null {
    try {
      return jwtDecode<UserProfile>(token);
    } catch {
      return null;
    }
  }

  private isExpired(expiresAt: number, skewMs = 0): boolean {
    return Date.now() >= expiresAt - skewMs;
  }

  private getPermissions(): string[] {
    const user = this._state().user;
    if (!user?.permissions) return [];
    return Array.isArray(user.permissions)
      ? user.permissions
      : user.permissions.split(',').map((permission) => permission.trim());
  }

  private getRoles(): string[] {
    const user = this._state().user;
    if (!user?.roles) return [];
    return Array.isArray(user.roles)
      ? user.roles
      : user.roles.split(',').map((role) => role.trim());
  }
}
