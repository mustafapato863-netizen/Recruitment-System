import { Module } from '@nestjs/common';
import { EmailOutboxService } from './email-outbox.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [EmailOutboxService],
  exports: [EmailOutboxService],
})
export class EmailModule {}
