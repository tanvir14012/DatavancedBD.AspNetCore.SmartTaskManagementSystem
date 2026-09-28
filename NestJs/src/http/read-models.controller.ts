import {
  BadRequestException,
  Controller,
  Get,
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
import { positiveId } from './projects.controller.js';

const statuses = ['Todo', 'InProgress', 'Completed', 'Cancelled'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];

@Controller('api/dashboard')
@UseGuards(TenantGuard)
export class DashboardController {
  constructor(private readonly storage: TenantStorage) {}

  @Get('summary')
  async summary(
    @Req() request: AuthorizedRequest,
    @Query('projectId') rawProjectId?: string,
  ) {
    const { context, userId, roles } = requireContext(request);
    const tenantId = context.placement.tenantId;
    const projectId =
      rawProjectId === undefined ? undefined : positiveId(rawProjectId);
    return this.storage.execute(context, async (db) => {
      const projectWhere = {
        tenantId,
        isDeleted: false,
        ...(projectId && { id: projectId }),
        ...(!roles.has('Admin') && { members: { some: { tenantId, userId } } }),
      };
      const taskWhere = {
        tenantId,
        isDeleted: false,
        ...(projectId && { projectId }),
        project: { isDeleted: false },
        ...(!roles.has('Admin') &&
          (roles.has('Project Manager')
            ? {
                project: {
                  isDeleted: false,
                  members: {
                    some: { tenantId, userId, projectRole: { in: [0, 1] } },
                  },
                },
              }
            : { assignees: { some: { tenantId, userId } } })),
      };
      const [
        totalProjects,
        totalTasks,
        completedTasks,
        statusRows,
        priorityRows,
      ] = await Promise.all([
        db.project.count({ where: projectWhere }),
        db.projectTask.count({ where: taskWhere }),
        db.projectTask.count({ where: { ...taskWhere, status: 2 } }),
        db.projectTask.groupBy({
          by: ['status'],
          where: taskWhere,
          _count: { _all: true },
        }),
        db.projectTask.groupBy({
          by: ['priority'],
          where: taskWhere,
          _count: { _all: true },
        }),
      ]);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const week = new Date(today);
      week.setUTCDate(week.getUTCDate() + 7);
      const urgent = await db.projectTask.findMany({
        where: { ...taskWhere, dueDate: { gte: today, lte: week } },
        orderBy: { dueDate: 'asc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          projectId: true,
        },
      });
      return {
        totalProjects,
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
        statusBreakdown: statusRows.map((row) => ({
          key: statuses[row.status] ?? 'Unknown',
          value: row._count._all,
        })),
        priorityBreakdown: priorityRows.map((row) => ({
          key: priorities[row.priority] ?? 'Unknown',
          value: row._count._all,
        })),
        urgentTasks: urgent.map((task) => ({
          id: task.id,
          title: task.title,
          status: statuses[task.status] ?? 'Unknown',
          priority: priorities[task.priority] ?? 'Unknown',
          dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
          projectId: task.projectId,
        })),
      };
    });
  }
}

@Controller('api/menus')
@UseGuards(TenantGuard)
export class MenusController {
  constructor(private readonly storage: TenantStorage) {}

  @Get()
  async list(@Req() request: AuthorizedRequest) {
    const { context, roles } = requireContext(request);
    return this.storage.execute(context, async (db) => {
      const rows = await db.menuItem.findMany({
        where: { tenantId: context.placement.tenantId },
        orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
      });
      const canManage = roles.has('Admin') || roles.has('Project Manager');
      const visible = rows.filter(
        (row) =>
          canManage ||
          !['/tasks/board', '/projects/new', '/projects/assign'].includes(
            row.route,
          ),
      );
      type MenuNode = {
        id: number;
        name: string;
        route: string;
        icon: string;
        displayOrder: number;
        parentId: number | null;
        type: string;
        children: MenuNode[];
      };
      const build = (parentId: number | null, depth: number): MenuNode[] => {
        if (depth > 8) throw new BadRequestException('Invalid menu hierarchy.');
        return visible
          .filter((row) => row.parentId === parentId)
          .map((row) => ({
            id: row.id,
            name: row.name,
            route: row.route,
            icon: row.icon,
            displayOrder: row.displayOrder,
            parentId: row.parentId,
            type: row.type === 1 ? 'TopBar' : 'SideBar',
            children: build(row.id, depth + 1),
          }));
      };
      return { menus: build(null, 0).filter((node) => node.type === 'TopBar') };
    });
  }
}
