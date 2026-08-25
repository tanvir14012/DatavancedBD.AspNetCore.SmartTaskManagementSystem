import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, tap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CustomValidators } from '../../shared/validators/custom-validators';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly fieldErrors = signal<Record<string, string[]>>({});
  readonly generalError = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', [
      Validators.maxLength(CustomValidators.MAX_FIRST_NAME_LENGTH),
      CustomValidators.noWhitespace()
    ]],
    lastName: ['', [
      Validators.maxLength(CustomValidators.MAX_LAST_NAME_LENGTH),
      CustomValidators.noWhitespace()
    ]],
    email: ['', [
      Validators.required,
      Validators.email,
      CustomValidators.emailFormat()
    ]],
    password: ['', [
      Validators.required,
      Validators.minLength(CustomValidators.MIN_PASSWORD_LENGTH),
      CustomValidators.passwordStrength()
    ]],
  });

  fieldError(controlName: string): string[] {
    return this.fieldErrors()[controlName] ?? [];
  }

  getPasswordErrors(): string[] {
    const control = this.form.get('password');
    if (!control || !control.errors) {
      return [];
    }

    const errors: string[] = [];
    if (control.errors['required']) {
      errors.push('Password is required.');
    }
    if (control.errors['minLength']) {
      errors.push(`Password must be at least ${CustomValidators.MIN_PASSWORD_LENGTH} characters.`);
    }
    if (control.errors['noUpperCase']) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (control.errors['noLowerCase']) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (control.errors['noDigit']) {
      errors.push('Password must contain at least one digit.');
    }
    if (control.errors['noSpecialChar']) {
      errors.push('Password must contain at least one special character (!@#$%^&*).');
    }
    return errors;
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
