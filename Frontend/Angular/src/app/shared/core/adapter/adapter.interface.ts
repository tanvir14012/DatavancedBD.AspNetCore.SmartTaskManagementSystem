/**
 * Adapter pattern interfaces
 */

export interface IAdapter<TSource, TTarget> {
  adapt(source: TSource): TTarget;
  adaptArray(sources: TSource[]): TTarget[];
}

export interface IBidirectionalAdapter<TSource, TTarget> extends IAdapter<TSource, TTarget> {
  reverse(target: TTarget): TSource;
  reverseArray(targets: TTarget[]): TSource[];
}

export interface IAdapterConfig<TSource, TTarget> {
  defaultValues?: Partial<TTarget>;
  mapping?: Record<keyof TTarget, keyof TSource | ((source: TSource) => any)>;
  transform?: (target: TTarget) => TTarget;
}
