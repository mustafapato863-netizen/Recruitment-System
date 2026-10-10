import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { ContactKeysBootstrap } from './contact-keys.bootstrap';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [MatchingController],
  providers: [MatchingService, ContactKeysBootstrap],
  exports: [MatchingService],
})
export class MatchingModule {}
