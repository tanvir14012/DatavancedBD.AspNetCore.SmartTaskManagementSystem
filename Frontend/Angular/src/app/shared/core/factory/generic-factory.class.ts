/**
 * Generic Factory implementation
 * Flexible factory for creating objects with various arguments
 */

import { IFactory, IAsyncFactory } from './factory.interface';

/**
 * Generic factory for creating objects synchronously
 */
export class GenericFactory<T, TArgs extends any[] = any[]>
  implements IFactory<T, TArgs>
{
  constructor(private creator: (...args: TArgs) => T) {}

  create(...args: TArgs): T {
    return this.creator(...args);
  }

  /**
   * Create a factory with predefined arguments
   */
  partial(...partialArgs: any[]): GenericFactory<T, any[]> {
    return new GenericFactory((args: any[]) =>
      this.creator(...(partialArgs.concat(args) as any))
    );
  }

  /**
   * Create a factory with transformed output
   */
  map<U>(mapper: (value: T) => U): GenericFactory<U, TArgs> {
    return new GenericFactory((...args: TArgs) => mapper(this.create(...args)));
  }

  /**
   * Create a factory with conditional creation
   */
  when(
    condition: (...args: TArgs) => boolean,
    fallback: (...args: TArgs) => T
  ): GenericFactory<T, TArgs> {
    return new GenericFactory((...args: TArgs) =>
      condition(...args) ? this.create(...args) : fallback(...args)
    );
  }
}

/**
 * Generic async factory for creating objects asynchronously
 */
export class GenericAsyncFactory<T, TArgs extends any[] = any[]>
  implements IAsyncFactory<T, TArgs>
{
  constructor(private creator: (...args: TArgs) => Promise<T>) {}

  create(...args: TArgs): Promise<T> {
    return this.creator(...args);
  }

  /**
   * Create a factory with predefined arguments
   */
  partial(...partialArgs: any[]): GenericAsyncFactory<T, any[]> {
    return new GenericAsyncFactory((args: any[]) =>
      this.creator(...(partialArgs.concat(args) as any))
    );
  }

  /**
   * Create a factory with transformed output
   */
  map<U>(mapper: (value: T) => U | Promise<U>): GenericAsyncFactory<U, TArgs> {
    return new GenericAsyncFactory(async (...args: TArgs) => {
      const result = await this.create(...args);
      return mapper(result);
    });
  }

  /**
   * Create a factory with conditional creation
   */
  when(
    condition: (...args: TArgs) => boolean | Promise<boolean>,
    fallback: (...args: TArgs) => Promise<T>
  ): GenericAsyncFactory<T, TArgs> {
    return new GenericAsyncFactory(async (...args: TArgs) => {
      const shouldCreate = await Promise.resolve(condition(...args));
      return shouldCreate ? this.create(...args) : fallback(...args);
    });
  }
}

/**
 * Example usage:
 * 
 * class User {
 *   constructor(readonly id: number, readonly name: string) {}
 * }
 * 
 * const userFactory = new GenericFactory<User, [number, string]>(
 *   (id, name) => new User(id, name)
 * );
 * 
 * const user = userFactory.create(1, 'John');
 * 
 * // With partial arguments
 * const premiumUserFactory = userFactory.partial(1);
 * const premiumUser = premiumUserFactory.create('Premium John');
 * 
 * // With mapping
 * const userNameFactory = userFactory
 *   .partial(1)
 *   .map(user => user.name);
 * 
 * const userName = userNameFactory.create('John'); // Returns 'John'
 */
