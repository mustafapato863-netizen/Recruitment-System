import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ManagerDecisionController } from './manager-decision.controller';
import { GradeBandsService } from './grade-bands.service';
import { OfferDecisionService } from './offer-decision.service';
import { ReassignService } from './reassign.service';

@Module({
  imports: [DatabaseModule, CommonModule, NotificationsModule],
  controllers: [ManagerDecisionController],
  providers: [GradeBandsService, OfferDecisionService, ReassignService],
})
export class ManagerDecisionModule {}
