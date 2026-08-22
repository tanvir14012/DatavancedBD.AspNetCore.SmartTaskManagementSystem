/**
 * Command pattern with undo/redo and history
 */

import { ICommand, ICommandHistory } from '../types';

export class CommandExecutor<T = any> implements ICommandHistory<T> {
  private history: ICommand<T>[] = [];
  private currentIndex = -1;

  get commands(): ICommand<T>[] {
    return this.history;
  }

  async execute(command: ICommand<T>): Promise<void> {
    // Remove redo stack
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    this.history.push(command);
    this.currentIndex++;
    
    await Promise.resolve(command.execute());
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) return;
    
    const command = this.history[this.currentIndex];
    if (command.undo) {
      await Promise.resolve(command.undo());
    }
    this.currentIndex--;
  }

  async redo(): Promise<void> {
    if (!this.canRedo()) return;
    
    this.currentIndex++;
    const command = this.history[this.currentIndex];
    await Promise.resolve(command.execute());
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  getHistory(): ICommand<T>[] {
    return [...this.history];
  }
}

export { ICommand, ICommandHistory } from './types';

/**
 * Example usage:
 * 
 * class IncrementCommand implements ICommand<number> {
 *   constructor(private value: { count: number }) {}
 *   async execute() { this.value.count++; }
 *   async undo() { this.value.count--; }
 * }
 * 
 * const executor = new CommandExecutor<number>();
 * const value = { count: 0 };
 * await executor.execute(new IncrementCommand(value));
 * console.log(value.count); // 1
 * await executor.undo();
 * console.log(value.count); // 0
 */
