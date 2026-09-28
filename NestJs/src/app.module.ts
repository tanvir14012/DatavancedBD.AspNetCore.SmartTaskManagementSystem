import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CatalogReader,
  TenantStorage,
} from './infrastructure/prisma/prisma.service.js';
import { TenantGuard } from './http/tenant.guard.js';
import { ProjectsController } from './http/projects.controller.js';
import { ProjectMembersController } from './http/project-members.controller.js';
import { TasksController } from './http/tasks.controller.js';
import { AuthController } from './http/auth.controller.js';
import {
  DashboardController,
  MenusController,
} from './http/read-models.controller.js';
import { UsersController } from './http/users.controller.js';
import { AiController } from './http/ai.controller.js';
import { DescriptionAiService } from './infrastructure/description-ai.js';

@Controller()
class HealthController {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly storage: TenantStorage,
  ) {}

  @Get('alive')
  alive(): string {
    return 'Healthy';
  }

  @Get(['ready', 'health'])
  async ready(): Promise<string> {
    if (
      process.env.NESTJS_CUTOVER_ENABLED !== 'true' ||
      !process.env.JWT_ISSUER ||
      !process.env.JWT_AUDIENCE ||
      !process.env.JWT_KEY ||
      Buffer.byteLength(process.env.JWT_KEY) < 32 ||
      !process.env.TENANT_REGION ||
      !process.env.ALLOWED_ORIGINS ||
      !this.storage.hasConfiguredTargets() ||
      !(await this.catalog.isReachable())
    )
      throw new ServiceUnavailableException('Backend is not ready.');
    return 'Healthy';
  }
}

@Module({
  controllers: [
    HealthController,
    ProjectsController,
    ProjectMembersController,
    TasksController,
    AuthController,
    DashboardController,
    MenusController,
    UsersController,
    AiController,
  ],
  providers: [CatalogReader, TenantStorage, TenantGuard, DescriptionAiService],
})
export class AppModule {}
