import { Component, ChangeDetectionStrategy, OnDestroy, inject, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { HttpCacheService } from '../../../core/services/http-cache.service';
import { ValidationError } from '../../models/validation-error.model';
import { HttpErrorResponse } from '@angular/common/http';
import { InstantErrorStateMatcher } from '../../error-state-matchers/instant-error-state-matcher';

/**
 * Abstract base for all dialog-based create/edit forms.
 *
 * Subclasses:
 *  1. Build `this.form` in the constructor / ngOnInit
 *  2. Implement `submit$()` returning the API call observable
 *  3. Optionally override `onSuccess()` for custom post-save logic
 */
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
export abstract class BaseFormComponent<TDto = unknown> implements OnDestroy {
  protected readonly notify = inject(NotificationService);
  protected readonly cacheService = inject(HttpCacheService);
  protected readonly destroy$ = new Subject<void>();

  readonly isSubmitting = signal(false);
  readonly errorMatcher = new InstantErrorStateMatcher();

  abstract form: FormGroup;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Return the API call to execute on submit. */
  protected abstract submit$(): Observable<TDto>;

  /** Cache prefix(es) to invalidate after a successful save. */
  protected get cacheInvalidationKeys(): string[] {
    return [];
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);

    this.submit$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.cacheInvalidationKeys.forEach((k) => this.cacheService.invalidate(k));
          this.onSuccess(result);
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.handleError(err);
        },
      });
  }

  protected onSuccess(_result: TDto): void {
    this.notify.success('common.success');
  }

  protected handleError(err: HttpErrorResponse): void {
    // Map FluentValidation / ProblemDetails validation errors to form controls
    const body = err.error;
    if (err.status === 400 || err.status === 422) {
      if (body?.errors) {
        // RFC 7807 ProblemDetails format
        const errors = body.errors as Record<string, string[]>;
        Object.entries(errors).forEach(([field, messages]) => {
          const key = field.charAt(0).toLowerCase() + field.slice(1);
          const ctrl = this.form.get(key);
          if (ctrl) {
            ctrl.setErrors({ serverError: messages[0] });
            ctrl.markAsTouched();
          }
        });
        return;
      }
    }
    this.notify.error('common.error');
  }

  getError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl?.errors || (!ctrl.dirty && !ctrl.touched)) return null;

    const errors = ctrl.errors;
    if (errors['required']) return 'validation.required';
    if (errors['minlength']) return 'validation.minLength';
    if (errors['maxlength']) return 'validation.maxLength';
    if (errors['email']) return 'validation.email';
    if (errors['pattern']) return 'validation.pattern';
    if (errors['serverError']) return errors['serverError'] as string;

    return null;
  }
}
