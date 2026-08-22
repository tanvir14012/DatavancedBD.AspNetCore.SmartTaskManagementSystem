/**
 * Pipeline and middleware interfaces
 */

export interface IMiddleware<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput> | TOutput;
}

export interface IPipelineContext<TInput, TOutput> {
  input: TInput;
  output?: TOutput;
  state: Map<string, any>;
  abort(): void;
  isAborted(): boolean;
  setData(key: string, value: any): void;
  getData(key: string): any;
}

export interface IPipeline<TInput, TOutput> {
  use(middleware: IMiddleware<TInput, TOutput> | ((input: TInput) => TOutput | Promise<TOutput>)): this;
  before(handler: (input: TInput) => void | Promise<void>): this;
  after(handler: (output: TOutput) => void | Promise<void>): this;
  catch(handler: (error: Error) => void | Promise<void>): this;
  execute(input: TInput): Promise<TOutput>;
}

export type PipelineMiddleware<TInput, TOutput> = 
  | IMiddleware<TInput, TOutput>
  | ((input: TInput) => TOutput | Promise<TOutput>);
