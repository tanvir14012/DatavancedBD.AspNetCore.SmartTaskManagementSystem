/**
 * Command pattern types
 */

export interface ICommand<T = any> {
  execute(): Promise<T> | T;
  undo?(): Promise<void> | void;
}

export interface ICommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
}

export interface ICommandHistory<T = any> {
  commands: ICommand<T>[];
  currentIndex: number;

  execute(command: ICommand<T>): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  getHistory(): ICommand<T>[];
}
