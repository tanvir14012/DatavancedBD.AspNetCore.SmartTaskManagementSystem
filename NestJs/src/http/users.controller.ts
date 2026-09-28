import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TenantStorage } from '../infrastructure/prisma/prisma.service.js';
import {
  AuthorizedRequest,
  requireContext,
  TenantGuard,
} from './tenant.guard.js';
import { page, positiveId } from './projects.controller.js';
import { Prisma } from '../../generated/tenant/index.js';

function requireAdmin(roles: ReadonlySet<string>): void {
  if (!roles.has('Admin')) throw new ForbiddenException();
}

function userDto(user: {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  createdAt: Date;
  lockoutEnd: Date | null;
  roles: Array<{ role: { name: string | null } }>;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email ?? '',
    role: user.roles[0]?.role.name ?? 'Team Member',
    isActive: user.lockoutEnd === null || user.lockoutEnd <= new Date(),
    createdAt: user.createdAt,
  };
}

@Controller('api/users')
@UseGuards(TenantGuard)
export class UsersController {
  constructor(private readonly storage: TenantStorage) {}

  @Get()
  async list(
    @Req() request: AuthorizedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const { context, userId, roles } = requireContext(request);
    const { start, length } = page(query.start, query.length);
    const tenantId = context.placement.tenantId;
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search.length > 200)
      throw new BadRequestException('Search is too long.');
    const role = typeof query.role === 'string' ? query.role.trim() : 'all';
    if (
      role.toLowerCase() !== 'all' &&
      !['Admin', 'Project Manager', 'Team Member'].includes(role)
    )
      throw new BadRequestException('Invalid role filter.');
    const status =
      typeof query.status === 'string' ? query.status.toLowerCase() : 'all';
    if (!['all', 'active', 'inactive'].includes(status))
      throw new BadRequestException('Invalid status filter.');
    const sortColumn =
      typeof query.sortColumn === 'string' ? query.sortColumn : 'CreatedAt';
    if (!['FirstName', 'LastName', 'Email', 'CreatedAt'].includes(sortColumn))
      throw new BadRequestException('Invalid sort column.');
    const sortDirection =
      typeof query.sortDirection === 'string'
        ? query.sortDirection.toLowerCase()
        : 'desc';
    if (sortDirection !== 'asc' && sortDirection !== 'desc')
      throw new BadRequestException('Invalid sort direction.');
    const sortField = {
      FirstName: 'firstName',
      LastName: 'lastName',
      Email: 'email',
      CreatedAt: 'createdAt',
    }[sortColumn] as 'firstName' | 'lastName' | 'email' | 'createdAt';
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortField]: sortDirection,
    };
    return this.storage.execute(context, async (db) => {
      const where: Prisma.UserWhereInput = {
        tenantId,
        ...(!roles.has('Admin') && {
          projects: {
            some: {
              tenantId,
              project: {
                isDeleted: false,
                members: { some: { tenantId, userId } },
              },
            },
          },
        }),
        ...(role.toLowerCase() !== 'all' && {
          roles: { some: { tenantId, role: { name: role } } },
        }),
        ...(status === 'active' && {
          OR: [{ lockoutEnd: null }, { lockoutEnd: { lte: new Date() } }],
        }),
        ...(status === 'inactive' && { lockoutEnd: { gt: new Date() } }),
        ...(search && {
          AND: [
            {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { userName: { contains: search } },
              ],
            },
          ],
        }),
      };
      const [totalCount, users] = await Promise.all([
        db.user.count({ where }),
        db.user.findMany({
          where,
          skip: start,
          take: length,
          orderBy,
          include: { roles: { include: { role: { select: { name: true } } } } },
        }),
      ]);
      return {
        page: Math.floor(start / length) + 1,
        pageSize: length,
        totalCount,
        filteredCount: totalCount,
        totalPages: Math.ceil(totalCount / length),
        items: users.map(userDto),
      };
    });
  }

  @Get(':id')
  async get(@Req() request: AuthorizedRequest, @Param('id') rawId: string) {
    const { context, roles } = requireContext(request);
    requireAdmin(roles);
    const id = positiveId(rawId);
    return this.storage.execute(context, async (db) => {
      const user = await db.user.findUnique({
        where: { tenantId_id: { tenantId: context.placement.tenantId, id } },
        include: { roles: { include: { role: { select: { name: true } } } } },
      });
      if (!user) throw new NotFoundException();
      return userDto(user);
    });
  }

  @Put(':id')
  async update(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const { context, userId, roles } = requireContext(request);
    requireAdmin(roles);
    const id = positiveId(rawId);
    if (!body || typeof body !== 'object') throw new BadRequestException();
    const input = body as Record<string, unknown>;
    if (
      typeof input.firstName !== 'string' ||
      typeof input.lastName !== 'string' ||
      typeof input.email !== 'string' ||
      !input.firstName.trim() ||
      !input.lastName.trim() ||
      input.firstName.length > 25 ||
      input.lastName.length > 25 ||
      input.email.length > 256 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)
    )
      throw new BadRequestException('Invalid user details.');
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = input.email.trim();
    if (
      input.role !== undefined &&
      (typeof input.role !== 'string' ||
        !['Admin', 'Project Manager', 'Team Member'].includes(input.role))
    )
      throw new BadRequestException('Invalid role.');
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const user = await db.user.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { id: true },
      });
      if (!user) throw new NotFoundException();
      const updated = await db.user.update({
        where: { tenantId_id: { tenantId, id } },
        data: {
          firstName,
          lastName,
          email,
          userName: email,
          normalizedEmail: email.toUpperCase(),
          normalizedUserName: email.toUpperCase(),
          updatedAt: new Date(),
          updatedById: userId,
        },
      });
      if (typeof input.role === 'string') {
        const role = await db.role.findFirst({
          where: { tenantId, normalizedName: input.role.toUpperCase() },
          select: { id: true },
        });
        if (!role) throw new BadRequestException('Role is not provisioned.');
        await db.userRole.deleteMany({ where: { tenantId, userId: id } });
        await db.userRole.create({
          data: { tenantId, userId: id, roleId: role.id },
        });
      }
      const currentRoles = await db.userRole.findMany({
        where: { tenantId, userId: id },
        include: { role: { select: { name: true } } },
      });
      return userDto({ ...updated, roles: currentRoles });
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
  ): Promise<void> {
    const { context, userId, roles } = requireContext(request);
    requireAdmin(roles);
    const id = positiveId(rawId);
    if (id === userId)
      throw new ForbiddenException('An admin cannot delete their own account.');
    const tenantId = context.placement.tenantId;
    await this.storage.execute(context, async (db) => {
      const user = await db.user.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { id: true },
      });
      if (!user) throw new NotFoundException();
      await db.user.update({
        where: { tenantId_id: { tenantId, id } },
        data: {
          lockoutEnd: new Date('9999-12-31T00:00:00.000Z'),
          updatedAt: new Date(),
          updatedById: userId,
        },
      });
      await db.refreshToken.updateMany({
        where: { tenantId, userId: id, isRevoked: false },
        data: { isRevoked: true, revokedAtUtc: new Date() },
      });
    });
  }

  @Post()
  create(): never {
    throw new ForbiddenException(
      'User creation requires catalog enrollment orchestration.',
    );
  }
}
