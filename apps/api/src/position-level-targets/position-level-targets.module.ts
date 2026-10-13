import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PositionLevelTargetsController } from './position-level-targets.controller';
import { PositionLevelTargetsService } from './position-level-targets.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PositionLevelTargetsController],
  providers: [PositionLevelTargetsService],
})
export class PositionLevelTargetsModule {}
