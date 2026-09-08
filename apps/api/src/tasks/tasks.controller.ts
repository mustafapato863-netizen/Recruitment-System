import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto, CreateTaskDto } from './tasks.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
import { TenantResource } from '../common/decorators/tenant-resource.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /** GET /tasks — list tasks assigned to the authenticated user */
  @Get()
  @RequirePermissions('TASK_VIEW')
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('overdueOnly') overdueOnly?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const opts: {
      status?: string;
      priority?: string;
      overdueOnly?: boolean;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {};
    if (status) opts.status = status;
    if (priority) opts.priority = priority;
    if (overdueOnly !== undefined) opts.overdueOnly = overdueOnly === 'true';
    if (search) opts.search = search;
    if (page) opts.page = parsePositiveInteger(page, 'page', 100000);
    if (pageSize) opts.pageSize = parsePositiveInteger(pageSize, 'pageSize', 100);

    return this.tasksService.list(user.organizationId, user.userId, opts);
  }

  /** GET /tasks/:id — get a single task (only assignee can view) */
  @Get(':id')
  @RequirePermissions('TASK_VIEW')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'task', param: 'id' })
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.getOne(user.organizationId, user.userId, id);
  }

  /** POST /tasks — create and assign a new task (Managers / Admins only; Recruiters are restricted) */
  @Post()
  @RequirePermissions('VACANCY_MANAGE')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.organizationId, user.userId, dto, user);
  }

  /** PATCH /tasks/:id/status — update task status (only assignee) */
  @Patch(':id/status')
  @RequirePermissions('TASK_UPDATE_STATUS')
  @UseGuards(TenantScopedGuard)
  @TenantResource({ resource: 'task', param: 'id' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(user.organizationId, user.userId, id, dto.status);
  }
}

export function parsePositiveInteger(value: string, field: string, max: number): number {
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException(`${field} must be between 1 and ${max}.`);
  }
  return parsed;
}
