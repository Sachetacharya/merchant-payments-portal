import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthenticatedRequest } from '../common/guards/jwt-auth.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { Role } from './role.enum.js';
import { UsersStore } from './users.store.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersStore: UsersStore,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() request: AuthenticatedRequest) {
    if (!request.user) {
      throw new UnauthorizedException();
    }
    this.authService.logout(request.user.sub);
  }

  @Get('reviewers')
  @Roles([Role.Admin])
  listReviewers() {
    return this.usersStore
      .listByRole(Role.Reviewer)
      .map(({ id, name, email }) => ({ id, name, email }));
  }
}
