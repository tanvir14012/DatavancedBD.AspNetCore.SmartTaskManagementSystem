/**
 * Factory Registry for managing and retrieving factories
 * Enables runtime factory selection and registration
 */

import { IFactory, IFactoryRegistry, IAsyncFactory, IAsyncFactoryRegistry } from './factory.interface';

/**
 * Factory registry for synchronous factories
 * Stores factories by key for runtime selection
 */
export class FactoryRegistry<T> implements IFactoryRegistry<T> {
  private factories = new Map<string, IFactory<T>>();

  /**
   * Register a factory
   */
  register<K extends string>(key: K, factory: IFactory<T>): void {
    this.factories.set(key, factory);
  }

  /**
   * Create an instance using a registered factory
   */
  create<K extends string>(key: K): T {
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Factory not registered for key: ${key}`);
    }
    return factory.create();
  }

  /**
   * Check if a factory is registered
   */
  has<K extends string>(key: K): boolean {
    return this.factories.has(key);
  }

  /**
   * Unregister a factory
   */
  unregister<K extends string>(key: K): boolean {
    return this.factories.delete(key);
  }

  /**
   * Get all registered factory keys
   */
  getRegisteredKeys(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get all factories
   */
  getAllFactories(): Map<string, IFactory<T>> {
    return new Map(this.factories);
  }

  /**
   * Clear all factories
   */
  clear(): void {
    this.factories.clear();
  }

  /**
   * Get the number of registered factories
   */
  size(): number {
    return this.factories.size;
  }
}

/**
 * Factory registry for asynchronous factories
 * Stores async factories by key for runtime selection
 */
export class AsyncFactoryRegistry<T> implements IAsyncFactoryRegistry<T> {
  private factories = new Map<string, IAsyncFactory<T>>();

  /**
   * Register an async factory
   */
  register<K extends string>(key: K, factory: IAsyncFactory<T>): void {
    this.factories.set(key, factory);
  }

  /**
   * Create an instance using a registered async factory
   */
  async create<K extends string>(key: K): Promise<T> {
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Async factory not registered for key: ${key}`);
    }
    return factory.create();
  }

  /**
   * Check if a factory is registered
   */
  has<K extends string>(key: K): boolean {
    return this.factories.has(key);
  }

  /**
   * Unregister a factory
   */
  unregister<K extends string>(key: K): boolean {
    return this.factories.delete(key);
  }

  /**
   * Get all registered factory keys
   */
  getRegisteredKeys(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Get all factories
   */
  getAllFactories(): Map<string, IAsyncFactory<T>> {
    return new Map(this.factories);
  }

  /**
   * Clear all factories
   */
  clear(): void {
    this.factories.clear();
  }

  /**
   * Get the number of registered factories
   */
  size(): number {
    return this.factories.size;
  }
}

/**
 * Example usage:
 * 
 * class DatabaseConnection {
 *   constructor(readonly name: string) {}
 *   connect(): Promise<void> { ... }
 * }
 * 
 * const dbRegistry = new AsyncFactoryRegistry<DatabaseConnection>();
 * 
 * dbRegistry.register(
 *   'postgres',
 *   new GenericAsyncFactory(() => new DatabaseConnection('postgres').connect())
 * );
 * 
 * dbRegistry.register(
 *   'mysql',
 *   new GenericAsyncFactory(() => new DatabaseConnection('mysql').connect())
 * );
 * 
 * // Runtime selection
 * const dbType = process.env.DB_TYPE || 'postgres';
 * const connection = await dbRegistry.create(dbType);
 */
