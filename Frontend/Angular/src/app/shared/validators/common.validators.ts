import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Ensure two controls in a group match (e.g. password confirmation). */
export function mustMatch(controlName: string, matchingControlName: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const control = group.get(controlName);
    const matching = group.get(matchingControlName);
    if (!control || !matching) return null;
    if (matching.errors && !matching.errors['mustMatch']) return null;
    if (control.value !== matching.value) {
      matching.setErrors({ ...matching.errors, mustMatch: true });
    } else {
      removeValidationError(matching, 'mustMatch');
    }
    return null;
  };
}

/** Required input that ignores leading and trailing whitespace. */
export function requiredTrimmed(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (typeof control.value !== 'string') return control.value ? null : { required: true };
    return control.value.trim().length ? null : { required: true };
  };
}

/** Validates that value is a positive integer. */
export function positiveInteger(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value && control.value !== 0) return null;
    const v = Number(control.value);
    if (!Number.isInteger(v) || v <= 0) return { positiveInteger: true };
    return null;
  };
}

/** Validates that a numeric value is greater than or equal to min. */
export function minNumber(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === undefined || control.value === '') return null;
    const value = Number(control.value);
    return Number.isFinite(value) && value >= min
      ? null
      : { minNumber: { min, actual: control.value } };
  };
}

/** Validates that a numeric value is less than or equal to max. */
export function maxNumber(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === undefined || control.value === '') return null;
    const value = Number(control.value);
    return Number.isFinite(value) && value <= max
      ? null
      : { maxNumber: { max, actual: control.value } };
  };
}

/** Saudi national ID validator (10-digit starting with 1 or 2). */
export function saudiNationalId(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const valid = /^[12]\d{9}$/.test(String(control.value));
    return valid ? null : { saudiNationalId: true };
  };
}

/** No whitespace-only input. */
export function noWhitespace(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (typeof control.value !== 'string') return null;
    const isBlank = control.value.trim().length === 0 && control.value.length > 0;
    return isBlank ? { whitespace: true } : null;
  };
}

/** Arabic text only. */
export function arabicOnly(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const valid = /^[\u0600-\u06FF\s\d]+$/.test(control.value);
    return valid ? null : { arabicOnly: true };
  };
}

/** File size validator for file input controls. */
export function maxFileSize(maxBytes: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const file = control.value as File;
    if (!file || !(file instanceof File)) return null;
    return file.size > maxBytes ? { maxFileSize: { max: maxBytes, actual: file.size } } : null;
  };
}

/** Date must be today or in the future. */
export function futureDate(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const value = new Date(control.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Number.isNaN(value.getTime()) || value < today ? { futureDate: true } : null;
  };
}

function removeValidationError(control: AbstractControl, errorKey: string): void {
  if (!control.errors?.[errorKey]) return;
  const { [errorKey]: _removed, ...remainingErrors } = control.errors;
  control.setErrors(Object.keys(remainingErrors).length ? remainingErrors : null);
}
