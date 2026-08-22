/**
 * Middleware Pipeline for processing requests through multiple stages
 */

import {
  IMiddleware,
  IPipelineContext,
  IPipeline,
  PipelineMiddleware,
} from './pipeline.interface';

/**
 * Default pipeline context implementation
 */
export class PipelineContext<TInput, TOutput> implements IPipelineContext<TInput, TOutput> {
  readonly input: TInput;
  output?: TOutput;
  readonly state = new Map<string, any>();
  private _aborted = false;

  constructor(input: TInput) {
    this.input = input;
  }

  abort(): void {
    this._aborted = true;
  }

  isAborted(): boolean {
    return this._aborted;
  }

  setData(key: string, value: any): void {
    this.state.set(key, value);
  }

  getData(key: string): any {
    return this.state.get(key);
  }
}

/**
 * Middleware pipeline for processing data through multiple middleware
 */
export class MiddlewarePipeline<TInput, TOutput> implements IPipeline<TInput, TOutput> {
  private middlewares: IMiddleware<any, any>[] = [];
  private beforeHandlers: Array<(input: TInput) => void | Promise<void>> = [];
  private afterHandlers: Array<(output: TOutput) => void | Promise<void>> = [];
  private errorHandlers: Array<(error: Error) => void | Promise<void>> = [];

  /**
   * Add middleware to the pipeline
   */
  use(
    middleware: PipelineMiddleware<TInput, TOutput>
  ): this {
    if (typeof middleware === 'function') {
      this.middlewares.push({
        execute: middleware,
      });
    } else {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Add before handler
   */
  before(handler: (input: TInput) => void | Promise<void>): this {
    this.beforeHandlers.push(handler);
    return this;
  }

  /**
   * Add after handler
   */
  after(handler: (output: TOutput) => void | Promise<void>): this {
    this.afterHandlers.push(handler);
    return this;
  }

  /**
   * Add error handler
   */
  catch(handler: (error: Error) => void | Promise<void>): this {
    this.errorHandlers.push(handler);
    return this;
  }

  /**
   * Execute the pipeline
   */
  async execute(input: TInput): Promise<TOutput> {
    const context = new PipelineContext<TInput, TOutput>(input);

    try {
      // Execute before handlers
      for (const handler of this.beforeHandlers) {
        await Promise.resolve(handler(input));
        if (context.isAborted()) {
          throw new Error('Pipeline aborted');
        }
      }

      // Execute middleware chain
      let result: any = input;
      for (const middleware of this.middlewares) {
        if (context.isAborted()) {
          break;
        }
        result = await Promise.resolve(middleware.execute(result));
        context.output = result;
      }

      // Execute after handlers
      for (const handler of this.afterHandlers) {
        await Promise.resolve(handler(result));
      }

      return result as TOutput;
    } catch (error) {
      // Execute error handlers
      for (const handler of this.errorHandlers) {
        await Promise.resolve(handler(error as Error));
      }
      throw error;
    }
  }

  /**
   * Execute synchronously (no async middleware)
   */
  executeSync(input: TInput): TOutput {
    const context = new PipelineContext<TInput, TOutput>(input);

    try {
      // Execute before handlers (sync only)
      for (const handler of this.beforeHandlers) {
        handler(input);
        if (context.isAborted()) {
          throw new Error('Pipeline aborted');
        }
      }

      // Execute middleware chain
      let result: any = input;
      for (const middleware of this.middlewares) {
        if (context.isAborted()) {
          break;
        }
        result = middleware.execute(result);
        context.output = result;
      }

      // Execute after handlers (sync only)
      for (const handler of this.afterHandlers) {
        handler(result);
      }

      return result as TOutput;
    } catch (error) {
      // Execute error handlers (sync only)
      for (const handler of this.errorHandlers) {
        handler(error as Error);
      }
      throw error;
    }
  }

  /**
   * Clone this pipeline
   */
  clone(): MiddlewarePipeline<TInput, TOutput> {
    const cloned = new MiddlewarePipeline<TInput, TOutput>();
    cloned.middlewares = [...this.middlewares];
    cloned.beforeHandlers = [...this.beforeHandlers];
    cloned.afterHandlers = [...this.afterHandlers];
    cloned.errorHandlers = [...this.errorHandlers];
    return cloned;
  }
}

/**
 * Example usage:
 * 
 * const pipeline = new MiddlewarePipeline<Request, Response>()
 *   .before(req => console.log('Starting request'))
 *   .use(authMiddleware)
 *   .use(validationMiddleware)
 *   .use(processingMiddleware)
 *   .after(res => console.log('Response ready'))
 *   .catch(err => console.error('Pipeline error:', err));
 * 
 * const response = await pipeline.execute(request);
 */
