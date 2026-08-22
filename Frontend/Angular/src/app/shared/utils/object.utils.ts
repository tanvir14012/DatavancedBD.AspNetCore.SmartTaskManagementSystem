export type PropertyKeyOf<T> = Extract<keyof T, string | number | symbol>;

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function coerceArray<T>(value: T | readonly T[] | null | undefined): T[] {
  if (isNil(value)) return [];
  if (Array.isArray(value)) return [...value];
  return [value as T];
}

export function uniqueBy<T, K extends PropertyKey>(
  items: readonly T[],
  keySelector: (item: T) => K,
): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const key = keySelector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  keySelector: (item: T) => K,
): Record<K, T[]> {
  return items.reduce<Record<K, T[]>>(
    (groups, item) => {
      const key = keySelector(item);
      groups[key] ??= [];
      groups[key].push(item);
      return groups;
    },
    {} as Record<K, T[]>,
  );
}

export function toLookup<T, K extends PropertyKey>(
  items: readonly T[],
  keySelector: (item: T) => K,
): Record<K, T> {
  return items.reduce<Record<K, T>>(
    (lookup, item) => {
      lookup[keySelector(item)] = item;
      return lookup;
    },
    {} as Record<K, T>,
  );
}

export function omitNil<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => !isNil(entryValue)),
  ) as Partial<T>;
}

export function pick<T extends object, K extends PropertyKeyOf<T>>(
  value: T,
  keys: readonly K[],
): Pick<T, K> {
  return keys.reduce<Pick<T, K>>(
    (result, key) => {
      result[key] = value[key];
      return result;
    },
    {} as Pick<T, K>,
  );
}
