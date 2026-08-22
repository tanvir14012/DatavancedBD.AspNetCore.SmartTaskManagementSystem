/**
 * Result type for handling success/failure operations
 * Railway-oriented programming pattern
 */

export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U> {
    return new Success(fn(this.value));
  }

  flatMap<U>(fn: (value: T) => Result<U>): Result<U> {
    return fn(this.value);
  }

  getOrElse(fallback: T): T {
    return this.value;
  }

  fold<U>(onSuccess: (value: T) => U, onFailure: (error: any) => U): U {
    return onSuccess(this.value);
  }
}

export class Failure<E> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(readonly error: E) {}

  map<U>(fn: (value: any) => U): Result<U> {
    return this as any;
  }

  flatMap<U>(fn: (value: any) => Result<U>): Result<U> {
    return this as any;
  }

  getOrElse<T>(fallback: T): T {
    return fallback;
  }

  fold<U>(onSuccess: (value: any) => U, onFailure: (error: E) => U): U {
    return onFailure(this.error);
  }
}

/**
 * Utility function to create a success result
 */
export function ok<T>(value: T): Result<T> {
  return new Success(value);
}

/**
 * Utility function to create a failure result
 */
export function fail<E>(error: E): Result<never, E> {
  return new Failure(error);
}

/**
 * Combine multiple results
 */
export function combine<T extends readonly Result<any>[]>(
  ...results: T
): Result<{ [K in keyof T]: T[K] extends Result<infer U> ? U : never }> {
  const values: any[] = [];
  for (const result of results) {
    if (result.isFailure) {
      return result as any;
    }
    values.push((result as Success<any>).value);
  }
  return ok(values as any);
}

/**
 * Try-catch wrapper for synchronous operations
 */
export function trySync<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    return fail(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Try-catch wrapper for async operations
 */
export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (error) {
    return fail(error instanceof Error ? error : new Error(String(error)));
  }
}
