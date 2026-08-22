/**
 * Lambda Strategy for functional strategy composition
 */

import { IStrategy, IAsyncStrategy } from './strategy.interface';

/**
 * Strategy created from a lambda function
 */
export class LambdaStrategy<TInput = any, TOutput = any>
  implements IStrategy<TInput, TOutput>
{
  constructor(private execute: (input: TInput) => TOutput) {}

  /**
   * Execute the strategy
   */
  execute(input: TInput): TOutput {
    return this.execute(input);
  }

  /**
   * Create a new strategy that applies a transformation
   */
  map<TNext>(transform: (output: TOutput) => TNext): LambdaStrategy<TInput, TNext> {
    return new LambdaStrategy(input =>
      transform(this.execute(input))
    );
  }

  /**
   * Create a new strategy that filters based on a predicate
   */
  filter(predicate: (output: TOutput) => boolean): LambdaStrategy<TInput, TOutput | undefined> {
    return new LambdaStrategy(input => {
      const result = this.execute(input);
      return predicate(result) ? result : undefined;
    });
  }

  /**
   * Create a new strategy that applies a side effect
   */
  tap(effect: (output: TOutput) => void): LambdaStrategy<TInput, TOutput> {
    return new LambdaStrategy(input => {
      const result = this.execute(input);
      effect(result);
      return result;
    });
  }

  /**
   * Create a new strategy with error handling
   */
  onError(handler: (error: Error) => TOutput): LambdaStrategy<TInput, TOutput> {
    return new LambdaStrategy(input => {
      try {
        return this.execute(input);
      } catch (error) {
        return handler(error as Error);
      }
    });
  }
}

/**
 * Async strategy created from a lambda function
 */
export class AsyncLambdaStrategy<TInput = any, TOutput = any>
  implements IAsyncStrategy<TInput, TOutput>
{
  constructor(private execute: (input: TInput) => Promise<TOutput>) {}

  /**
   * Execute the strategy
   */
  execute(input: TInput): Promise<TOutput> {
    return this.execute(input);
  }

  /**
   * Create a new strategy that applies a transformation
   */
  map<TNext>(
    transform: (output: TOutput) => TNext | Promise<TNext>
  ): AsyncLambdaStrategy<TInput, TNext> {
    return new AsyncLambdaStrategy(async input => {
      const result = await this.execute(input);
      return transform(result);
    });
  }

  /**
   * Create a new strategy that filters based on a predicate
   */
  filter(
    predicate: (output: TOutput) => boolean | Promise<boolean>
  ): AsyncLambdaStrategy<TInput, TOutput | undefined> {
    return new AsyncLambdaStrategy(async input => {
      const result = await this.execute(input);
      const isValid = await Promise.resolve(predicate(result));
      return isValid ? result : undefined;
    });
  }

  /**
   * Create a new strategy that applies a side effect
   */
  tap(effect: (output: TOutput) => void | Promise<void>): AsyncLambdaStrategy<TInput, TOutput> {
    return new AsyncLambdaStrategy(async input => {
      const result = await this.execute(input);
      await Promise.resolve(effect(result));
      return result;
    });
  }

  /**
   * Create a new strategy with error handling
   */
  onError(handler: (error: Error) => TOutput | Promise<TOutput>): AsyncLambdaStrategy<TInput, TOutput> {
    return new AsyncLambdaStrategy(async input => {
      try {
        return await this.execute(input);
      } catch (error) {
        return Promise.resolve(handler(error as Error));
      }
    });
  }

  /**
   * Create a new strategy with retry logic
   */
  retry(maxAttempts: number = 3, delayMs: number = 0): AsyncLambdaStrategy<TInput, TOutput> {
    return new AsyncLambdaStrategy(async input => {
      let lastError: Error | undefined;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          return await this.execute(input);
        } catch (error) {
          lastError = error as Error;
          if (i < maxAttempts - 1 && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
      throw lastError;
    });
  }

  /**
   * Create a new strategy with timeout
   */
  timeout(timeoutMs: number): AsyncLambdaStrategy<TInput, TOutput> {
    return new AsyncLambdaStrategy(input => {
      return Promise.race([
        this.execute(input),
        new Promise<TOutput>((_, reject) =>
          setTimeout(() => reject(new Error(`Strategy timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
    });
  }
}

/**
 * Example usage:
 * 
 * const sorting = new LambdaStrategy<number[], number[]>(
 *   (arr) => [...arr].sort((a, b) => a - b)
 * );
 * 
 * const sorted = sorting.execute([3, 1, 2]); // [1, 2, 3]
 * 
 * const logging = sorting
 *   .tap(result => console.log('Sorted:', result));
 * 
 * // Async example
 * const fetchUser = new AsyncLambdaStrategy<number, User>(
 *   (id) => fetch(`/api/users/${id}`).then(r => r.json())
 * );
 * 
 * const withRetry = fetchUser
 *   .retry(3, 1000) // 3 attempts, 1s delay
 *   .timeout(5000)  // 5s timeout
 *   .tap(user => console.log('Fetched:', user));
 */
