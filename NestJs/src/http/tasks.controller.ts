import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { membership, page, positiveId } from './projects.controller.js';

const statuses = ['Todo', 'InProgress', 'Completed', 'Cancelled'] as const;
const priorities = ['Low', 'Medium', 'High', 'Critical'] as const;

function enumValue(
  value: unknown,
  options: readonly string[],
  fallback: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string')
    throw new BadRequestException('Invalid task state.');
  const index = options.findIndex(
    (option) => option.toLowerCase() === value.toLowerCase(),
  );
  if (index < 0) throw new BadRequestException('Invalid task state.');
  return index;
}

function dueDate(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Invalid due date.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value)
    throw new BadRequestException('Invalid due date.');
  return date;
}

function taskInput(value: unknown) {
  if (!value || typeof value !== 'object')
    throw new BadRequestException('Invalid task.');
  const input = value as Record<string, unknown>;
  if (
    typeof input.title !== 'string' ||
    input.title.trim().length < 1 ||
    input.title.length > 200 ||
    (input.description !== undefined &&
      input.description !== null &&
      (typeof input.description !== 'string' ||
        input.description.length > 4000))
  )
    throw new BadRequestException('Invalid task title or description.');
  if (
    input.assigneeEmail !== undefined &&
    input.assigneeEmail !== null &&
    typeof input.assigneeEmail !== 'string'
  )
    throw new BadRequestException('Invalid assignee email.');
  return {
    title: input.title.trim(),
    description:
      typeof input.description === 'string' ? input.description.trim() : null,
    status: enumValue(input.status, statuses, 0),
    priority: enumValue(input.priority, priorities, 1),
    dueDate: dueDate(input.dueDate),
    projectId:
      typeof input.projectId === 'number' &&
      Number.isSafeInteger(input.projectId) &&
      input.projectId > 0
        ? input.projectId
        : null,
    assigneeEmail:
      typeof input.assigneeEmail === 'string'
        ? input.assigneeEmail.trim()
        : null,
  };
}

async function taskAccess(
  db: TenantTransaction,
  tenantId: string,
  taskId: number,
  userId: number,
  roles: ReadonlySet<string>,
) {
  const task = await db.projectTask.findUnique({
    where: { tenantId_id: { tenantId, id: taskId } },
    include: {
      project: { select: { name: true, isDeleted: true } },
      assignees: { select: { userId: true } },
    },
  });
  if (!task || task.isDeleted || task.project.isDeleted)
    throw new NotFoundException();
  const projectRole = await membership(db, tenantId, task.projectId, userId);
  const admin = roles.has('Admin');
  const manager =
    roles.has('Project Manager') && (projectRole === 0 || projectRole === 1);
  const assignee = task.assignees.some((item) => item.userId === userId);
  if (!admin && projectRole === null && !assignee)
    throw new ForbiddenException();
  return {
    task,
    canManage: admin || manager,
    canEdit: admin || manager || assignee,
  };
}

function output(
  task: {
    id: number;
    projectId: number;
    title: string;
    description: string | null;
    status: number;
    priority: number;
    dueDate: Date | null;
    createdAt: Date;
  },
  projectName: string,
  canEdit: boolean,
  canDelete: boolean,
) {
  return {
    id: task.id,
    projectId: task.projectId,
    projectName,
    title: task.title,
    description: task.description,
    status: statuses[task.status] ?? 'Todo',
    priority: priorities[task.priority] ?? 'Medium',
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
    createdAt: task.createdAt,
    canEdit,
    canDelete,
  };
}

@Controller('api/tasks')
@UseGuards(TenantGuard)
export class TasksController {
  constructor(private readonly storage: TenantStorage) {}

  @Get()
  async list(
    @Req() request: AuthorizedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const { context, userId, roles } = requireContext(request);
    const { start, length } = page(query.start, query.length);
    const tenantId = context.placement.tenantId;
    const projectId =
      typeof query.projectId === 'string'
        ? positiveId(query.projectId)
        : undefined;
    const status =
      query.status === undefined
        ? undefined
        : enumValue(query.status, statuses, -1);
    const priority =
      query.priority === undefined
        ? undefined
        : enumValue(query.priority, priorities, -1);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search.length > 200)
      throw new BadRequestException('Search is too long.');
    return this.storage.execute(context, async (db) => {
      const where = {
        tenantId,
        isDeleted: false,
        project: {
          isDeleted: false,
          ...(!roles.has('Admin') && {
            members: { some: { tenantId, userId } },
          }),
        },
        ...(projectId && { projectId }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(search && { title: { contains: search } }),
      };
      const [totalCount, rows] = await Promise.all([
        db.projectTask.count({ where }),
        db.projectTask.findMany({
          where,
          skip: start,
          take: length,
          orderBy: { createdAt: 'desc' },
          include: {
            project: { select: { name: true } },
            assignees: {
              where: { tenantId, userId },
              select: { userId: true },
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
        items: rows.map((row) =>
          output(
            row,
            row.project.name,
            roles.has('Admin') || row.assignees.length > 0,
            roles.has('Admin'),
          ),
        ),
      };
    });
  }

  @Get(':id')
  async get(@Req() request: AuthorizedRequest, @Param('id') rawId: string) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    return this.storage.execute(context, async (db) => {
      const result = await taskAccess(
        db,
        context.placement.tenantId,
        id,
        userId,
        roles,
      );
      return output(
        result.task,
        result.task.project.name,
        result.canEdit,
        result.canManage,
      );
    });
  }

  @Post()
  async create(@Req() request: AuthorizedRequest, @Body() body: unknown) {
    const { context, userId, roles } = requireContext(request);
    if (!roles.has('Admin') && !roles.has('Project Manager'))
      throw new ForbiddenException();
    const input = taskInput(body);
    if (!input.projectId) throw new BadRequestException('Project is required.');
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const project = await db.project.findUnique({
        where: { tenantId_id: { tenantId, id: input.projectId! } },
        select: { isDeleted: true },
      });
      if (!project || project.isDeleted) throw new NotFoundException();
      const role = await membership(db, tenantId, input.projectId!, userId);
      if (!roles.has('Admin') && role !== 0 && role !== 1)
        throw new ForbiddenException();
      let assigneeId: number | null = null;
      if (input.assigneeEmail) {
        const assignee = await db.user.findFirst({
          where: {
            tenantId,
            normalizedEmail: input.assigneeEmail.toUpperCase(),
          },
          select: { id: true },
        });
        if (!assignee)
          throw new BadRequestException('Assignee does not exist.');
        if (
          (await membership(db, tenantId, input.projectId!, assignee.id)) ===
          null
        )
          throw new BadRequestException('Assignee is not a project member.');
        assigneeId = assignee.id;
      }
      const task = await db.projectTask.create({
        data: {
          tenantId,
          projectId: input.projectId!,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          dueDate: input.dueDate,
          isDeleted: false,
          createdAt: new Date(),
          createdById: userId,
          updatedById: userId,
        },
      });
      if (assigneeId !== null)
        await db.userTask.create({
          data: {
            tenantId,
            taskId: task.id,
            userId: assigneeId,
            assignedById: userId,
            isPrimary: true,
            assignedAt: new Date(),
          },
        });
      return {
        id: task.id,
        title: task.title,
        status: statuses[task.status],
        priority: priorities[task.priority],
        dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
        projectId: task.projectId,
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
    const input = taskInput(body);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const { task, canEdit, canManage } = await taskAccess(
        db,
        tenantId,
        id,
        userId,
        roles,
      );
      if (!canEdit) throw new ForbiddenException();
      if (input.projectId && input.projectId !== task.projectId) {
        if (!canManage) throw new ForbiddenException();
        const destination = await db.project.findUnique({
          where: { tenantId_id: { tenantId, id: input.projectId } },
          select: { isDeleted: true },
        });
        if (!destination || destination.isDeleted)
          throw new NotFoundException();
        const role = await membership(db, tenantId, input.projectId, userId);
        if (!roles.has('Admin') && role !== 0 && role !== 1)
          throw new ForbiddenException();
        for (const assigned of task.assignees) {
          if (
            (await membership(
              db,
              tenantId,
              input.projectId,
              assigned.userId,
            )) === null
          ) {
            throw new BadRequestException(
              'Task assignees must belong to the destination project.',
            );
          }
        }
      }
      const updated = await db.projectTask.update({
        where: { tenantId_id: { tenantId, id } },
        data: {
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          dueDate: input.dueDate,
          projectId: input.projectId ?? task.projectId,
          updatedAt: new Date(),
          updatedById: userId,
        },
        include: { project: { select: { name: true } } },
      });
      return output(updated, updated.project.name, true, canManage);
    });
  }

  @Delete(':id')
  async remove(@Req() request: AuthorizedRequest, @Param('id') rawId: string) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const { canManage } = await taskAccess(db, tenantId, id, userId, roles);
      if (!canManage) throw new ForbiddenException();
      await db.projectTask.update({
        where: { tenantId_id: { tenantId, id } },
        data: { isDeleted: true, updatedAt: new Date(), updatedById: userId },
      });
      return { success: true, id };
    });
  }

  @Post(':id/assign')
  async assign(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
    @Body() body: unknown,
  ) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    if (!body || typeof body !== 'object') throw new BadRequestException();
    const input = body as Record<string, unknown>;
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const { task, canManage } = await taskAccess(
        db,
        tenantId,
        id,
        userId,
        roles,
      );
      if (!canManage) throw new ForbiddenException();
      const user =
        typeof input.userId === 'string' && /^[1-9]\d*$/.test(input.userId)
          ? await db.user.findUnique({
              where: {
                tenantId_id: { tenantId, id: positiveId(input.userId) },
              },
              select: { id: true },
            })
          : typeof input.email === 'string'
            ? await db.user.findFirst({
                where: {
                  tenantId,
                  normalizedEmail: input.email.trim().toUpperCase(),
                },
                select: { id: true },
              })
            : null;
      if (!user) throw new NotFoundException('User not found.');
      if ((await membership(db, tenantId, task.projectId, user.id)) === null)
        throw new ForbiddenException('User is not a project member.');
      await db.userTask.upsert({
        where: {
          tenantId_userId_taskId: { tenantId, userId: user.id, taskId: id },
        },
        create: {
          tenantId,
          userId: user.id,
          taskId: id,
          assignedById: userId,
          assignedAt: new Date(),
          isPrimary: false,
        },
        update: { assignedById: userId, assignedAt: new Date() },
      });
      return { message: 'User assigned.', userId: user.id, taskId: id };
    });
  }

  @Delete(':id/assign/:userId')
  async unassign(
    @Req() request: AuthorizedRequest,
    @Param('id') rawId: string,
    @Param('userId') rawUserId: string,
  ) {
    const { context, userId, roles } = requireContext(request);
    const id = positiveId(rawId);
    const memberId = positiveId(rawUserId);
    const tenantId = context.placement.tenantId;
    return this.storage.execute(context, async (db) => {
      const { canManage } = await taskAccess(db, tenantId, id, userId, roles);
      if (!canManage) throw new ForbiddenException();
      const result = await db.userTask.deleteMany({
        where: { tenantId, taskId: id, userId: memberId },
      });
      if (result.count === 0) throw new NotFoundException();
      return { message: 'User unassigned.', userId: memberId, taskId: id };
    });
  }
}
