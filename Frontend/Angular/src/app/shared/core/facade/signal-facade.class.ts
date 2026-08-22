/**
 * Signal Facade for Angular signals
 */

import { Signal, WritableSignal, signal, computed, effect } from '@angular/core';
import { ISignalFacade } from './facade.interface';

/**
 * Facade for managing Angular signals
 */
export abstract class SignalFacade implements ISignalFacade {
  protected signals = new Map<string, WritableSignal<any>>();
  protected computedSignals = new Map<string, Signal<any>>();
  protected effects: Array<() => void> = [];
  protected disposed = false;

  /**
   * Create a signal
   */
  protected createSignal<T>(key: string, initialValue: T): WritableSignal<T> {
    if (this.signals.has(key)) {
      throw new Error(`Signal with key '${key}' already exists`);
    }
    const s = signal<T>(initialValue);
    this.signals.set(key, s);
    return s;
  }

  /**
   * Get a signal
   */
  protected getSignal<T>(key: string): WritableSignal<T> | undefined {
    return this.signals.get(key);
  }

  /**
   * Create a computed signal
   */
  protected createComputedSignal<T>(
    key: string,
    compute: () => T
  ): Signal<T> {
    if (this.computedSignals.has(key)) {
      throw new Error(`Computed signal with key '${key}' already exists`);
    }
    const c = computed(compute);
    this.computedSignals.set(key, c);
    return c;
  }

  /**
   * Get a computed signal
   */
  protected getComputedSignal<T>(key: string): Signal<T> | undefined {
    return this.computedSignals.get(key);
  }

  /**
   * Create an effect
   */
  protected createEffect(fn: () => void): void {
    const dispose = effect(fn);
    this.effects.push(dispose);
  }

  /**
   * Get all signals
   */
  getAllSignals(): Map<string, WritableSignal<any>> {
    return new Map(this.signals);
  }

  /**
   * Get all computed signals
   */
  getAllComputedSignals(): Map<string, Signal<any>> {
    return new Map(this.computedSignals);
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose all signals and effects
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Dispose effects
    for (const dispose of this.effects) {
      try {
        dispose();
      } catch (error) {
        console.error('Error disposing effect:', error);
      }
    }

    // Clear collections
    this.signals.clear();
    this.computedSignals.clear();
    this.effects = [];
    this.disposed = true;
  }

  /**
   * Ensure not disposed
   */
  protected checkDisposed(): void {
    if (this.disposed) {
      throw new Error('SignalFacade has been disposed');
    }
  }
}

/**
 * Example usage:
 * 
 * interface CounterFacadeAPI {
 *   count: Signal<number>;
 *   increment(): void;
 *   decrement(): void;
 * }
 * 
 * class CounterFacade extends SignalFacade implements CounterFacadeAPI {
 *   private countSignal: WritableSignal<number>;
 * 
 *   constructor() {
 *     super();
 *     this.countSignal = this.createSignal('count', 0);
 *   }
 * 
 *   get count(): Signal<number> {
 *     return this.countSignal;
 *   }
 * 
 *   increment(): void {
 *     this.checkDisposed();
 *     this.countSignal.update(c => c + 1);
 *   }
 * 
 *   decrement(): void {
 *     this.checkDisposed();
 *     this.countSignal.update(c => c - 1);
 *   }
 * }
 */
