/** Storage strategy values match Application/Tenancy/TenantPlacement.cs. */
export enum TenantIsolation {
  Database = 0,
  Schema = 1,
  Row = 2,
}

export enum TenantLifecycle {
  Provisioning = 0,
  Active = 1,
  Moving = 2,
  Suspended = 3,
}

export class TenantAccessDenied extends Error {
  constructor() {
    super('Tenant access denied.');
  }
}

export function tenantId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) ||
    value === '00000000-0000-0000-0000-000000000000'
  ) {
    throw new TenantAccessDenied();
  }
  return value.toLowerCase();
}

export function identityPart(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 256 ||
    value.trim() !== value ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159);
    })
  ) {
    throw new TenantAccessDenied();
  }
  return value;
}

export function schemaName(value: string): string {
  if (!/^[A-Za-z_][A-Za-z\d_]{0,127}$/.test(value)) {
    throw new Error('Invalid storage schema.');
  }
  return value;
}

export function logicalHandle(value: string): string {
  if (!/^[A-Za-z\d][A-Za-z\d._-]{0,127}$/.test(value)) {
    throw new Error('Invalid logical storage handle.');
  }
  return value;
}

/** Immutable catalog metadata. Version stays bigint to avoid losing SQL bigint precision. */
export class TenantPlacement {
  readonly tenantId: string;

  constructor(
    id: string,
    readonly isolation: TenantIsolation,
    readonly targetId: string,
    readonly schema: string | null,
    readonly region: string,
    readonly version: bigint,
    readonly lifecycle: TenantLifecycle,
  ) {
    this.tenantId = tenantId(id);
    logicalHandle(targetId);
    logicalHandle(region);
    if (
      !Number.isInteger(isolation) ||
      isolation < TenantIsolation.Database ||
      isolation > TenantIsolation.Row ||
      !Number.isInteger(lifecycle) ||
      lifecycle < TenantLifecycle.Provisioning ||
      lifecycle > TenantLifecycle.Suspended ||
      version <= 0n
    ) {
      throw new Error('Invalid tenant placement.');
    }
    if (isolation === TenantIsolation.Schema) {
      if (schema === null)
        throw new Error('Schema placement requires a schema.');
      schemaName(schema);
    } else if (schema !== null) {
      throw new Error('Only schema isolation permits a schema override.');
    }
    Object.freeze(this);
  }
}

/** Structurally valid access; authentication and authoritative membership are separate. */
export class TenantAccess {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly issuer: string;

  constructor(id: string, subjectId: string, issuer: string) {
    this.tenantId = tenantId(id);
    this.subjectId = identityPart(subjectId);
    this.issuer = identityPart(issuer);
    Object.freeze(this);
  }
}

export class TenantContext {
  constructor(
    readonly placement: TenantPlacement,
    readonly access: TenantAccess,
  ) {
    if (
      placement.lifecycle !== TenantLifecycle.Active ||
      placement.tenantId !== access.tenantId
    ) {
      throw new TenantAccessDenied();
    }
    Object.freeze(this);
  }
}

/** Allocate one instance per request/job. A second initialization is always a defect. */
export class TenantContextScope {
  #current: TenantContext | undefined;

  get current(): TenantContext {
    if (!this.#current) throw new TenantAccessDenied();
    return this.#current;
  }

  initialize(context: TenantContext): void {
    if (this.#current)
      throw new Error('Tenant context is already initialized.');
    this.#current = context;
  }
}
