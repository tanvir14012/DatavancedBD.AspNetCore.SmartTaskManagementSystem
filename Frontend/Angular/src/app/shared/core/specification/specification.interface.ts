/**
 * Specification pattern interfaces
 */

export interface ISpecification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
  compile(): (candidate: T) => boolean;
  predicate(): (candidate: T) => boolean;
}

/**
 * Abstract base specification
 */
export abstract class Specification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }

  compile(): (candidate: T) => boolean {
    return (candidate: T) => this.isSatisfiedBy(candidate);
  }

  predicate(): (candidate: T) => boolean {
    return this.compile();
  }
}

/**
 * Helper classes for composite specifications
 */
class AndSpecification<T> extends Specification<T> {
  constructor(
    private spec1: ISpecification<T>,
    private spec2: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.spec1.isSatisfiedBy(candidate) && this.spec2.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(
    private spec1: ISpecification<T>,
    private spec2: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.spec1.isSatisfiedBy(candidate) || this.spec2.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private spec: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/**
 * Example usage:
 * 
 * class UserSpecifications {
 *   static isActive(): Specification<User> {
 *     return new (class extends Specification<User> {
 *       isSatisfiedBy(candidate: User): boolean {
 *         return candidate.active;
 *       }
 *     })();
 *   }
 * 
 *   static hasEmail(): Specification<User> {
 *     return new (class extends Specification<User> {
 *       isSatisfiedBy(candidate: User): boolean {
 *         return !!candidate.email;
 *       }
 *     })();
 *   }
 * }
 * 
 * // Usage
 * const spec = UserSpecifications.isActive()
 *   .and(UserSpecifications.hasEmail());
 * 
 * const users = allUsers.filter(spec.predicate());
 */
