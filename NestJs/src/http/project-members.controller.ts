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
import { membership, page, positiveId } from './projects.controller.js';

function projectRole(value: unknown): number {
  if (typeof value !== 'string') throw new BadRequestException('Invalid role.');
  const index = ['owner', 'manager', 'member', 'viewer'].indexOf(
    value.toLowerCase(),
  );
  if (index < 0) throw new BadRequestException('Invalid role.');
  return index;
}

@Controller('api/projects')
@UseGuards(TenantGuard)
export class ProjectMembersController {
  constructor(private readonly storage: TenantStorage) {}

  @Get('assignments')
  async assignments(
    @Req() request: AuthorizedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const { context, userId, roles } = requireContext(request);
    if (!roles.has('Admin') && !roles.has('Project Manager'))
      throw new ForbiddenException();
    const { start, length } = page(query.start, query.length);
    const projectId =
      query.projectId === undefined
        ? undefined
        : typeof query.projectId === 'string'
          ? positiveId(query.projectId)
          : (() => {
              throw new BadRequestException('Invalid project identifier.');
            })();
    const tenantId = context.placement.tenantId;
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search.length > 200)
      throw new BadRequestException('Search is too long.');
    const role =
      query.role === undefined || query.role === 'all'
        ? undefined
        : projectRole(query.role);
    return this.storage.execute(context, async (db) => {
      const where = {
        tenantId,
        ...(projectId && { projectId }),
        ...(role !== undefined && { projectRole: role }),
        project: {
          isDeleted: false,
          ...(!roles.has('Admin') && {
            members: {
              some: { tenantId, userId, projectRole: { in: [0, 1] } },
            },
          }),
          ...(search && { name: { contains: search } }),
        },
      };
      const [totalCount, rows] = await Promise.all([
        db.userProject.count({ where }),
        db.userProject.findMany({
          where,
          skip: start,
          take: length,
          orderBy: { projectId: 'asc' },
          include: {
            project: { select: { name: true } },
            user: { select: { userName: true, email: true } },
          },
        }),
      ]);
      return {
        page: Math.floor(start / length) + 1,
        pageSize: length,
        totalCount,
        filteredCount: totalCount,
        totalPages: Math.ceil(totalCount / length),
        items: rows.map((row) => ({
          projectId: row.projectId,
          projectName: row.project.name,
          userId: row.userId,
          userName: row.user.userName ?? row.user.email ?? '',
          email: row.user.email ?? '',
          role: row.projectRole,
        })),
      };
    });
  }

  @Get(':id/members')
  async list(@Req() request: AuthorizedRequest, @Param('id') rawId: string) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const project = await db.project.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { isDeleted: true },
      });
      if (!project || project.isDeleted) throw new NotFoundException();
      if (
        !roles.has('Admin') &&
        (await membership(db, tenantId, id, userId)) === null
      )
        throw new ForbiddenException();
      const members = await db.userProject.findMany({
        where: { tenantId, projectId: id },
        orderBy: { projectRole: 'asc' },
        include: { user: { select: { userName: true, email: true } } },
      });
      return members.map((member) => ({
        userId: member.userId,
        userName: member.user.userName ?? member.user.email ?? '',
        email: member.user.email ?? '',
        role: member.projectRole,
      }));
    });
  }

  @Post(':id/members')
  async assign(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    if (!body || typeof body !== 'object') throw new BadRequestException();
    const payload = body as Record<string, unknown>;
    const memberId = positiveId(String(payload.userId));
    const role = projectRole(payload.role);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const project = await db.project.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { isDeleted: true },
      });
      if (!project || project.isDeleted) throw new NotFoundException();
      const actorRole = await membership(db, tenantId, id, userId);
      if (
        !roles.has('Admin') &&
        ((actorRole !== 0 && actorRole !== 1) || role === 0 || role === 1)
      )
        throw new ForbiddenException();
      const user = await db.user.findUnique({
        where: { tenantId_id: { tenantId, id: memberId } },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('User not found.');
      await db.userProject.upsert({
        where: {
          tenantId_userId_projectId: {
            tenantId,
            userId: memberId,
            projectId: id,
          },
        },
        create: {
          tenantId,
          userId: memberId,
          projectId: id,
          projectRole: role,
          joinedAt: new Date(),
        },
        update: { projectRole: role, joinedAt: new Date() },
      });
      return { projectId: id, userId: memberId, role };
    });
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  async remove(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
    @Param('userId') rawUserId: string,
  ): Promise<void> {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    const memberId = positiveId(rawUserId);
    const tenantId = context.placement.tenantId;
    await this.storage.execute(context, async (db) => {
      const project = await db.project.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { isDeleted: true },
      });
      if (!project || project.isDeleted) throw new NotFoundException();
      const actorRole = await membership(db, tenantId, id, userId);
      if (!roles.has('Admin') && actorRole !== 0 && actorRole !== 1)
        throw new ForbiddenException();
      const targetRole = await membership(db, tenantId, id, memberId);
      if (targetRole === null) throw new NotFoundException();
      if (!roles.has('Admin') && (targetRole === 0 || targetRole === 1))
        throw new ForbiddenException();
      await db.userProject.delete({
        where: {
          tenantId_userId_projectId: {
            tenantId,
            userId: memberId,
            projectId: id,
          },
        },
      });
    });
  }
}
