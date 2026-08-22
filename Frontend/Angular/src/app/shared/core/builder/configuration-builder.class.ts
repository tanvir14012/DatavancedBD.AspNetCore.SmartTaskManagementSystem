/**
 * Configuration Builder for complex nested configurations
 * Provides a structured way to build complex objects with validation
 */

export interface IConfigurationBuilder<T> {
  set<K extends keyof T>(key: K, value: T[K]): this;
  merge(config: Partial<T>): this;
  build(): T;
  buildPartial(): Partial<T>;
  validate(): void;
  clone(): IConfigurationBuilder<T>;
}

export interface ValidationRule<T> {
  validate(config: Partial<T>): void;
}

/**
 * Base class for configuration builders
 * Provides a fluent interface for building complex configurations
 */
export abstract class ConfigurationBuilder<T> implements IConfigurationBuilder<T> {
  protected config: Partial<T> = {};
  protected validationRules: ValidationRule<T>[] = [];
  protected defaultConfig: Partial<T> = {};

  constructor(defaultConfig?: Partial<T>) {
    if (defaultConfig) {
      this.config = { ...defaultConfig };
      this.defaultConfig = { ...defaultConfig };
    }
  }

  /**
   * Set a single property
   */
  set<K extends keyof T>(key: K, value: T[K]): this {
    this.config[key] = value;
    return this;
  }

  /**
   * Merge multiple properties
   */
  merge(config: Partial<T>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Get a property value
   */
  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.config[key];
  }

  /**
   * Check if a property is set
   */
  has<K extends keyof T>(key: K): boolean {
    return key in this.config;
  }

  /**
   * Remove a property
   */
  remove<K extends keyof T>(key: K): this {
    delete this.config[key];
    return this;
  }

  /**
   * Clear all configurations
   */
  clear(): this {
    this.config = {};
    return this;
  }

  /**
   * Reset to default configuration
   */
  reset(): this {
    this.config = { ...this.defaultConfig };
    return this;
  }

  /**
   * Add a validation rule
   */
  addValidationRule(rule: ValidationRule<T>): this {
    this.validationRules.push(rule);
    return this;
  }

  /**
   * Validate the configuration
   */
  validate(): void {
    for (const rule of this.validationRules) {
      rule.validate(this.config);
    }
  }

  /**
   * Build the final object
   * Validates before building
   */
  build(): T {
    this.validate();
    return this.buildInternal();
  }

  /**
   * Build a partial object without full validation
   */
  buildPartial(): Partial<T> {
    return { ...this.config };
  }

  /**
   * Internal build method - override in subclasses
   */
  protected buildInternal(): T {
    return this.config as T;
  }

  /**
   * Clone this builder
   */
  clone(): IConfigurationBuilder<T> {
    const cloned = new (this.constructor as new () => this)();
    cloned.config = { ...this.config };
    cloned.validationRules = [...this.validationRules];
    cloned.defaultConfig = { ...this.defaultConfig };
    return cloned;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Partial<T> {
    return { ...this.config };
  }

  /**
   * Check if configuration is complete
   * Override in subclasses to provide custom logic
   */
  isComplete(): boolean {
    return true;
  }
}

/**
 * Example usage:
 * 
 * interface ApiClientConfig {
 *   baseUrl: string;
 *   timeout: number;
 *   retries: number;
 *   headers?: Record<string, string>;
 * }
 * 
 * class ApiClientConfigBuilder extends ConfigurationBuilder<ApiClientConfig> {
 *   withBaseUrl(url: string): this {
 *     return this.set('baseUrl', url);
 *   }
 *   
 *   withTimeout(ms: number): this {
 *     return this.set('timeout', ms);
 *   }
 *   
 *   withRetries(count: number): this {
 *     return this.set('retries', count);
 *   }
 *   
 *   withHeaders(headers: Record<string, string>): this {
 *     return this.set('headers', headers);
 *   }
 *   
 *   isComplete(): boolean {
 *     return this.has('baseUrl') && this.has('timeout') && this.has('retries');
 *   }
 * }
 * 
 * // Usage:
 * const config = new ApiClientConfigBuilder()
 *   .withBaseUrl('https://api.example.com')
 *   .withTimeout(5000)
 *   .withRetries(3)
 *   .build();
 */
