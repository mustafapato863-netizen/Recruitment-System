import { ApplicationFileController } from './application-file.controller';
import { ApplicationFileService } from './application-file.service';
import { MessageAttemptsService } from './message-attempts.service';
import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, EmailModule, EmailTemplatesModule, AccessControlModule, AuditModule, NotificationsModule],
  controllers: [ApplicationsController, ApplicationFileController],
  providers: [ApplicationsService, ApplicationFileService, MessageAttemptsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
