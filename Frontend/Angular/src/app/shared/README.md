# Angular 21 Shared Enterprise Framework

A production-quality, reusable frontend framework built for enterprise SaaS applications using Angular 21, Signals, and TypeScript strict mode.

## Architecture Overview

### Core Module (`/core`)
Foundational design patterns and architectural components:

#### Design Patterns
- **Builder Pattern** - Fluent, Immutable, and Configuration builders for complex object construction
- **Factory Pattern** - Generic, Async, and Lambda factories with runtime registry
- **Strategy Pattern** - Context-based strategy switching with composition
- **Adapter Pattern** - DTO mapping, API response transformation, ViewModel adaptation
- **Facade Pattern** - Service, Signal, and RxJS facades for simplified interfaces
- **Specification Pattern** - Composable predicates with And/Or/Not operations
- **Pipeline Pattern** - Middleware pipeline with before/after/catch hooks
- **State Machine** - Transitions, guards, entry/exit handlers, async support
- **Command Pattern** - Undo/redo with full history tracking
- **Observer Pattern** - Lightweight event bus with priority, replay, once support
- **Feature Flags** - Boolean, role-based, percentage, environment, and time-based flags

#### Foundation Types
- Result<T, E> - Railway-oriented programming for error handling
- Exception hierarchy with severity levels
- Pagination and cursor-based pagination types
- Sort and filter types with fluent builders
- Validation types
- DTO types and interfaces
- Command history types
- State machine types

### Infrastructure Module (`/infrastructure`)
High-level utilities and services for common SaaS features:

#### API Layer
- APIClientService - HTTP client with standardized response handling
- APIInterceptor interface for custom request/response processing

#### Query & Filtering
- QueryBuilder - Combines filters, sort, pagination
- FilterBuilder - Fluent filter construction with AND/OR logic
- SortBuilder - Multi-column sorting with direction
- PaginationBuilder - Offset-based pagination
- CursorPaginationBuilder - Cursor-based pagination

#### Caching Strategies
- **LRUCache** - Least-recently-used eviction O(1) operations
- **TTLCache** - Time-to-live expiration with background cleanup
- **ObservableCache** - RxJS BehaviorSubject backed cache
- **SignalCache** - Angular Signals backed cache

#### Collections & Algorithms
- PriorityQueue - Priority-based queue with comparators
- CircularBuffer - Fixed-size circular buffer
- Binary Search - Logarithmic search in sorted arrays
- Linear Search - Complete search with predicates
- Quick Sort, Merge Sort - Efficient sorting algorithms
- Levenshtein Distance - String similarity matching

#### Reactive Utilities
- Debounce - Execution delay with reset
- Throttle - Rate limiting with interval
- Signal Helpers - Derive signals, split signals
- Observable ↔ Signal adapters

#### Forms
- Enhanced FormBuilder for metadata-driven forms
- Support for dynamic and nested forms

#### Services
- LoadingService - Global loading state management with signals
- NotificationService - Toast/snackbar notification system

## Key Features

### Signals-First Architecture
- Leverages Angular 21 Signals for reactive state
- Signal composition and computed properties
- Memoization for performance
- Perfect for SSR

### Type Safety
- Full TypeScript strict mode
- Comprehensive generic support
- No implicit any
- Strong interface contracts

### Production Ready
- Error handling with Result types
- Disposal patterns for cleanup
- Memoization for optimization
- Tree-shakable exports
- Zero business logic

### SOLID Principles
- Single Responsibility - Each class has one reason to change
- Open/Closed - Extensible through composition
- Liskov Substitution - Proper interface implementation
- Interface Segregation - Focused, minimal interfaces
- Dependency Inversion - Depend on abstractions

### Performance
- O(1) cache access with LRU
- O(n log n) sorting algorithms
- Lazy evaluation throughout
- Memoization for expensive operations
- Request coalescing for API calls

## Usage Examples

### Factory Pattern
```typescript
const factory = new GenericFactory(() => new User())
  .map(u => ({ ...u, isActive: true }))
  .retry(3);

const user = factory.create();
```

### Strategy Pattern
```typescript
const context = new StrategyContext<Data, Result>()
  .setStrategy(strategy1)
  .execute(data);
```

### Specification Pattern
```typescript
const spec = new SpecificationBuilder<User>()
  .where(u => u.age > 18)
  .and(u => u.isActive)
  .build();

const validUsers = users.filter(u => spec.isSatisfiedBy(u));
```

### Query Builder
```typescript
const query = new QueryBuilder()
  .withFilters({ conditions: [...] })
  .withSort({ columns: [{ field: 'name', direction: 'ASC' }] })
  .withPagination({ pageNumber: 1, pageSize: 10 })
  .build();
```

### Caching
```typescript
const cache = new LRUCache<string, User>(100);
cache.set('user:1', user);
const cached = cache.get('user:1');
```

### Event Bus
```typescript
const bus = new EventBus<UserEvent>();
bus.subscribe('user:created', (event) => {
  console.log('User created:', event);
});
bus.publish('user:created', { ...event });
```

### Feature Flags
```typescript
const flags = new FeatureFlagManager();
flags.registerFlag('feature-x', { type: 'boolean', value: true });
flags.registerFlag('beta-feature', { type: 'roleBasedFlag', roles: ['admin'] });

if (flags.isEnabled('feature-x')) {
  // Feature logic
}
```

## Module Exports

Import from the main shared module:
```typescript
import {
  // Core patterns
  FluentBuilder,
  GenericFactory,
  StrategyContext,
  // Infrastructure
  APIClientService,
  QueryBuilder,
  LRUCache,
  LoadingService,
  // Types
  Result,
  Exception,
} from '@shared';
```

## Architecture Decisions

### Signals over Observables
- Default to Signals for reactive state
- Use Observables for streams and side effects
- Full interoperability between both

### Composition over Inheritance
- Prefer composition for flexibility
- Minimal inheritance hierarchy
- Easier testing and mockability

### Functional Programming
- Pure functions where appropriate
- Immutability in builders
- Functional pipelines for transformations

### Error Handling
- Railway-oriented programming with Result<T, E>
- Exception hierarchy with severity levels
- Proper error context preservation

## Performance Characteristics

| Component | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| LRUCache get/set | O(1) | O(n) |
| LRUCache evict | O(n) | O(1) |
| PriorityQueue add | O(log n) | O(1) |
| PriorityQueue poll | O(log n) | O(1) |
| Binary Search | O(log n) | O(1) |
| Quick Sort | O(n log n) avg | O(log n) |
| Merge Sort | O(n log n) | O(n) |
| Levenshtein Distance | O(m*n) | O(m*n) |

## Best Practices

1. **Use Result<T, E> for operations that might fail**
   ```typescript
   const result = Result.tryAsync(() => apiCall());
   ```

2. **Leverage Signals for reactive state**
   ```typescript
   const count = signal(0);
   const doubled = computed(() => count() * 2);
   ```

3. **Use builders for complex configurations**
   ```typescript
   const config = new ConfigurationBuilder().with('key', value).build();
   ```

4. **Implement proper error handling**
   ```typescript
   try {
     throw new ValidationException('Invalid input');
   } catch (e) {
     handleException(e);
   }
   ```

5. **Use the appropriate cache strategy**
   - LRU for bounded, frequently accessed data
   - TTL for time-sensitive data
   - Signal cache for reactive state
   - Observable cache for streams

## SSR Compatibility

All components are SSR-compatible:
- No browser-only APIs (localStorage in services only)
- Proper signal handling
- Observable subscriptions cleanup
- No global state dependencies

## Tree-Shaking

All exports are tree-shakable:
- Import only what you need
- Unused exports are removed in production
- Pure functions are properly marked

## Contributing

When adding new patterns or utilities:
1. Maintain strict TypeScript
2. Add comprehensive JSDoc comments
3. Include usage examples
4. Ensure SOLID principles
5. Add generic type support where applicable
6. No business logic
7. Use Result<T, E> for error cases

## License

Built as part of USM Inventory monorepo
