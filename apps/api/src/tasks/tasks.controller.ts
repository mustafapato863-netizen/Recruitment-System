import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './tasks.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
    if (page) opts.page = parseInt(page, 10);
    if (pageSize) opts.pageSize = parseInt(pageSize, 10);

    return this.tasksService.list(user.organizationId, user.userId, opts);
  }

  /** GET /tasks/:id — get a single task (only assignee can view) */
  @Get(':id')
  @RequirePermissions('TASK_VIEW')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.getOne(user.organizationId, user.userId, id);
  }

  /** PATCH /tasks/:id/status — update task status (only assignee) */
  @Patch(':id/status')
  @RequirePermissions('TASK_UPDATE_STATUS')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(user.organizationId, user.userId, id, dto.status);
  }
}
