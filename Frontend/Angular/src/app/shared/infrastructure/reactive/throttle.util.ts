/**
 * Throttle utility
 */

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCallTime >= intervalMs) {
      fn(...args);
      lastCallTime = now;
    }
  };
}
