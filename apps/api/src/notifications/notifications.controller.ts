import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
// DTO classes must remain runtime imports for Nest metadata reflection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './notifications.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /notifications — list notifications for the authenticated user */
  @Get()
  @RequirePermissions('NOTIFICATION_VIEW')
  list(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) {
    return this.notificationsService.list(
      user.organizationId,
      user.userId,
      query.unreadOnly,
      query.page,
      query.pageSize,
    );
  }

  /** GET /notifications/unread-count — fast badge count */
  @Get('unread-count')
  @RequirePermissions('NOTIFICATION_VIEW')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user.organizationId, user.userId).then((count) => ({ unreadCount: count }));
  }

  /** PATCH /notifications/:id/read — mark one notification read */
  @Patch(':id/read')
  @RequirePermissions('NOTIFICATION_VIEW')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.organizationId, user.userId, id);
  }

  /** POST /notifications/read-all — mark all notifications read */
  @Post('read-all')
  @RequirePermissions('NOTIFICATION_VIEW')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.organizationId, user.userId);
  }
}
