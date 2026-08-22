/**
 * State Machine pattern with transitions, guards, and async support
 */

import { IState, ITransition, IStateMachine, StateGuard, StateAction } from '../types';

export class StateMachine<TContext = any> implements IStateMachine<TContext> {
  private states = new Map<string, IState<TContext>>();
  private transitions = new Map<string, ITransition<TContext>[]>();
  private _currentState: IState<TContext>;

  constructor(
    initialState: IState<TContext>,
    private context: TContext
  ) {
    this._currentState = initialState;
  }

  get currentState(): IState<TContext> {
    return this._currentState;
  }

  registerState(state: IState<TContext>): void {
    this.states.set(state.name, state);
  }

  registerTransition(transition: ITransition<TContext>): void {
    if (!this.transitions.has(transition.from)) {
      this.transitions.set(transition.from, []);
    }
    this.transitions.get(transition.from)!.push(transition);
  }

  async trigger(triggerName: string): Promise<boolean> {
    const transitions = this.transitions.get(this._currentState.name) || [];
    const transition = transitions.find(t => t.trigger === triggerName);

    if (!transition) {
      return false;
    }

    if (transition.guard && !transition.guard(this.context)) {
      return false;
    }

    await this._currentState.onExit?.(this.context);
    if (transition.action) {
      await transition.action(this.context);
    }

    const nextState = this.states.get(transition.to);
    if (nextState) {
      this._currentState = nextState;
      await nextState.onEnter?.(this.context);
    }

    return true;
  }

  canTransitionTo(targetStateName: string): boolean {
    return this._currentState.canTransitionTo?.(targetStateName) ?? true;
  }

  reset(): void {
    // Reset implementation
  }
}

export { IState, ITransition, IStateMachine, StateGuard, StateAction } from './types';

/**
 * Example usage:
 * 
 * const sm = new StateMachine(
 *   { name: 'idle', onEnter: () => console.log('Ready') },
 *   {}
 * );
 * 
 * sm.registerState({ name: 'running' });
 * sm.registerTransition({
 *   from: 'idle',
 *   to: 'running',
 *   trigger: 'start',
 *   guard: () => true,
 *   action: () => console.log('Starting...')
 * });
 * 
 * await sm.trigger('start');
 */
