import { TenantContextAuthorizer } from '../tenancy/authorizer.js';
import {
  logicalHandle,
  TenantAccess,
  TenantAccessDenied,
  TenantContext,
  TenantIsolation,
  tenantId,
} from '../../domain/tenancy.js';

/** One tenant-scoped job. The placement revision fences work queued before a move. */
export class TenantWorkItem {
  readonly tenantId: string;

  constructor(
    readonly jobId: string,
    id: string,
    readonly isolation: TenantIsolation,
    readonly targetId: string,
    readonly placementVersion: bigint,
    readonly access: TenantAccess,
  ) {
    this.tenantId = tenantId(id);
    if (
      !jobId ||
      jobId.length > 256 ||
      access.tenantId !== this.tenantId ||
      !Number.isInteger(isolation) ||
      ![
        TenantIsolation.Database,
        TenantIsolation.Schema,
        TenantIsolation.Row,
      ].includes(isolation) ||
      placementVersion <= 0n
    )
      throw new Error('Invalid tenant job.');
    logicalHandle(targetId);
    Object.freeze(this);
  }
}

export interface TenantJobQueue {
  read(signal: AbortSignal): AsyncIterable<TenantWorkItem>;
  complete(item: TenantWorkItem, signal: AbortSignal): Promise<void>;
  abandon(
    item: TenantWorkItem,
    retryable: boolean,
    signal: AbortSignal,
  ): Promise<void>;
}

export interface TenantJobDeduplicator {
  tryBegin(key: string, signal: AbortSignal): Promise<boolean>;
  complete(key: string, signal: AbortSignal): Promise<void>;
  abandon(key: string, signal: AbortSignal): Promise<void>;
}

export interface TenantWorkAdmission {
  acquire(
    tenantId: string,
    targetId: string,
    signal: AbortSignal,
  ): Promise<(() => Promise<void>) | null>;
}

export interface TenantWorkHandler {
  handle(
    item: TenantWorkItem,
    context: TenantContext,
    signal: AbortSignal,
  ): Promise<void>;
}

/** Requires explicit queue, admission, deduplication, and handler adapters at composition. */
export class TenantWorker {
  constructor(
    private readonly queue: TenantJobQueue,
    private readonly deduplicator: TenantJobDeduplicator,
    private readonly admission: TenantWorkAdmission,
    private readonly authorizer: TenantContextAuthorizer,
    private readonly handler: TenantWorkHandler,
    private readonly maxInFlight = 32,
  ) {
    if (!Number.isInteger(maxInFlight) || maxInFlight < 1 || maxInFlight > 512)
      throw new Error('Invalid worker concurrency.');
  }

  async run(signal: AbortSignal): Promise<void> {
    const inFlight = new Set<Promise<void>>();
    try {
      for await (const item of this.queue.read(signal)) {
        signal.throwIfAborted();
        const work = this.process(item, signal);
        inFlight.add(work);
        void work.finally(() => inFlight.delete(work)).catch(() => undefined);
        if (inFlight.size >= this.maxInFlight) await Promise.race(inFlight);
      }
    } finally {
      await Promise.allSettled(inFlight);
    }
  }

  private async process(
    item: TenantWorkItem,
    signal: AbortSignal,
  ): Promise<void> {
    const key = `${item.tenantId}:${item.jobId}`;
    if (!(await this.deduplicator.tryBegin(key, signal))) {
      await this.queue.complete(item, signal);
      return;
    }
    let release: (() => Promise<void>) | null = null;
    try {
      release = await this.admission.acquire(
        item.tenantId,
        item.targetId,
        signal,
      );
      if (!release) {
        await this.deduplicator.abandon(key, signal);
        await this.queue.abandon(item, true, signal);
        return;
      }
      // The queued access is checked against durable membership and placement now.
      const context = await this.authorizer.authorize(
        item.tenantId,
        item.access,
        signal,
      );
      if (
        context.placement.version !== item.placementVersion ||
        context.placement.targetId !== item.targetId ||
        context.placement.isolation !== item.isolation
      ) {
        await this.deduplicator.complete(key, signal);
        await this.queue.complete(item, signal);
        return;
      }
      await this.handler.handle(item, context, signal);
      await this.deduplicator.complete(key, signal);
      await this.queue.complete(item, signal);
    } catch (error) {
      if (error instanceof TenantAccessDenied && !signal.aborted) {
        await this.deduplicator.complete(key, signal);
        await this.queue.complete(item, signal);
        return;
      }
      await this.deduplicator.abandon(key, new AbortController().signal);
      await this.queue.abandon(item, true, new AbortController().signal);
      if (signal.aborted) throw error;
    } finally {
      await release?.();
    }
  }
}
