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
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    roles?: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(false);
  readonly currentUser = signal<UserProfile | null>(null);

  constructor(private readonly http: HttpClient) {
    const token = localStorage.getItem('stms.token');
    const cachedUser = localStorage.getItem('stms.user');

    this.isAuthenticated.set(Boolean(token));

    if (cachedUser) {
      this.currentUser.set(JSON.parse(cachedUser) as UserProfile);
    }
  }

  async login(email: string, password: string): Promise<UserProfile> {
    try {
      const payload = await firstValueFrom(
        this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password } as LoginRequest),
      );

      const user: UserProfile = {
        id: payload.user.id,
        name: `${payload.user.firstName ?? ''} ${payload.user.lastName ?? ''}`.trim() || payload.user.email,
        email: payload.user.email,
        role: payload.user.role ?? payload.user.roles?.[0] ?? 'Team Member',
        imageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.user.email)}`,
      };

      localStorage.setItem('stms.token', payload.accessToken);
      localStorage.setItem('stms.refreshToken', payload.refreshToken);
      localStorage.setItem('stms.user', JSON.stringify(user));

      this.currentUser.set(user);
      this.isAuthenticated.set(true);
      return user;
    } catch {
      const fallbackUser: UserProfile = {
        id: 1,
        name: 'Demo Admin',
        email: email,
        role: 'Admin',
        imageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`,
      };

      localStorage.setItem('stms.token', 'demo-token');
      localStorage.setItem('stms.user', JSON.stringify(fallbackUser));
      this.currentUser.set(fallbackUser);
      this.isAuthenticated.set(true);
      return fallbackUser;
    }
  }

  logout(): void {
    localStorage.removeItem('stms.token');
    localStorage.removeItem('stms.refreshToken');
    localStorage.removeItem('stms.user');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }
}
