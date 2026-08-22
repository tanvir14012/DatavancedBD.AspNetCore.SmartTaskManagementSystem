/** Maps to FluentValidation error responses from the backend. */
export interface ValidationError {
  propertyName: string;
  errorMessage: string;
  attemptedValue?: unknown;
  errorCode?: string;
}

/** Indexed by camelCase field name for fast lookup in reactive form controls. */
export type ServerErrors = Record<string, string[]>;

export function toServerErrors(errors: ValidationError[]): ServerErrors {
  return errors.reduce<ServerErrors>((acc, e) => {
    const key = toCamelCase(e.propertyName);
    acc[key] = [...(acc[key] ?? []), e.errorMessage];
    return acc;
  }, {});
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
