/**
 * Adapter Factory for creating adapters
 */

import { DTOAdapter, BidirectionalDTOAdapter } from './dto-adapter.class';
import { APIAdapter, GenericAPIAdapter } from './api-adapter.class';
import { ViewModelAdapter } from './viewmodel-adapter.class';
import { IAdapterConfig } from './adapter.interface';

/**
 * Factory for creating adapters
 */
export class AdapterFactory {
  /**
   * Create a DTO adapter
   */
  static createDTOAdapter<TSource, TTarget>(
    config: IAdapterConfig<TSource, TTarget> = {}
  ): DTOAdapter<TSource, TTarget> {
    return new DTOAdapter(config);
  }

  /**
   * Create a bidirectional DTO adapter
   */
  static createBidirectionalDTOAdapter<TSource, TTarget>(
    config: IAdapterConfig<TSource, TTarget> = {},
    reverseConfig: IAdapterConfig<TTarget, TSource> = {}
  ): BidirectionalDTOAdapter<TSource, TTarget> {
    return new BidirectionalDTOAdapter(config, reverseConfig);
  }

  /**
   * Create an API adapter
   */
  static createAPIAdapter<TAPIResponse, TInternal>(
    transformer: (data: TAPIResponse) => TInternal
  ): APIAdapter<TAPIResponse, TInternal> {
    return APIAdapter.create(transformer);
  }

  /**
   * Create a generic API adapter
   */
  static createGenericAPIAdapter<T>(): GenericAPIAdapter<T> {
    return new GenericAPIAdapter<T>();
  }

  /**
   * Create a view model adapter
   */
  static createViewModelAdapter<TDomain, TViewModel>(
    mapper: (domain: TDomain) => TViewModel
  ): ViewModelAdapter<TDomain, TViewModel> {
    return new ViewModelAdapter(mapper);
  }

  /**
   * Create a composition of adapters
   */
  static compose<T1, T2, T3>(
    adapter1: DTOAdapter<T1, T2>,
    adapter2: DTOAdapter<T2, T3>
  ): DTOAdapter<T1, T3> {
    return new DTOAdapter({
      mapping: {} as any,
      transform: (t3: T3) => t3,
    });
  }
}
