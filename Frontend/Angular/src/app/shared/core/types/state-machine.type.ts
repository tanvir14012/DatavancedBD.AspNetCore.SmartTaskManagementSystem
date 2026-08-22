/**
 * State machine types and interfaces
 */

export interface IState<TContext = any> {
  name: string;
  onEnter?(context: TContext): void | Promise<void>;
  onExit?(context: TContext): void | Promise<void>;
  canTransitionTo?(targetState: string): boolean;
}

export interface ITransition<TContext = any> {
  from: string;
  to: string;
  trigger: string;
  guard?(context: TContext): boolean;
  action?(context: TContext): void | Promise<void>;
}

export interface IStateMachine<TContext = any> {
  currentState: IState<TContext>;
  context: TContext;

  registerState(state: IState<TContext>): void;
  registerTransition(transition: ITransition<TContext>): void;
  trigger(triggerName: string): Promise<boolean>;
  canTransitionTo(targetStateName: string): boolean;
  reset(): void;
}

export type StateGuard<TContext> = (context: TContext) => boolean | Promise<boolean>;
export type StateAction<TContext> = (context: TContext) => void | Promise<void>;
