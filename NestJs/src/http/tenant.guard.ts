import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtVerify } from 'jose';
import type { FastifyRequest } from 'fastify';
import { mayUseTenantAccount } from '../domain/account-access.js';
import {
  TenantContext,
  TenantAccess,
  TenantAccessDenied,
} from '../domain/tenancy.js';
import { TenantRequestResolver } from '../application/tenancy/resolver.js';
import { TenantContextAuthorizer } from '../application/tenancy/authorizer.js';
import {
  CatalogReader,
  TenantStorage,
} from '../infrastructure/prisma/prisma.service.js';

export interface AuthorizedRequest extends FastifyRequest {
  tenantContext?: TenantContext;
  userId?: number;
  roles?: ReadonlySet<string>;
}

/** Authenticates before tenant resolution or any business storage operation. */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly storage: TenantStorage,
  ) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<AuthorizedRequest>();
    const issuer = process.env.JWT_ISSUER;
    const audience = process.env.JWT_AUDIENCE;
    const key = process.env.JWT_KEY;
    const region = process.env.TENANT_REGION;
    if (
      !issuer ||
      !audience ||
      !key ||
      Buffer.byteLength(key) < 32 ||
      !region
    ) {
      throw new ServiceUnavailableException(
        'Authentication is not configured.',
      );
    }
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException();
    let access: TenantAccess;
    let userId: number;
    try {
      const { payload } = await jwtVerify(
        authorization.slice(7),
        new TextEncoder().encode(key),
        { issuer, audience, algorithms: ['HS256'] },
      );
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.iss !== 'string' ||
        typeof payload.tenant_id !== 'string'
      )
        throw new TenantAccessDenied();
      userId = Number(payload.sub);
      if (!Number.isSafeInteger(userId) || userId <= 0)
        throw new TenantAccessDenied();
      access = new TenantAccess(payload.tenant_id, payload.sub, payload.iss);
    } catch {
      throw new UnauthorizedException();
    }
    const host = request.headers.host;
    const selector = request.headers['x-tenant-id'];
    const shared =
      process.env.SHARED_API_AUTHORITIES?.split(',').filter(Boolean) ?? [];
    const resolver = new TenantRequestResolver(this.catalog, shared);
    const authorizer = new TenantContextAuthorizer(this.catalog, region);
    try {
      const candidate = await resolver.resolve(
        host,
        selector,
        new AbortController().signal,
      );
      request.tenantContext = await authorizer.authorize(
        candidate,
        access,
        new AbortController().signal,
      );
    } catch (error) {
      if (error instanceof TenantAccessDenied) throw new ForbiddenException();
      throw error;
    }
    const context = request.tenantContext;
    if (!context) throw new UnauthorizedException();
    const roles = await this.storage.execute(context, async (db) => {
      const tenantId = context.placement.tenantId;
      const user = await db.user.findUnique({
        where: { tenantId_id: { tenantId, id: userId } },
        select: { lockoutEnd: true },
      });
      if (!user || (user.lockoutEnd !== null && user.lockoutEnd > new Date()))
        throw new ForbiddenException();
      const rows = await db.userRole.findMany({
        where: { tenantId, userId },
        include: { role: { select: { name: true } } },
      });
      const currentRoles = new Set(
        rows
          .map((row) => row.role.name)
          .filter((value): value is string => value !== null),
      );
      if (!mayUseTenantAccount(user.lockoutEnd, [...currentRoles], new Date()))
        throw new ForbiddenException();
      return currentRoles;
    });
    request.userId = userId;
    request.roles = roles;
    return true;
  }
}

export function requireContext(request: AuthorizedRequest): {
  context: TenantContext;
  userId: number;
  roles: ReadonlySet<string>;
} {
  if (!request.tenantContext || !request.userId || !request.roles)
    throw new UnauthorizedException();
  return {
    context: request.tenantContext,
    userId: request.userId,
    roles: request.roles,
  };
}
