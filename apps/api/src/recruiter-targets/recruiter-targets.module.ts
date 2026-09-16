import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { RecruiterTargetsController } from './recruiter-targets.controller';
import { RecruiterTargetsService } from './recruiter-targets.service';

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [RecruiterTargetsController],
  providers: [RecruiterTargetsService],
  exports: [RecruiterTargetsService],
})
export class RecruiterTargetsModule {}
