/**
 * Strategy Context for managing and executing strategies
 */

import { IStrategy, IStrategyContext, IAsyncStrategy, IAsyncStrategyContext } from './strategy.interface';

/**
 * Context for executing strategies
 * Allows runtime strategy switching
 */
export class StrategyContext<TInput = any, TOutput = any>
  implements IStrategyContext<TInput, TOutput>
{
  private strategy: IStrategy<TInput, TOutput>;

  constructor(strategy: IStrategy<TInput, TOutput>) {
    this.strategy = strategy;
  }

  /**
   * Set the strategy
   */
  setStrategy(strategy: IStrategy<TInput, TOutput>): void {
    this.strategy = strategy;
  }

  /**
   * Get the current strategy
   */
  getStrategy(): IStrategy<TInput, TOutput> {
    return this.strategy;
  }

  /**
   * Execute using the current strategy
   */
  execute(input: TInput): TOutput {
    return this.strategy.execute(input);
  }

  /**
   * Create a new context with a different strategy
   */
  withStrategy(strategy: IStrategy<TInput, TOutput>): StrategyContext<TInput, TOutput> {
    return new StrategyContext(strategy);
  }

  /**
   * Chain the execution result through another strategy
   */
  chain<TNext>(
    nextStrategy: IStrategy<TOutput, TNext>
  ): StrategyContext<TInput, TNext> {
    const chainedStrategy: IStrategy<TInput, TNext> = {
      execute: (input: TInput) => {
        const intermediate = this.strategy.execute(input);
        return nextStrategy.execute(intermediate);
      },
    };
    return new StrategyContext(chainedStrategy);
  }

  /**
   * Create a strategy that applies a transform
   */
  map<TNext>(transform: (output: TOutput) => TNext): StrategyContext<TInput, TNext> {
    const mappedStrategy: IStrategy<TInput, TNext> = {
      execute: (input: TInput) => {
        const result = this.strategy.execute(input);
        return transform(result);
      },
    };
    return new StrategyContext(mappedStrategy);
  }

  /**
   * Create a fallback strategy
   */
  fallback(fallbackStrategy: IStrategy<TInput, TOutput>): StrategyContext<TInput, TOutput> {
    const combined: IStrategy<TInput, TOutput> = {
      execute: (input: TInput) => {
        try {
          return this.strategy.execute(input);
        } catch (error) {
          return fallbackStrategy.execute(input);
        }
      },
    };
    return new StrategyContext(combined);
  }
}

/**
 * Context for executing async strategies
 * Allows runtime strategy switching for async operations
 */
export class AsyncStrategyContext<TInput = any, TOutput = any>
  implements IAsyncStrategyContext<TInput, TOutput>
{
  private strategy: IAsyncStrategy<TInput, TOutput>;

  constructor(strategy: IAsyncStrategy<TInput, TOutput>) {
    this.strategy = strategy;
  }

  /**
   * Set the strategy
   */
  setStrategy(strategy: IAsyncStrategy<TInput, TOutput>): void {
    this.strategy = strategy;
  }

  /**
   * Get the current strategy
   */
  getStrategy(): IAsyncStrategy<TInput, TOutput> {
    return this.strategy;
  }

  /**
   * Execute using the current strategy
   */
  execute(input: TInput): Promise<TOutput> {
    return this.strategy.execute(input);
  }

  /**
   * Create a new context with a different strategy
   */
  withStrategy(strategy: IAsyncStrategy<TInput, TOutput>): AsyncStrategyContext<TInput, TOutput> {
    return new AsyncStrategyContext(strategy);
  }

  /**
   * Chain the execution result through another strategy
   */
  chain<TNext>(
    nextStrategy: IAsyncStrategy<TOutput, TNext>
  ): AsyncStrategyContext<TInput, TNext> {
    const chainedStrategy: IAsyncStrategy<TInput, TNext> = {
      execute: async (input: TInput) => {
        const intermediate = await this.strategy.execute(input);
        return nextStrategy.execute(intermediate);
      },
    };
    return new AsyncStrategyContext(chainedStrategy);
  }

  /**
   * Create a strategy that applies a transform
   */
  map<TNext>(transform: (output: TOutput) => TNext | Promise<TNext>): AsyncStrategyContext<TInput, TNext> {
    const mappedStrategy: IAsyncStrategy<TInput, TNext> = {
      execute: async (input: TInput) => {
        const result = await this.strategy.execute(input);
        return transform(result);
      },
    };
    return new AsyncStrategyContext(mappedStrategy);
  }

  /**
   * Create a fallback strategy
   */
  fallback(fallbackStrategy: IAsyncStrategy<TInput, TOutput>): AsyncStrategyContext<TInput, TOutput> {
    const combined: IAsyncStrategy<TInput, TOutput> = {
      execute: async (input: TInput) => {
        try {
          return await this.strategy.execute(input);
        } catch (error) {
          return fallbackStrategy.execute(input);
        }
      },
    };
    return new AsyncStrategyContext(combined);
  }

  /**
   * Retry the strategy on failure
   */
  retry(maxAttempts: number = 3, delayMs: number = 0): AsyncStrategyContext<TInput, TOutput> {
    const retriedStrategy: IAsyncStrategy<TInput, TOutput> = {
      execute: async (input: TInput) => {
        let lastError: Error | undefined;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            return await this.strategy.execute(input);
          } catch (error) {
            lastError = error as Error;
            if (i < maxAttempts - 1 && delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }
        throw lastError;
      },
    };
    return new AsyncStrategyContext(retriedStrategy);
  }
}

/**
 * Example usage:
 * 
 * // Payment strategies
 * class CreditCardStrategy implements IAsyncStrategy<Payment, TransactionResult> {
 *   execute(payment: Payment): Promise<TransactionResult> {
 *     return chargeCard(payment);
 *   }
 * }
 * 
 * class PayPalStrategy implements IAsyncStrategy<Payment, TransactionResult> {
 *   execute(payment: Payment): Promise<TransactionResult> {
 *     return chargePayPal(payment);
 *   }
 * }
 * 
 * // Usage
 * const context = new AsyncStrategyContext(new CreditCardStrategy());
 * let result = await context.execute(payment);
 * 
 * // Switch strategy at runtime
 * context.setStrategy(new PayPalStrategy());
 * result = await context.execute(payment);
 * 
 * // Chain strategies
 * const validation = context
 *   .chain(validationStrategy)
 *   .chain(encryptionStrategy);
 */
