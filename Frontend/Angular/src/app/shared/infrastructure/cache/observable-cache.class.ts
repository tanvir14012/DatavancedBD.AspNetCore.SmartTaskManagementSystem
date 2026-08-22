import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { ICache } from './cache.interface';

/**
 * Observable-backed Cache using RxJS
 */
export class ObservableCache<K, V> implements ICache<K, V> {
  private cache = new Map<K, BehaviorSubject<V>>();
  private change$ = new Subject<{ key: K; value: V }>();

  get(key: K): V | undefined {
    return this.cache.get(key)?.value;
  }

  getObservable(key: K): Observable<V> | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.get(key)!.next(value);
    } else {
      this.cache.set(key, new BehaviorSubject(value));
    }
    this.change$.next({ key, value });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    const subject = this.cache.get(key);
    if (subject) {
      subject.complete();
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    for (const subject of this.cache.values()) {
      subject.complete();
    }
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getChanges(): Observable<{ key: K; value: V }> {
    return this.change$.asObservable();
  }
}
