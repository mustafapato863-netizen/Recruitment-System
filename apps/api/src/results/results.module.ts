import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
