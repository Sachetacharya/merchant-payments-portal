import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthenticatedRequestUser } from '../guards/jwt-auth.guard.js';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    throw new UnauthorizedException();
  }
  return request.user;
});
