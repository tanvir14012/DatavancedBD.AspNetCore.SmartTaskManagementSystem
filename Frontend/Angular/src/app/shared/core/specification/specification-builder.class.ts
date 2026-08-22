/**
 * Specification Builder for fluent specification construction
 */

import { Specification, ISpecification } from './specification.interface';
import { CompositeSpecification, DisjunctiveSpecification } from './composite-specification.class';

/**
 * Fluent builder for specifications
 */
export class SpecificationBuilder<T> {
  private specifications: ISpecification<T>[] = [];
  private mode: 'and' | 'or' = 'and';

  /**
   * Add a specification with AND logic
   */
  and(spec: ISpecification<T>): this {
    this.mode = 'and';
    this.specifications.push(spec);
    return this;
  }

  /**
   * Add a specification with AND logic (fluent)
   */
  where(spec: ISpecification<T>): this {
    return this.and(spec);
  }

  /**
   * Add a specification with OR logic
   */
  or(spec: ISpecification<T>): this {
    this.mode = 'or';
    this.specifications.push(spec);
    return this;
  }

  /**
   * Add a predicate
   */
  withPredicate(predicate: (candidate: T) => boolean): this {
    const spec = new (class extends Specification<T> {
      isSatisfiedBy(candidate: T): boolean {
        return predicate(candidate);
      }
    })();
    this.specifications.push(spec);
    return this;
  }

  /**
   * Add multiple predicates
   */
  withPredicates(...predicates: Array<(candidate: T) => boolean>): this {
    for (const predicate of predicates) {
      this.withPredicate(predicate);
    }
    return this;
  }

  /**
   * Build the final specification
   */
  build(): ISpecification<T> {
    if (this.specifications.length === 0) {
      throw new Error('No specifications added to builder');
    }

    if (this.specifications.length === 1) {
      return this.specifications[0];
    }

    if (this.mode === 'and') {
      const composite = new CompositeSpecification<T>();
      for (const spec of this.specifications) {
        composite.addSpecification(spec);
      }
      return composite;
    } else {
      const disjunctive = new DisjunctiveSpecification<T>();
      for (const spec of this.specifications) {
        disjunctive.addSpecification(spec);
      }
      return disjunctive;
    }
  }

  /**
   * Build and compile the specification
   */
  compile(): (candidate: T) => boolean {
    return this.build().compile();
  }

  /**
   * Build and get the predicate
   */
  predicate(): (candidate: T) => boolean {
    return this.build().predicate();
  }

  /**
   * Clear all specifications
   */
  clear(): this {
    this.specifications = [];
    return this;
  }

  /**
   * Get the number of specifications
   */
  count(): number {
    return this.specifications.length;
  }
}

/**
 * Example usage:
 * 
 * const spec = new SpecificationBuilder<User>()
 *   .withPredicate(u => u.active)
 *   .and(isAdultSpec)
 *   .and(hasEmailSpec)
 *   .build();
 * 
 * const filtered = users.filter(spec.predicate());
 */
