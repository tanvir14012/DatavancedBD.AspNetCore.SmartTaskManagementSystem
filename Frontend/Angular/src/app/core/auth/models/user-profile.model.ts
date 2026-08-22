export interface UserProfile {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  preferred_username?: string;
  /** Comma-separated or array of permission codes */
  permissions?: string | string[];
  roles?: string | string[];
  tenant_id?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  accessToken: string | null;
  expiresAt: number | null;
}
