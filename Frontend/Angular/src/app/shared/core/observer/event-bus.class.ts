/**
 * Observer/Event Bus pattern with publish, subscribe, replay
 */

type EventHandler<T> = (data: T) => void;

interface EventSubscription {
  unsubscribe(): void;
}

export class EventBus<T = any> {
  private handlers = new Map<string, EventHandler<T>[]>();
  private priorities = new Map<string, number[]>();
  private replayData = new Map<string, T>();

  subscribe(event: string, handler: EventHandler<T>, priority = 0): EventSubscription {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
      this.priorities.set(event, []);
    }

    const handlers = this.handlers.get(event)!;
    const priorityList = this.priorities.get(event)!;
    
    // Insert in priority order
    const index = priorityList.findIndex(p => p < priority);
    if (index === -1) {
      handlers.push(handler);
      priorityList.push(priority);
    } else {
      handlers.splice(index, 0, handler);
      priorityList.splice(index, 0, priority);
    }

    // Replay if available
    if (this.replayData.has(event)) {
      handler(this.replayData.get(event)!);
    }

    return {
      unsubscribe: () => {
        const idx = handlers.indexOf(handler);
        if (idx > -1) {
          handlers.splice(idx, 1);
          priorityList.splice(idx, 1);
        }
      }
    };
  }

  once(event: string, handler: EventHandler<T>): EventSubscription {
    const wrapper = (data: T) => {
      handler(data);
      subscription.unsubscribe();
    };
    const subscription = this.subscribe(event, wrapper);
    return subscription;
  }

  publish(event: string, data: T, replay = false): void {
    if (replay) {
      this.replayData.set(event, data);
    }

    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  unsubscribeAll(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      this.priorities.delete(event);
      this.replayData.delete(event);
    } else {
      this.handlers.clear();
      this.priorities.clear();
      this.replayData.clear();
    }
  }
}

/**
 * Example usage:
 * 
 * const bus = new EventBus<{message: string}>();
 * 
 * bus.subscribe('message', (data) => console.log(data.message));
 * bus.publish('message', { message: 'Hello' }, true);
 */
