import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  TenantStorage,
  TenantTransaction,
} from '../infrastructure/prisma/prisma.service.js';
import {
  AuthorizedRequest,
  requireContext,
  TenantGuard,
} from './tenant.guard.js';
import type { Prisma } from '../../generated/tenant/index.js';

const projectSortFields: Readonly<
  Record<string, 'name' | 'startDate' | 'endDate' | 'updatedAt' | 'createdAt'>
> = {
  Name: 'name',
  StartDate: 'startDate',
  EndDate: 'endDate',
  UpdatedAt: 'updatedAt',
  CreatedAt: 'createdAt',
};

export function positiveId(raw: string): number {
  const id = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id))
    throw new BadRequestException('Invalid identifier.');
  return id;
}

export function page(
  rawStart: unknown,
  rawLength: unknown,
): { start: number; length: number } {
  const start = rawStart === undefined ? 0 : Number(rawStart);
  const length = rawLength === undefined ? 20 : Number(rawLength);
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(length) ||
    length < 1 ||
    length > 200
  )
    throw new BadRequestException('Invalid pagination.');
  return { start, length };
}

function projectInput(value: unknown): {
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isArchived: boolean;
} {
  if (!value || typeof value !== 'object')
    throw new BadRequestException('Invalid project.');
  const data = value as Record<string, unknown>;
  if (
    typeof data.name !== 'string' ||
    !/^[a-zA-Z0-9\s\-_.&()]{1,200}$/.test(data.name.trim()) ||
    (data.description !== undefined &&
      data.description !== null &&
      (typeof data.description !== 'string' || data.description.length > 1000))
  ) {
    throw new BadRequestException('Invalid project name or description.');
  }
  const startDate = dateInput(data.startDate);
  const endDate = dateInput(data.endDate);
  if (startDate && endDate && startDate > endDate)
    throw new BadRequestException('End date precedes start date.');
  if (data.isArchived !== undefined && typeof data.isArchived !== 'boolean')
    throw new BadRequestException('Invalid archive state.');
  return {
    name: data.name.trim(),
    description:
      typeof data.description === 'string' ? data.description.trim() : null,
    startDate,
    endDate,
    isArchived: data.isArchived === true,
  };
}

function dateInput(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Invalid date.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid date.');
  return parsed;
}

function dateOutput(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

export async function membership(
  db: TenantTransaction,
  tenantId: string,
  projectId: number,
  userId: number,
): Promise<number | null> {
  const row = await db.userProject.findUnique({
    where: { tenantId_userId_projectId: { tenantId, userId, projectId } },
    select: { projectRole: true },
  });
  return row?.projectRole ?? null;
}

@Controller('api/projects')
@UseGuards(TenantGuard)
export class ProjectsController {
  constructor(private readonly storage: TenantStorage) {}

  @Get()
  async list(
    @Req() request: AuthorizedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const { context, userId, roles } = requireContext(request);
    const { start, length } = page(query.start, query.length);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search.length > 200)
      throw new BadRequestException('Search is too long.');
    const status =
      typeof query.status === 'string' ? query.status.toLowerCase() : 'all';
    if (!['all', 'active', 'archived', 'planned', 'completed'].includes(status))
      throw new BadRequestException('Invalid project status.');
    const sortColumn =
      typeof query.sortColumn === 'string' ? query.sortColumn : 'CreatedAt';
    const sortField = projectSortFields[sortColumn];
    if (!sortField) throw new BadRequestException('Invalid sort column.');
    const sortDirection =
      typeof query.sortDirection === 'string'
        ? query.sortDirection.toLowerCase()
        : 'desc';
    if (sortDirection !== 'asc' && sortDirection !== 'desc')
      throw new BadRequestException('Invalid sort direction.');
    const orderBy: Prisma.ProjectOrderByWithRelationInput = {
      [sortField]: sortDirection,
    };
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tenantId = context.placement.tenantId;
    const isAdmin = roles.has('Admin');
    return this.storage.execute(context, async (db) => {
      const where: Prisma.ProjectWhereInput = {
        tenantId,
        isDeleted: false,
        ...(!isAdmin && { members: { some: { tenantId, userId } } }),
        ...(status === 'active' && { isArchived: false }),
        ...(status === 'archived' && { isArchived: true }),
        ...(status === 'planned' && {
          isArchived: false,
          OR: [{ startDate: null }, { startDate: { gt: today } }],
        }),
        ...(status === 'completed' && {
          isArchived: false,
          endDate: { lte: today },
        }),
        ...(search && {
          AND: [
            {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
              ],
            },
          ],
        }),
      };
      const [totalCount, projects] = await Promise.all([
        db.project.count({ where }),
        db.project.findMany({
          where,
          orderBy: [orderBy, { id: 'asc' }],
          skip: start,
          take: length,
          include: {
            members: {
              where: { tenantId, userId },
              select: { projectRole: true },
            },
            _count: {
              select: { tasks: { where: { tenantId, isDeleted: false } } },
            },
          },
        }),
      ]);
      return {
        page: Math.floor(start / length) + 1,
        pageSize: length,
        totalCount,
        filteredCount: totalCount,
        totalPages: Math.ceil(totalCount / length),
        items: projects.map((project) => {
          const role = project.members[0]?.projectRole ?? 2;
          return {
            id: project.id,
            name: project.name,
            description: project.description,
            startDate: dateOutput(project.startDate),
            endDate: dateOutput(project.endDate),
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            canEdit: isAdmin || role === 0 || role === 1,
            canDelete: isAdmin,
            status: project.isArchived ? 'Archived' : 'Active',
            role: ['Owner', 'Manager', 'Member', 'Viewer'][role] ?? 'Member',
            taskCount: project._count.tasks,
            currentUserRole: role,
          };
        }),
      };
    });
  }

  @Get(':id')
  async get(@Req() request: AuthorizedRequest, @Param('id') rawId: string) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const project = await db.project.findUnique({
        where: { tenantId_id: { tenantId, id } },
        include: {
          members: {
            include: { user: { select: { userName: true, email: true } } },
          },
        },
      });
      if (!project || project.isDeleted) throw new NotFoundException();
      const role = project.members.find(
        (member) => member.userId === userId,
      )?.projectRole;
      const isAdmin = roles.has('Admin');
      if (!isAdmin && role === undefined) throw new ForbiddenException();
      return {
        id,
        name: project.name,
        description: project.description,
        startDate: dateOutput(project.startDate),
        endDate: dateOutput(project.endDate),
        createdAt: project.createdAt,
        canEdit: isAdmin || role === 0 || role === 1,
        canDelete: isAdmin,
        members: project.members.map((member) => ({
          userId: member.userId,
          userName: member.user.userName ?? member.user.email ?? '',
          email: member.user.email ?? '',
          role: member.projectRole,
        })),
      };
    });
  }

  @Post()
  async create(@Req() request: AuthorizedRequest, @Body() body: unknown) {
    const { context, userId, roles } = requireContext(request);
    if (!roles.has('Admin') && !roles.has('Project Manager'))
      throw new ForbiddenException();
    const input = projectInput(body);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const project = await db.project.create({
        data: {
          tenantId,
          name: input.name,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
          createdById: userId,
        },
      });
      await db.userProject.create({
        data: {
          tenantId,
          projectId: project.id,
          userId,
          projectRole: 0,
          joinedAt: new Date(),
        },
      });
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        startDate: dateOutput(project.startDate),
        endDate: dateOutput(project.endDate),
      };
    });
  }

  @Put(':id')
  async update(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    const input = projectInput(body);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const project = await db.project.findUnique({
        where: { tenantId_id: { tenantId, id } },
        select: { isDeleted: true },
      });
      if (!project || project.isDeleted) throw new NotFoundException();
      const role = await membership(db, tenantId, id, userId);
      if (!roles.has('Admin') && role !== 0 && role !== 1)
        throw new ForbiddenException();
      const updated = await db.project.update({
        where: { tenantId_id: { tenantId, id } },
        data: { ...input, updatedAt: new Date(), updatedById: userId },
      });
      return {
        id,
        name: updated.name,
        description: updated.description,
        startDate: dateOutput(updated.startDate),
        endDate: dateOutput(updated.endDate),
        createdAt: updated.createdAt,
        canEdit: true,
        canDelete: roles.has('Admin'),
      };
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
  ): Promise<void> {
    const { context, userId, roles } = requireContext(request);
    if (!roles.has('Admin')) throw new ForbiddenException();
    const id = positiveId(rawId);
    const tenantId = context.placement.tenantId;
    await this.storage.execute(context, async (db) => {
      const result = await db.project.updateMany({
        where: { tenantId, id, isDeleted: false },
        data: { isDeleted: true, updatedAt: new Date(), updatedById: userId },
      });
      if (result.count === 0) throw new NotFoundException();
    });
  }
}
