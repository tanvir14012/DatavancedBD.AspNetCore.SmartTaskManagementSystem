/**
 * Common specifications for reusable predicates
 */

import { Specification } from './specification.interface';

/**
 * Lambda specification for simple predicates
 */
export class LambdaSpecification<T> extends Specification<T> {
  constructor(private predicate: (candidate: T) => boolean) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.predicate(candidate);
  }
}

/**
 * Common specifications for objects
 */
export class CommonSpecifications {
  /**
   * Create a property equality specification
   */
  static propertyEquals<T, K extends keyof T>(
    property: K,
    value: T[K]
  ): Specification<T> {
    return new LambdaSpecification((candidate: T) => candidate[property] === value);
  }

  /**
   * Create a property inequality specification
   */
  static propertyNotEquals<T, K extends keyof T>(
    property: K,
    value: T[K]
  ): Specification<T> {
    return new LambdaSpecification((candidate: T) => candidate[property] !== value);
  }

  /**
   * Create a string contains specification
   */
  static stringContains<T, K extends keyof T>(
    property: K,
    value: string,
    caseSensitive = true
  ): Specification<T> {
    return new LambdaSpecification((candidate: T) => {
      const str = String(candidate[property]);
      if (caseSensitive) {
        return str.includes(value);
      }
      return str.toLowerCase().includes(value.toLowerCase());
    });
  }

  /**
   * Create a range specification for comparable values
   */
  static inRange<T, K extends keyof T>(
    property: K,
    min: number,
    max: number
  ): Specification<T> {
    return new LambdaSpecification((candidate: T) => {
      const value = Number(candidate[property]);
      return value >= min && value <= max;
    });
  }

  /**
   * Create an array contains specification
   */
  static arrayContains<T>(
    predicate: (candidate: T) => boolean
  ): Specification<T[]> {
    return new LambdaSpecification((candidates: T[]) =>
      candidates.some(predicate)
    );
  }

  /**
   * Create a null check specification
   */
  static isNull<T, K extends keyof T>(property: K): Specification<T> {
    return new LambdaSpecification(
      (candidate: T) => candidate[property] === null || candidate[property] === undefined
    );
  }

  /**
   * Create a not-null check specification
   */
  static isNotNull<T, K extends keyof T>(property: K): Specification<T> {
    return new LambdaSpecification(
      (candidate: T) => candidate[property] !== null && candidate[property] !== undefined
    );
  }

  /**
   * Create a boolean property specification
   */
  static isTruthy<T, K extends keyof T>(property: K): Specification<T> {
    return new LambdaSpecification((candidate: T) => !!candidate[property]);
  }

  /**
   * Create a boolean property specification
   */
  static isFalsy<T, K extends keyof T>(property: K): Specification<T> {
    return new LambdaSpecification((candidate: T) => !candidate[property]);
  }
}

/**
 * Example usage:
 * 
 * interface Product {
 *   name: string;
 *   price: number;
 *   inStock: boolean;
 * }
 * 
 * const spec = CommonSpecifications.propertyEquals<Product>('inStock', true)
 *   .and(CommonSpecifications.inRange<Product, 'price'>('price', 10, 100))
 *   .and(CommonSpecifications.stringContains<Product, 'name'>('name', 'laptop'));
 * 
 * const filtered = products.filter(spec.predicate());
 */
