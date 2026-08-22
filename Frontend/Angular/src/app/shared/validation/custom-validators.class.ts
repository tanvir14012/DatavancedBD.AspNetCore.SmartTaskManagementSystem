import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {
  static matchFields(controlName: string, matchingControlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const sourceControl = control.get(controlName);
      const targetControl = control.get(matchingControlName);

      if (!sourceControl || !targetControl) {
        return null;
      }

      const mismatch = sourceControl.value !== targetControl.value;
      const existingErrors = targetControl.errors ?? {};
      const hasMismatchError = Boolean(existingErrors['fieldMismatch']);

      if (!mismatch) {
        if (!hasMismatchError) {
          return null;
        }

        const { fieldMismatch: _fieldMismatch, ...remainingErrors } = existingErrors;
        targetControl.setErrors(Object.keys(remainingErrors).length ? remainingErrors : null);
        return null;
      }

      targetControl.setErrors({
        ...existingErrors,
        fieldMismatch: {
          controlName,
          matchingControlName,
        },
      });

      return { fieldMismatch: true };
    };
  }

  static nonWhitespace(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (typeof value !== 'string') {
        return null;
      }

      return value.trim().length ? null : { whitespace: true };
    };
  }
}
