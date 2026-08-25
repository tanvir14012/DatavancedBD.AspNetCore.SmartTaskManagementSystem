import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class CustomValidators {
  static readonly MIN_PASSWORD_LENGTH = 8;
  static readonly MAX_FIRST_NAME_LENGTH = 25;
  static readonly MAX_LAST_NAME_LENGTH = 25;
  static readonly MAX_PROJECT_NAME_LENGTH = 200;
  static readonly MAX_PROJECT_DESCRIPTION_LENGTH = 1000;
  static readonly MAX_TASK_TITLE_LENGTH = 200;
  static readonly MAX_TASK_DESCRIPTION_LENGTH = 4000;

  /**
   * Validates that a password contains uppercase, lowercase, digit, and special character
   */
  static passwordStrength(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }

      const errors: ValidationErrors = {};

      if (value.length < this.MIN_PASSWORD_LENGTH) {
        errors['minLength'] = true;
      }

      if (!/[A-Z]/.test(value)) {
        errors['noUpperCase'] = true;
      }

      if (!/[a-z]/.test(value)) {
        errors['noLowerCase'] = true;
      }

      if (!/[0-9]/.test(value)) {
        errors['noDigit'] = true;
      }

      if (!/[!@#$%^&*]/.test(value)) {
        errors['noSpecialChar'] = true;
      }

      return Object.keys(errors).length > 0 ? errors : null;
    };
  }

  /**
   * Validates that end date is not before start date
   */
  static dateRangeValidator(startDateField: string, endDateField: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const startDate = control.get(startDateField)?.value;
      const endDate = control.get(endDateField)?.value;

      if (!startDate || !endDate) {
        return null;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      return end >= start ? null : { dateRangeError: true };
    };
  }

  /**
   * Validates that a date is not in the past
   */
  static noPastDate(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }

      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return date >= today ? null : { pastDate: true };
    };
  }

  /**
   * Validates project name format
   */
  static projectNameFormat(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }

      const pattern = /^[a-zA-Z0-9\s\-_.&()]+$/;
      return pattern.test(value) ? null : { invalidFormat: true };
    };
  }

  /**
   * Validates task title format
   */
  static taskTitleFormat(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }

      const pattern = /^[a-zA-Z0-9\s\-_.&():'""]+$/;
      return pattern.test(value) ? null : { invalidFormat: true };
    };
  }

  /**
   * Validates email format
   */
  static emailFormat(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailPattern.test(value) ? null : { invalidEmail: true };
    };
  }

  /**
   * Validates that a field is not only whitespace
   */
  static noWhitespace(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }

      return /\S/.test(value) ? null : { whitespaceOnly: true };
    };
  }
}
