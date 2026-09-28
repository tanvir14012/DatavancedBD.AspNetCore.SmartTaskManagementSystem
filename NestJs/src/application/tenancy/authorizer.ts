import {
  TenantAccess,
  TenantAccessDenied,
  TenantContext,
  TenantLifecycle,
  logicalHandle,
  tenantId,
} from '../../domain/tenancy.js';
import { TenantAuthorityReader } from './ports.js';

/** Checks durable membership and placement on every request and again for queued jobs. */
export class TenantContextAuthorizer {
  constructor(
    private readonly authority: TenantAuthorityReader,
    private readonly region: string,
  ) {
    logicalHandle(region);
  }

  async authorize(
    candidate: string,
    access: TenantAccess,
    signal: AbortSignal,
  ): Promise<TenantContext> {
    signal.throwIfAborted();
    if (tenantId(candidate) !== access.tenantId) throw new TenantAccessDenied();
    const active = await this.authority.isActiveMember(access, signal);
    signal.throwIfAborted();
    if (!active) throw new TenantAccessDenied();
    const placement = await this.authority.findPlacement(
      access.tenantId,
      signal,
    );
    signal.throwIfAborted();
    if (
      !placement ||
      placement.tenantId !== access.tenantId ||
      placement.lifecycle !== TenantLifecycle.Active ||
      placement.region !== this.region
    ) {
      throw new TenantAccessDenied();
    }
    return new TenantContext(placement, access);
  }

  /** A fresh decision must agree before opening storage. Relocation still needs write fencing. */
  async reauthorize(
    context: TenantContext,
    signal: AbortSignal,
  ): Promise<void> {
    const fresh = await this.authorize(
      context.access.tenantId,
      context.access,
      signal,
    );
    const before = context.placement;
    const after = fresh.placement;
    if (
      after.version !== before.version ||
      after.targetId !== before.targetId ||
      after.isolation !== before.isolation ||
      after.schema !== before.schema
    ) {
      throw new TenantAccessDenied();
    }
  }
}
