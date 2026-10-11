import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsGateway } from './applications.gateway.js';
import { ApplicationsService } from './applications.service.js';
import { ApplicationsStore } from './applications.store.js';

@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsStore, ApplicationsGateway],
})
export class ApplicationsModule {}
