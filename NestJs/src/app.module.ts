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

@Controller()
class HealthController {
  @Get('alive')
  alive(): string {
    return 'Healthy';
  }

  @Get(['ready', 'health'])
  ready(): never {
    // A running process is not evidence that tenant storage is ready to serve traffic.
    throw new ServiceUnavailableException('Backend cutover is not enabled.');
  }
}

@Module({
  controllers: [HealthController, ProjectsController],
  providers: [CatalogReader, TenantStorage, TenantGuard],
})
export class AppModule {}
