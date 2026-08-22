import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector.component';

interface PublicKeyCredentialRequestOptionsJson {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{
    type: PublicKeyCredentialType;
    id: string;
    transports?: AuthenticatorTransport[];
  }>;
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
}

type Tab = 'password' | 'cac' | 'fido2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LanguageSelectorComponent,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-page">
      <!-- Left brand panel -->
      <div class="brand-panel">
        <div class="brand-content">
          <div class="brand-logo">
            <svg viewBox="0 0 20 20" fill="currentColor" width="28" height="28" class="star-icon">
              <path d="M10 1.5l2.4 5 5.5.8-4 3.9.95 5.5L10 14.1l-4.85 2.6.95-5.5-4-3.9 5.5-.8z" />
            </svg>
            <span>ORDISS</span>
          </div>
          <h1>Operational Resource &amp; Defense Inventory Supply System</h1>
          <p>
            Secure, mission-ready supply chain management for authorized U.S. military personnel.
          </p>

          <div class="brand-features">
            <div class="brand-feature">
              <span class="bf-icon">🔒</span>
              <div>
                <strong>Zero-Trust Security</strong>
                <span>DoD-grade access control</span>
              </div>
            </div>
            <div class="brand-feature">
              <span class="bf-icon">📦</span>
              <div>
                <strong>14 Supply Modules</strong>
                <span>End-to-end logistics coverage</span>
              </div>
            </div>
            <div class="brand-feature">
              <span class="bf-icon">📊</span>
              <div>
                <strong>Real-Time Visibility</strong>
                <span>Live dashboards &amp; alerts</span>
              </div>
            </div>
          </div>

          <a routerLink="/home" class="back-link">← {{ 'loginPage.backPublicSite' | translate }}</a>
        </div>

        <!-- Decorative shield SVG -->
        <svg
          class="deco-shield"
          viewBox="0 0 200 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="shG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="rgba(74,222,128,0.12)" />
              <stop offset="100%" stop-color="rgba(74,222,128,0.03)" />
            </linearGradient>
          </defs>
          <path
            d="M100 10 L175 42 L175 105 C175 148 140 178 100 190 C60 178 25 148 25 105 L25 42 Z"
            fill="url(#shG)"
            stroke="rgba(74,222,128,0.2)"
            stroke-width="1"
          />
          <path
            d="M100 24 L165 52 L165 105 C165 140 134 167 100 178 C66 167 35 140 35 105 L35 52 Z"
            fill="none"
            stroke="rgba(74,222,128,0.1)"
            stroke-width="0.8"
          />
        </svg>
      </div>

      <!-- Right login form -->
      <div class="form-panel">
        <div class="form-content">
          <div class="form-topbar">
            <app-language-selector variant="light"></app-language-selector>
          </div>
          <div class="form-header">
            <h2>{{ 'auth.signIn' | translate }}</h2>
            <p>{{ 'loginPage.accessSystem' | translate }}</p>
          </div>

          <!-- Auth method tabs -->
          <div class="auth-tabs">
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'password'"
              (click)="setTab('password')"
            >
              <svg viewBox="0 0 18 18" fill="none" width="16" height="16">
                <rect
                  x="1"
                  y="8"
                  width="16"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <path
                  d="M5 8V5.5a4 4 0 018 0V8"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
                <circle cx="9" cy="13" r="1.5" fill="currentColor" />
              </svg>
              {{ 'auth.passwordLogin' | translate }}
            </button>
            <button class="tab-btn" [class.active]="activeTab() === 'cac'" (click)="setTab('cac')">
              <svg viewBox="0 0 18 18" fill="none" width="16" height="16">
                <rect
                  x="1"
                  y="4"
                  width="16"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <line x1="1" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="1.5" />
                <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              </svg>
              {{ 'loginPage.cacCard' | translate }}
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'fido2'"
              (click)="setTab('fido2')"
            >
              <svg viewBox="0 0 18 18" fill="none" width="16" height="16">
                <path
                  d="M9 1 L16 4 L16 10 C16 14 12.5 17 9 18 C5.5 17 2 14 2 10 L2 4 Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                />
                <path
                  d="M6 9l2 2 4-4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              {{ 'loginPage.fido2Key' | translate }}
            </button>
          </div>

          <!-- Password Tab -->
          @if (activeTab() === 'password') {
            <form [formGroup]="form" (ngSubmit)="onPasswordSignIn()" class="auth-form">
              <div class="field">
                <label for="username">{{ 'auth.username' | translate }}</label>
                <input
                  id="username"
                  formControlName="username"
                  [placeholder]="'loginPage.usernamePlaceholder' | translate"
                  autocomplete="username"
                  [class.invalid]="form.get('username')?.invalid && form.get('username')?.touched"
                />
                @if (form.get('username')?.invalid && form.get('username')?.touched) {
                  <span class="field-error">{{ 'loginPage.usernameRequired' | translate }}</span>
                }
              </div>
              <div class="field">
                <label for="password">{{ 'auth.password' | translate }}</label>
                <div class="pw-wrap">
                  <input
                    id="password"
                    formControlName="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    [placeholder]="'loginPage.passwordPlaceholder' | translate"
                    autocomplete="current-password"
                    [class.invalid]="form.get('password')?.invalid && form.get('password')?.touched"
                  />
                  <button type="button" class="pw-toggle" (click)="showPassword.update((v) => !v)">
                    @if (showPassword()) {
                      <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                        <path
                          d="M2 10s3-7 8-7 8 7 8 7-3 7-8 7-8-7-8-7z"
                          stroke="currentColor"
                          stroke-width="1.5"
                        />
                        <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
                        <line
                          x1="2"
                          y1="2"
                          x2="18"
                          y2="18"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                      </svg>
                    } @else {
                      <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                        <path
                          d="M2 10s3-7 8-7 8 7 8 7-3 7-8 7-8-7-8-7z"
                          stroke="currentColor"
                          stroke-width="1.5"
                        />
                        <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" />
                      </svg>
                    }
                  </button>
                </div>
                @if (form.get('password')?.invalid && form.get('password')?.touched) {
                  <span class="field-error">{{ 'loginPage.passwordRequired' | translate }}</span>
                }
              </div>
              <button type="submit" class="btn-submit" [disabled]="isBusy()">
                @if (isBusy()) {
                  <span class="spinner"></span> {{ 'loginPage.signingIn' | translate }}
                } @else {
                  {{ 'loginPage.signInWithPassword' | translate }}
                }
              </button>
            </form>
          }

          <!-- CAC Tab -->
          @if (activeTab() === 'cac') {
            <div class="auth-form cac-form">
              <div class="method-info">
                <div class="method-icon">
                  <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                    <rect
                      x="4"
                      y="10"
                      width="40"
                      height="28"
                      rx="4"
                      stroke="#C8A96E"
                      stroke-width="2"
                    />
                    <line x1="4" y1="20" x2="44" y2="20" stroke="#C8A96E" stroke-width="2" />
                    <circle
                      cx="12"
                      cy="33"
                      r="4"
                      fill="rgba(200,169,110,0.2)"
                      stroke="#C8A96E"
                      stroke-width="1.5"
                    />
                    <rect
                      x="20"
                      y="29"
                      width="16"
                      height="3"
                      rx="1.5"
                      fill="rgba(200,169,110,0.4)"
                    />
                    <rect
                      x="20"
                      y="34"
                      width="10"
                      height="3"
                      rx="1.5"
                      fill="rgba(200,169,110,0.3)"
                    />
                  </svg>
                </div>
                <div>
                  <strong>Common Access Card (CAC)</strong>
                  <p>
                    Insert your DoD-issued CAC card into the card reader, then click the button
                    below to authenticate using your PKI certificate.
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="btn-submit"
                (click)="onCacSignIn()"
                [disabled]="isBusy()"
              >
                @if (isBusy()) {
                  <span class="spinner"></span> {{ 'loginPage.authenticating' | translate }}
                } @else {
                  {{ 'loginPage.authenticateWithCac' | translate }}
                }
              </button>
            </div>
          }

          <!-- FIDO2 Tab -->
          @if (activeTab() === 'fido2') {
            <div class="auth-form fido2-form">
              <div class="method-info">
                <div class="method-icon">
                  <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                    <path
                      d="M24 4 L42 11 L42 26 C42 36 34 43 24 46 C14 43 6 36 6 26 L6 11 Z"
                      stroke="#4ade80"
                      stroke-width="2"
                      fill="rgba(74,222,128,0.08)"
                    />
                    <path
                      d="M16 24l5 5 11-11"
                      stroke="#4ade80"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <strong>FIDO2 Security Key</strong>
                  <p>
                    Use a hardware security key (YubiKey, etc.) or device biometric
                    (fingerprint/face) for phishing-resistant WebAuthn authentication.
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="btn-submit fido2-btn"
                (click)="onFido2SignIn()"
                [disabled]="isBusy()"
              >
                @if (isBusy()) {
                  <span class="spinner"></span> {{ 'loginPage.waitingForKey' | translate }}
                } @else {
                  {{ 'loginPage.authenticateWithSecurityKey' | translate }}
                }
              </button>
            </div>
          }

          <!-- Error message -->
          @if (error()) {
            <div class="error-banner">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                  clip-rule="evenodd"
                />
              </svg>
              {{ error() ?? '' | translate }}
            </div>
          }

          <p class="footer-note">
            For authorized U.S. military personnel only. All access is monitored and logged.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        font-family: 'Outfit', sans-serif;
      }

      .login-page {
        min-height: 100vh;
        display: flex;
      }

      /* ── LEFT BRAND PANEL ─────────────────────────────────── */
      .brand-panel {
        flex: 0 0 420px;
        width: 420px;
        background: linear-gradient(160deg, #0d2b1d 0%, #1a4731 55%, #0d2b1d 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        padding: 3rem 2.5rem;
      }
      @media (max-width: 900px) {
        .brand-panel {
          display: none;
        }
      }
      .brand-content {
        position: relative;
        z-index: 2;
        width: 100%;
      }
      .brand-logo {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 1.7rem;
        font-weight: 700;
        color: #fff;
        margin-bottom: 2rem;
      }
      .star-icon {
        color: #c8a96e;
      }
      .brand-content h1 {
        font-size: 1.1rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        line-height: 1.5;
        margin: 0 0 0.75rem;
      }
      .brand-content > p {
        color: rgba(255, 255, 255, 0.55);
        font-size: 0.9rem;
        line-height: 1.7;
        margin: 0 0 2.5rem;
      }
      .brand-features {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        margin-bottom: 2.5rem;
      }
      .brand-feature {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
      }
      .bf-icon {
        font-size: 1.2rem;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .brand-feature strong {
        display: block;
        color: #fff;
        font-size: 0.9rem;
        margin-bottom: 0.15rem;
      }
      .brand-feature span {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.82rem;
      }
      .back-link {
        color: rgba(255, 255, 255, 0.45);
        font-size: 0.85rem;
        text-decoration: none;
        transition: color 0.2s;
      }
      .back-link:hover {
        color: #c8a96e;
      }
      .deco-shield {
        position: absolute;
        bottom: -20px;
        right: -30px;
        width: 220px;
        opacity: 0.6;
        pointer-events: none;
      }

      /* ── RIGHT FORM PANEL ─────────────────────────────────── */
      .form-panel {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f7f9f7;
        padding: 2rem;
      }
      @media (max-width: 900px) {
        .form-panel {
          background: linear-gradient(160deg, #0d2b1d, #1a4731);
        }
      }
      .form-content {
        width: 100%;
        max-width: 420px;
      }
      .form-topbar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.75rem;
      }
      .form-header {
        margin-bottom: 2rem;
      }
      .form-header h2 {
        font-size: 2rem;
        font-weight: 700;
        color: #0d2b1d;
        margin: 0 0 0.4rem;
      }
      @media (max-width: 900px) {
        .form-header h2 {
          color: #fff;
        }
      }
      .form-header p {
        color: #6b7280;
        font-size: 0.95rem;
        margin: 0;
      }
      @media (max-width: 900px) {
        .form-header p {
          color: rgba(255, 255, 255, 0.6);
        }
      }

      /* Tabs */
      .auth-tabs {
        display: flex;
        gap: 0.5rem;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 10px;
        padding: 4px;
        margin-bottom: 1.75rem;
      }
      @media (max-width: 900px) {
        .auth-tabs {
          background: rgba(255, 255, 255, 0.1);
        }
      }
      .tab-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.55rem 0.5rem;
        border: none;
        border-radius: 7px;
        cursor: pointer;
        font-family: 'Outfit', sans-serif;
        font-size: 0.82rem;
        font-weight: 600;
        background: transparent;
        color: #6b7280;
        transition: all 0.2s;
        white-space: nowrap;
      }
      .tab-btn.active {
        background: #fff;
        color: #0d2b1d;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
      }
      @media (max-width: 900px) {
        .tab-btn {
          color: rgba(255, 255, 255, 0.55);
        }
        .tab-btn.active {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          box-shadow: none;
        }
      }

      /* Form fields */
      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .field label {
        font-size: 0.88rem;
        font-weight: 600;
        color: #374151;
      }
      @media (max-width: 900px) {
        .field label {
          color: rgba(255, 255, 255, 0.8);
        }
      }
      .field input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1.5px solid #d1d5db;
        border-radius: 8px;
        font-family: 'Outfit', sans-serif;
        font-size: 0.95rem;
        background: #fff;
        color: #111;
        outline: none;
        box-sizing: border-box;
        transition:
          border-color 0.2s,
          box-shadow 0.2s;
      }
      .field input:focus {
        border-color: #2d7a56;
        box-shadow: 0 0 0 3px rgba(45, 122, 86, 0.12);
      }
      .field input.invalid {
        border-color: #dc2626;
      }
      .field-error {
        font-size: 0.78rem;
        color: #dc2626;
      }
      .pw-wrap {
        position: relative;
      }
      .pw-wrap input {
        padding-right: 2.75rem;
      }
      .pw-toggle {
        position: absolute;
        right: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: #9ca3af;
        padding: 2px;
        display: flex;
        align-items: center;
      }
      .pw-toggle:hover {
        color: #374151;
      }

      /* Method info box */
      .method-info {
        display: flex;
        gap: 1rem;
        align-items: flex-start;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 10px;
        padding: 1rem;
      }
      @media (max-width: 900px) {
        .method-info {
          background: rgba(255, 255, 255, 0.08);
        }
      }
      .method-icon {
        flex-shrink: 0;
        margin-top: 2px;
      }
      .method-info strong {
        display: block;
        color: #0d2b1d;
        font-size: 0.95rem;
        margin-bottom: 0.4rem;
      }
      @media (max-width: 900px) {
        .method-info strong {
          color: #fff;
        }
      }
      .method-info p {
        color: #6b7280;
        font-size: 0.85rem;
        line-height: 1.6;
        margin: 0;
      }
      @media (max-width: 900px) {
        .method-info p {
          color: rgba(255, 255, 255, 0.55);
        }
      }

      /* Submit button */
      .btn-submit {
        width: 100%;
        padding: 0.9rem 1rem;
        border: none;
        border-radius: 8px;
        background: #0d2b1d;
        color: #fff;
        font-family: 'Outfit', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        letter-spacing: 0.02em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition:
          background 0.2s,
          transform 0.2s,
          box-shadow 0.2s;
        margin-top: 0.25rem;
      }
      .btn-submit:hover:not(:disabled) {
        background: #1a4731;
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(13, 43, 29, 0.25);
      }
      .btn-submit:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .fido2-btn {
        background: #1a4731;
      }
      .fido2-btn:hover:not(:disabled) {
        background: #2d7a56;
      }

      /* Spinner */
      .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Error banner */
      .error-banner {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        background: rgba(220, 38, 38, 0.08);
        border: 1px solid rgba(220, 38, 38, 0.25);
        color: #dc2626;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        font-size: 0.88rem;
        line-height: 1.5;
      }
      .footer-note {
        text-align: center;
        font-size: 0.75rem;
        color: #9ca3af;
        margin: 0;
        line-height: 1.6;
      }
      @media (max-width: 900px) {
        .footer-note {
          color: rgba(255, 255, 255, 0.3);
        }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });
  readonly isBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<Tab>('password');
  readonly showPassword = signal(false);

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/');
    }
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.error.set(null);
  }

  async onPasswordSignIn(): Promise<void> {
    if (this.form.invalid || this.isBusy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.isBusy.set(true);

    try {
      const { username, password } = this.form.getRawValue();
      await this.auth.loginWithPassword(username, password);
      await this.router.navigateByUrl('/');
    } catch {
      this.error.set('loginPage.invalidCredentials');
    } finally {
      this.isBusy.set(false);
    }
  }

  async onCacSignIn(): Promise<void> {
    if (this.isBusy()) return;

    this.error.set(null);
    this.isBusy.set(true);

    try {
      await this.auth.loginWithCac();
      await this.router.navigateByUrl('/');
    } catch {
      this.error.set('loginPage.cacFailed');
    } finally {
      this.isBusy.set(false);
    }
  }

  async onFido2SignIn(): Promise<void> {
    if (this.isBusy()) return;

    this.error.set(null);
    this.isBusy.set(true);

    try {
      if (!window.PublicKeyCredential || !navigator.credentials) {
        throw new Error('WebAuthn is not available in this browser.');
      }

      const assertionOptionsJson = await this.auth.beginFido2Login();
      const assertionOptions = JSON.parse(
        assertionOptionsJson,
      ) as PublicKeyCredentialRequestOptionsJson;
      const credential = await navigator.credentials.get({
        publicKey: this.toAssertionOptions(assertionOptions),
      });

      if (!(credential instanceof PublicKeyCredential)) {
        throw new Error('Security key assertion was not returned.');
      }

      const assertionResponse = this.serializeAssertion(credential);
      await this.auth.loginWithFido2(assertionResponse, assertionOptionsJson);
      await this.router.navigateByUrl('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'FIDO2 authentication failed.';
      this.error.set(
        msg.includes('not available') ? 'loginPage.webauthnUnavailable' : 'loginPage.fido2Failed',
      );
    } finally {
      this.isBusy.set(false);
    }
  }

  private toAssertionOptions(
    json: PublicKeyCredentialRequestOptionsJson,
  ): PublicKeyCredentialRequestOptions {
    return {
      challenge: this.base64UrlToBuffer(json.challenge),
      timeout: json.timeout,
      rpId: json.rpId,
      allowCredentials: json.allowCredentials?.map((item) => ({
        type: item.type,
        id: this.base64UrlToBuffer(item.id),
        transports: item.transports,
      })),
      userVerification: json.userVerification,
      extensions: json.extensions,
    };
  }

  private serializeAssertion(credential: PublicKeyCredential): unknown {
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
      id: credential.id,
      type: credential.type,
      rawId: this.bufferToBase64Url(credential.rawId),
      response: {
        authenticatorData: this.bufferToBase64Url(response.authenticatorData),
        clientDataJson: this.bufferToBase64Url(response.clientDataJSON),
        signature: this.bufferToBase64Url(response.signature),
        userHandle: response.userHandle ? this.bufferToBase64Url(response.userHandle) : null,
      },
      clientExtensionResults: credential.getClientExtensionResults(),
    };
  }

  private base64UrlToBuffer(value: string): ArrayBuffer {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  private bufferToBase64Url(input: ArrayBuffer): string {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
