import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, tap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss']
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

  submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    this.generalError.set('');
    this.fieldErrors.set({});

    this.authService
      .register({
        firstName: this.form.value.firstName ?? '',
        lastName: this.form.value.lastName ?? '',
        email: this.form.value.email ?? '',
        password: this.form.value.password ?? '',
      })
      .pipe(
        tap(() => {
          this.router.navigateByUrl('/dashboard');
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        error: (error: unknown) => {
          const parsed = this.parseApiError(error);
          this.fieldErrors.set(parsed.fieldErrors);
          this.generalError.set(parsed.generalError);
        },
      });
  }

  private parseApiError(error: unknown): { fieldErrors: Record<string, string[]>; generalError: string } {
    const httpError = error as HttpErrorResponse;
    const payload = (httpError.error ?? {}) as Record<string, unknown>;
    const fieldErrors = payload['errors'] ?? {};
    const normalized: Record<string, string[]> = {};

    for (const [key, value] of Object.entries(fieldErrors as Record<string, unknown>)) {
      normalized[key] = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [String(value)];
    }

    const generalError =
      (typeof payload['detail'] === 'string' && payload['detail']) ||
      (typeof payload['message'] === 'string' && payload['message']) ||
      (typeof payload['title'] === 'string' && payload['title']) ||
      'Unable to create your account right now.';

    return { fieldErrors: normalized, generalError };
  }
}
