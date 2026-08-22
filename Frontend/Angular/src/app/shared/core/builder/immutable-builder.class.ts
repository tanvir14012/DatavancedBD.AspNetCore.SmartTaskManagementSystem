/**
 * Immutable Builder for thread-safe, functional-style configuration
 * Creates a new builder instance for each configuration change
 */

export interface IImmutableBuilder<T> {
  build(): T;
}

/**
 * Base class for immutable builders
 * Each method returns a new builder instance
 * T is the product type being built
 */
export abstract class ImmutableBuilder<T> implements IImmutableBuilder<T> {
  protected readonly config: Readonly<Partial<T>>;

  constructor(config: Readonly<Partial<T>> = {}) {
    this.config = config;
  }

  /**
   * Create a new builder with an updated property
   * Returns a new instance, leaving this one unchanged
   */
  protected with<K extends keyof T>(
    key: K,
    value: T[K]
  ): this {
    const newConfig = { ...this.config, [key]: value };
    return new (this.constructor as new (config: any) => this)(newConfig);
  }

  /**
   * Get a property from the configuration
   */
  protected get<K extends keyof T>(key: K): T[K] | undefined {
    return this.config[key];
  }

  /**
   * Get a copy of the current configuration
   */
  protected getConfig(): Readonly<Partial<T>> {
    return this.config;
  }

  /**
   * Build the final object
   * Must be implemented by subclasses
   */
  abstract build(): T;

  /**
   * Validate the configuration before building
   * Override in subclasses for custom validation
   */
  protected validate(): void {
    // Override in subclasses
  }
}

/**
 * Example usage:
 * class UserBuilder extends ImmutableBuilder<User> {
 *   withName(name: string): UserBuilder {
 *     return this.with('name', name);
 *   }
 *   
 *   withEmail(email: string): UserBuilder {
 *     return this.with('email', email);
 *   }
 *   
 *   build(): User {
 *     this.validate();
 *     return new User(this.config as User);
 *   }
 * }
 * 
 * // Usage:
 * const builder1 = new UserBuilder()
 *   .withName('John')
 *   .withEmail('john@example.com');
 * 
 * const user1 = builder1.build();
 * 
 * // Create a new user based on builder1 without modifying builder1
 * const builder2 = builder1.withName('Jane');
 * const user2 = builder2.build();
 * 
 * // builder1 is unchanged
 */
