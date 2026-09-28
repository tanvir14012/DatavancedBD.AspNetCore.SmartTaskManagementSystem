import { TenantAccessDenied, tenantId } from '../../domain/tenancy.js';
import { TenantAuthorityReader } from './ports.js';

/** Strict DNS authority normalization; ports never alias implicit defaults. */
export function normalizeAuthority(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0 || input.length > 259) {
    throw new TenantAccessDenied();
  }
  const [host, port, extra] = input.split(':');
  if (
    !host ||
    host.length > 253 ||
    extra !== undefined ||
    (port !== undefined &&
      (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535))
  ) {
    throw new TenantAccessDenied();
  }
  if (
    host
      .split('.')
      .some(
        (label) => !/^[A-Za-z\d](?:[A-Za-z\d-]{0,61}[A-Za-z\d])?$/.test(label),
      )
  ) {
    throw new TenantAccessDenied();
  }
  return input.toLowerCase();
}

export class TenantRequestResolver {
  readonly #sharedAuthorities: ReadonlySet<string>;

  constructor(
    private readonly directory: TenantAuthorityReader,
    sharedAuthorities: readonly string[],
  ) {
    this.#sharedAuthorities = new Set(
      sharedAuthorities.map(normalizeAuthority),
    );
  }

  async resolve(
    host: unknown,
    selector: unknown,
    signal: AbortSignal,
  ): Promise<string> {
    signal.throwIfAborted();
    const authority = normalizeAuthority(host);
    const selected = selector === undefined ? undefined : tenantId(selector);
    if (this.#sharedAuthorities.has(authority)) {
      if (!selected) throw new TenantAccessDenied();
      return selected;
    }
    const mapped = await this.directory.findTenant(authority, signal);
    signal.throwIfAborted();
    if (mapped === null) throw new TenantAccessDenied();
    const resolved = tenantId(mapped);
    if (selected !== undefined && selected !== resolved)
      throw new TenantAccessDenied();
    return resolved;
  }
}
