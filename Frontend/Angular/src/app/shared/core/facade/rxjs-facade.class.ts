/**
 * RxJS Facade for simplifying observable management
 */

import { Observable, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { IRxJSFacade } from './facade.interface';

/**
 * Base facade for managing RxJS observables and subjects
 */
export abstract class RxJSFacade implements IRxJSFacade {
  protected subjects = new Map<string, Subject<any>>();
  protected observables = new Map<string, Observable<any>>();
  protected subscriptions: Subscription[] = [];
  protected disposed = false;

  /**
   * Create a subject
   */
  protected createSubject<T>(key: string): Subject<T> {
    if (this.subjects.has(key)) {
      throw new Error(`Subject with key '${key}' already exists`);
    }
    const subject = new Subject<T>();
    this.subjects.set(key, subject);
    return subject;
  }

  /**
   * Create a behavior subject
   */
  protected createBehaviorSubject<T>(key: string, initialValue: T): BehaviorSubject<T> {
    if (this.subjects.has(key)) {
      throw new Error(`Subject with key '${key}' already exists`);
    }
    const subject = new BehaviorSubject<T>(initialValue);
    this.subjects.set(key, subject);
    return subject;
  }

  /**
   * Get a subject
   */
  protected getSubject<T>(key: string): Subject<T> | undefined {
    return this.subjects.get(key);
  }

  /**
   * Register an observable
   */
  protected registerObservable<T>(key: string, observable: Observable<T>): Observable<T> {
    this.observables.set(key, observable);
    return observable;
  }

  /**
   * Get an observable
   */
  protected getObservable<T>(key: string): Observable<T> | undefined {
    return this.observables.get(key);
  }

  /**
   * Subscribe to an observable
   */
  protected subscribe<T>(
    observable: Observable<T>,
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    const sub = observable.subscribe({ next, error, complete });
    this.subscriptions.push(sub);
    return sub;
  }

  /**
   * Get all subjects
   */
  getAllSubjects(): Map<string, Subject<any>> {
    return new Map(this.subjects);
  }

  /**
   * Get all observables
   */
  getAllObservables(): Map<string, Observable<any>> {
    return new Map(this.observables);
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose all subjects and subscriptions
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Complete and close all subjects
    for (const subject of this.subjects.values()) {
      try {
        subject.complete();
      } catch (error) {
        console.error('Error completing subject:', error);
      }
    }

    // Unsubscribe from all subscriptions
    for (const sub of this.subscriptions) {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
    }

    // Clear collections
    this.subjects.clear();
    this.observables.clear();
    this.subscriptions = [];
    this.disposed = true;
  }

  /**
   * Ensure not disposed
   */
  protected checkDisposed(): void {
    if (this.disposed) {
      throw new Error('RxJSFacade has been disposed');
    }
  }
}

/**
 * Example usage:
 * 
 * interface UserFacadeAPI {
 *   users$: Observable<User[]>;
 *   loadUsers(): void;
 *   addUser(user: User): void;
 * }
 * 
 * class UserRxJSFacade extends RxJSFacade implements UserFacadeAPI {
 *   private usersSubject: BehaviorSubject<User[]>;
 * 
 *   constructor(private userService: UserService) {
 *     super();
 *     this.usersSubject = this.createBehaviorSubject('users', []);
 *   }
 * 
 *   get users$(): Observable<User[]> {
 *     return this.usersSubject.asObservable();
 *   }
 * 
 *   loadUsers(): void {
 *     this.checkDisposed();
 *     this.subscribe(
 *       this.userService.getUsers(),
 *       (users) => this.usersSubject.next(users)
 *     );
 *   }
 * 
 *   addUser(user: User): void {
 *     this.checkDisposed();
 *     const current = this.usersSubject.value;
 *     this.usersSubject.next([...current, user]);
 *   }
 * }
 */
