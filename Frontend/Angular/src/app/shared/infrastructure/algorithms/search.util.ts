/**
 * Searching algorithms
 */

export class SearchUtil {
  /**
   * Binary search - O(log n)
   */
  static binarySearch<T>(array: T[], target: T, compareFn: (a: T, b: T) => number): number {
    let left = 0;
    let right = array.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const cmp = compareFn(array[mid], target);

      if (cmp === 0) {
        return mid;
      } else if (cmp < 0) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return -1;
  }

  /**
   * Linear search - O(n)
   */
  static linearSearch<T>(array: T[], predicate: (item: T) => boolean): number {
    for (let i = 0; i < array.length; i++) {
      if (predicate(array[i])) {
        return i;
      }
    }
    return -1;
  }
}
