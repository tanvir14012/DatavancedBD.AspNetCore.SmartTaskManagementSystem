/**
 * Factory pattern interfaces
 */

export interface IFactory<T, TArgs extends any[] = any[]> {
  create(...args: TArgs): T;
}

export interface IAsyncFactory<T, TArgs extends any[] = any[]> {
  create(...args: TArgs): Promise<T>;
}

export interface IFactoryRegistry<T> {
  register<K extends string>(key: K, factory: IFactory<T>): void;
  create<K extends string>(key: K): T;
  has<K extends string>(key: K): boolean;
  unregister<K extends string>(key: K): boolean;
  getRegisteredKeys(): string[];
}

export interface IAsyncFactoryRegistry<T> {
  register<K extends string>(key: K, factory: IAsyncFactory<T>): void;
  create<K extends string>(key: K): Promise<T>;
  has<K extends string>(key: K): boolean;
  unregister<K extends string>(key: K): boolean;
  getRegisteredKeys(): string[];
}
