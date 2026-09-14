import { TestBed } from '@angular/core/testing';
import { filter, Subject, takeUntil } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { TenantContext, TenantContextSnapshot, TenantContextStore } from './tenant-context';

const organizationA: TenantContext = {
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  displayName: 'Organization A',
};
const organizationB: TenantContext = {
  tenantId: '748ed753-e1b4-472b-ad7b-a207dfd1f449',
  displayName: 'Organization B',
};

describe('TenantContextStore', () => {
  let store: TenantContextStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TenantContextStore] });
    store = TestBed.inject(TenantContextStore);
  });

  it('starts empty and replays a read-only initial snapshot', () => {
    const snapshots: TenantContextSnapshot[] = [];
    const subscription = store.changes$.subscribe((snapshot) => snapshots.push(snapshot));

    expect(store.current()).toBeNull();
    expect(snapshots).toEqual([{ context: null, generation: 0 }]);
    expect(Object.isFrozen(store.snapshot())).toBe(true);
    expect('next' in store.changes$).toBe(false);
    subscription.unsubscribe();
  });

  it('keeps independent application instances isolated', () => {
    const otherStore = new TenantContextStore();
    store.set(organizationA);

    expect(otherStore.current()).toBeNull();
    expect(otherStore.snapshot().generation).toBe(0);
  });

  it('copies only browser-visible fields and freezes both snapshot and context', () => {
    const selection = { ...organizationA, targetId: 'private-database', secret: 'never-copy' };
    const snapshot = store.set(selection);
    selection.displayName = 'Mutated after selection';

    expect(snapshot).toEqual({ context: organizationA, generation: 1 });
    expect(Object.keys(snapshot.context!)).toEqual(['tenantId', 'displayName']);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.context)).toBe(true);
    expect(Reflect.set(snapshot.context!, 'tenantId', organizationB.tenantId)).toBe(false);
    expect(Reflect.set(snapshot, 'generation', 999)).toBe(false);
    expect(store.current()).toEqual(organizationA);
  });

  it('canonicalizes UUID casing while preserving Unicode and internal spaces in the label', () => {
    store.set({
      tenantId: organizationA.tenantId.toUpperCase(),
      displayName: '  ঢাকা  東京 Équipe  ',
    });

    expect(store.current()).toEqual({
      tenantId: organizationA.tenantId,
      displayName: 'ঢাকা  東京 Équipe',
    });
  });

  it('does not emit or change generation for an equivalent repeated selection', () => {
    const snapshots: TenantContextSnapshot[] = [];
    const initial = store.set(organizationA);
    const subscription = store.changes$.subscribe((snapshot) => snapshots.push(snapshot));
    const repeated = store.set({
      tenantId: organizationA.tenantId.toUpperCase(),
      displayName: ` ${organizationA.displayName} `,
    });

    expect(repeated).toBe(initial);
    expect(snapshots).toEqual([initial]);
    subscription.unsubscribe();
  });

  it('refreshes a display name without invalidating work for the same organization', () => {
    const initial = store.set(organizationA);
    const snapshots: TenantContextSnapshot[] = [];
    const subscription = store.changes$.subscribe((snapshot) => snapshots.push(snapshot));
    const refreshed = store.set({ ...organizationA, displayName: 'New display name' });

    expect(refreshed.generation).toBe(initial.generation);
    expect(refreshed.context?.displayName).toBe('New display name');
    expect(initial.context?.displayName).toBe(organizationA.displayName);
    expect(snapshots).toEqual([initial, refreshed]);
    subscription.unsubscribe();
  });

  it('advances generation across A to B to A so original A results remain obsolete', () => {
    const firstA = store.set(organizationA);
    const selectedB = store.set(organizationB);
    const secondA = store.set(organizationA);

    expect(firstA.context?.tenantId).toBe(secondA.context?.tenantId);
    expect([firstA.generation, selectedB.generation, secondA.generation]).toEqual([1, 2, 3]);
    expect(firstA.generation).not.toBe(store.snapshot().generation);
  });

  it('clears context, invalidates captured work and keeps repeated clears idempotent', () => {
    store.set(organizationA);
    store.clear();
    const cleared = store.snapshot();
    const snapshots: TenantContextSnapshot[] = [];
    const subscription = store.changes$.subscribe((snapshot) => snapshots.push(snapshot));
    store.clear();

    expect(cleared).toEqual({ context: null, generation: 2 });
    expect(store.snapshot()).toBe(cleared);
    expect(snapshots).toEqual([cleared]);
    expect(store.set(organizationA).generation).toBe(3);
    subscription.unsubscribe();
  });

  it('leaves a newly created empty store unchanged when cleared', () => {
    const empty = store.snapshot();
    store.clear();

    expect(store.snapshot()).toBe(empty);
  });

  it('supports cancelling old work on switches without cancelling display-name refreshes', () => {
    const captured = store.set(organizationA);
    const responses = new Subject<string>();
    const received: string[] = [];
    let completed = false;
    responses
      .pipe(takeUntil(store.changes$.pipe(filter((state) => state.generation !== captured.generation))))
      .subscribe({ next: (response) => received.push(response), complete: () => (completed = true) });

    store.set({ ...organizationA, displayName: 'Refreshed name' });
    responses.next('current A response');
    expect(completed).toBe(false);
    store.set(organizationB);
    expect(completed).toBe(true);
    store.set(organizationA);
    responses.next('obsolete A response');

    expect(received).toEqual(['current A response']);
  });

  it('cancels captured work even when it subscribes after the organization changed', () => {
    const captured = store.set(organizationA);
    store.set(organizationB);
    store.set(organizationA);
    const responses = new Subject<string>();
    let completed = false;
    responses
      .pipe(takeUntil(store.changes$.pipe(filter((state) => state.generation !== captured.generation))))
      .subscribe({ complete: () => (completed = true) });

    expect(completed).toBe(true);
    expect(responses.observed).toBe(false);
  });

  it.each([
    null,
    undefined,
    {},
    { ...organizationA, tenantId: null },
    { ...organizationA, tenantId: '' },
    { ...organizationA, tenantId: '00000000-0000-0000-0000-000000000000' },
    { ...organizationA, tenantId: organizationA.tenantId.replaceAll('-', '') },
    { ...organizationA, tenantId: `{${organizationA.tenantId}}` },
    { ...organizationA, tenantId: ` ${organizationA.tenantId}` },
    { ...organizationA, tenantId: 'not-an-organization' },
    { ...organizationA, displayName: null },
    { ...organizationA, displayName: '' },
    { ...organizationA, displayName: '   ' },
    { ...organizationA, displayName: 'a'.repeat(201) },
    { ...organizationA, displayName: 'name\n' },
    { ...organizationA, displayName: 'name\u0000suffix' },
    { ...organizationA, displayName: 'name\u0085suffix' },
  ])('rejects invalid selection %# without changing the current state or generation', (invalid) => {
    const valid = store.set(organizationA);
    const snapshots: TenantContextSnapshot[] = [];
    const subscription = store.changes$.subscribe((snapshot) => snapshots.push(snapshot));

    expect(() => store.set(invalid as TenantContext)).toThrow(TypeError);
    expect(store.snapshot()).toBe(valid);
    expect(snapshots).toEqual([valid]);
    subscription.unsubscribe();
  });

  it('accepts the maximum display-name length', () => {
    const displayName = 'a'.repeat(200);

    expect(store.set({ ...organizationA, displayName }).context?.displayName).toBe(displayName);
  });
});
