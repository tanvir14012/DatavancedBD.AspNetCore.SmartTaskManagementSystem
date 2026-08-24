import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../models/menu-item.model';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    roles?: string[];
  };
}

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

interface RegisterRequest {
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(false);
  readonly currentUser = signal<UserProfile | null>(null);

  private refreshTimerId: number | null = null;

  constructor(private readonly http: HttpClient) {
    const token = localStorage.getItem('stms.token');
    const cachedUser = localStorage.getItem('stms.user');
    const expiresAt = Number(localStorage.getItem('stms.expiresAt'));

    this.isAuthenticated.set(Boolean(token));

    if (cachedUser) {
      this.currentUser.set(JSON.parse(cachedUser) as UserProfile);
    }

    if (token && Number.isFinite(expiresAt)) {
      this.scheduleRefresh(expiresAt);
    }
  }

  async login(email: string, password: string): Promise<UserProfile> {
    const payload = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password } as LoginRequest, {
        withCredentials: true,
      }),
    );

    const user = this.toUserProfile(payload.user);
    this.persistSession(payload.accessToken, payload.expiresIn, user);
    return user;
  }

  async register(payload: RegisterRequest): Promise<UserProfile> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/register`, payload, {
        withCredentials: true,
      }),
    );

    const user = this.toUserProfile(response.user);
    this.persistSession(response.accessToken, response.expiresIn, user);
    return user;
  }

  async refreshAccessToken(): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<RefreshResponse>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true }),
    );

    const user = this.currentUser();
    if (user) {
      localStorage.setItem('stms.user', JSON.stringify(user));
    }

    localStorage.setItem('stms.token', response.accessToken);
    localStorage.setItem('stms.expiresAt', String(Date.now() + response.expiresIn * 1000));
    this.scheduleRefresh(Date.now() + response.expiresIn * 1000);
    return response.accessToken;
  }

  logout(): void {
    this.clearRefreshTimer();

    if (localStorage.getItem('stms.token')) {
      this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({
        error: () => undefined,
      });
    }

    localStorage.removeItem('stms.token');
    localStorage.removeItem('stms.user');
    localStorage.removeItem('stms.expiresAt');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  private persistSession(accessToken: string, expiresIn: number, user: UserProfile): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem('stms.token', accessToken);
    localStorage.setItem('stms.expiresAt', String(expiresAt));
    localStorage.setItem('stms.user', JSON.stringify(user));

    this.currentUser.set(user);
    this.isAuthenticated.set(true);
    this.scheduleRefresh(expiresAt);
  }

  private toUserProfile(user: LoginResponse['user']): UserProfile {
    const firstName = user.firstName?.trim() ?? '';
    const lastName = user.lastName?.trim() ?? '';

    return {
      id: user.id,
      name: `${firstName} ${lastName}`.trim() || user.email,
      email: user.email,
      role: user.role ?? user.roles?.[0] ?? 'Team Member',
      imageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email)}`,
    };
  }

  private scheduleRefresh(expiresAt: number): void {
    this.clearRefreshTimer();

    const delayMs = expiresAt - Date.now() - 60_000;
    if (delayMs <= 0) {
      void this.refreshAccessToken().catch(() => this.logout());
      return;
    }

    this.refreshTimerId = window.setTimeout(() => {
      void this.refreshAccessToken().catch(() => this.logout());
    }, delayMs);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      window.clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }
}
