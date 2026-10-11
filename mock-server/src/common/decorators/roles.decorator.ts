import { Reflector } from '@nestjs/core';
import { Role } from '../../auth/role.enum.js';

export const Roles = Reflector.createDecorator<Role[]>();
