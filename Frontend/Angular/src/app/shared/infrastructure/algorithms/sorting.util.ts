/**
 * Sorting algorithms
 */

export class SortingUtil {
  /**
   * Quick Sort - O(n log n) average
   */
  static quickSort<T>(array: T[], compareFn: (a: T, b: T) => number): T[] {
    if (array.length <= 1) return array;

    const pivot = array[Math.floor(array.length / 2)];
    const left = array.filter(x => compareFn(x, pivot) < 0);
    const middle = array.filter(x => compareFn(x, pivot) === 0);
    const right = array.filter(x => compareFn(x, pivot) > 0);

    return [
      ...this.quickSort(left, compareFn),
      ...middle,
      ...this.quickSort(right, compareFn),
    ];
  }

  /**
   * Merge Sort - O(n log n)
   */
  static mergeSort<T>(array: T[], compareFn: (a: T, b: T) => number): T[] {
    if (array.length <= 1) return array;

    const mid = Math.floor(array.length / 2);
    const left = this.mergeSort(array.slice(0, mid), compareFn);
    const right = this.mergeSort(array.slice(mid), compareFn);

    return this.merge(left, right, compareFn);
  }

  private static merge<T>(
    left: T[],
    right: T[],
    compareFn: (a: T, b: T) => number
  ): T[] {
    const result: T[] = [];
    let i = 0;
    let j = 0;

    while (i < left.length && j < right.length) {
      if (compareFn(left[i], right[j]) <= 0) {
        result.push(left[i++]);
      } else {
        result.push(right[j++]);
      }
    }

    return result.concat(left.slice(i)).concat(right.slice(j));
  }
}
