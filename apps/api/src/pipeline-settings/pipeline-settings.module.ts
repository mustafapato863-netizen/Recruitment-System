import { Module } from '@nestjs/common';
import { PipelineSettingsController } from './pipeline-settings.controller';
import { PipelineSettingsService } from './pipeline-settings.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PipelineSettingsController],
  providers: [PipelineSettingsService],
})
export class PipelineSettingsModule {}
