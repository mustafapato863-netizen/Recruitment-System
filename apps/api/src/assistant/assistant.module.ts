import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { AssistantController } from './assistant.controller';
import { AssistantLlmProvider } from './assistant-llm.provider';
import { AssistantService } from './assistant.service';
import { KnowledgeIndexService } from './knowledge-index.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [AssistantController],
  providers: [KnowledgeIndexService, AssistantLlmProvider, AssistantService],
  exports: [AssistantService, KnowledgeIndexService],
})
export class AssistantModule {}
