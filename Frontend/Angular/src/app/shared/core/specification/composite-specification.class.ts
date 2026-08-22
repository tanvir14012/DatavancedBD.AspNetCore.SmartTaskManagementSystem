/**
 * Composite Specification for building complex predicates
 */

import { Specification, ISpecification } from './specification.interface';

/**
 * Composite specification allowing runtime composition
 */
export class CompositeSpecification<T> extends Specification<T> {
  private predicates: Array<(candidate: T) => boolean> = [];

  /**
   * Add a predicate to the composition
   */
  addPredicate(predicate: (candidate: T) => boolean): this {
    this.predicates.push(predicate);
    return this;
  }

  /**
   * Add multiple predicates
   */
  addPredicates(...predicates: Array<(candidate: T) => boolean>): this {
    this.predicates.push(...predicates);
    return this;
  }

  /**
   * Add a specification as a predicate
   */
  addSpecification(spec: ISpecification<T>): this {
    this.predicates.push(spec.predicate());
    return this;
  }

  /**
   * Check if all predicates are satisfied
   */
  isSatisfiedBy(candidate: T): boolean {
    return this.predicates.every(p => p(candidate));
  }

  /**
   * Get the number of predicates
   */
  count(): number {
    return this.predicates.length;
  }

  /**
   * Clear all predicates
   */
  clear(): this {
    this.predicates = [];
    return this;
  }

  /**
   * Clone this specification
   */
  clone(): CompositeSpecification<T> {
    const cloned = new CompositeSpecification<T>();
    cloned.predicates = [...this.predicates];
    return cloned;
  }
}

/**
 * Disjunctive (OR) Composite Specification
 */
export class DisjunctiveSpecification<T> extends Specification<T> {
  private predicates: Array<(candidate: T) => boolean> = [];

  /**
   * Add a predicate
   */
  addPredicate(predicate: (candidate: T) => boolean): this {
    this.predicates.push(predicate);
    return this;
  }

  /**
   * Add a specification
   */
  addSpecification(spec: ISpecification<T>): this {
    this.predicates.push(spec.predicate());
    return this;
  }

  /**
   * Check if any predicate is satisfied
   */
  isSatisfiedBy(candidate: T): boolean {
    return this.predicates.some(p => p(candidate));
  }

  /**
   * Get the number of predicates
   */
  count(): number {
    return this.predicates.length;
  }

  /**
   * Clear all predicates
   */
  clear(): this {
    this.predicates = [];
    return this;
  }

  /**
   * Clone this specification
   */
  clone(): DisjunctiveSpecification<T> {
    const cloned = new DisjunctiveSpecification<T>();
    cloned.predicates = [...this.predicates];
    return cloned;
  }
}

/**
 * Example usage:
 * 
 * const spec = new CompositeSpecification<User>()
 *   .addPredicate(u => u.active)
 *   .addPredicate(u => u.email)
 *   .addPredicate(u => u.age >= 18);
 * 
 * const filtered = users.filter(spec.predicate());
 */
