import { Module } from '@nestjs/common';
import { PipelineSettingsController } from './pipeline-settings.controller';
import { PipelineSettingsService } from './pipeline-settings.service';
import { WorkflowRulesController } from './workflow-rules.controller';
import { WorkflowRulesService } from './workflow-rules.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PipelineSettingsController, WorkflowRulesController],
  providers: [PipelineSettingsService, WorkflowRulesService],
})
export class PipelineSettingsModule {}
