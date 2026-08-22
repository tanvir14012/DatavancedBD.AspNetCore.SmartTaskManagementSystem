/**
 * DTO Adapter for mapping between data transfer objects
 */

import { IAdapter, IBidirectionalAdapter, IAdapterConfig } from './adapter.interface';

/**
 * Generic DTO adapter for object mapping
 */
export class DTOAdapter<TSource, TTarget> implements IAdapter<TSource, TTarget> {
  protected mapping: Map<keyof TTarget, keyof TSource | ((source: TSource) => any)>;
  protected defaultValues?: Partial<TTarget>;
  protected transform?: (target: TTarget) => TTarget;

  constructor(protected config: IAdapterConfig<TSource, TTarget> = {}) {
    this.mapping = new Map(
      Object.entries(config.mapping || {}) as [keyof TTarget, keyof TSource | ((source: TSource) => any)][]
    );
    this.defaultValues = config.defaultValues;
    this.transform = config.transform;
  }

  /**
   * Adapt a single object
   */
  adapt(source: TSource): TTarget {
    const target: any = { ...this.defaultValues };

    if (this.mapping.size === 0) {
      // Auto-map properties if no explicit mapping provided
      for (const key in source) {
        target[key] = source[key];
      }
    } else {
      // Use explicit mapping
      for (const [targetKey, sourceKey] of this.mapping.entries()) {
        if (typeof sourceKey === 'function') {
          target[targetKey] = sourceKey(source);
        } else {
          target[targetKey] = (source as any)[sourceKey];
        }
      }
    }

    return this.transform ? this.transform(target) : target;
  }

  /**
   * Adapt an array of objects
   */
  adaptArray(sources: TSource[]): TTarget[] {
    return sources.map(source => this.adapt(source));
  }

  /**
   * Add a custom mapping
   */
  addMapping(
    targetKey: keyof TTarget,
    sourceKeyOrTransformer: keyof TSource | ((source: TSource) => any)
  ): this {
    this.mapping.set(targetKey, sourceKeyOrTransformer);
    return this;
  }

  /**
   * Add a custom transform function
   */
  addTransform(transform: (target: TTarget) => TTarget): this {
    const previousTransform = this.transform;
    this.transform = (target: TTarget) => {
      let result = target;
      if (previousTransform) {
        result = previousTransform(result);
      }
      return transform(result);
    };
    return this;
  }

  /**
   * Clone this adapter
   */
  clone(): DTOAdapter<TSource, TTarget> {
    return new DTOAdapter({
      defaultValues: this.defaultValues ? { ...this.defaultValues } : undefined,
      mapping: Object.fromEntries(this.mapping) as any,
      transform: this.transform,
    });
  }
}

/**
 * Bidirectional DTO adapter for two-way mapping
 */
export class BidirectionalDTOAdapter<TSource, TTarget>
  extends DTOAdapter<TSource, TTarget>
  implements IBidirectionalAdapter<TSource, TTarget>
{
  private reverseMapping: Map<keyof TSource, keyof TTarget | ((target: TTarget) => any)>;
  private reverseTransform?: (source: TSource) => TSource;
  private reverseDefaults?: Partial<TSource>;

  constructor(
    config: IAdapterConfig<TSource, TTarget> = {},
    reverseConfig: IAdapterConfig<TTarget, TSource> = {}
  ) {
    super(config);
    this.reverseMapping = new Map(
      Object.entries(reverseConfig.mapping || {}) as [keyof TSource, keyof TTarget | ((target: TTarget) => any)][]
    );
    this.reverseDefaults = reverseConfig.defaultValues;
    this.reverseTransform = reverseConfig.transform;
  }

  /**
   * Reverse adapt from target to source
   */
  reverse(target: TTarget): TSource {
    const source: any = { ...this.reverseDefaults };

    if (this.reverseMapping.size === 0) {
      // Auto-map properties
      for (const key in target) {
        source[key] = target[key];
      }
    } else {
      // Use explicit mapping
      for (const [sourceKey, targetKeyOrTransform] of this.reverseMapping.entries()) {
        if (typeof targetKeyOrTransform === 'function') {
          source[sourceKey] = targetKeyOrTransform(target);
        } else {
          source[sourceKey] = (target as any)[targetKeyOrTransform];
        }
      }
    }

    return this.reverseTransform ? this.reverseTransform(source) : source;
  }

  /**
   * Reverse adapt an array
   */
  reverseArray(targets: TTarget[]): TSource[] {
    return targets.map(target => this.reverse(target));
  }

  /**
   * Add a reverse mapping
   */
  addReverseMapping(
    sourceKey: keyof TSource,
    targetKeyOrTransformer: keyof TTarget | ((target: TTarget) => any)
  ): this {
    this.reverseMapping.set(sourceKey, targetKeyOrTransformer);
    return this;
  }

  /**
   * Clone this adapter
   */
  clone(): BidirectionalDTOAdapter<TSource, TTarget> {
    const cloned = new BidirectionalDTOAdapter(this.config);
    cloned.mapping = new Map(this.mapping);
    cloned.reverseMapping = new Map(this.reverseMapping);
    cloned.defaultValues = this.defaultValues ? { ...this.defaultValues } : undefined;
    cloned.reverseDefaults = this.reverseDefaults ? { ...this.reverseDefaults } : undefined;
    return cloned;
  }
}

/**
 * Example usage:
 * 
 * interface UserDTO {
 *   id: number;
 *   firstName: string;
 *   lastName: string;
 *   email: string;
 * }
 * 
 * interface UserEntity {
 *   id: number;
 *   fullName: string;
 *   emailAddress: string;
 * }
 * 
 * const adapter = new BidirectionalDTOAdapter<UserEntity, UserDTO>(
 *   {
 *     mapping: {
 *       id: 'id',
 *       firstName: source => source.fullName.split(' ')[0],
 *       lastName: source => source.fullName.split(' ')[1],
 *       email: 'emailAddress',
 *     }
 *   },
 *   {
 *     mapping: {
 *       id: 'id',
 *       fullName: source => `${source.firstName} ${source.lastName}`,
 *       emailAddress: 'email',
 *     }
 *   }
 * );
 * 
 * const entity: UserEntity = { id: 1, fullName: 'John Doe', emailAddress: 'john@example.com' };
 * const dto = adapter.adapt(entity);
 * const backToEntity = adapter.reverse(dto);
 */
