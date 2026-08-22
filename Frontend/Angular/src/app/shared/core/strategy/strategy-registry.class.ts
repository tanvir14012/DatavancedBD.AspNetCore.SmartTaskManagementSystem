/**
 * Strategy Registry for managing multiple strategies
 */

import { IStrategy, IAsyncStrategy } from './strategy.interface';

/**
 * Registry for managing strategies
 */
export class StrategyRegistry<TInput = any, TOutput = any> {
  private strategies = new Map<string, IStrategy<TInput, TOutput>>();

  /**
   * Register a strategy
   */
  register(key: string, strategy: IStrategy<TInput, TOutput>): void {
    this.strategies.set(key, strategy);
  }

  /**
   * Get a strategy
   */
  get(key: string): IStrategy<TInput, TOutput> | undefined {
    return this.strategies.get(key);
  }

  /**
   * Has a strategy registered
   */
  has(key: string): boolean {
    return this.strategies.has(key);
  }

  /**
   * Execute a strategy
   */
  execute(key: string, input: TInput): TOutput {
    const strategy = this.get(key);
    if (!strategy) {
      throw new Error(`Strategy not found: ${key}`);
    }
    return strategy.execute(input);
  }

  /**
   * Unregister a strategy
   */
  unregister(key: string): boolean {
    return this.strategies.delete(key);
  }

  /**
   * Get all registered keys
   */
  getKeys(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get all strategies
   */
  getAll(): Map<string, IStrategy<TInput, TOutput>> {
    return new Map(this.strategies);
  }

  /**
   * Clear all strategies
   */
  clear(): void {
    this.strategies.clear();
  }

  /**
   * Get the number of registered strategies
   */
  size(): number {
    return this.strategies.size;
  }
}

/**
 * Registry for managing async strategies
 */
export class AsyncStrategyRegistry<TInput = any, TOutput = any> {
  private strategies = new Map<string, IAsyncStrategy<TInput, TOutput>>();

  /**
   * Register a strategy
   */
  register(key: string, strategy: IAsyncStrategy<TInput, TOutput>): void {
    this.strategies.set(key, strategy);
  }

  /**
   * Get a strategy
   */
  get(key: string): IAsyncStrategy<TInput, TOutput> | undefined {
    return this.strategies.get(key);
  }

  /**
   * Has a strategy registered
   */
  has(key: string): boolean {
    return this.strategies.has(key);
  }

  /**
   * Execute a strategy
   */
  async execute(key: string, input: TInput): Promise<TOutput> {
    const strategy = this.get(key);
    if (!strategy) {
      throw new Error(`Strategy not found: ${key}`);
    }
    return strategy.execute(input);
  }

  /**
   * Unregister a strategy
   */
  unregister(key: string): boolean {
    return this.strategies.delete(key);
  }

  /**
   * Get all registered keys
   */
  getKeys(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get all strategies
   */
  getAll(): Map<string, IAsyncStrategy<TInput, TOutput>> {
    return new Map(this.strategies);
  }

  /**
   * Clear all strategies
   */
  clear(): void {
    this.strategies.clear();
  }

  /**
   * Get the number of registered strategies
   */
  size(): number {
    return this.strategies.size;
  }
}

/**
 * Example usage:
 * 
 * const registry = new StrategyRegistry<string, string>();
 * 
 * registry.register('uppercase', new LambdaStrategy(str => str.toUpperCase()));
 * registry.register('lowercase', new LambdaStrategy(str => str.toLowerCase()));
 * registry.register('reverse', new LambdaStrategy(str => str.split('').reverse().join('')));
 * 
 * // Runtime strategy selection
 * const transformation = process.env.TRANSFORM || 'uppercase';
 * const result = registry.execute(transformation, 'hello');
 */
