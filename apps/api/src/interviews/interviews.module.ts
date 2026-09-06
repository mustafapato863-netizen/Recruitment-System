import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller';
import { PublicInterviewsController } from './public-interviews.controller';
import { InterviewsService } from './interviews.service';
import { SelfScheduleService } from './self-schedule.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [InterviewsController, PublicInterviewsController],
  providers: [InterviewsService, SelfScheduleService],
  exports: [InterviewsService, SelfScheduleService],
})
export class InterviewsModule {}
