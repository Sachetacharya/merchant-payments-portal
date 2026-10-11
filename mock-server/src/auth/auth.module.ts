import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshTokenStore } from './refresh-token.store.js';
import { UsersStore } from './users.store.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UsersStore, RefreshTokenStore],
  exports: [UsersStore],
})
export class AuthModule {}
