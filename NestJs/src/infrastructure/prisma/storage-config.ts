import {
  logicalHandle,
  schemaName,
  TenantIsolation,
} from '../../domain/tenancy.js';

export interface StorageTargetConfig {
  readonly targetId: string;
  readonly region: string;
  readonly isolation: TenantIsolation;
  readonly schema: string;
  readonly connectionString: string;
  readonly commandTimeoutSeconds: number;
}

export function parseStorageTargets(
  raw: unknown,
): ReadonlyMap<string, StorageTargetConfig> {
  if (typeof raw !== 'string' || raw.trim() === '')
    throw new Error('Storage targets are required.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Storage targets configuration is invalid.');
  }
  if (!Array.isArray(parsed))
    throw new Error('Storage targets configuration is invalid.');
  const targets = new Map<string, StorageTargetConfig>();
  for (const item of parsed) {
    if (!item || typeof item !== 'object')
      throw new Error('Storage target configuration is invalid.');
    const value = item as Record<string, unknown>;
    if (
      typeof value.targetId !== 'string' ||
      typeof value.region !== 'string' ||
      typeof value.schema !== 'string' ||
      typeof value.connectionString !== 'string' ||
      typeof value.isolation !== 'number' ||
      typeof value.commandTimeoutSeconds !== 'number'
    ) {
      throw new Error('Storage target configuration is invalid.');
    }
    const targetId = logicalHandle(value.targetId);
    logicalHandle(value.region);
    schemaName(value.schema);
    const isolation = toIsolation(value.isolation);
    if (
      !Number.isInteger(value.commandTimeoutSeconds) ||
      value.commandTimeoutSeconds < 1 ||
      value.commandTimeoutSeconds > 120
    )
      throw new Error('Storage target timeout is invalid.');
    if (
      value.connectionString.includes('\n') ||
      value.connectionString.includes('\r')
    )
      throw new Error('Storage target connection configuration is invalid.');
    if (targets.has(targetId))
      throw new Error('Storage target identifiers must be unique.');
    targets.set(
      targetId,
      Object.freeze({
        targetId,
        region: value.region,
        isolation,
        schema: value.schema,
        connectionString: value.connectionString,
        commandTimeoutSeconds: value.commandTimeoutSeconds,
      }),
    );
  }
  return targets;
}

function toIsolation(value: number): TenantIsolation {
  if (!Number.isInteger(value) || value < 0 || value > 2) {
    throw new Error('Storage target isolation is invalid.');
  }
  switch (value) {
    case 0:
      return TenantIsolation.Database;
    case 1:
      return TenantIsolation.Schema;
    case 2:
      return TenantIsolation.Row;
    default:
      throw new Error('Storage target isolation is invalid.');
  }
}
