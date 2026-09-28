import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';

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

@Module({ controllers: [HealthController] })
export class AppModule {}
