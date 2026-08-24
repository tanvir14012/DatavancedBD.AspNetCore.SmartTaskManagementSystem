import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile } from '../models/menu-item.model';
import { MenuService } from './menu.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';

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

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly menuService = inject(MenuService);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);

  private readonly authStateSubject = new BehaviorSubject<AuthState>(this.readStoredState());

  readonly authState$ = this.authStateSubject.asObservable();
  readonly isAuthenticated$ = this.authState$.pipe(
    map((state) => state.isAuthenticated),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  readonly currentUser$ = this.authState$.pipe(
    map((state) => state.user),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  readonly isAuthenticated = signal(this.authStateSubject.value.isAuthenticated);
  readonly currentUser = signal<UserProfile | null>(this.authStateSubject.value.user);

  private refreshTimerId: number | null = null;

  constructor(private readonly http: HttpClient) {
    this.syncSignals(this.authStateSubject.value);
    this.restoreSession();
  }

  login(email: string, password: string): Observable<UserProfile> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password } as LoginRequest, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          const user = this.toUserProfile(response.user);
          this.persistSession(response.accessToken, response.expiresIn, user);
        }),
        map((response) => this.toUserProfile(response.user)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
  }

  register(payload: RegisterRequest): Observable<UserProfile> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/register`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          const user = this.toUserProfile(response.user);
          this.persistSession(response.accessToken, response.expiresIn, user);
        }),
        map((response) => this.toUserProfile(response.user)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
  }

  refreshAccessToken(): Observable<string> {
    return this.http
      .post<RefreshResponse>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((response) => {
          const expiresAt = Date.now() + response.expiresIn * 1000;
          this.persistToken(response.accessToken, expiresAt);
        }),
        map((response) => response.accessToken),
        shareReplay({ bufferSize: 1, refCount: true }),
        catchError((error) => {
          this.logout().subscribe();
          return throwError(() => error);
        }),
      );
  }

  logout(): Observable<void> {
    this.clearRefreshTimer();
    this.projectService.clearListCache();
    this.taskService.clearListCache();
    this.menuService.clearMenus();

    const request$ = localStorage.getItem('stms.token')
      ? this.http.post<void>(`${environment.apiBaseUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
          catchError(() => of(void 0)),
        )
      : of(void 0);

    return request$.pipe(
      tap(() => {
        localStorage.removeItem('stms.token');
        localStorage.removeItem('stms.user');
        localStorage.removeItem('stms.expiresAt');
        this.syncSignals({ token: null, expiresAt: null, user: null, isAuthenticated: false });
      }),
    );
  }

  private restoreSession(): void {
    const state = this.readStoredState();
    if (state.isAuthenticated && state.expiresAt !== null) {
      this.scheduleRefresh(state.expiresAt);
    }
  }

  private persistSession(accessToken: string, expiresIn: number, user: UserProfile): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem('stms.token', accessToken);
    localStorage.setItem('stms.expiresAt', String(expiresAt));
    localStorage.setItem('stms.user', JSON.stringify(user));

    this.projectService.clearListCache();
    this.taskService.clearListCache();
    this.menuService.clearMenus();

    this.syncSignals({ token: accessToken, expiresAt, user, isAuthenticated: true });
    this.scheduleRefresh(expiresAt);
  }

  private persistToken(accessToken: string, expiresAt: number): void {
    localStorage.setItem('stms.token', accessToken);
    localStorage.setItem('stms.expiresAt', String(expiresAt));

    const currentUser = this.authStateSubject.value.user;
    if (currentUser) {
      localStorage.setItem('stms.user', JSON.stringify(currentUser));
    }

    this.syncSignals({
      token: accessToken,
      expiresAt,
      user: currentUser,
      isAuthenticated: currentUser !== null,
    });

    this.scheduleRefresh(expiresAt);
  }

  private readStoredState(): AuthState {
    const token = localStorage.getItem('stms.token');
    const cachedUser = localStorage.getItem('stms.user');
    const expiresAt = Number(localStorage.getItem('stms.expiresAt'));
    const user = cachedUser ? (JSON.parse(cachedUser) as UserProfile) : null;

    return {
      token: token ?? null,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
      user,
      isAuthenticated: Boolean(token && user),
    };
  }

  private syncSignals(state: AuthState): void {
    this.authStateSubject.next(state);
    this.currentUser.set(state.user);
    this.isAuthenticated.set(state.isAuthenticated);
  }

  private toUserProfile(user: LoginResponse['user']): UserProfile {
    const firstName = user.firstName?.trim() ?? '';
    const lastName = user.lastName?.trim() ?? '';
    const role = this.normalizeRole(user.role ?? user.roles?.[0] ?? 'Team Member');

    return {
      id: user.id,
      name: `${firstName} ${lastName}`.trim() || user.email,
      email: user.email,
      role,
      imageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email)}`,
    };
  }

  private normalizeRole(value: string | undefined | null): string {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      return 'Team Member';
    }

    const compact = normalized.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');

    if (compact === 'admin') {
      return 'Admin';
    }

    if (compact === 'project manager' || compact === 'projectmanager') {
      return 'Project Manager';
    }

    if (compact === 'team member' || compact === 'teammember' || compact === 'member') {
      return 'Team Member';
    }

    return normalized;
  }

  private scheduleRefresh(expiresAt: number): void {
    this.clearRefreshTimer();

    const delayMs = expiresAt - Date.now() - 60_000;
    if (delayMs <= 0) {
      this.refreshAccessToken().subscribe();
      return;
    }

    this.refreshTimerId = window.setTimeout(() => {
      this.refreshAccessToken().subscribe();
    }, delayMs);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      window.clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }
}
