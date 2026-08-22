import { FormControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

/**
 * Shows errors immediately (on dirty or on touched) rather than waiting
 * for the control to be blurred. Useful for server-side validation errors.
 */
export class InstantErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

/**
 * Always shows error state regardless of touch/dirty.
 * Use when programmatically setting server errors.
 */
export class AlwaysShowErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid);
  }
}
