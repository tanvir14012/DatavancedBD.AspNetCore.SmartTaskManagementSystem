/**
 * Lambda Factory for functional factory composition
 * Creates factories from lambda functions
 */

import { IFactory, IAsyncFactory } from './factory.interface';

/**
 * Lambda factory wrapper
 * Simple wrapper around a lambda function
 */
export class LambdaFactory<T, TArgs extends any[] = any[]>
  implements IFactory<T, TArgs>
{
  constructor(private lambda: (...args: TArgs) => T) {}

  create(...args: TArgs): T {
    return this.lambda(...args);
  }

  /**
   * Create a factory that caches the result
   */
  memoized(): LambdaFactory<T, TArgs> {
    let cached: T | undefined;
    let isCached = false;

    return new LambdaFactory((...args: TArgs) => {
      if (!isCached) {
        cached = this.lambda(...args);
        isCached = true;
      }
      return cached as T;
    });
  }

  /**
   * Create a factory with a decorator function
   */
  decorate(decorator: (result: T) => T): LambdaFactory<T, TArgs> {
    return new LambdaFactory((...args: TArgs) =>
      decorator(this.lambda(...args))
    );
  }

  /**
   * Compose two factories
   */
  compose<U>(next: LambdaFactory<U>): LambdaFactory<U, TArgs> {
    return new LambdaFactory((...args: TArgs) => next.create(this.lambda(...args) as any));
  }

  /**
   * Apply a filter to the factory
   */
  filter(predicate: (result: T) => boolean): LambdaFactory<T | undefined, TArgs> {
    return new LambdaFactory((...args: TArgs) => {
      const result = this.lambda(...args);
      return predicate(result) ? result : undefined;
    });
  }

  /**
   * Chain multiple factories
   */
  chain(...factories: LambdaFactory<T, TArgs>[]): LambdaFactory<T[], TArgs> {
    return new LambdaFactory((...args: TArgs) => [
      this.lambda(...args),
      ...factories.map(f => f.lambda(...args)),
    ]);
  }
}

/**
 * Async lambda factory wrapper
 * Simple wrapper around an async lambda function
 */
export class AsyncLambdaFactory<T, TArgs extends any[] = any[]>
  implements IAsyncFactory<T, TArgs>
{
  constructor(private lambda: (...args: TArgs) => Promise<T>) {}

  create(...args: TArgs): Promise<T> {
    return this.lambda(...args);
  }

  /**
   * Create a factory that caches the result
   */
  memoized(): AsyncLambdaFactory<T, TArgs> {
    let cached: T | undefined;
    let isCached = false;

    return new AsyncLambdaFactory(async (...args: TArgs) => {
      if (!isCached) {
        cached = await this.lambda(...args);
        isCached = true;
      }
      return cached as T;
    });
  }

  /**
   * Create a factory with a decorator function
   */
  decorate(decorator: (result: T) => T | Promise<T>): AsyncLambdaFactory<T, TArgs> {
    return new AsyncLambdaFactory(async (...args: TArgs) =>
      decorator(await this.lambda(...args))
    );
  }

  /**
   * Compose two factories
   */
  compose<U>(
    next: AsyncLambdaFactory<U, any[]>
  ): AsyncLambdaFactory<U, TArgs> {
    return new AsyncLambdaFactory(async (...args: TArgs) =>
      next.create(await this.lambda(...args))
    );
  }

  /**
   * Apply a filter to the factory
   */
  filter(
    predicate: (result: T) => boolean | Promise<boolean>
  ): AsyncLambdaFactory<T | undefined, TArgs> {
    return new AsyncLambdaFactory(async (...args: TArgs) => {
      const result = await this.lambda(...args);
      const isValid = await Promise.resolve(predicate(result));
      return isValid ? result : undefined;
    });
  }

  /**
   * Chain multiple factories
   */
  chain(...factories: AsyncLambdaFactory<T, TArgs>[]): AsyncLambdaFactory<T[], TArgs> {
    return new AsyncLambdaFactory(async (...args: TArgs) => [
      await this.lambda(...args),
      ...(await Promise.all(factories.map(f => f.lambda(...args)))),
    ]);
  }

  /**
   * Retry the factory if it fails
   */
  retry(maxAttempts: number = 3): AsyncLambdaFactory<T, TArgs> {
    return new AsyncLambdaFactory(async (...args: TArgs) => {
      let lastError: Error | undefined;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          return await this.lambda(...args);
        } catch (error) {
          lastError = error as Error;
        }
      }
      throw lastError;
    });
  }
}

/**
 * Factory utilities
 */
export class LambdaFactoryUtils {
  /**
   * Create a factory from a class constructor
   */
  static fromConstructor<T, TArgs extends any[] = any[]>(
    ctor: new (...args: TArgs) => T
  ): LambdaFactory<T, TArgs> {
    return new LambdaFactory((...args: TArgs) => new ctor(...args));
  }

  /**
   * Create an async factory from a class constructor
   */
  static fromAsyncConstructor<T, TArgs extends any[] = any[]>(
    ctor: new (...args: TArgs) => Promise<T>
  ): AsyncLambdaFactory<T, TArgs> {
    return new AsyncLambdaFactory((...args: TArgs) => new ctor(...args));
  }

  /**
   * Create a factory that applies transformations
   */
  static pipeline<T, U>(
    source: LambdaFactory<T>,
    ...transformers: Array<(value: T) => U>
  ): LambdaFactory<U[]> {
    return new LambdaFactory(() => transformers.map(t => t(source.create())));
  }
}

/**
 * Example usage:
 * 
 * class Logger {
 *   constructor(readonly name: string) {}
 *   log(msg: string) { console.log(`[${this.name}] ${msg}`); }
 * }
 * 
 * const loggerFactory = new LambdaFactory<Logger, [string]>(
 *   (name) => new Logger(name)
 * );
 * 
 * const logger = loggerFactory.create('App');
 * logger.log('Hello');
 * 
 * // With memoization
 * const memoizedFactory = loggerFactory.memoized();
 * 
 * // With composition
 * const decoratedFactory = loggerFactory.decorate((logger) => {
 *   logger.log = (msg) => console.log(`DECORATED: ${msg}`);
 *   return logger;
 * });
 */
