import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller';
import { MeInterviewsController } from './me-interviews.controller';
import { PublicInterviewsController } from './public-interviews.controller';
import { InterviewsService } from './interviews.service';
import { SelfScheduleService } from './self-schedule.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, AccessControlModule, DocumentsModule],
  controllers: [InterviewsController, PublicInterviewsController, MeInterviewsController],
  providers: [InterviewsService, SelfScheduleService],
  exports: [InterviewsService, SelfScheduleService],
})
export class InterviewsModule {}
