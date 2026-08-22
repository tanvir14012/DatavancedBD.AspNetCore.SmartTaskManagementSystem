/**
 * Strategy pattern interfaces
 */

export interface IStrategy<TInput = any, TOutput = any> {
  execute(input: TInput): TOutput;
}

export interface IAsyncStrategy<TInput = any, TOutput = any> {
  execute(input: TInput): Promise<TOutput>;
}

export interface IStrategyContext<TInput = any, TOutput = any> {
  setStrategy(strategy: IStrategy<TInput, TOutput>): void;
  execute(input: TInput): TOutput;
}

export interface IAsyncStrategyContext<TInput = any, TOutput = any> {
  setStrategy(strategy: IAsyncStrategy<TInput, TOutput>): void;
  execute(input: TInput): Promise<TOutput>;
}

/**
 * Base strategy class
 */
export abstract class BaseStrategy<TInput = any, TOutput = any>
  implements IStrategy<TInput, TOutput>
{
  abstract execute(input: TInput): TOutput;
}

/**
 * Base async strategy class
 */
export abstract class BaseAsyncStrategy<TInput = any, TOutput = any>
  implements IAsyncStrategy<TInput, TOutput>
{
  abstract execute(input: TInput): Promise<TOutput>;
}
