/**
 * ViewModel Adapter for converting domain models to view models
 */

import { IAdapter } from './adapter.interface';

/**
 * Adapter for domain models to view models
 */
export class ViewModelAdapter<TDomain, TViewModel> implements IAdapter<TDomain, TViewModel> {
  constructor(private mapper: (domain: TDomain) => TViewModel) {}

  /**
   * Adapt domain to view model
   */
  adapt(domain: TDomain): TViewModel {
    return this.mapper(domain);
  }

  /**
   * Adapt array of domain models
   */
  adaptArray(domains: TDomain[]): TViewModel[] {
    return domains.map(domain => this.adapt(domain));
  }

  /**
   * Add post-processing step
   */
  then<TNext>(next: (vm: TViewModel) => TNext): ViewModelAdapter<TDomain, TNext> {
    return new ViewModelAdapter(domain => next(this.adapt(domain)));
  }

  /**
   * Add filtering
   */
  filter(predicate: (vm: TViewModel) => boolean): ViewModelAdapter<TDomain, TViewModel | undefined> {
    return new ViewModelAdapter(domain => {
      const vm = this.adapt(domain);
      return predicate(vm) ? vm : undefined;
    });
  }

  /**
   * Clone with new mapper
   */
  clone(): ViewModelAdapter<TDomain, TViewModel> {
    return new ViewModelAdapter(this.mapper);
  }
}

/**
 * Complex view model builder
 */
export class ComplexViewModelAdapter<TDomain, TViewModel> implements IAdapter<TDomain, TViewModel> {
  private mappers: Array<(vm: Partial<TViewModel>, domain: TDomain) => void> = [];
  private defaults: Partial<TViewModel> = {};

  /**
   * Set default values
   */
  withDefaults(defaults: Partial<TViewModel>): this {
    this.defaults = { ...defaults };
    return this;
  }

  /**
   * Add a property mapper
   */
  mapProperty<K extends keyof TViewModel>(
    key: K,
    mapper: (domain: TDomain) => TViewModel[K]
  ): this {
    this.mappers.push((vm, domain) => {
      vm[key] = mapper(domain);
    });
    return this;
  }

  /**
   * Add a conditional mapper
   */
  mapPropertyIf<K extends keyof TViewModel>(
    key: K,
    mapper: (domain: TDomain) => TViewModel[K],
    condition: (domain: TDomain) => boolean
  ): this {
    this.mappers.push((vm, domain) => {
      if (condition(domain)) {
        vm[key] = mapper(domain);
      }
    });
    return this;
  }

  /**
   * Map multiple properties at once
   */
  mapProperties(mapper: (domain: TDomain) => Partial<TViewModel>): this {
    this.mappers.push((vm, domain) => {
      Object.assign(vm, mapper(domain));
    });
    return this;
  }

  /**
   * Adapt domain to view model
   */
  adapt(domain: TDomain): TViewModel {
    const vm: Partial<TViewModel> = { ...this.defaults };

    for (const mapper of this.mappers) {
      mapper(vm, domain);
    }

    return vm as TViewModel;
  }

  /**
   * Adapt array
   */
  adaptArray(domains: TDomain[]): TViewModel[] {
    return domains.map(domain => this.adapt(domain));
  }

  /**
   * Clone this adapter
   */
  clone(): ComplexViewModelAdapter<TDomain, TViewModel> {
    const cloned = new ComplexViewModelAdapter<TDomain, TViewModel>();
    cloned.defaults = { ...this.defaults };
    cloned.mappers = [...this.mappers];
    return cloned;
  }
}

/**
 * Example usage:
 * 
 * interface Product {
 *   id: number;
 *   name: string;
 *   price: number;
 *   inStock: boolean;
 * }
 * 
 * interface ProductViewModel {
 *   id: number;
 *   displayName: string;
 *   formattedPrice: string;
 *   availability: string;
 * }
 * 
 * const adapter = new ComplexViewModelAdapter<Product, ProductViewModel>()
 *   .withDefaults({ availability: 'Unknown' })
 *   .mapProperty('id', p => p.id)
 *   .mapProperty('displayName', p => p.name.toUpperCase())
 *   .mapProperty('formattedPrice', p => `$${p.price.toFixed(2)}`)
 *   .mapProperty('availability', p => p.inStock ? 'In Stock' : 'Out of Stock');
 * 
 * const product: Product = { id: 1, name: 'Laptop', price: 999.99, inStock: true };
 * const vm = adapter.adapt(product);
 */
