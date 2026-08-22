/**
 * Service Facade for simplifying service interactions
 */

import { IServiceFacade } from './facade.interface';

/**
 * Base service facade
 * Simplifies interactions with multiple services
 */
export abstract class ServiceFacade implements IServiceFacade {
  protected disposed = false;
  protected disposables: (() => void)[] = [];

  /**
   * Register a disposable resource
   */
  protected registerDisposable(disposer: () => void): void {
    this.disposables.push(disposer);
  }

  /**
   * Register multiple disposables
   */
  protected registerDisposables(...disposers: Array<() => void>): void {
    this.disposables.push(...disposers);
  }

  /**
   * Check if facade is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const disposer of this.disposables) {
      try {
        disposer();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    }

    this.disposables = [];
    this.disposed = true;
  }

  /**
   * Ensure not disposed
   */
  protected checkDisposed(): void {
    if (this.disposed) {
      throw new Error('Facade has been disposed');
    }
  }
}

/**
 * Example usage:
 * 
 * interface UserFacadeAPI {
 *   getUser(id: number): Promise<User>;
 *   updateUser(user: User): Promise<void>;
 *   deleteUser(id: number): Promise<void>;
 * }
 * 
 * class UserServiceFacade extends ServiceFacade implements UserFacadeAPI {
 *   constructor(
 *     private userService: UserService,
 *     private logger: LoggerService
 *   ) {
 *     super();
 *   }
 * 
 *   async getUser(id: number): Promise<User> {
 *     this.checkDisposed();
 *     this.logger.log(`Fetching user ${id}`);
 *     return this.userService.get(id);
 *   }
 * 
 *   async updateUser(user: User): Promise<void> {
 *     this.checkDisposed();
 *     this.logger.log(`Updating user ${user.id}`);
 *     return this.userService.update(user);
 *   }
 * 
 *   async deleteUser(id: number): Promise<void> {
 *     this.checkDisposed();
 *     this.logger.log(`Deleting user ${id}`);
 *     return this.userService.delete(id);
 *   }
 * }
 */
