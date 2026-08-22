/**
 * Signal helper utilities
 */

import { Signal, WritableSignal, computed, effect } from '@angular/core';

/**
 * Create a derived signal
 */
export function deriveSignal<T>(
  source: Signal<T>,
  transform: (value: T) => T
): Signal<T> {
  return computed(() => transform(source()));
}

/**
 * Create multiple signals from a single source
 */
export function splitSignal<T, R extends Record<string, any>>(
  source: Signal<T>,
  splitter: (value: T) => R
): { [K in keyof R]: Signal<R[K]> } {
  const result: any = {};
  const split = computed(() => splitter(source()));

  for (const key in splitter(source())) {
    result[key] = computed(() => split()[key]);
  }

  return result;
}
