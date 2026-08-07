import { Module } from '@nestjs/common';
import { TalentPoolController } from './talent-pool.controller';
import { TalentPoolService } from './talent-pool.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TalentPoolController],
  providers: [TalentPoolService],
})
export class TalentPoolModule {}
