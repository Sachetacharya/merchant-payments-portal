import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '../auth/role.enum.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedRequestUser } from '../common/guards/jwt-auth.guard.js';
import { SENSITIVE_FIELDS, type SensitiveField } from './application.model.js';
import { ApplicationsService } from './applications.service.js';
import { AssignDto } from './dto/assign.dto.js';
import { DecisionDto } from './dto/decision.dto.js';
import { ListQueryDto } from './dto/list-query.dto.js';
import { UpdateApplicationDto } from './dto/update-application.dto.js';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser, @Query() query: ListQueryDto) {
    return this.applicationsService.list(user, query);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.applicationsService.statusCounts(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return this.applicationsService.findOne(user, id);
  }

  @Post()
  @Roles([Role.Sales])
  create(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.applicationsService.create(user);
  }

  @Patch(':id')
  @Roles([Role.Sales])
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(user, id, dto);
  }

  @Post(':id/submit')
  @Roles([Role.Sales])
  submit(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return this.applicationsService.submit(user, id);
  }

  @Delete(':id')
  @Roles([Role.Sales])
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    this.applicationsService.delete(user, id);
  }

  @Patch(':id/assign')
  @Roles([Role.Admin])
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.applicationsService.assign(id, dto.reviewerId);
  }

  @Patch(':id/decision')
  @Roles([Role.Reviewer, Role.Admin])
  recordDecision(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.applicationsService.recordDecision(user, id, dto);
  }

  @Get(':id/reveal/:field')
  @Roles([Role.Reviewer, Role.Admin])
  reveal(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Param('field') field: string,
  ) {
    const sensitiveField = SENSITIVE_FIELDS.includes(field as SensitiveField) ? (field as SensitiveField) : null;
    if (!sensitiveField) {
      return { field, value: null };
    }
    return this.applicationsService.reveal(user, id, sensitiveField);
  }
}
