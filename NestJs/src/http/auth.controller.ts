import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { TenantRequestResolver } from '../application/tenancy/resolver.js';
import { TenantLifecycle, TenantPlacement } from '../domain/tenancy.js';
import { verifyIdentityPassword } from '../domain/identity-password.js';
import {
  CatalogReader,
  TenantStorage,
  TenantTransaction,
} from '../infrastructure/prisma/prisma.service.js';

const cookieName = 'stms_refresh_token';
const roleClaim =
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

function authConfig() {
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;
  const key = process.env.JWT_KEY;
  const region = process.env.TENANT_REGION;
  if (!issuer || !audience || !key || Buffer.byteLength(key) < 32 || !region)
    throw new ServiceUnavailableException('Authentication is not configured.');
  return { issuer, audience, key, region };
}

function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

function secureOrigin(request: FastifyRequest): void {
  const origin = request.headers.origin;
  const allowed = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) ?? [];
  if (!origin || !allowed.includes(origin)) throw new ForbiddenException();
}

async function rolesFor(
  db: TenantTransaction,
  tenantId: string,
  userId: number,
): Promise<string[]> {
  const memberships = await db.userRole.findMany({
    where: { tenantId, userId },
    include: { role: { select: { name: true } } },
  });
  return memberships
    .map((item) => item.role.name)
    .filter((name): name is string => name !== null);
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly storage: TenantStorage,
  ) {}

  private async placement(request: FastifyRequest): Promise<TenantPlacement> {
    const shared =
      process.env.SHARED_API_AUTHORITIES?.split(',').filter(Boolean) ?? [];
    const resolver = new TenantRequestResolver(this.catalog, shared);
    const id = await resolver.resolve(
      request.headers.host,
      request.headers['x-tenant-id'],
      new AbortController().signal,
    );
    const placement = await this.catalog.findPlacement(
      id,
      new AbortController().signal,
    );
    if (
      !placement ||
      placement.lifecycle !== TenantLifecycle.Active ||
      placement.region !== authConfig().region
    )
      throw new UnauthorizedException();
    return placement;
  }

  private async issue(
    db: TenantTransaction,
    placement: TenantPlacement,
    userId: number,
  ) {
    const settings = authConfig();
    const roles = await rolesFor(db, placement.tenantId, userId);
    const accessToken = await new SignJWT({
      tenant_id: placement.tenantId,
      [roleClaim]: roles,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(userId))
      .setIssuer(settings.issuer)
      .setAudience(settings.audience)
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(new TextEncoder().encode(settings.key));
    const refresh = randomBytes(32).toString('base64');
    await db.refreshToken.create({
      data: {
        tenantId: placement.tenantId,
        tokenHash: tokenHash(refresh),
        userId,
        createdAtUtc: new Date(),
        expiresAtUtc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
      },
    });
    return { accessToken, refresh, roles };
  }

  private setCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(cookieName, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  @Post('login')
  async login(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body: unknown,
  ) {
    secureOrigin(request);
    if (!body || typeof body !== 'object') throw new BadRequestException();
    const input = body as Record<string, unknown>;
    if (
      typeof input.email !== 'string' ||
      typeof input.password !== 'string' ||
      input.email.length > 256 ||
      input.password.length > 1024
    )
      throw new BadRequestException();
    const email = input.email.trim().toUpperCase();
    const password = input.password;
    const placement = await this.placement(request);
    const tenantId = placement.tenantId;
    const result = await this.storage.executeCandidate(
      placement,
      async (db) => {
        const user = await db.user.findFirst({
          where: { tenantId, normalizedEmail: email },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            passwordHash: true,
            lockoutEnd: true,
          },
        });
        if (
          !user ||
          (user.lockoutEnd !== null && user.lockoutEnd > new Date()) ||
          !(await verifyIdentityPassword(password, user.passwordHash))
        )
          throw new UnauthorizedException();
        const active = await this.catalog.isActiveMember(
          { tenantId, subjectId: String(user.id), issuer: authConfig().issuer },
          new AbortController().signal,
        );
        if (!active) throw new UnauthorizedException();
        const tokens = await this.issue(db, placement, user.id);
        return {
          user: {
            id: user.id,
            email: user.email ?? '',
            firstName: user.firstName,
            lastName: user.lastName,
            roles: tokens.roles,
          },
          accessToken: tokens.accessToken,
          refresh: tokens.refresh,
        };
      },
    );
    this.setCookie(reply, result.refresh);
    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: 1800,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    secureOrigin(request);
    const token = request.cookies[cookieName];
    if (!token || token.length > 128) throw new UnauthorizedException();
    const placement = await this.placement(request);
    const tenantId = placement.tenantId;
    const result = await this.storage.executeCandidate(
      placement,
      async (db) => {
        const stored = await db.refreshToken.findFirst({
          where: {
            tenantId,
            tokenHash: tokenHash(token),
            isRevoked: false,
            expiresAtUtc: { gt: new Date() },
          },
          select: { id: true, userId: true },
        });
        if (!stored) throw new UnauthorizedException();
        const active = await this.catalog.isActiveMember(
          {
            tenantId,
            subjectId: String(stored.userId),
            issuer: authConfig().issuer,
          },
          new AbortController().signal,
        );
        if (!active) throw new UnauthorizedException();
        const changed = await db.refreshToken.updateMany({
          where: { tenantId, id: stored.id, isRevoked: false },
          data: { isRevoked: true, revokedAtUtc: new Date() },
        });
        if (changed.count !== 1) throw new UnauthorizedException();
        return this.issue(db, placement, stored.userId);
      },
    );
    this.setCookie(reply, result.refresh);
    return { accessToken: result.accessToken, expiresIn: 1800 };
  }

  @Post('logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    secureOrigin(request);
    const token = request.cookies[cookieName];
    if (token && token.length <= 128) {
      const placement = await this.placement(request);
      await this.storage.executeCandidate(placement, async (db) => {
        await db.refreshToken.updateMany({
          where: {
            tenantId: placement.tenantId,
            tokenHash: tokenHash(token),
            isRevoked: false,
          },
          data: { isRevoked: true, revokedAtUtc: new Date() },
        });
      });
    }
    reply.clearCookie(cookieName, {
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'none',
    });
    return { message: 'Logged out successfully.' };
  }

  @Post('register')
  register(): never {
    throw new ForbiddenException(
      'Registration requires tenant provisioning authorization.',
    );
  }
}
