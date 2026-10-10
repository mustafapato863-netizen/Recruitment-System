import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, CommonModule, AccessControlModule, EmailModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
