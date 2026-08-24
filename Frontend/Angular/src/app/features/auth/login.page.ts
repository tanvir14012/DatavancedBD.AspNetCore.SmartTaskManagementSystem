import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly fieldErrors = signal<Record<string, string[]>>({});
  readonly generalError = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    email: ['admin@datavanced.com', [Validators.required, Validators.email]],
    password: ['Datavanced@123', [Validators.required]],
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
      await this.authService.login(this.form.value.email ?? '', this.form.value.password ?? '');
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
      'Invalid email or password.';

    return { fieldErrors: normalized, generalError };
  }
}
