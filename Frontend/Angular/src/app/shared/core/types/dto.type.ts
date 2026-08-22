/**
 * DTO (Data Transfer Object) types and interfaces
 */

export interface IMapper<TSource, TTarget> {
  map(source: TSource): TTarget;
  mapArray(sources: TSource[]): TTarget[];
  mapReverse(target: TTarget): TSource;
  mapReverseArray(targets: TTarget[]): TSource[];
}

export interface IBidirectionalMapper<T1, T2> {
  mapAtoB(source: T1): T2;
  mapBtoA(source: T2): T1;
  mapArrayAtoB(sources: T1[]): T2[];
  mapArrayBtoA(sources: T2[]): T1[];
}

export interface IDTO {
  toEntity<T>(): T;
  fromEntity<T>(entity: T): this;
}

export type DTOTransformer<TSource, TTarget> = (source: TSource) => TTarget;
