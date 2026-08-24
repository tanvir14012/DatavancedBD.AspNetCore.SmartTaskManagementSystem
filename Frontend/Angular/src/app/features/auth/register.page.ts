import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-shell">
      <div class="auth-card">
        <div class="brand-block">
          <span class="eyebrow">Smart Task Management System</span>
          <h1>Create your account</h1>
          <p>Set up your workspace and start organizing projects and tasks.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
          <div class="name-row">
            <label>
              <span>First name</span>
              <input formControlName="firstName" type="text" placeholder="Jane" />
            </label>

            <label>
              <span>Last name</span>
              <input formControlName="lastName" type="text" placeholder="Doe" />
            </label>
          </div>

          <label>
            <span>Email</span>
            <input formControlName="email" type="email" placeholder="name@company.com" />
            @if (fieldError('email').length) {
              <small class="field-error">{{ fieldError('email')[0] }}</small>
            } @else if (form.controls.email.touched && form.controls.email.hasError('required')) {
              <small class="field-error">Email is required.</small>
            } @else if (form.controls.email.touched && form.controls.email.hasError('email')) {
              <small class="field-error">Enter a valid email.</small>
            }
          </label>

          <label>
            <span>Password</span>
            <input formControlName="password" type="password" placeholder="••••••••" />
            @if (fieldError('password').length) {
              <small class="field-error">{{ fieldError('password')[0] }}</small>
            } @else if (form.controls.password.touched && form.controls.password.hasError('required')) {
              <small class="field-error">Password is required.</small>
            } @else if (form.controls.password.touched && form.controls.password.hasError('minlength')) {
              <small class="field-error">Password must be at least 8 characters.</small>
            }
          </label>

          @if (generalError()) {
            <div class="general-error">{{ generalError() }}</div>
          }

          <button type="submit" [disabled]="loading() || form.invalid">
            {{ loading() ? 'Creating account...' : 'Create account' }}
          </button>

          <p class="auth-link">
            Already have an account?
            <a routerLink="/login">Login</a>
          </p>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(135deg, #0f172a, #1d4ed8);
        padding: 32px;
      }

      .auth-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
      }

      .auth-card {
        width: min(100%, 520px);
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 24px;
        box-shadow: 0 30px 60px rgba(15, 23, 42, 0.4);
        padding: 32px;
        backdrop-filter: blur(14px);
      }

      .brand-block {
        margin-bottom: 24px;
      }

      .eyebrow {
        color: #93c5fd;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      h1 {
        color: #f8fafc;
        margin: 10px 0 8px;
        font-size: 2rem;
      }

      p {
        color: #cbd5e1;
        margin: 0;
      }

      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .name-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: #e2e8f0;
        font-size: 0.92rem;
      }

      input {
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.6);
        border-radius: 12px;
        color: white;
        padding: 12px 14px;
        font-size: 1rem;
      }

      .field-error,
      .general-error {
        color: #fca5a5;
        font-size: 0.82rem;
        line-height: 1.4;
      }

      .general-error {
        border: 1px solid rgba(252, 165, 165, 0.35);
        background: rgba(127, 29, 29, 0.2);
        padding: 10px 12px;
        border-radius: 10px;
      }

      button {
        border: none;
        border-radius: 12px;
        padding: 12px 18px;
        background: linear-gradient(135deg, #38bdf8, #2563eb);
        color: white;
        font-weight: 700;
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .auth-link {
        text-align: center;
        margin-top: 4px;
      }

      a {
        color: #93c5fd;
        text-decoration: none;
      }

      @media (max-width: 560px) {
        .name-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RegisterPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly fieldErrors = signal<Record<string, string[]>>({});
  readonly generalError = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    firstName: [''],
    lastName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  fieldError(controlName: string): string[] {
    return this.fieldErrors()[controlName] ?? [];
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    this.generalError.set('');
    this.fieldErrors.set({});

    try {
      await this.authService.register({
        firstName: this.form.value.firstName ?? '',
        lastName: this.form.value.lastName ?? '',
        email: this.form.value.email ?? '',
        password: this.form.value.password ?? '',
      });
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      const parsed = this.parseApiError(error);
      this.fieldErrors.set(parsed.fieldErrors);
      this.generalError.set(parsed.generalError);
    } finally {
      this.loading.set(false);
    }
  }

  private parseApiError(error: unknown): { fieldErrors: Record<string, string[]>; generalError: string } {
    const httpError = error as HttpErrorResponse;
    const payload = (httpError.error ?? {}) as Record<string, unknown>;
    const fieldErrors = ((payload['errors'] ?? {}) as Record<string, unknown>);
    const normalized: Record<string, string[]> = {};

    for (const [key, value] of Object.entries(fieldErrors)) {
      normalized[key] = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [String(value)];
    }

    const generalError =
      (typeof payload['detail'] === 'string' && payload['detail']) ||
      (typeof payload['message'] === 'string' && payload['message']) ||
      (typeof payload['title'] === 'string' && payload['title']) ||
      'Unable to create your account right now.';

    return { fieldErrors: normalized, generalError };
  }
}
