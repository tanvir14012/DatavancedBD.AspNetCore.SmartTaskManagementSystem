import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient as CatalogClient } from '../../../generated/catalog/index.js';
import {
  PrismaClient as TenantClient,
  Prisma,
} from '../../../generated/tenant/index.js';
import {
  TenantAccess,
  TenantContext,
  TenantIsolation,
  TenantLifecycle,
  TenantPlacement,
} from '../../domain/tenancy.js';
import { TenantAuthorityReader } from '../../application/tenancy/ports.js';
import { TenantContextAuthorizer } from '../../application/tenancy/authorizer.js';
import { parseStorageTargets, StorageTargetConfig } from './storage-config.js';

/** Reads durable membership and placement from the independent system catalog. */
@Injectable()
export class CatalogReader implements TenantAuthorityReader, OnModuleDestroy {
  private readonly client: CatalogClient | undefined;

  constructor() {
    const url = process.env.CATALOG_DATABASE_URL;
    if (url)
      this.client = new CatalogClient({
        datasources: { db: { url } },
        log: ['error'],
      });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }

  private get db(): CatalogClient {
    if (!this.client) throw new Error('Catalog database is not configured.');
    return this.client;
  }

  async findTenant(
    authority: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    signal.throwIfAborted();
    const row = await this.db.tenantAuthority.findUnique({
      where: { authority },
      select: { tenantId: true, isActive: true },
    });
    signal.throwIfAborted();
    return row?.isActive ? row.tenantId : null;
  }

  async isActiveMember(
    access: TenantAccess,
    signal: AbortSignal,
  ): Promise<boolean> {
    signal.throwIfAborted();
    const row = await this.db.tenantMembership.findUnique({
      where: {
        tenantId_issuer_subjectId: {
          tenantId: access.tenantId,
          issuer: access.issuer,
          subjectId: access.subjectId,
        },
      },
      select: { isActive: true },
    });
    signal.throwIfAborted();
    return row?.isActive === true;
  }

  async findPlacement(
    id: string,
    signal: AbortSignal,
  ): Promise<TenantPlacement | null> {
    signal.throwIfAborted();
    const row = await this.db.tenantPlacement.findUnique({
      where: { tenantId: id },
    });
    signal.throwIfAborted();
    return row
      ? new TenantPlacement(
          row.tenantId,
          row.isolation,
          row.targetId,
          row.schemaName,
          row.region,
          row.version,
          row.lifecycle,
        )
      : null;
  }
}

export type TenantTransaction = Prisma.TransactionClient;

/** Pins each operation to one configured target and one SQL transaction. */
@Injectable()
export class TenantStorage implements OnModuleDestroy {
  private targets: ReadonlyMap<string, StorageTargetConfig> | undefined;
  private readonly clients = new Map<string, TenantClient>();

  constructor(private readonly catalog: CatalogReader) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.clients.values()].map((client) => client.$disconnect()),
    );
  }

  async execute<T>(
    context: TenantContext,
    action: (db: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    const region = process.env.TENANT_REGION;
    if (!region) throw new Error('Tenant region is not configured.');
    await new TenantContextAuthorizer(this.catalog, region).reauthorize(
      context,
      new AbortController().signal,
    );
    return this.executeAtPlacement(context.placement, action);
  }

  /** Login-only path: resolve a candidate, check active placement, then verify user and membership. */
  async executeCandidate<T>(
    placement: TenantPlacement,
    action: (db: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    const fresh = await this.catalog.findPlacement(
      placement.tenantId,
      new AbortController().signal,
    );
    if (
      !fresh ||
      fresh.lifecycle !== TenantLifecycle.Active ||
      fresh.version !== placement.version ||
      fresh.targetId !== placement.targetId ||
      fresh.schema !== placement.schema ||
      fresh.region !== placement.region ||
      fresh.isolation !== placement.isolation ||
      fresh.region !== process.env.TENANT_REGION
    ) {
      throw new Error('Tenant placement changed or is unavailable.');
    }
    return this.executeAtPlacement(fresh, action);
  }

  private async executeAtPlacement<T>(
    placement: TenantPlacement,
    action: (db: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    this.targets ??= parseStorageTargets(process.env.TENANT_STORAGE_TARGETS);
    const target = this.targets.get(placement.targetId);
    if (
      !target ||
      target.region !== placement.region ||
      target.isolation !== placement.isolation
    ) {
      throw new Error(
        'Authorized placement does not match a configured storage target.',
      );
    }
    const schema =
      placement.isolation === TenantIsolation.Schema
        ? placement.schema
        : target.schema;
    if (!schema) throw new Error('Authorized placement has no storage schema.');
    const client = this.clientFor(target, schema);
    return client.$transaction(
      async (db) => {
        if (placement.isolation === TenantIsolation.Row) {
          // The transaction pins every subsequent Prisma statement to this checked connection.
          await db.$executeRaw`EXEC sys.sp_set_session_context @key=N'TenantId', @value=${placement.tenantId}, @read_only=0`;
          const policy = await db.$queryRaw<Array<{ missingCount: number }>>`
            SELECT COUNT(*) AS missingCount FROM sys.tables t
            WHERE t.schema_id=SCHEMA_ID(${schema})
              AND EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'TenantId')
              AND NOT EXISTS (SELECT 1 FROM sys.security_policies p
                WHERE p.schema_id=SCHEMA_ID(${schema}) AND p.name=N'TenantIsolationPolicy' AND p.is_enabled=1
                  AND EXISTS (SELECT 1 FROM sys.security_predicates sp WHERE sp.object_id=p.object_id AND sp.target_object_id=t.object_id AND sp.predicate_type=0)
                  AND EXISTS (SELECT 1 FROM sys.security_predicates sp WHERE sp.object_id=p.object_id AND sp.target_object_id=t.object_id AND sp.predicate_type=1 AND sp.operation=1)
                  AND EXISTS (SELECT 1 FROM sys.security_predicates sp WHERE sp.object_id=p.object_id AND sp.target_object_id=t.object_id AND sp.predicate_type=1 AND sp.operation=2))`;
          if (policy[0]?.missingCount !== 0)
            throw new Error('Tenant row security is incomplete.');
        }
        try {
          return await action(db);
        } finally {
          if (placement.isolation === TenantIsolation.Row) {
            await db.$executeRaw`EXEC sys.sp_set_session_context @key=N'TenantId', @value=NULL, @read_only=0`;
          }
        }
      },
      { timeout: target.commandTimeoutSeconds * 1000 },
    );
  }

  private clientFor(target: StorageTargetConfig, schema: string): TenantClient {
    const key = `${target.targetId}:${schema}`;
    let client = this.clients.get(key);
    if (!client) {
      const url = `${target.connectionString};schema=${schema}`;
      client = new TenantClient({
        datasources: { db: { url } },
        log: ['error'],
      });
      this.clients.set(key, client);
    }
    return client;
  }
}
