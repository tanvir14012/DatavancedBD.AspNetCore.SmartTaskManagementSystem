type MemoizedMethod = (...args: unknown[]) => unknown;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const objectEntries = keys.map((key) => `"${key}":${stableStringify(record[key])}`);
  return `{${objectEntries.join(',')}}`;
}

export function PureMemo(): MethodDecorator {
  const instanceCache = new WeakMap<object, Map<string, unknown>>();

  return <T>(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
  ) => {
    const originalMethod = descriptor.value;
    if (!originalMethod || typeof originalMethod !== 'function') {
      throw new Error('PureMemo can only be applied to methods.');
    }

    const callable = originalMethod as MemoizedMethod;

    descriptor.value = function memoizedMethod(this: object, ...args: unknown[]): unknown {
      const targetInstance = this;
      let cacheForInstance = instanceCache.get(targetInstance);

      if (!cacheForInstance) {
        cacheForInstance = new Map<string, unknown>();
        instanceCache.set(targetInstance, cacheForInstance);
      }

      const signature = stableStringify(args);
      if (cacheForInstance.has(signature)) {
        return cacheForInstance.get(signature);
      }

      const result = callable.apply(targetInstance, args);
      cacheForInstance.set(signature, result);
      return result;
    } as T;

    return descriptor;
  };
}
