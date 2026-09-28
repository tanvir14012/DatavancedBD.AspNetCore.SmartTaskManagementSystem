import { TenantAccess, TenantPlacement } from '../../domain/tenancy.js';

/** Readers must query durable authority; a placement cache cannot implement this port. */
export interface TenantAuthorityReader {
  findTenant(authority: string, signal: AbortSignal): Promise<string | null>;
  isActiveMember(access: TenantAccess, signal: AbortSignal): Promise<boolean>;
  findPlacement(
    tenantId: string,
    signal: AbortSignal,
  ): Promise<TenantPlacement | null>;
}
