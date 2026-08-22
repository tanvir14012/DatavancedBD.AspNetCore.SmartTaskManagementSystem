/**
 * Validation types and interfaces
 */

export interface IValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface IValidationResult {
  isValid: boolean;
  errors: IValidationError[];
}

export type Validator<T> = (value: T) => IValidationResult;

export type AsyncValidator<T> = (value: T) => Promise<IValidationResult>;

export interface IValidationRule<T = any> {
  name: string;
  validate: Validator<T> | AsyncValidator<T>;
}

export enum ValidationType {
  REQUIRED = 'required',
  MIN_LENGTH = 'minLength',
  MAX_LENGTH = 'maxLength',
  PATTERN = 'pattern',
  EMAIL = 'email',
  URL = 'url',
  MIN = 'min',
  MAX = 'max',
  CUSTOM = 'custom',
}
