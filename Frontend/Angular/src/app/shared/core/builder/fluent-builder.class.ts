/**
 * Fluent Builder for chaining method calls
 * Mutable but provides fluent interface for easy configuration
 */

export interface IFluentBuilder<T> {
  build(): T;
}

/**
 * Base class for fluent builders
 * T is the product type being built
 */
export abstract class FluentBuilder<T> implements IFluentBuilder<T> {
  protected config: Partial<T> = {};

  /**
   * Set a property on the configuration
   */
  protected set<K extends keyof T>(key: K, value: T[K]): this {
    this.config[key] = value;
    return this;
  }

  /**
   * Get a property from the configuration
   */
  protected get<K extends keyof T>(key: K): T[K] | undefined {
    return this.config[key];
  }

  /**
   * Build the final object
   * Must be implemented by subclasses
   */
  abstract build(): T;

  /**
   * Reset the builder to initial state
   */
  reset(): this {
    this.config = {};
    return this;
  }

  /**
   * Validate the configuration before building
   * Override in subclasses for custom validation
   */
  protected validate(): void {
    // Override in subclasses
  }

  /**
   * Get a copy of the current configuration
   */
  protected getConfig(): Partial<T> {
    return { ...this.config };
  }
}

/**
 * Example usage:
 * class UserBuilder extends FluentBuilder<User> {
 *   withName(name: string): this {
 *     return this.set('name', name);
 *   }
 *   
 *   withEmail(email: string): this {
 *     return this.set('email', email);
 *   }
 *   
 *   build(): User {
 *     this.validate();
 *     return new User(this.config as User);
 *   }
 * }
 * 
 * // Usage:
 * const user = new UserBuilder()
 *   .withName('John')
 *   .withEmail('john@example.com')
 *   .build();
 */
