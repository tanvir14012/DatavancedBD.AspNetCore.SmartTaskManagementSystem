/**
 * Fluent builder for pipelines
 */

import { MiddlewarePipeline } from './middleware-pipeline.class';
import { PipelineMiddleware } from './pipeline.interface';

/**
 * Fluent builder for creating pipelines
 */
export class PipelineBuilder<TInput, TOutput> {
  private pipeline = new MiddlewarePipeline<TInput, TOutput>();

  /**
   * Add middleware
   */
  use(middleware: PipelineMiddleware<TInput, TOutput>): this {
    this.pipeline.use(middleware);
    return this;
  }

  /**
   * Add multiple middleware
   */
  useMany(...middlewares: PipelineMiddleware<TInput, TOutput>[]): this {
    for (const middleware of middlewares) {
      this.pipeline.use(middleware);
    }
    return this;
  }

  /**
   * Add before handler
   */
  before(handler: (input: TInput) => void | Promise<void>): this {
    this.pipeline.before(handler);
    return this;
  }

  /**
   * Add after handler
   */
  after(handler: (output: TOutput) => void | Promise<void>): this {
    this.pipeline.after(handler);
    return this;
  }

  /**
   * Add error handler
   */
  catch(handler: (error: Error) => void | Promise<void>): this {
    this.pipeline.catch(handler);
    return this;
  }

  /**
   * Add conditional middleware
   */
  when(
    condition: (input: TInput) => boolean,
    middleware: PipelineMiddleware<TInput, TOutput>
  ): this {
    this.pipeline.use(async (input: TInput) => {
      if (condition(input)) {
        if (typeof middleware === 'function') {
          return middleware(input);
        } else {
          return middleware.execute(input);
        }
      }
      return input;
    });
    return this;
  }

  /**
   * Build the pipeline
   */
  build(): MiddlewarePipeline<TInput, TOutput> {
    return this.pipeline;
  }
}

/**
 * Example usage:
 * 
 * const pipeline = new PipelineBuilder<Request, Response>()
 *   .before(req => console.log('Starting'))
 *   .use(authMiddleware)
 *   .when(req => req.requiresValidation, validationMiddleware)
 *   .use(processingMiddleware)
 *   .after(res => console.log('Done'))
 *   .catch(err => console.error(err))
 *   .build();
 */
